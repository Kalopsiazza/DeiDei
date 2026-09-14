"""Pinned real sockets -> pinned desktop decoder, with no product source changes."""
from __future__ import annotations

import argparse
import asyncio
from contextlib import AsyncExitStack
from copy import deepcopy
import json
from pathlib import Path
import hashlib
from random import Random
import subprocess
import sys
from uuid import NAMESPACE_URL, uuid5

if __package__:
    from .run_acceptance import ManualClock, evidence, load_module
else:
    from run_acceptance import ManualClock, evidence, load_module

HERE = Path(__file__).resolve().parent


def decode(rows: list[dict], desktop: Path) -> dict:
    result = subprocess.run(['node', str(HERE / 'decode_frames.cjs'),
                             str((desktop / 'online/wire.cjs').resolve())],
                            input=json.dumps(rows), capture_output=True, text=True, timeout=30)
    if result.returncode not in (0, 1):
        raise RuntimeError('desktop decoder process failed')
    try:
        output = json.loads(result.stdout)
    except ValueError:
        raise RuntimeError('desktop decoder did not return a report') from None
    return {'exit_code': result.returncode, **output}


class SocketProbe:
    """Collects transport frames, not a server model or a producer of correct answers."""
    def __init__(self, server: object, connect: object) -> None:
        self.server, self.connect = server, connect
        self.stack = AsyncExitStack()
        self.sockets, self.sessions, self.seq = {}, {}, {}
        self.frames, self.messages = {}, []
        self.policy = None

    async def open(self, alias: str, nickname: str | None = None) -> dict:
        ws = await self.stack.enter_async_context(self.connect(self.server.url,
            subprotocols=['deidei.rooms.v1'], compression=None, proxy=None, close_timeout=1))
        self.sockets[alias] = ws
        self.frames[alias] = []
        hello = json.loads(await asyncio.wait_for(ws.recv(), 3))
        self.policy = hello['policy_defaults']
        self.messages.append({'actor': alias, 'frame': hello})
        ack = await self.command(alias, 'session.open', {'profile': {'nickname': nickname or alias, 'avatar_id': 'leaf'}})
        if ack['ok']:
            self.sessions[alias] = ack['data']
        return ack

    async def command(self, alias: str, op: str, payload: dict) -> dict:
        self.seq[alias] = self.seq.get(alias, 0) + 1
        rid = str(uuid5(NAMESPACE_URL, f'crosscheck:{alias}:{self.seq[alias]}'))
        message = dict(v=1, type='command', request_id=rid, command_seq=None if op.startswith('session.') else str(self.seq[alias]), op=op, payload=payload)
        self.messages.append({'actor': alias, 'sent': {'op': op, 'request_id': rid, 'command_seq': message['command_seq']}})
        await self.sockets[alias].send(json.dumps(message))
        while True:
            frame = await self.receive(alias)
            if frame.get('type') == 'ack' and frame.get('request_id') == rid:
                return frame

    async def receive(self, alias: str) -> dict:
        frame = json.loads(await asyncio.wait_for(self.sockets[alias].recv(), 3))
        self.frames[alias].append(frame)
        safe = deepcopy(frame)
        if safe.get('type') == 'ack' and 'resume_token' in safe.get('data', {}):
            safe['data']['resume_token'] = '[REDACTED]'
        if safe.get('type') == 'snapshot' and safe['view']['phase'] in {'selecting', 'paused'}:
            if safe['view']['self']['accepted_entry_id'] is not None:
                safe['view']['self']['accepted_entry_id'] = '[REDACTED_UNREVEALED]'
        self.messages.append({'actor': alias, 'frame': safe})
        return frame

    async def drain(self, alias: str) -> None:
        await self.server.drain()
        while True:
            try:
                await asyncio.wait_for(self.receive(alias), 0.04)
            except TimeoutError:
                break

    def latest(self, alias: str) -> dict:
        return next(f for f in reversed(self.frames[alias]) if f['type'] == 'snapshot')

    async def sync(self, alias: str, room_id: str) -> dict:
        ack = await self.command(alias, 'room.sync', {'room_id': room_id})
        if not ack['ok']:
            raise ValueError('sync rejected')
        await self.drain(alias)
        return self.latest(alias)

    async def submit(self, alias: str, room_id: str, match: dict, entry: str = 'Charge') -> None:
        ack = await self.command(alias, 'room.submit', dict(room_id=room_id,
            match_id=match['match_id'], turn_id=match['turn_id'], entry_id=entry))
        if not ack['ok']:
            raise ValueError('submit rejected')


