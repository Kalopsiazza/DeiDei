"""Real core teaching flow, retry boundaries and unchanged ordinary worker."""
from copy import deepcopy
import unittest
from deidei_runtime.tutorial import TutorialGame
from deidei_runtime.worker import Worker

PROFILE = {'profile_id': 'learner', 'nickname': '新手', 'avatar_id': 'leaf'}


class TutorialTests(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.game = TutorialGame(PROFILE, clock=lambda: self.now)

    def play(self, entry):
        before = self.game.get_view()
        submitted = self.game.submit(before['view_id'], entry)
        self.assertEqual(submitted['phase'], 'submitting')
        self.assertFalse(submitted['tutorial']['won'])
        self.assertFalse(submitted['tutorial']['ended'])
        snapshot = self.game.session.snapshot()
        self.assertEqual(self.game.submit(before['view_id'], entry), submitted)
        self.assertEqual(snapshot, self.game.session.snapshot())
        self.now += 2
        revealed = self.game.get_view()
        self.assertEqual(revealed['phase'], 'revealed')
        self.assertEqual(revealed['public_round']['actions']['learner']['entry_id'], entry)
        self.now += 100
        self.assertEqual(self.game.get_view()['phase'], 'revealed')
        return revealed

    def advance(self):
        previous = self.game.get_view()['view_id']
        next_view = self.game.advance(previous)
        self.assertEqual(self.game.advance(previous), next_view)
        return next_view

    def guided(self):
        for step, entry in enumerate(('Charge', 'Def', 'Bi')):
            self.assertEqual(self.game.get_view()['tutorial']['step'], step)
            revealed = self.play(entry)
            player = next(p for p in revealed['participants'] if p['player_id'] == 'learner')
            self.assertEqual(player['resources']['dd6'], '6' if step < 2 else '0')
            if step == 2:
                self.assertTrue(revealed['tutorial']['won'])
            self.advance()
        self.assertEqual(self.game.stage, 'challenge')

    def test_guided_and_independent_match_resolve_once_and_finish(self):
        first = self.game.get_view()
        self.assertEqual(first['source'], 'live')
        self.assertEqual(first['mode'], 'tutorial')
        self.assertIsNone(first['public_round'])
        self.assertEqual(len(first['options']), 3)
        snapshot = deepcopy(self.game.session.snapshot())
        for entry, error in [('Def', 'TUTORIAL_TRY_TARGET'), ('Reflect', 'UNAVAILABLE_MOVE')]:
            with self.assertRaisesRegex(ValueError, error):
                self.game.submit(first['view_id'], entry)
            self.assertEqual(snapshot, self.game.session.snapshot())
        with self.assertRaisesRegex(ValueError, 'NOT_REVEALED'):
            self.game.advance(first['view_id'])
        self.guided()
        self.assertNotEqual(first['match_id'], self.game.get_view()['match_id'])
        self.assertTrue(all(p['resources']['dd6'] == '0' for p in self.game.get_view()['participants']))
        self.assertIsNone(self.game.get_view()['tutorial']['target_entry_id'])
        for entry in ('Charge', 'Def', 'Bi'):
            self.play(entry)
            self.advance()
        self.assertEqual(self.game.get_view()['tutorial']['stage'], 'complete')
        self.assertEqual(len(self.game.resolutions), 6)

    def test_failure_retry_stale_and_exit_are_safe(self):
        self.guided()
        self.play('Charge'); self.advance()
        lost = self.play('Charge')
        self.assertTrue(lost['tutorial']['ended'])
        self.assertFalse(lost['tutorial']['won'])
        reset = self.advance()
        self.assertEqual(reset['tutorial']['stage'], 'challenge')
        self.assertNotEqual(reset['match_id'], lost['match_id'])
        with self.assertRaisesRegex(ValueError, 'STALE_VIEW'):
            self.game.submit(lost['view_id'], 'Bi')
        with self.assertRaisesRegex(ValueError, 'STALE_VIEW'):
            self.game.advance('unseen-old-view')
        with self.assertRaisesRegex(ValueError, 'UNAVAILABLE_MOVE'):
            self.game.submit(reset['view_id'], 'Bi')
        self.game.leave()
        for action in (self.game.get_view, lambda: self.game.advance(reset['view_id'])):
            with self.assertRaisesRegex(ValueError, 'SESSION_CLOSED'):
                action()

    def test_worker_fixed_contract_and_normal_solo_unchanged(self):
        worker = Worker()
        def call(op, payload):
            return worker.handle({'v': 1, 'id': 'request', 'op': op, 'payload': payload})
        self.assertFalse(call('start_tutorial', {**PROFILE, 'script': []})['ok'])
        self.assertTrue(call('start_tutorial', PROFILE)['ok'])
        self.assertFalse(call('tutorial_next', {'view_id': worker.solo.view_id, 'step': 2})['ok'])
        self.assertTrue(call('start_solo', PROFILE)['ok'])
        normal = call('get_view', {})['data']
        self.assertNotIn('tutorial', normal)
        self.assertEqual(len(normal['options']), 33)
        self.assertFalse(call('tutorial_next', {'view_id': normal['view_id']})['ok'])
        call('leave', {})
