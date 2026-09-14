"""Loopback-only WebSocket service with bounded transport and atomic transactions."""
import asyncio
from collections import OrderedDict, deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import suppress
from dataclasses import dataclass, field
import hashlib
import hmac
import ipaddress
import json
import logging
from random import Random, SystemRandom
import secrets
import time
from uuid import uuid4

from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed
from deidei_core.api import new_match
from .protocol import Rejected, ack, dumps, parse, policy as load_policy, require, validate, TURN_TIMES, request_uuid
from .room import Room

LOGGER = logging.getLogger('deidei.rooms')


class Clock:
    def now_ms(self) -> int:
        return time.monotonic_ns() // 1000000

    def wall_ms(self) -> int:
        return time.time_ns() // 1000000


@dataclass
class Session:
    profile: dict
    digest: bytes
    touched: int
    id: str = field(default_factory=lambda: str(uuid4()))
    player_id: str = field(default_factory=lambda: str(uuid4()))
    room_id: str | None = None
    closed_room: str | None = None
    generation: int = 0
    connection: object = None
    disconnected_at: int | None = None
    last_membership_end: dict | None = None
    last_seq: int = 0
    cache: OrderedDict = field(default_factory=OrderedDict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class Connection:
    def __init__(self, service, ws):
        self.service, self.ws, self.id = service, ws, str(uuid4())
        self.session, self.generation = None, 0
        self.queue, self.queued_bytes = deque(), 0
        self.wake = asyncio.Event()
        self.tokens, self.rate_at, self.violations = 40., time.monotonic(), 0
        self.closing = False
        self.opened = service.clock.now_ms()

    def valid(self) -> bool:
        return (self.session is not None and self.service.sessions.get(self.session.id) is self.session
                and self.session.connection is self and self.generation == self.session.generation)

    def allowed(self, room_id: str) -> bool:
        return self.valid() and room_id in (self.session.room_id, self.session.closed_room)

    def stop(self, code: int, reason: str) -> None:
        if not self.closing:
            self.closing = True
            self.service.background(self.ws.close(code, reason))

    def put(self, value: dict) -> None:
        if self.closing:
            return
        text = dumps(value)
        size = len(text.encode('utf-8'))
        room_id = value.get('room_id') if value['type'] == 'snapshot' else None
        if value['type'] == 'membership.ended':
            room_id = ('membership.ended', self.session.id, self.generation, value['room_id'], value['event_id'])
        # ponytail: coalesce only adjacent same-room snapshots; ack order remains intact.
        if isinstance(room_id, str) and self.queue and self.queue[-1][2] == room_id:
            _, old_size, _ = self.queue.pop()
            self.queued_bytes -= old_size
        if len(self.queue) >= 32 or self.queued_bytes + size > 2 * 1024 * 1024:
            self.stop(1008, 'SLOW_CONSUMER')
            return
        self.queue.append((text, size, room_id))
        self.queued_bytes += size
        self.wake.set()

    async def writer(self) -> None:
        try:
            while True:
                await self.wake.wait()
                while self.queue:
                    text, size, room_id = self.queue.popleft()
                    self.queued_bytes -= size
                    if isinstance(room_id, tuple):
                        _, sid, generation, old_room, event_id = room_id
                        receipt = self.session.last_membership_end if self.valid() else None
                        allowed = (self.valid() and self.session.id == sid and self.generation == generation
                                   and self.session.room_id is None and receipt is not None
                                   and receipt['room_id'] == old_room and receipt['event_id'] == event_id)
                    else:
                        allowed = room_id is None or self.allowed(room_id)
                    if allowed:
                        await self.ws.send(text)
                self.wake.clear()
        except ConnectionClosed:
            pass

    def limited(self) -> bool:
        now = time.monotonic()
        self.tokens = min(40., self.tokens + (now - self.rate_at) * 20.)
        self.rate_at = now
        if self.tokens < 1:
            return True
        self.tokens -= 1
        return False


def password_hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode('utf-8'), salt=salt, n=16384, r=8, p=1, dklen=32)


