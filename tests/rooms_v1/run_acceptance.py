"""Execute room samples through A08 on real loopback sockets; fail closed."""
from __future__ import annotations

import argparse
import asyncio
from contextlib import AsyncExitStack
from copy import deepcopy
import hashlib
import importlib
import json
from pathlib import Path
import random
import subprocess
import sys
from typing import Any
from urllib.parse import urlsplit

if __package__:
    from .validate import *
else:
    from validate import *


class ManualClock:
    def __init__(self) -> None:
        self.value = 0

    def now_ms(self) -> int:
        return self.value

    def wall_ms(self) -> int:
        return 1800000000000 + self.value

    def advance_ms(self, ms: int) -> None:
        integer(ms)
        self.value += ms


def load_module(directory: Path, name: str, file: str) -> Any:
    target = (directory / file).resolve()
    if not target.is_file():
        raise FileNotFoundError(file)
    sys.path.insert(0, str(directory.resolve()))
    importlib.invalidate_caches()
    module = importlib.import_module(name)
    need(Path(module.__file__).resolve() == target, 'import path differs from explicit candidate')
    for key, loaded in sys.modules.copy().items():
        if key == name.split('.')[0] or key.startswith(name.split('.')[0] + '.'):
            location = getattr(loaded, '__file__', None)
            need(location and Path(location).resolve().is_relative_to(directory.resolve()), 'mixed candidate modules')
    return module


def evidence(directory: Path) -> dict:
    proc = subprocess.run(['git', '-C', str(directory), 'rev-parse', 'HEAD'], capture_output=True, text=True)
    files = sorted(p for p in directory.rglob('*.py') if '__pycache__' not in p.parts)
    digest = hashlib.sha256()
    for path in files:
        digest.update(str(path.relative_to(directory)).encode())
        digest.update(path.read_bytes())
    dirty = subprocess.run(['git', '-C', str(directory), 'status', '--porcelain', '--', '.'], capture_output=True, text=True)
    return dict(sha=proc.stdout.strip() if proc.returncode == 0 else None,
                source_sha256=digest.hexdigest(), dirty=bool(dirty.stdout.strip()))


class Peer:
    def __init__(self, owner: 'Scenario', alias: str, ws: Any) -> None:
        self.owner, self.alias, self.ws = owner, alias, ws
        self.frames: list[dict] = []
        self.pending: dict[str, tuple[dict, dict, asyncio.Future]] = {}
        self.latest: dict | None = None
        self.room_id: str | None = None
        self.previous_seq: dict[str, int] = {}
        self.fault: Exception | None = None
        self.closed = False
        self.raw_error: str | None = None
        self.task = asyncio.create_task(self.receive())

    async def receive(self) -> None:
        try:
            async for raw in self.ws:
                need(type(raw) is str, 'binary server frame')
                frame = strict_json(raw)
                self.frames.append(frame)
                if frame.get('type') == 'ack':
                    rid = frame['request_id']
                    if rid not in self.pending and self.raw_error:
                        check_ack(frame, {'request_id': rid}, {'ok': False, 'error': {'code': self.raw_error}})
                        continue
                    need(rid in self.pending, 'unsolicited ack')
                    command, expected, future = self.pending.pop(rid)
                    check_ack(frame, command, expected)
                    if frame['ok']:
                        data = frame['data']
                        op = command['op']
                        if op == 'session.resume':
                            prior = self.owner.env[self.alias]
                            need(all(data[k] == prior[k] for k in ('session_id', 'player_id', 'boot_id')), 'resume changed session identity')
                        if op in {'session.open', 'session.resume'}:
                            self.owner.env.setdefault(self.alias, {}).update(data)
                        elif op in {'room.create', 'room.join'}:
                            # Replayed creates cannot silently rejoin after explicit leave.
                            if rid not in self.owner.completed:
                                self.room_id = data['room_id']
                        elif op == 'room.leave':
                            self.room_id = None
                    self.owner.completed.add(rid)
                    if not future.done():
                        future.set_result(frame)
                elif frame.get('type') == 'snapshot':
                    need(self.room_id is not None, 'snapshot delivered after membership revoked')
                    check_snapshot(frame, self.owner.env[self.alias]['player_id'], self.room_id, self.owner.case['policy'])
                    seq = int(frame['seq'])
                    need(seq >= self.previous_seq.get(self.room_id, 0), 'snapshot seq went backwards')
                    self.previous_seq[self.room_id] = seq
                    self.latest = frame
                    self.owner.check_public_consistency(frame)
                    if frame['view']['phase'] == 'closed':
                        self.room_id = None
                else:
                    raise ValueError('unexpected server message after hello')
        except Exception as error:
            # WebSocket close is observable separately; protocol assertion failures are fatal.
            if not type(error).__module__.startswith('websockets.exceptions'):
                self.fault = error
            self.closed = True
        finally:
            self.closed = True

    async def command(self, message: dict, expected: dict) -> dict:
        future = asyncio.get_running_loop().create_future()
        self.pending[message['request_id']] = (message, expected, future)
        await self.ws.send(json.dumps(message, ensure_ascii=False))
        try:
            return await asyncio.wait_for(future, 3)
        except TimeoutError:
            raise ValueError('missing ack or invalid response') from None


