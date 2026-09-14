"""Transport doubles prove the harness only, never a room server PASS."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest

from tests.rooms_v1.author_cases import build
from tests.rooms_v1.validate import (HERE, POLICY, ROOT, check_ack, check_snapshot,
    expect_paths, load_cases, no_secrets, strict_json)
from tests.rooms_v1.run_acceptance import ManualClock, Scenario, Peer, load_module


def lobby() -> dict:
    return dict(v=1, type='snapshot', room_id='id-room', seq='1', server_time_ms=1800000000000,
                view=dict(source='online', room_code='2AB3CD4E', host_id='id-h', phase='lobby',
                          has_password=False, policy=deepcopy(POLICY), members=[dict(
                              player_id='id-h', nickname='测试h', avatar_id='leaf', role='player',
                              seat=0, connected=True, ready=False, participation='lobby',
                              submission_state='none', absence_count=0)], match=None,
                          self=dict(player_id='id-h', role='player', seat=0, options=[], accepted_entry_id=None),
                          timer=dict(kind='none', deadline_at_ms=None, remaining_ms=None),
                          pause=None, close_reason=None))


def hello() -> dict:
    return dict(v=1, type='hello', boot_id='boot', connection_id='conn', protocol='rooms-1.0',
                rules_version='classic-1.0.1', server_time_ms=1800000000000,
                policy_defaults=deepcopy(POLICY), capabilities=dict(max_players=6,
                allowed_turn_ms=[5000, 8000, 12000, 20000, 30000], spectator_max=6))


class ScriptedSocket:
    """Two pre-authored exchanges, no room state machine or verdict generator."""
    def __init__(self, mutation: str | None = None) -> None:
        self.queue = asyncio.Queue()
        self.queue.put_nowait(json.dumps(hello()))
        self.index = 0
        self.close_code = None
        self.mutation = mutation
        self.transport = SimpleNamespace(is_reading=lambda: True)

    async def recv(self) -> str:
        return await self.queue.get()

    def __aiter__(self) -> 'ScriptedSocket':
        return self

    async def __anext__(self) -> str:
        return await self.recv()

    async def send(self, text: str) -> None:
        request = strict_json(text)
        expected_op = ['session.open', 'room.create'][self.index]
        if request['op'] != expected_op:
            raise ValueError('script unexpected command')
        if self.index == 0:
            ack = dict(v=1, type='ack', request_id='h-auth-0', ok=True,
                       data=dict(session_id='session-h', player_id='id-h', resume_token='synthetic-token', boot_id='boot', last_command_seq='0'))
            self.queue.put_nowait(json.dumps(ack))
        else:
            ack = dict(v=1, type='ack', request_id='create-room', ok=True,
                       data=dict(room_id='id-room', room_code='2AB3CD4E'))
            snapshot = lobby()
            if self.mutation == 'cross_room': snapshot['room_id'] = 'other-room'
            if self.mutation == 'other_private': snapshot['view']['self']['player_id'] = 'other-person'
            if self.mutation == 'secret': snapshot['view']['members'][0]['entry_id'] = 'Bi'
            if self.mutation == 'wrong_role': snapshot['view']['members'][0]['role'] = 'spectator'
            if self.mutation != 'missing_ack': self.queue.put_nowait(json.dumps(ack))
            self.queue.put_nowait(json.dumps(snapshot))
        self.index += 1

    async def close(self) -> None:
        self.close_code = 1000


class HarnessTests(unittest.TestCase):
    def test_authored_suite_is_reproducible(self) -> None:
        self.assertEqual(build(), load_cases())
        self.assertEqual(len(load_cases()), 96)

    def test_bad_samples_missing_family_ack_policy_or_oracle(self) -> None:
        original = load_cases()
        mutations = []
        cases = deepcopy(original); cases.pop(0); mutations.append(cases)
        cases = deepcopy(original); cases[0]['steps'][1].pop('ack'); mutations.append(cases)
        cases = deepcopy(original); cases[0]['policy']['turn_ms'] = True; mutations.append(cases)
        cases = deepcopy(original); cases[0]['steps'][-1]['expect'] = {}; mutations.append(cases)
        cases = deepcopy(original); cases[0]['forbidden'] = []; mutations.append(cases)
        for cases in mutations:
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'cases.json'; path.write_text(json.dumps(cases))
                with self.assertRaises((ValueError, KeyError)):
                    load_cases(path)

    def test_json_rejects_duplicate_and_nonfinite(self) -> None:
        for raw in ('{"a":1,"a":2}', '{"a":NaN}', '{"a":Infinity}'):
            with self.assertRaises(ValueError): strict_json(raw)

    def test_ack_missing_wrong_identity_secret_and_types(self) -> None:
        request = dict(request_id='request', op='room.sync', payload={'room_id': 'r'})
        valid = dict(v=1, type='ack', request_id='request', ok=True, data={'room_id': 'r'})
        check_ack(valid, request, {'ok': True})
        variants = [None, {**valid, 'request_id': 'other'}, {**valid, 'ok': 1},
                    {**valid, 'data': {'room_id': 'r', 'resume_token': 'secret'}}]
        for ack in variants:
            with self.assertRaises(ValueError): check_ack(ack, request, {'ok': True})
        error = dict(v=1, type='ack', request_id='request', ok=False, error=dict(code='TURN_CLOSED', field=None, retryable=False))
        check_ack(error, request, dict(ok=False, error={'code': ['TURN_CLOSED', 'STALE_TURN']}))

    def test_snapshot_mutations(self) -> None:
        snapshot = lobby()
        check_snapshot(snapshot, 'id-h', 'id-room', POLICY)
        variants = []
        for path, value in [('view.self.player_id', 'someone'), ('room_id', 'another'),
                            ('view.members.0.role', 'spectator'), ('view.members.0.seat', True),
                            ('view.self.accepted_entry_id', 'Bi'), ('seq', '0'),
                            ('view.policy.turn_ms', 5000)]:
            changed = deepcopy(snapshot); target = changed; parts = path.split('.')
            for part in parts[:-1]: target = target[int(part)] if isinstance(target, list) else target[part]
            target[parts[-1]] = value; variants.append(changed)
        changed = deepcopy(snapshot); changed['view']['members'][0]['pending_entry'] = 'Bi'; variants.append(changed)
        changed = deepcopy(snapshot); changed['view']['self']['resume_token'] = 'secret'; variants.append(changed)
        for changed in variants:
            with self.assertRaises(ValueError): check_snapshot(changed, 'id-h', 'id-room', POLICY)

    def test_old_turn_and_duplicate_reward_are_detected(self) -> None:
        # Authored assertions are the same path comparator used by real scenarios.
        original = dict(phase='selecting', match={'turn_id': 'm:g1:t2', 'public_state': {'players': {'A': {'dd6': '6'}}}})
        expected = {'phase': 'selecting', 'match.turn_id': 'm:g1:t2', 'match.public_state.players.A.dd6': '6'}
        expect_paths(original, expected)
        changed = deepcopy(original); changed['match']['turn_id'] = 'm:g1:t1'
        with self.assertRaises(ValueError): expect_paths(changed, expected)
        changed = deepcopy(original); changed['match']['public_state']['players']['A']['dd6'] = '12'
        with self.assertRaises(ValueError): expect_paths(changed, expected)

    def test_clock_and_negative_time(self) -> None:
        clock = ManualClock(); clock.advance_ms(11999)
        self.assertEqual(clock.now_ms(), 11999)
        self.assertEqual(clock.wall_ms(), 1800000011999)
        clock.advance_ms(1); self.assertEqual(clock.now_ms(), 12000)
        for value in (-1, True):
            with self.assertRaises(ValueError): clock.advance_ms(value)

    def test_missing_paths_are_non_success_no_fallback(self) -> None:
        for server, core in [('no-service', ROOT / 'game/core'), ('no-service', 'no-core')]:
            result = subprocess.run([sys.executable, str(HERE / 'run_acceptance.py'), '--server-path', str(server), '--core-path', str(core)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            report = json.loads(result.stdout)
            self.assertEqual(report['passed'], 0)
            self.assertEqual(report['server_status'], 'NOT_RUN')
            self.assertEqual(len(report['cases']), 96)

    def test_import_does_not_reuse_cached_package(self) -> None:
        name = '_r03_path_guard_probe'
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            for directory in (first, second): (Path(directory) / (name + '.py')).write_text('VALUE = 1\n')
            try:
                load_module(Path(first), name, name + '.py')
                with self.assertRaises(ValueError): load_module(Path(second), name, name + '.py')
            finally:
                sys.modules.pop(name, None)
                sys.path[:] = [p for p in sys.path if p not in (first, second)]

    def test_all_core_oracles_have_complete_ledger_and_state(self) -> None:
        from tests.rules_v1_001.validate_fixtures import validate_state
        for case in load_cases():
            for step in case['steps']:
                if step['do'] == 'core':
                    expected = step['expected']
                    for field in ('post_turn_players', 'actions', 'kills', 'eliminated_ids', 'next_state', 'transition', 'required_events', 'forbidden_events'):
                        self.assertIn(field, expected)
                    validate_state(expected['next_state'], 'expected')
                    self.assertEqual(set(expected['actions']), set(step['input']['state']['active_ids']))


class AsyncHarnessTests(unittest.IsolatedAsyncioTestCase):
    async def test_scripted_n01_and_five_transport_mutations(self) -> None:
        @asynccontextmanager
        async def factory(*args: object, **kwargs: object):
            async def drain() -> None: await asyncio.sleep(0)
            yield SimpleNamespace(url='ws://127.0.0.1:1/rooms-v1', drain=drain)
        for mutation in (None, 'cross_room', 'other_private', 'secret', 'wrong_role', 'missing_ack'):
            @asynccontextmanager
            async def connect(*args: object, **kwargs: object):
                yield ScriptedSocket(mutation)
            scenario = Scenario(load_cases()[0], None, connect, {})
            if mutation is None:
                await scenario.run(factory)
            else:
                with self.assertRaises(ValueError, msg=mutation):
                    await scenario.run(factory)

    async def test_explicit_baseline_core_oracles_and_identifier_mapping(self) -> None:
        # Fixed product core only; this does not execute or certify a room service.
        api = load_module(ROOT / 'game/core', 'deidei_core.api', 'deidei_core/api.py')
        async def drain() -> None: await asyncio.sleep(0)
        for case in load_cases():
            if not any(step['do'] == 'core' for step in case['steps']):
                continue
            scenario = Scenario(case, api, None, {})
            for alias in case['people']:
                scenario.env[alias] = {'player_id': 'pid-' + alias}
            ids = [data['player_id'] for data in scenario.env.values()]
            state = scenario.factory(ids, 'test-match')
            scenario.server = SimpleNamespace(drain=drain)
            for step in case['steps']:
                if step['do'] != 'core':
                    continue
                inp = step['input']
                submissions = {'pid-' + a: e for a, e in inp['submissions'].items()}
                tokens = {'pid-' + a: t for a, t in inp['choice_tokens'].items()}
                actual = api.resolve_round(state, submissions, tokens)
                self.assertTrue(actual['ok'])
                frame = {'room_id': 'test-room', 'view': {'match': {'match_id': 'test-match', 'last_turn': {'core_resolution': actual}}}}
                scenario.peers[step['as']] = SimpleNamespace(latest=frame, fault=None)
                await scenario.execute(step)
                state = actual['next_state']

    async def test_privacy_differential_checks_entire_observer_json(self) -> None:
        scenario = Scenario(load_cases()[0], None, None, {})
        async def drain() -> None: await asyncio.sleep(0)
        scenario.server = SimpleNamespace(drain=drain)
        scenario.env = {'h': {'player_id': 'id-h'}}
        peer = SimpleNamespace(latest=lobby(), fault=None)
        scenario.peers['h'] = peer
        step = {'do': 'privacy', 'as': 'h', 'key': 'pair'}
        await scenario.execute(step)
        peer.latest['server_time_ms'] += 1
        await scenario.execute(step)
        peer.latest['view']['has_password'] = True
        with self.assertRaises(ValueError): await scenario.execute(step)

    async def test_same_seq_cannot_have_different_public_resources(self) -> None:
        scenario = Scenario(load_cases()[0], None, None, {})
        first = lobby(); scenario.check_public_consistency(first)
        changed = deepcopy(first); changed['view']['members'][0]['absence_count'] = 1
        with self.assertRaises(ValueError): scenario.check_public_consistency(changed)

    async def test_real_peer_rejects_old_seq_and_revoked_broadcast(self) -> None:
        async def exercise(revoked: bool) -> None:
            scenario = Scenario(load_cases()[0], None, None, {})
            scenario.env = {'h': {'player_id': 'id-h'}}
            socket = ScriptedSocket(); await socket.recv()
            peer = Peer(scenario, 'h', socket); peer.room_id = None if revoked else 'id-room'
            peer.previous_seq['id-room'] = 2
            socket.queue.put_nowait(json.dumps(lobby()))
            await asyncio.sleep(0.02)
            self.assertIsInstance(peer.fault, ValueError)
            peer.task.cancel(); await asyncio.gather(peer.task, return_exceptions=True)
        await exercise(False); await exercise(True)


if __name__ == '__main__':
    unittest.main()