async def scenario(name: str, service: object, connect: object, desktop: Path) -> dict:
    clock = ManualClock()
    async with service.create_test_server(clock=clock, timeout_chooser=lambda state, options: 'Charge', rng=Random(73)) as server:
        probe = SocketProbe(server, connect)
        try:
            for alias in ('A', 'B'):
                opened = await probe.open(alias, {'nickname_spaces': '   ', 'nickname_format': '\u200b',
                    'nickname_chinese': '测试成员', 'nickname_emoji': '😀'}[name] if alias == 'B' and name.startswith('nickname_') else None)
                if not opened['ok']:
                    return dict(name=name, status='PROFILE_REJECTED', error=opened['error'], messages=probe.messages,
                                expected_1_1='REJECT' if name in {'nickname_spaces', 'nickname_format'} else 'ACCEPT')
            created = await probe.command('A', 'room.create', {'password': None, 'options': {key: probe.policy[key] for key in ('turn_ms', 'early_reveal', 'spectator_cap')}})
            if not created['ok']: raise ValueError('create rejected')
            room = created['data']
            joined = await probe.command('B', 'room.join', {'room_code': room['room_code'], 'password': None, 'role': 'player'})
            if not joined['ok']: raise ValueError('join rejected')
            lobby = await probe.sync('A', room['room_id'])
            frames = [{'frame': lobby}]
            if not name.startswith('nickname_') and name != 'lobby':
                for alias in ('A', 'B'):
                    ack = await probe.command(alias, 'room.ready', {'room_id': room['room_id'], 'ready': True})
                    if not ack['ok']: raise ValueError('ready rejected')
                ack = await probe.command('A', 'room.start', {'room_id': room['room_id']})
                if not ack['ok']: raise ValueError('start rejected')
                selecting = await probe.sync('A', room['room_id'])
                frames.append({'frame': selecting})
                match = selecting['view']['match']
                if name == 'timeout_forfeit':
                    for turn in range(3):
                        await probe.submit('A', room['room_id'], match)
                        await server.advance_ms(probe.policy['turn_ms'])
                        latest = await probe.sync('A', room['room_id'])
                        if turn < 2:
                            await server.advance_ms(1500)
                            match = (await probe.sync('A', room['room_id']))['view']['match']
                    await probe.drain('B')
                    ended = [f for f in probe.frames['B'] if f['type'] == 'membership.ended']
                else:
                    if name in {'ordinary_win', 'nobody_survives', 'forfeit_nobody'}:
                        await probe.submit('A', room['room_id'], match)
                        await probe.submit('B', room['room_id'], match)
                        await server.advance_ms(300); await server.advance_ms(1500)
                        match = (await probe.sync('A', room['room_id']))['view']['match']
                    a_entry = 'Bi' if name == 'ordinary_win' else 'SelfBi' if name == 'nobody_survives' else 'Charge'
                    b_entry = 'SelfBi' if name == 'nobody_survives' else 'Bi' if name == 'forfeit_nobody' else 'Charge'
                    await probe.submit('A', room['room_id'], match, a_entry)
                    await probe.submit('B', room['room_id'], match, b_entry)
                    if name in {'voluntary_forfeit', 'forfeit_nobody'}:
                        await probe.command('B', 'room.leave', {'room_id': room['room_id']})
                    await server.advance_ms(300)
                    latest = await probe.sync('A', room['room_id'])
                    ended = []
                frames.append({'frame': latest})
                last = latest['view']['match']['last_turn']
                kind = {'ordinary_reveal': 'continue_game', 'ordinary_win': 'sole_survivor',
                        'voluntary_forfeit': 'sole_survivor', 'timeout_forfeit': 'sole_survivor',
                        'nobody_survives': 'nobody_survives', 'forfeit_nobody': 'nobody_survives'}[name]
                if last['effective_transition']['kind'] != kind:
                    raise ValueError('authored outcome mismatch')
            else:
                last, ended = None, []
            decoded = decode(frames, desktop)
            return dict(name=name, status='OBSERVED', decoder=decoded,
                        expected_1_1='REJECT' if name in {'nickname_spaces', 'nickname_format'} else 'ACCEPT',
                        transition=last['effective_transition'] if last else None,
                        effective_game_id=last['effective_state']['game_id'] if last else None,
                        membership_events=len(ended), frames=frames, messages=probe.messages)
        finally:
            await probe.stack.aclose()


