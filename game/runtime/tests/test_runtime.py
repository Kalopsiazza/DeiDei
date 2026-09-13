"""ARC S01–S08 plus wire/privacy checks; original independent fixtures remain read-only."""
from copy import deepcopy
import io
import json
from pathlib import Path
from random import Random
import unittest
from unittest.mock import patch

from deidei_core.api import list_options, new_match, resolve_round
from deidei_runtime.session import MatchSession, expected_turn
from deidei_runtime.solo import SoloGame
from deidei_runtime.opponent import choose_entry, needs_token
from deidei_runtime.view import dd_text, options_view
from deidei_runtime.worker import Worker, serve, LIMIT

FIXTURES = Path(__file__).resolve().parents[3] / 'tests/rules_v1_001/fixtures'
PROFILE = {'profile_id': 'local-test', 'nickname': '本机测试', 'avatar_id': 'leaf'}


def fixture(case: str, index: int = 0) -> dict:
    return json.loads((FIXTURES / f'{case}.json').read_text())[index]


class Clock:
    now = 0.0

    def __call__(self) -> float:
        return self.now

    def step(self) -> None:
        self.now += 2


class CountingRandom(Random):
    calls = 0

    def choice(self, values):
        self.calls += 1
        return super().choice(values)


class SessionTests(unittest.TestCase):
    def test_S01_same_id_returns_isolated_resolution_applies_once(self):
        state = new_match(['A', 'B'], 'test')
        session = MatchSession(state)
        original = deepcopy(state)
        args = ('one', expected_turn(state), {'A': 'Charge', 'B': 'Charge'}, {})
        with patch('deidei_runtime.session.resolve_round', wraps=resolve_round) as resolve:
            result = session.apply_round(*args)
            snapshot = session.snapshot()
            replay = session.apply_round(*args)
            self.assertEqual(resolve.call_count, 1)
        self.assertEqual(result, replay)
        self.assertEqual(snapshot, session.snapshot())
        replay['next_state']['players']['A']['dd6'] = '900'
        self.assertEqual(session.apply_round(*args), result)
        snapshot['players']['A']['pending_bombs'].append({})
        self.assertEqual(state, original)
        self.assertEqual(session.snapshot()['players']['A']['pending_bombs'], [])

    def test_S02_conflict_and_rejected_move_can_reuse_id(self):
        session = MatchSession(new_match(['A', 'B'], 'test'))
        expected = expected_turn(session.snapshot())
        invalid = session.apply_round('one', expected, {'A': 'Bi', 'B': 'Charge'}, {})
        self.assertEqual(invalid['error']['code'], 'UNAVAILABLE_MOVE')
        self.assertTrue(session.apply_round('one', expected, {'A': 'Charge', 'B': 'Charge'}, {})['ok'])
        snapshot = session.snapshot()
        self.assertEqual(session.apply_round('one', expected, {'A': 'Def', 'B': 'Charge'}, {})['error']['code'], 'REQUEST_CONFLICT')
        self.assertEqual(session.snapshot(), snapshot)

    def test_S03_fifo_eviction_does_not_reapply_old_turn(self):
        session = MatchSession(new_match(['A', 'B'], 'test'), max_cached=1)
        expected = expected_turn(session.snapshot())
        moves = {'A': 'Charge', 'B': 'Charge'}
        session.apply_round('one', expected, moves, {})
        session.apply_round('two', expected_turn(session.snapshot()), moves, {})
        before = session.snapshot()
        self.assertEqual(session.apply_round('one', expected, moves, {})['error']['code'], 'STALE_TURN')
        self.assertEqual(session.snapshot(), before)

    def test_S04_C065_r5_reward_replay_after_r6_spend(self):
        case = fixture('C065')
        session = MatchSession(new_match(**case['input']['new_match']))
        r5 = None
        for turn, step in enumerate(case['input']['steps'][:6], 1):
            expected = expected_turn(session.snapshot())
            result = session.apply_round(f'r{turn}', expected, **step)
            self.assertTrue(result['ok'])
            if turn == 5:
                r5 = (expected, deepcopy(step), deepcopy(result))
                self.assertEqual(sum(e['kind'] == 'reward_granted' for e in result['ledger']['events']), 1)
                self.assertEqual(session.apply_round('r5', expected, **step), result)
                self.assertEqual(session.snapshot()['players']['A']['zeng_state'], 'ready')
        before = session.snapshot()
        self.assertEqual(before['turn_index'], '7')
        self.assertEqual(before['players']['A']['zeng_state'], 'spent')
        self.assertEqual(before['players']['A']['dd6'], '18')
        self.assertEqual(session.apply_round('r5', r5[0], **r5[1]), r5[2])
        self.assertEqual(session.snapshot(), before)

    def test_S05_C074_restart_keeps_context_and_eliminated_roster(self):
        case = fixture('C074')
        context = {'mode_at_start': 'multiplayer', 'absence_counts': {'A': 2}}
        session = MatchSession(case['input']['state'], context)
        result = session.apply_round('reset', expected_turn(session.snapshot()), case['input']['submissions'], case['input']['choice_tokens'])
        self.assertEqual(result['transition']['kind'], 'restart_survivors')
        self.assertEqual(session.context_snapshot(), context)
        copied = session.context_snapshot(); copied['absence_counts']['A'] = 999
        self.assertEqual(session.context_snapshot(), context)
        for pid in result['ledger']['eliminated_ids']:
            self.assertNotIn(pid, session.snapshot()['active_ids'])
            self.assertIn(pid, session.snapshot()['players'])
        self.assertNotEqual(result['ledger']['post_turn_players'], result['next_state']['players'])

    def test_S06_close_and_new_match_reject_old_expected(self):
        old = MatchSession(new_match(['A', 'B'], 'old'))
        expected = expected_turn(old.snapshot())
        old.close()
        self.assertEqual(old.apply_round('x', expected, {}, {})['error']['code'], 'SESSION_CLOSED')
        new = MatchSession(new_match(['A', 'B'], 'new'))
        self.assertEqual(new.apply_round('x', expected, {}, {})['error']['code'], 'STALE_TURN')

    def test_request_and_initial_state_validation(self):
        session = MatchSession(new_match(['A', 'B'], 'test'))
        for request in ('', 'x' * 129, True, None):
            self.assertEqual(session.apply_round(request, {}, {}, {})['error']['code'], 'INVALID_REQUEST')
        for expected in ({}, {**expected_turn(session.snapshot()), 'turn_index': True}):
            self.assertEqual(session.apply_round('x', expected, {}, {})['error']['code'], 'INVALID_REQUEST')
        keyed = MatchSession(new_match(['true', 'B'], 'keys'))
        expected = expected_turn(keyed.snapshot())
        self.assertTrue(keyed.apply_round('same', expected, {'true': 'Charge', 'B': 'Charge'}, {})['ok'])
        self.assertFalse(keyed.apply_round('same', expected, {True: 'Charge', 'B': 'Charge'}, {})['ok'])
        state = session.snapshot(); state['players']['A']['dd6'] = '01'
        with self.assertRaises(ValueError):
            MatchSession(state)


