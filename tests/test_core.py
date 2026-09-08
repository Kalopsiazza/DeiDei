"""Small, deterministic examples of the imported engine's current behavior."""
from __future__ import annotations

from copy import deepcopy
import random
import unittest

from deidei_env import (
    ALL_MOVES, Move, Outcome, PlayerState, choose_easy_move,
    dd_cost_units_for_move, is_legal_move, kDDOne,
    list_legal_moves, simulate_turn,
)


class ResourceTests(unittest.TestCase):
    def test_dd_uses_six_integer_units(self):
        self.assertEqual(kDDOne, 6)
        self.assertEqual(dd_cost_units_for_move(PlayerState(), Move.Xiao), 2)
        self.assertEqual(dd_cost_units_for_move(PlayerState(), Move.Bi), 6)

    def test_move_catalog_has_no_duplicates(self):
        self.assertEqual(len(ALL_MOVES), len(set(ALL_MOVES)))
        self.assertNotIn(Move.NoMove, ALL_MOVES)
        self.assertEqual(len(ALL_MOVES), 31)

    def test_new_players_have_independent_bomb_lists(self):
        a, b = PlayerState(), PlayerState()
        a.bombPending[0] = 1
        self.assertEqual(b.bombPending, [0, 0, 0])

    def test_bi_requires_one_dd(self):
        self.assertFalse(is_legal_move(PlayerState(dd=5), PlayerState(), Move.Bi))
        self.assertTrue(is_legal_move(PlayerState(dd=6), PlayerState(), Move.Bi))

    def test_charge_is_available_at_start(self):
        self.assertIn(Move.Charge, list_legal_moves(PlayerState(), PlayerState()))

    def test_special_resources_control_moves(self):
        opp = PlayerState()
        cases = [
            (Move.NieXiang, {"nxCharge": 3}, {"nxCharge": 4}),
            (Move.BombPragon, {"bombLayers": 0}, {"bombLayers": 1}),
            (Move.BombVolvo, {"bombLayers": 1}, {"bombLayers": 2}),
            (Move.BombFlipVolvo, {"bombLayers": 3}, {"bombLayers": 4}),
            (Move.FreeThree, {"lightning": 2}, {"lightning": 3}),
            (Move.FreeRotateThree, {"lightning": 5}, {"lightning": 6}),
        ]
        for move, below, ready in cases:
            with self.subTest(move=move):
                self.assertFalse(is_legal_move(PlayerState(**below), opp, move))
                self.assertTrue(is_legal_move(PlayerState(**ready), opp, move))

    def test_liqiang_is_single_use(self):
        self.assertTrue(is_legal_move(PlayerState(), PlayerState(), Move.LiQiang))
        self.assertFalse(is_legal_move(PlayerState(liqUsed=True), PlayerState(), Move.LiQiang))