class RoomServer:
    def __init__(self, policy: dict | None = None, *, clock=None, new_match_factory=None,
                 timeout_chooser=None, rng=None, host_leave_timing='after_turn'):
        if host_leave_timing not in ('after_turn', 'immediate'):
            raise ValueError('host_leave_timing must be after_turn or immediate')
        self.host_leave_timing = host_leave_timing
        self.policy = load_policy(policy)
        self.clock = clock if clock is not None else Clock()
        self.new_match_factory = new_match_factory or new_match
        self.rng = Random(rng.getrandbits(256)) if rng is not None else SystemRandom()
        self.token_rng = Random(rng.getrandbits(256)) if rng is not None else SystemRandom()
        self.timeout_chooser = timeout_chooser or (lambda state, options: self.rng.choice(options)['entry_id'])
        self.boot_id = str(uuid4())
        self.sessions, self.by_player, self.rooms, self.codes = {}, {}, {}, {}
        self.used_codes, self.dirty, self.connections = set(), set(), set()
        self.tasks = set()
        self.failures = {}
        self.pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix='room-password')
        self.password_slots = asyncio.Semaphore(2)
        self.ws_server = self.timer_task = None
        self.closed = False
        logging.getLogger('deidei.transport').disabled = True

    def background(self, awaitable) -> None:
        task = asyncio.create_task(awaitable)
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def start(self, host: str = '127.0.0.1', port: int = 8765) -> None:
        if not ipaddress.ip_address(host).is_loopback:
            raise ValueError('Only loopback listening is authorized')
        def request(connection, request):
            if request.path != '/rooms-v1':
                return connection.respond(404, 'NOT_FOUND\n')
            if len(self.connections) >= 1024:
                return connection.respond(503, 'SERVER_BUSY\n')
        self.ws_server = await serve(self.handler, host, port, subprotocols=['deidei.rooms.v1'],
            origins=[None], process_request=request, compression=None, max_size=16384, max_queue=16,
            ping_interval=5, ping_timeout=10, open_timeout=5, close_timeout=3,
            logger=logging.getLogger('deidei.transport'))
        actual_port = self.ws_server.sockets[0].getsockname()[1]
        self.url = f'ws://[{host}]:{actual_port}/rooms-v1' if ':' in host else f'ws://{host}:{actual_port}/rooms-v1'
        self.timer_task = asyncio.create_task(self.timer())

    async def timer(self) -> None:
        while True:
            self.tick()
            self.flush()
            await asyncio.sleep(.01)

    def tick(self) -> None:
        now = self.clock.now_ms()
        # ponytail: one synchronous event-loop transaction, O(64 rooms); shard only if this limit grows.
        for room in list(self.rooms.values()):
            if room.phase == 'closed':
                if now >= room.closed_at + 60000:
                    self.rooms.pop(room.id)
                    self.codes.pop(room.code, None)
                continue
            try:
                room.tick(now)
            except Exception:
                LOGGER.error('room=%s event=terminate code=INTERNAL_ERROR', room.id)
                room.close('INTERNAL_ERROR', now)
        for s in list(self.sessions.values()):
            if s.room_id is None and s.closed_room not in self.rooms and now >= s.touched + 600000:
                if s.connection:
                    s.connection.stop(1008, 'SESSION_EXPIRED')
                self.sessions.pop(s.id)
                self.by_player.pop(s.player_id)
        for ip, times in list(self.failures.items()):
            while times and times[0] <= now - 60000:
                times.popleft()
            if not times:
                self.failures.pop(ip)

    def snapshot(self, c: Connection, room: Room) -> None:
        if not c.allowed(room.id) or c.session.player_id not in room.members:
            return
        value = room.snapshot(c.session, self.clock.now_ms())
        if len(dumps(value).encode('utf-8')) > 1024 * 1024:
            room.close('ROOM_STATE_TOO_LARGE', self.clock.now_ms())
            # Drop oversized public history only on this explicit terminal error.
            room.state, room.last_turn, room.outcome = None, None, None
            value = room.snapshot(c.session, self.clock.now_ms())
        c.put(value)

    def membership_end(self, c: Connection) -> None:
        if c.valid() and c.session.room_id is None and c.session.last_membership_end is not None:
            c.put(c.session.last_membership_end)

    def current_snapshot(self, c: Connection) -> None:
        if c.valid():
            room = self.rooms.get(c.session.room_id or c.session.closed_room)
            if room:
                self.snapshot(c, room)

    def flush(self) -> None:
        dirty, self.dirty = self.dirty, set()
        for room_id in dirty:
            room = self.rooms.get(room_id)
            if room:
                for pid in list(room.members):
                    session = self.by_player.get(pid)
                    if session and session.connection:
                        self.snapshot(session.connection, room)

    def bind(self, c: Connection, s: Session) -> None:
        old = s.connection
        s.generation += 1
        s.connection, c.session, c.generation = c, s, s.generation
        if old and old is not c:
            old.stop(1008, 'SESSION_REPLACED')
        if s.room_id in self.rooms:
            self.rooms[s.room_id].resumed(s, self.clock.now_ms())
        s.disconnected_at = None
        s.touched = self.clock.now_ms()

    def authenticate(self, c: Connection, msg: dict) -> dict:
        require(c.session is None, 'ALREADY_AUTHENTICATED')
        p = msg['payload']
        if msg['op'] == 'session.open':
            require(len(self.sessions) < 4096, 'SERVER_BUSY')
            token = secrets.token_urlsafe(32)
            s = Session(dict(p['profile']), hashlib.sha256(token.encode()).digest(), self.clock.now_ms())
            self.sessions[s.id], self.by_player[s.player_id] = s, s
            self.bind(c, s)
            return dict(session_id=s.id, player_id=s.player_id, resume_token=token,
                        boot_id=self.boot_id, last_command_seq='0')
        s = self.sessions.get(p['session_id'])
        digest = hashlib.sha256(p['resume_token'].encode()).digest()
        require(hmac.compare_digest(digest, s.digest if s else bytes(32)) and s is not None, 'SESSION_EXPIRED')
        self.bind(c, s)
        return dict(session_id=s.id, player_id=s.player_id, boot_id=self.boot_id, last_command_seq=str(s.last_seq))

    async def check_password(self, c: Connection, msg: dict):
        p, op = msg['payload'], msg['op']
        if op not in ('room.create', 'room.join'):
            return None
        require(c.session.room_id is None, 'ALREADY_IN_ROOM')
        room = self.rooms.get(self.codes.get(p.get('room_code')))
        ip = c.ws.remote_address[0]
        if op == 'room.join':
            require(len(self.failures.get(ip, ())) < 10, 'RATE_LIMITED')
        credentials = None
        if op == 'room.create' and p['password'] is not None:
            credentials = (secrets.token_bytes(16), None)
        elif room and room.password:
            credentials = room.password
        if credentials and p['password'] is not None:
            async with self.password_slots:
                hashed = await asyncio.get_running_loop().run_in_executor(self.pool, password_hash, p['password'], credentials[0])
            if op == 'room.create':
                return credentials[0], hashed
            valid = hmac.compare_digest(hashed, credentials[1])
        else:
            valid = room is not None and room.password is None and p['password'] is None
        if op == 'room.join':
            require(len(self.failures.get(ip, ())) < 10, 'RATE_LIMITED')
            if not valid or room.phase == 'closed':
                self.failures.setdefault(ip, deque()).append(self.clock.now_ms())
                raise Rejected('ROOM_ACCESS_DENIED')
            return room.id
        return None

    def apply(self, c: Connection, msg: dict, checked) -> dict:
        s, p, op, now = c.session, msg['payload'], msg['op'], self.clock.now_ms()
        if op in ('room.create', 'room.join'):
            require(s.room_id is None, 'ALREADY_IN_ROOM')
            if op == 'room.create':
                require(sum(r.phase != 'closed' for r in self.rooms.values()) < 64, 'SERVER_BUSY')
                require(p['options']['spectator_cap'] <= self.policy['spectator_cap'], 'INVALID_MESSAGE', 'spectator_cap')
                alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
                code = ''.join(secrets.choice(alphabet) for _ in range(8))
                while code in self.used_codes:
                    code = ''.join(secrets.choice(alphabet) for _ in range(8))
                room = Room(self, s, code, self.policy | p['options'], checked)
                self.rooms[room.id], self.codes[code] = room, room.id
                self.used_codes.add(code)
                return dict(room_id=room.id, room_code=code)
            room = self.rooms.get(checked)
            require(room is not None and room.phase != 'closed', 'ROOM_ACCESS_DENIED')
            room.add(s, p['role'])
            return dict(room_id=room.id, room_code=room.code, role=p['role'])
        room = self.rooms.get(p['room_id'])
        if s.closed_room == p['room_id']:
            require(room is not None, 'ROOM_GONE')
            require(op == 'room.sync', 'ROOM_GONE')
            return dict(room_id=room.id)
        require(s.room_id == p['room_id'], 'ROOM_NOT_MEMBER')
        require(room is not None, 'ROOM_GONE')
        room.last_activity = now
        return room.command(s, op, p, now)

    async def command(self, c: Connection, msg: dict) -> None:
        validate(msg)
        self.tick()
        if msg['op'].startswith('session.'):
            data = self.authenticate(c, msg)
            c.put(ack(msg['request_id'], data))
            self.membership_end(c)
            self.current_snapshot(c)
            self.flush()
            return
        require(c.session is not None, 'UNAUTHENTICATED')
        s = c.session
        async with s.lock:
            self.tick()
            require(c.valid(), 'SESSION_REPLACED')
            request_id = msg['request_id']
            # Sort all levels; JSON object order isn't command identity.
            fingerprint = hashlib.sha256(json.dumps(
                [msg['command_seq'], msg['op'], msg['payload']], sort_keys=True,
                separators=(',', ':')).encode('utf-8')).digest()
            if request_id in s.cache:
                original, result = s.cache[request_id]
                require(original == fingerprint, 'REQUEST_CONFLICT')
                c.put(result)
                self.current_snapshot(c)
                self.flush()
                return
            require(int(msg['command_seq']) > s.last_seq, 'STALE_COMMAND')
            s.last_seq, s.touched = int(msg['command_seq']), self.clock.now_ms()
            try:
                checked = await self.check_password(c, msg)
                self.tick()
                require(c.valid(), 'SESSION_REPLACED')
                data = self.apply(c, msg, checked)
                result = ack(request_id, data)
            except Rejected as exc:
                if exc.code == 'INTERNAL_ERROR' and s.room_id in self.rooms:
                    self.rooms[s.room_id].close('INTERNAL_ERROR', self.clock.now_ms())
                result = ack(request_id, error=exc)
            except Exception:
                room = self.rooms.get(s.room_id)
                if room:
                    room.close('INTERNAL_ERROR', self.clock.now_ms())
                LOGGER.error('event=command code=INTERNAL_ERROR')
                result = ack(request_id, error=Rejected('INTERNAL_ERROR'))
            s.cache[request_id] = (fingerprint, result)
            if len(s.cache) > 128:
                s.cache.popitem(last=False)
            c.put(result)
            # Due work and this command are fully applied before the current view is generated.
            if result['ok']:
                self.tick()
                if msg['op'] != 'room.set_turn_limit':
                    self.current_snapshot(c)
            self.flush()

    async def handler(self, ws) -> None:
        if len(self.connections) >= 1024:
            await ws.close(1008, 'SERVER_BUSY')
            return
        c = Connection(self, ws)
        self.connections.add(c)
        writer = asyncio.create_task(c.writer())
        c.put(dict(v=1, type='hello', boot_id=self.boot_id, connection_id=c.id,
            protocol='rooms-1.1', rules_version='classic-1.0.1', server_time_ms=self.clock.wall_ms(),
            policy_defaults=dict(self.policy), capabilities=dict(max_players=6, allowed_turn_ms=TURN_TIMES,
                                                                spectator_max=self.policy['spectator_cap'])))
        auth_deadline = time.monotonic() + 5
        try:
            while True:
                try:
                    if c.session is None:
                        raw = await asyncio.wait_for(ws.recv(), max(0, auth_deadline - time.monotonic()))
                    else:
                        raw = await ws.recv()
                except asyncio.TimeoutError:
                    await ws.close(1008, 'UNAUTHENTICATED')
                    break
                request_id = None
                try:
                    if c.limited():
                        raise Rejected('RATE_LIMITED')
                    msg = parse(raw)
                    if isinstance(msg, dict) and request_uuid(msg.get('request_id')):
                        request_id = msg['request_id']
                    await self.command(c, msg)
                except (Rejected, UnicodeError) as exc:
                    error = exc if isinstance(exc, Rejected) else Rejected('INVALID_MESSAGE')
                    if request_id is None and error.code != 'RATE_LIMITED':
                        error = Rejected('INVALID_MESSAGE')
                    c.put(ack(request_id, error=error))
                    self.flush()
                    c.violations += 1
                    if c.violations >= 5:
                        c.stop(1008, 'INVALID_MESSAGE')
                        break
        except ConnectionClosed:
            pass
        finally:
            self.tick()
            if c.valid():
                s = c.session
                s.connection, s.disconnected_at = None, self.clock.now_ms()
                room = self.rooms.get(s.room_id)
                if room:
                    room.disconnected(s, s.disconnected_at)
                self.flush()
            self.connections.discard(c)
            writer.cancel()
            with suppress(asyncio.CancelledError):
                await writer

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        if self.timer_task:
            self.timer_task.cancel()
            with suppress(asyncio.CancelledError):
                await self.timer_task
        if self.ws_server:
            self.ws_server.close()
            await self.ws_server.wait_closed()
        if self.tasks:
            await asyncio.gather(*list(self.tasks), return_exceptions=True)
        self.pool.shutdown(wait=True, cancel_futures=True)