class SoloTests(unittest.TestCase):
    def test_S07_preselection_retry_privacy_and_separate_randomness(self):
        rng, tokens, clock = CountingRandom(7), CountingRandom(31), Clock()
        solo = SoloGame(PROFILE, rng=rng, token_rng=tokens, clock=clock)
        original = solo.bot_entry, deepcopy(solo.tokens)
        self.assertEqual(rng.calls, 1)
        for _ in range(3):
            view = solo.get_view()
            with self.assertRaisesRegex(ValueError, 'UNAVAILABLE_MOVE'):
                solo.submit(view['view_id'], 'Shell')
        self.assertEqual((solo.bot_entry, solo.tokens), original)
        self.assertEqual(rng.calls, 1)
        self.assertNotIn('choice_tokens', json.dumps(view))
        self.assertNotIn('bot_entry', json.dumps(view))
        self.assertTrue(all('selected_entry_id' not in p for p in view['participants']))
        submitted = solo.submit(view['view_id'], 'Charge')
        state = solo.session.snapshot()
        self.assertEqual(solo.submit(view['view_id'], 'Charge'), submitted)
        self.assertEqual(solo.session.snapshot(), state)
        with self.assertRaisesRegex(ValueError, 'REQUEST_CONFLICT'):
            solo.submit(view['view_id'], 'Def')
        clock.step(); revealed = solo.get_view()
        self.assertEqual(revealed['phase'], 'revealed')
        self.assertEqual(solo.submit(view['view_id'], 'Charge')['phase'], 'revealed')
        self.assertEqual(solo.session.snapshot(), state)

    def test_S08_recovery_one_or_both_actors_automatic_once(self):
        for both in (False, True):
            state = new_match(['local-test', 'bot_local'], f'recovery-{both}')
            moves = {'local-test': 'ZengYi', 'bot_local': 'ZengYi' if both else 'Charge'}
            state = resolve_round(state, moves, {})['next_state']
            clock = Clock()
            solo = SoloGame(PROFILE, session=MatchSession(state), rng=Random(3), clock=clock)
            self.assertEqual(len(solo.resolutions), 1)
            self.assertEqual(solo.get_view()['phase'], 'submitting')
            self.assertTrue(all(o['forced'] and not o['available'] for o in solo.options))
            action = solo.resolutions[0]['ledger']['actions']['local-test']
            self.assertTrue(action['is_recovery'])
            if both:
                self.assertTrue(solo.resolutions[0]['ledger']['actions']['bot_local']['is_recovery'])
            for _ in range(4): solo.get_view()
            self.assertEqual(len(solo.resolutions), 1)
            clock.step(); self.assertEqual(solo.get_view()['phase'], 'revealed')
            self.assertEqual(solo.get_view()['phase'], 'revealed')
            clock.step(); self.assertEqual(solo.get_view()['phase'], 'selecting')
            self.assertEqual(solo.state['turn_index'], '3')
            self.assertEqual(solo.state['players']['local-test']['zeng_state'], 'waiting')

    def test_real_options_formats_copy_and_reveal_ledger(self):
        self.assertEqual([dd_text(n) for n in ['6', '2', '3', '7', '9', '36']], ['1', '1/3', '1/2', '1又1/6', '1又1/2', '6'])
        huge = str(10**100 * 6 + 3)
        self.assertEqual(dd_text(huge), str(10**100) + '又1/2')
        self.assertEqual(dd_text('6' + '0'*4998 + '3'), '1' + '0'*4999 + '又1/2')
        state = new_match(['local-test', 'bot_local'], 'view')
        state['players']['local-test'].update(dd6='7', enhanced_xiao=True, latest_copyable_move='NieXiang')
        options = options_view(state, 'local-test')
        for shown, core in zip(options, list_options(state, 'local-test')):
            self.assertEqual({k: shown[k] for k in core}, core)
        xiao = next(o for o in options if o['entry_id'] == 'Xiao')
        self.assertEqual((xiao['cost_text'], xiao['requirement_text']), ('0 DD', '持有 1/3 DD'))
        copy = next(o for o in options if o['entry_id'] == 'ZhangXinWei')
        self.assertEqual(copy['required']['nx_charge'], '0')
        self.assertTrue(needs_token('BombFlipVolvo', state['players']['local-test']))
        clock = Clock()
        solo = SoloGame(PROFILE, session=MatchSession(state), rng=Random(7), clock=clock)
        solo.submit(solo.view_id, 'Charge'); clock.step(); view = solo.get_view()
        for participant in view['participants']:
            self.assertEqual(participant['resources']['dd6'], solo.resolutions[-1]['ledger']['post_turn_players'][participant['player_id']]['dd6'])
        self.assertTrue(any('本机测试：攒' in line for line in view['summary']))

    def test_multiple_fixed_seed_matches_end_without_hidden_turn_cap(self):
        totals = []
        for seed in range(12):
            clock, player_rng = Clock(), Random(seed + 100)
            solo = SoloGame(PROFILE, rng=Random(seed), token_rng=Random(seed+50), clock=clock)
            for turns in range(300):  # Test budget, never a product draw rule.
                view = solo.get_view()
                if view['phase'] == 'result': break
                if view['phase'] == 'selecting':
                    solo.submit(view['view_id'], choose_entry(view['options'], player_rng))
                clock.step()
            else:
                self.fail(f'seed {seed} did not finish within the test budget')
            self.assertIn(solo.resolutions[-1]['transition']['kind'], ('sole_survivor', 'nobody_survives'))
            self.assertEqual(view['outcome']['winner_id'], solo.session.snapshot()['winner_id'])
            totals.append(len(solo.resolutions))
        print('Fixed-seed actual rounds:', totals)