class TurnTests(unittest.TestCase):
    def test_both_charge(self):
        result = simulate_turn(PlayerState(), PlayerState(), Move.Charge, Move.Charge)
        self.assertEqual(result.outcome, Outcome.Continue)
        self.assertEqual((result.nextP.dd, result.nextC.dd), (6, 6))

    def test_equal_attacks_continue_and_spend_resources(self):
        result = simulate_turn(PlayerState(dd=6), PlayerState(dd=6), Move.Bi, Move.Bi)
        self.assertEqual(result.outcome, Outcome.Continue)
        self.assertEqual((result.nextP.dd, result.nextC.dd), (0, 0))

    def test_attack_beats_charge(self):
        result = simulate_turn(PlayerState(dd=6), PlayerState(), Move.Bi, Move.Charge)
        self.assertEqual(result.outcome, Outcome.PlayerWin)

    def test_normal_defense_blocks_bi_and_gains_nx_charge(self):
        result = simulate_turn(PlayerState(), PlayerState(dd=6), Move.Def, Move.Bi)
        self.assertEqual(result.outcome, Outcome.Continue)
        self.assertEqual(result.nextP.nxCharge, 2)

    def test_normal_defense_does_not_block_pragon(self):
        result = simulate_turn(PlayerState(), PlayerState(dd=12), Move.Def, Move.Pragon)
        self.assertEqual(result.outcome, Outcome.CpuWin)

    def test_special_defense_blocks_its_attack(self):
        result = simulate_turn(PlayerState(), PlayerState(dd=18), Move.ThreeDef, Move.Three)
        self.assertEqual(result.outcome, Outcome.Continue)

    def test_special_defenses_do_not_block_bi(self):
        for move in (Move.ThreeDef, Move.PragonDef, Move.VolvoDef, Move.NieXiangDef):
            with self.subTest(move=move):
                result = simulate_turn(PlayerState(), PlayerState(dd=6), move, Move.Bi)
                self.assertEqual(result.outcome, Outcome.CpuWin)

    def test_reflect_beats_bi(self):
        result = simulate_turn(PlayerState(dd=6), PlayerState(dd=6), Move.Reflect, Move.Bi)
        self.assertEqual(result.outcome, Outcome.PlayerWin)

    def test_suicide_beats_reflect(self):
        result = simulate_turn(PlayerState(), PlayerState(dd=6), Move.Suicide, Move.Reflect)
        self.assertEqual(result.outcome, Outcome.PlayerWin)

    def test_both_suicide_draw(self):
        result = simulate_turn(PlayerState(), PlayerState(), Move.Suicide, Move.Suicide)
        self.assertEqual(result.outcome, Outcome.Draw)

    def test_tianlijun_loses_to_cloud(self):
        result = simulate_turn(PlayerState(), PlayerState(), Move.TianLiJun, Move.Cloud)
        self.assertEqual(result.outcome, Outcome.CpuWin)

    def test_bomb_becomes_usable_after_following_turn(self):
        first = simulate_turn(PlayerState(dd=6), PlayerState(), Move.Bomb, Move.Charge)
        self.assertEqual(first.nextP.bombLayers, 0)
        self.assertEqual(first.nextP.bombPending, [1, 0, 0])
        second = simulate_turn(first.nextP, first.nextC, Move.Charge, Move.Charge)
        self.assertEqual(second.nextP.bombLayers, 1)
        self.assertIn(Move.BombPragon, list_legal_moves(second.nextP, second.nextC))

    def test_illegal_attack_does_not_advance_fresh_state(self):
        p, c = PlayerState(), PlayerState()
        result = simulate_turn(p, c, Move.Bi, Move.Charge)
        self.assertEqual(result.outcome, Outcome.Continue)
        self.assertEqual(result.nextP, p)
        self.assertEqual(result.nextC, c)

    def test_swapping_sides_swaps_winner_for_basic_attacks(self):
        left = simulate_turn(PlayerState(dd=6), PlayerState(), Move.Bi, Move.Charge)
        right = simulate_turn(PlayerState(), PlayerState(dd=6), Move.Charge, Move.Bi)
        self.assertEqual(left.outcome, Outcome.PlayerWin)
        self.assertEqual(right.outcome, Outcome.CpuWin)
        self.assertEqual(left.nextP, right.nextC)
        self.assertEqual(left.nextC, right.nextP)


class EasyAITests(unittest.TestCase):
    def test_seeded_ai_only_selects_legal_moves(self):
        rng = random.Random(20260908)
        for units in (0, 2, 6, 12, 30, 60):
            state = PlayerState(dd=units, lightning=6, bombLayers=2, nxCharge=4)
            opp = PlayerState(dd=12)
            legal = list_legal_moves(state, opp)
            for _ in range(40):
                self.assertIn(choose_easy_move(state, opp, rng), legal)

    def test_seeded_ai_is_repeatable(self):
        a, b = random.Random(42), random.Random(42)
        p, c = PlayerState(dd=18), PlayerState(dd=12)
        first = [choose_easy_move(p, c, a) for _ in range(20)]
        second = [choose_easy_move(p, c, b) for _ in range(20)]
        self.assertEqual(first, second)

    def test_easy_ai_does_not_change_inputs(self):
        p, c = PlayerState(dd=18), PlayerState(dd=12)
        before = deepcopy((p, c))
        choose_easy_move(p, c, random.Random(42))
        self.assertEqual((p, c), before)


if __name__ == "__main__":
    unittest.main()