async def run(args: argparse.Namespace) -> tuple[dict, int]:
    sources = {label: evidence(directory) for label, directory in [('service', args.server_path), ('core', args.core_path), ('desktop', args.desktop_path)]}
    for label, wanted in [('service', args.server_sha), ('core', args.server_sha), ('desktop', args.desktop_sha)]:
        if sources[label]['sha'] != wanted or sources[label]['dirty']:
            raise ValueError('candidate SHA/path is not clean and exact')
    load_module(args.core_path, 'deidei_core.api', 'deidei_core/api.py')
    service = load_module(args.server_path, 'deidei_server.testing', 'deidei_server/testing.py')
    import websockets
    if websockets.__version__ != '17.0.1': raise ValueError('wrong websockets version')
    from websockets.asyncio.client import connect
    records = []
    for name in ('lobby', 'ordinary_reveal', 'ordinary_win', 'voluntary_forfeit',
                 'timeout_forfeit', 'nobody_survives', 'forfeit_nobody',
                 'nickname_spaces', 'nickname_format', 'nickname_chinese', 'nickname_emoji'):
        try:
            records.append(await scenario(name, service, connect, args.desktop_path))
        except Exception as error:
            records.append(dict(name=name, status='ERROR', reason=type(error).__name__))
    failed = False
    for record in records:
        if record['status'] == 'ERROR': failed = True; continue
        if record['expected_1_1'] == 'REJECT':
            good = record['status'] == 'PROFILE_REJECTED' and record['error'] == {'code': 'INVALID_MESSAGE', 'field': 'nickname', 'retryable': False}
        else:
            good = record['status'] == 'OBSERVED' and record['decoder']['exit_code'] == 0
            if record.get('transition'):
                good &= record['transition']['to_game_id'] == record['effective_game_id']
            if record['name'] == 'timeout_forfeit': good &= record['membership_events'] == 1
        record['meets_1_1_expectation'] = bool(good)
        failed |= not good
    # Confirm execution did not change either candidate source tree.
    unchanged = all(evidence(path) == sources[label] for label, path in [('service', args.server_path), ('core', args.core_path), ('desktop', args.desktop_path)])
    report = dict(scope='LIVE loopback sockets + exact Node readMessage; no Electron window',
        sources=sources, input_tests_sha=args.tests_sha, driver=evidence(HERE),
        driver_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        decoder_bridge_sha256=hashlib.sha256((HERE / 'decode_frames.cjs').read_bytes()).hexdigest(),
        source_unchanged=unchanged,
        status='FAIL' if failed or not unchanged else 'PASS', records=records)
    return report, 1 if failed or not unchanged else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('server-path', 'core-path', 'desktop-path'):
        parser.add_argument('--' + name, required=True, type=Path)
    for name in ('server-sha', 'desktop-sha', 'tests-sha'):
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    report, code = asyncio.run(run(args))
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'records'}, ensure_ascii=False))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