class ProtocolTests(unittest.TestCase):
    def test_protocol_whitelist_lifecycle_and_invalid_shapes(self):
        worker = Worker()
        def call(op, payload=None):
            return worker.handle({'v': 1, 'id': 'request', 'op': op, 'payload': payload or {}})
        self.assertTrue(call('health')['ok']); self.assertIsNone(worker.solo)
        self.assertFalse(call('start_solo', {**PROFILE, 'path': '/tmp'})['ok'])
        for request in (None, [], {'v': True, 'id': 'x', 'op': 'health', 'payload': {}},
                        {'v': 1, 'id': 'x', 'op': 'eval', 'payload': {}}):
            self.assertFalse(worker.handle(request)['ok'])
        first = call('start_solo', PROFILE)['data']
        self.assertFalse(call('submit', {'view_id': first['view_id'], 'entry_id': []})['ok'])
        second = call('start_solo', PROFILE)['data']
        self.assertNotEqual(first['match_id'], second['match_id'])
        self.assertEqual(call('submit', {'view_id': first['view_id'], 'entry_id': 'Charge'})['error']['code'], 'STALE_VIEW')
        self.assertTrue(call('leave')['ok'])
        self.assertFalse(call('get_view')['ok'])
        self.assertTrue(call('shutdown')['ok'])

    def test_jsonl_unicode_duplicate_keys_size_and_stdout(self):
        good = json.dumps({'v': 1, 'id': 'x', 'op': 'health', 'payload': {}}).encode() + b'\n'
        output = io.BytesIO()
        serve(io.BytesIO(b'{bad}\n' + good), output)
        replies = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertFalse(replies[0]['ok']); self.assertTrue(replies[1]['ok'])
        for bad in (b'\xff\n', b'{"v":1,"v":1}\n', b'x'*(LIMIT+1), good[:-1]):
            output = io.BytesIO(); serve(io.BytesIO(bad), output)
            self.assertFalse(json.loads(output.getvalue())['ok'])


if __name__ == '__main__':
    unittest.main()