class Scenario:
    def __init__(self, case: dict, api: Any, connect: Any, shared: dict) -> None:
        self.case, self.api, self.connect, self.shared = case, api, connect, shared
        self.env: dict[str, Any] = {}
        self.peers: dict[str, Peer] = {}
        self.history: dict[str, tuple[str, dict, dict]] = {}
        self.saved: dict[str, Any] = {}
        self.completed: set[str] = set()
        self.seq: dict[str, int] = {}
        self.public: dict[tuple[str, str], dict] = {}
        self.retired: list[Peer] = []
        self.factory_calls = 0
        self.chooser_calls = 0
        self.server = None
        self.stack = AsyncExitStack()

    def expand(self, obj: Any) -> Any:
        if isinstance(obj, str) and obj.startswith('$'):
            return deepcopy(at(self.env, obj[1:]))
        if isinstance(obj, dict):
            return {k: self.expand(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self.expand(v) for v in obj]
        return obj

    def normalize(self, obj: Any) -> Any:
        mapping = {}
        for name, data in self.env.items():
            if isinstance(data, dict) and 'player_id' in data:
                mapping[data['player_id']] = name
        for frame in [p.latest for p in self.peers.values() if p.latest]:
            mapping[frame['room_id']] = 'room'
            if frame['view']['match']:
                mapping[frame['view']['match']['match_id']] = 'match'
        def walk(value: Any) -> Any:
            if isinstance(value, str):
                for old, new in sorted(mapping.items(), key=lambda pair: -len(pair[0])):
                    if value == old or value.startswith(old + ':'):
                        return new + value[len(old):]
                return value
            if isinstance(value, dict):
                return {walk(k): walk(v) for k, v in value.items()}
            if isinstance(value, list):
                return [walk(v) for v in value]
            return value
        return walk(obj)

    def view(self, frame: dict) -> dict:
        view = self.normalize(frame['view'])
        view['members'] = {m['player_id']: m for m in view['members']}
        def sort_ids(obj: Any) -> None:
            if isinstance(obj, dict):
                for key, value in obj.items():
                    if key in {'active_ids', 'roster'} and isinstance(value, list):
                        value.sort()
                    sort_ids(value)
            elif isinstance(obj, list):
                for item in obj:
                    sort_ids(item)
        sort_ids(view)
        return view

    def check_public_consistency(self, frame: dict) -> None:
        key = (frame['room_id'], frame['seq'])
        public = public_view(frame)
        # Sync can re-send the same seq with a fresher countdown.
        public['timer'].pop('remaining_ms')
        if key in self.public:
            need(self.public[key] == public, 'different public state for the same room seq')
        self.public[key] = public

    def factory(self, player_ids: list[str], match_id: str) -> dict:
        state = self.api.new_match(player_ids, match_id)
        self.factory_calls += 1
        if self.factory_calls > 1:
            return state
        initial = self.case['initial']
        if 'state' in initial:
            aliases = {alias: data['player_id'] for alias, data in self.env.items()
                       if isinstance(data, dict) and 'player_id' in data}
            def replace(obj: Any) -> Any:
                if isinstance(obj, str):
                    if obj in aliases:
                        return aliases[obj]
                    return obj.replace('fixture', match_id)
                if isinstance(obj, dict):
                    return {replace(k): replace(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [replace(v) for v in obj]
                return obj
            state = replace(initial['state'])
            state['roster'].sort()
            state['active_ids'].sort()
        for alias, patch in initial.get('players', {}).items():
            state['players'][self.env[alias]['player_id']].update(deepcopy(patch))
        validate_state(state, 'injected initial state')
        return state

    def chooser(self, public_state: dict, legal_options: list) -> str:
        self.chooser_calls += 1
        no_secrets(public_state)
        validate_state(public_state, 'chooser public start state')
        entry = self.case['initial'].get('timeout_entry', 'Charge')
        entries = [v['entry_id'] if isinstance(v, dict) else v for v in legal_options]
        need(entry in entries, 'authored timeout choice not legal')
        return entry

    async def flush(self) -> None:
        await self.server.drain()
        # Transport settling only: this doesn't advance ManualClock or replace a deadline.
        await asyncio.sleep(0.03)
        for peer in self.peers.values():
            if peer.fault:
                raise peer.fault

    async def open(self, alias: str, *, resume: bool = False, token: str | None = None,
                   error: str | None = None) -> None:
        ws = await self.stack.enter_async_context(self.connect(
            self.server.url, subprotocols=['deidei.rooms.v1'], compression=None,
            max_size=1048576, open_timeout=3, close_timeout=1, proxy=None))
        check_hello(strict_json(await asyncio.wait_for(ws.recv(), 3)))
        old = self.peers.get(alias)
        peer = Peer(self, alias, ws)
        if resume and old:
            peer.room_id = old.room_id
        if old:
            self.retired.append(old)
        self.peers[alias] = peer
        if resume:
            payload = dict(session_id=self.env[alias]['session_id'],
                           resume_token=token or self.env[alias]['resume_token'])
            op = 'session.resume'
        else:
            payload = dict(profile=self.case['people'][alias])
            op = 'session.open'
        message = dict(v=1, type='command', request_id=f'{alias}-auth-{len(self.completed)}',
                       command_seq=None, op=op, payload=payload)
        expected = {'ok': False, 'error': {'code': error}} if error else {'ok': True}
        await peer.command(message, expected)
        await self.flush()

    async def send(self, step: dict) -> dict:
        alias = step['as']
        message = self.expand(step['message'])
        self.seq[alias] = self.seq.get(alias, 0) + 1
        if message['command_seq'] == '@next':
            message['command_seq'] = str(self.seq[alias])
        ack = await self.peers[alias].command(message, self.expand(step['ack']))
        self.history[message['request_id']] = (alias, deepcopy(message), deepcopy(step['ack']))
        if step.get('save') and ack['ok']:
            self.env[step['save']] = deepcopy(ack['data'])
        return ack

    async def execute(self, step: dict) -> None:
        action = step['do']
        if action == 'connect':
            await self.open(step['as'])
        elif action == 'command':
            await self.send(step)
        elif action == 'parallel':
            results = await asyncio.gather(*(self.send(s) for s in step['commands']))
            need(sum(r['ok'] for r in results) == step['successes'], 'concurrent capacity result')
        elif action == 'advance':
            if self.case['clock'] == 'real':
                await asyncio.sleep(step['ms'] / 1000)
            else:
                await self.server.advance_ms(step['ms'])
        elif action == 'view':
            await self.flush()
            peer = self.peers[step['as']]
            need(peer.latest is not None, 'missing snapshot')
            expect_paths(self.view(peer.latest), step['expect'])
            if peer.latest['view']['match']:
                self.env['match'] = peer.latest['view']['match']
            if 'save' in step:
                self.saved[step['save']] = deepcopy(self.view(peer.latest))
        elif action == 'disconnect':
            await self.peers[step['as']].ws.close()
        elif action == 'resume':
            await self.open(step['as'], resume=True, token=step.get('token'), error=step.get('error'))
        elif action == 'replay':
            alias, message, expected = deepcopy(self.history[step['request_id']])
            if 'payload_patch' in step:
                message['payload'].update(self.expand(step['payload_patch']))
                expected = dict(ok=False, error=dict(code='REQUEST_CONFLICT'))
            if 'fresh' in step:
                self.seq[alias] += 1
                message.update(command_seq=str(self.seq[alias]), request_id=step['fresh'])
            expected = step.get('ack', expected)
            await self.peers[alias].command(message, expected)
        elif action == 'remember':
            self.saved[step['name']] = deepcopy(at(self.view(self.peers[step['as']].latest), step['path']))
        elif action == 'compare':
            actual = at(self.view(self.peers[step['as']].latest), step['path'])
            saved = self.saved[step['name']]
            need((actual == saved) == step.get('equal', True), 'saved state/turn comparison')
        elif action == 'core':
            from tests.rules_v1_001.run_acceptance import check_result
            frame = self.peers[step['as']].latest
            actual = self.normalize(frame['view']['match']['last_turn']['core_resolution'])
            # Restore fixture's authored match ID; player aliases already match the fixture.
            def restore(obj: Any) -> Any:
                if isinstance(obj, str):
                    return 'fixture' + obj[5:] if obj == 'match' or obj.startswith('match:') else obj
                if isinstance(obj, dict):
                    return {k: restore(v) for k, v in obj.items()}
                if isinstance(obj, list):
                    return [restore(v) for v in obj]
                return obj
            result = restore(actual)
            ledger = result['ledger']
            ledger['eliminated_ids'].sort()
            for targets in ledger['kills'].values():
                targets.sort()
            ledger['events'].sort(key=lambda e: (e['phase'], e['actor_id'] or '', e['target_id'] or '', e['kind'], e['event_id']))
            check_result(result, step['expected'], step['input'])
        elif action == 'raw':
            peer = self.peers[step['as']]
            before = len(peer.frames)
            peer.raw_error = step.get('error')
            await peer.ws.send(step['text'])
            await asyncio.sleep(0.08)
            frames = peer.frames[before:]
            if step.get('close'):
                need(peer.ws.close_code == step['close'], 'expected safe close code')
            else:
                need(any(f.get('type') == 'ack' and f.get('ok') is False
                         and f.get('error', {}).get('code') == step['error'] for f in frames), 'malformed request not safely rejected')
            peer.raw_error = None
        elif action == 'silence':
            peer = self.peers[step['as']]
            count = len(peer.frames)
            await asyncio.sleep(0.1)
            need(not any(f.get('type') == 'snapshot' for f in peer.frames[count:]), 'revoked member received snapshot')
        elif action == 'privacy':
            frame = deepcopy(self.normalize(self.peers[step['as']].latest))
            frame.pop('server_time_ms')
            frame['view']['room_code'] = 'ROOMCODE'
            frame['view']['timer'].pop('deadline_at_ms')
            key = step['key']
            need(not step.get('compare') or key in self.shared, 'missing paired privacy baseline')
            if key in self.shared:
                need(frame == self.shared[key], 'secret choice changes observer JSON')
            else:
                self.shared[key] = frame
        elif action == 'chooser_count':
            need(self.chooser_calls == step['count'], 'wrong timeout policy or repeated random choice')
        elif action == 'different_match':
            old = self.history[step['old_request']][1]['payload']['match_id']
            need(self.peers[step['as']].latest['view']['match']['match_id'] != old, 'old match reused')
        elif action == 'rate':
            alias = step['as']
            commands = []
            for i in range(45):
                commands.append({'as': alias, 'message': dict(v=1, type='command', request_id=f'rate-{i}', command_seq='@next', op='room.sync', payload={'room_id': '$room.room_id'}),
                                 'ack': {'one_of': [{'ok': True}, {'ok': False, 'error': {'code': 'RATE_LIMITED'}}]}})
            results = await asyncio.gather(*(self.send(command) for command in commands))
            need(any(not result['ok'] for result in results), 'burst limit not enforced')
        elif action == 'slow':
            peer = self.peers[step['as']]
            peer.task.cancel()
            await asyncio.gather(peer.task, return_exceptions=True)
            peer.ws.transport.pause_reading()
        elif action == 'gui':
            raise ValueError('GUI belongs to the later integration package')
        else:
            raise ValueError('unsupported step')
        await self.flush()

    async def run(self, create_test_server: Any) -> None:
        clock = ManualClock() if self.case['clock'] == 'manual' else None
        try:
            async with create_test_server(self.case['policy'], clock=clock,
                    new_match_factory=self.factory, timeout_chooser=self.chooser, rng=random.Random(73)) as server:
                url = urlsplit(server.url)
                need(url.scheme == 'ws' and url.hostname == '127.0.0.1' and url.path == '/rooms-v1'
                     and url.port and not url.username and not url.query and not url.fragment, 'A08 must bind real loopback URL')
                self.server = server
                for index, step in enumerate(self.case['steps']):
                    try:
                        await self.execute(step)
                    except Exception as error:
                        raise ValueError(f'step {index + 1} ({step["do"]}): {type(error).__name__}') from error
                await self.flush()
                for peer in self.peers.values():
                    if peer.fault:
                        raise peer.fault
        finally:
            for peer in list(self.peers.values()) + self.retired:
                peer.task.cancel()
                if peer.ws.transport.is_reading() is False:
                    peer.ws.transport.resume_reading()
            await asyncio.gather(*(p.task for p in list(self.peers.values()) + self.retired), return_exceptions=True)
            await self.stack.aclose()


async def run(args: argparse.Namespace) -> tuple[dict, int]:
    cases = load_cases()
    chosen = [c for c in cases if not args.case or any(c['case_id'] == q or c['case_id'].split('/')[0] == q for q in args.case)]
    need(bool(chosen), 'no matching case')
    if any(c['case_id'].startswith('N10/') for c in chosen):
        ids = {c['case_id'] for c in chosen}
        chosen = [c for c in cases if c['case_id'] in ids or c['case_id'].startswith('N10/')]
    report = dict(server_status='NOT_RUN', fixture_status='VALID', selected=len(chosen), passed=0,
                  server=evidence(args.server_path) if args.server_path.is_dir() else None,
                  core=evidence(args.core_path) if args.core_path.is_dir() else None, cases=[])
    if not (args.server_path / 'deidei_server/testing.py').is_file() or not (args.core_path / 'deidei_core/api.py').is_file():
        report['reason'] = 'explicit server or core missing; no fallback'
        report['cases'] = [dict(case_id=c['case_id'], status='NOT_RUN') for c in chosen]
        return report, 2
    if not args.tested_code_sha or report['server']['sha'] != args.tested_code_sha or report['server']['dirty'] or report['core']['dirty'] or report['core']['sha'] != args.tested_code_sha:
        report['reason'] = 'fixed clean service SHA required via --tested-code-sha'
        return report, 2
    api = load_module(args.core_path, 'deidei_core.api', 'deidei_core/api.py')
    service = load_module(args.server_path, 'deidei_server.testing', 'deidei_server/testing.py')
    import websockets
    need(websockets.__version__ == '17.0.1', 'candidate runtime requires websockets==17.0.1')
    from websockets.asyncio.client import connect
    shared = {}
    report['server_status'] = 'RUN'
    for case in chosen:
        if case['needs_gui']:
            report['cases'].append(dict(case_id=case['case_id'], status='NOT_RUN', reason='actual Electron requires integration package'))
            continue
        try:
            await Scenario(case, api, connect, shared).run(service.create_test_server)
            report['cases'].append(dict(case_id=case['case_id'], status='PASS'))
            report['passed'] += 1
        except Exception as error:
            report['cases'].append(dict(case_id=case['case_id'], status='FAIL', reason=str(error) if isinstance(error, ValueError) and str(error).startswith('step ') else type(error).__name__))
    failed = any(c['status'] == 'FAIL' for c in report['cases'])
    report['server_status'] = 'FAIL' if failed else 'SOCKET_CHECKS_PASS'
    return report, 1 if failed else (3 if not report['passed'] else 0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server-path', required=True, type=Path)
    parser.add_argument('--core-path', required=True, type=Path)
    parser.add_argument('--tested-code-sha')
    parser.add_argument('--case', action='append')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    try:
        report, code = asyncio.run(run(args))
    except Exception as error:
        report, code = dict(server_status='ERROR', reason=type(error).__name__), 1
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(text)
    print(text, end='')
    return code


if __name__ == '__main__':
    raise SystemExit(main())
