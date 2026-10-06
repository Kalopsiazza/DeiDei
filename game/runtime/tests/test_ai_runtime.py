"""Lightweight projection, real bounded IPC, and successful-apply AI provenance."""
from copy import deepcopy
from pathlib import Path
from random import Random
import sys
import time
import unittest
from unittest.mock import patch

from deidei_core.api import new_match, resolve_round
from deidei_core.rules import compile_rules, default_request
from deidei_runtime.ai_supervisor import AISupervisor, AIError
from deidei_runtime.legacy_model import LegacyModelProvider, MODEL_ID
from deidei_runtime.legacy_projection import ACTION_MAP, clipped_decimal, observation, compatibility
from deidei_runtime.session import MatchSession
from deidei_runtime.solo import SoloGame
from deidei_runtime.worker import Worker

PROFILE = {"profile_id": "A", "nickname": "AI测试", "avatar_id": "leaf"}


class FakeSupervisor:
    state = "ready"
    def __init__(self, replies=None):
        self.calls, self.replies, self.closed = [], list(replies or []), False
    def poll(self):
        return self.state
    def infer(self, expected, values, mask):
        self.calls.append(deepcopy((expected, values, mask)))
        result = self.replies.pop(0) if self.replies else [1.0] + [0.0] * 30
        if isinstance(result, Exception):
            raise result
        return result
    def close(self, state="cancelled"):
        self.closed, self.state = True, state


class CountRandom(Random):
    def __init__(self):
        super().__init__(12)
        self.draws = self.choices = 0
    def random(self):
        self.draws += 1
        return super().random()
    def choice(self, values):
        self.choices += 1
        return "Charge" if "Charge" in values else values[0]


def configured():
    return new_match(["A", "bot_local"], "model", compile_rules(default_request()))


class ProjectionTests(unittest.TestCase):
    def test_exact_slots_ai_first_initial_and_huge_decimal(self):
        self.assertEqual(len(ACTION_MAP), 31)
        self.assertEqual(ACTION_MAP[7], "SelfBi")
        self.assertEqual(ACTION_MAP[30], "FreeRotateThree")
        self.assertNotIn("ZengYi", ACTION_MAP)
        self.assertNotIn("ZengRewardBigBi", ACTION_MAP)
        state = configured()
        values = observation(state, "bot_local", {})
        self.assertEqual([i for i, v in enumerate(values) if v], [14, 77, 92, 155])
        state["players"]["bot_local"]["dd6"] = "60"
        state["players"]["A"]["dd6"] = "30"
        values = observation(state, "bot_local", {})
        self.assertEqual((values[0], values[78]), (0.5, 0.25))
        self.assertEqual(clipped_decimal("9" * 10000, 120), 1)
        self.assertEqual(clipped_decimal("119", 120), 119 / 120)

    def test_pending_game_offsets_flags_copyable_and_declared_origin(self):
        state = configured(); state["turn_index"] = "10"
        p = state["players"]["bot_local"]
        p.update(lightning="6", cloud_uses="2", bomb_placement_count="3", mature_bombs="4",
                 tian_uses="2", enhanced_xiao=True, nx_charge="2", zhang_used=True, liq_used=True,
                 latest_copyable_move="Volvo", last_actual_move="Three")
        p["pending_bombs"] = [{"game_id": state["game_id"], "mature_at_turn_end": str(turn)} for turn in (10, 11, 12, 13)]
        p["pending_bombs"].append({"game_id": "old", "mature_at_turn_end": "10"})
        values = observation(state, "bot_local", {"bot_local": "FreeThree", "A": "ZhangXinWei"})
        self.assertEqual(values[1:14], [0.5, 0.2, 0.3, 0.4, 0.2, 0.2, 0.2, 0.2, 1, 0.2, 1, 1, 1])
        self.assertEqual(values[14 + ACTION_MAP.index("Volvo")], 1)
        self.assertEqual(values[46 + 29], 1)
        self.assertEqual(values[78 + 46 + 24], 1)
        for declaration in ("ZengYi", "ZengRewardBigBi", "forced_recovery"):
            values = observation(state, "bot_local", {"bot_local": declaration})
            self.assertEqual(values[77], 1)
            self.assertEqual(values[46 + 5], 0)
            self.assertIn(declaration, compatibility(state, {"bot_local": declaration})["missing_features"])


class ProviderTests(unittest.TestCase):
    def game(self, replies=None, rng=None):
        supervisor = FakeSupervisor(replies)
        provider = LegacyModelProvider(supervisor)
        game = SoloGame(PROFILE, rules_snapshot=compile_rules(default_request()), opponent_provider=provider,
                        rng=rng or CountRandom(), submit_delay=0, reveal_delay=0)
        return game, provider, supervisor

    def advance(self, game):
        game.get_view(); game.get_view()

    def test_precommit_retry_no_input_or_tokens_and_apply_counters(self):
        game, provider, supervisor = self.game()
        self.assertEqual(len(supervisor.calls), 1)
        view = game.get_view()
        self.assertIsNone(view["decision_source"])
        self.assertNotIn("probabilities", str(view))
        game.submit(view["view_id"], "Charge")
        repeated = game.submit(view["view_id"], "Charge")
        self.assertEqual(len(supervisor.calls), 1)
        self.assertEqual(provider.model_turns, 1)
        self.assertEqual(repeated["decision_source"], "legacy_model")
        self.advance(game)
        self.assertEqual(len(supervisor.calls), 2)
        expected, values, mask = supervisor.calls[0]
        self.assertEqual(set(expected), {"match_id", "game_id", "turn_index", "rules_hash"})
        self.assertEqual(len(values), 156)
        self.assertEqual(len(mask), 31)
        game.leave(); self.assertTrue(supervisor.closed)

    def test_invalid_distributions_single_fallback_two_errors_degrade(self):
        for invalid in ([0.0] * 31, [float("nan")] * 31, [-1] * 31, [1] * 30, [True] * 31):
            rng = CountRandom()
            game, provider, supervisor = self.game([invalid, invalid], rng)
            self.assertEqual((rng.draws, rng.choices), (0, 1))
            self.assertTrue(provider.fallback_used)
            game.submit(game.view_id, "Charge")
            self.assertEqual((provider.model_turns, provider.fallback_turns), (0, 1))
            self.advance(game)
            self.assertEqual(provider.state, "degraded")
            self.assertTrue(supervisor.closed)
            game.submit(game.view_id, "Charge"); self.advance(game)
            self.assertEqual(len(supervisor.calls), 2)
            game.leave()

    def test_core_rejection_budget_preserves_human_and_reserved_tokens(self):
        game, provider, supervisor = self.game()
        game.bot_entry = "Bi"  # Controlled stale/invalid model candidate at zero resources.
        tokens, lucky = deepcopy(game.tokens), deepcopy(game.lucky_tokens)
        game.submit(game.view_id, "Def")
        self.assertEqual(game.resolution["ledger"]["actions"]["A"]["entry_id"], "Def")
        self.assertEqual((game.tokens, game.lucky_tokens), (tokens, lucky))
        self.assertEqual((provider.model_turns, provider.fallback_turns), (0, 1))
        self.assertEqual(game.decision_source, "legal_fallback")
        game.leave()
        game, provider, supervisor = self.game([[0] * 31])
        before = game.session.snapshot()
        game.bot_entry = "Bi"
        with self.assertRaisesRegex(ValueError, "AI_FALLBACK_EXHAUSTED"):
            game.submit(game.view_id, "Charge")
        self.assertEqual(game.session.snapshot(), before)
        self.assertEqual((provider.model_turns, provider.fallback_turns), (0, 0))
        self.assertEqual(game.rng.choices, 1)
        game.leave()

    def test_bad_human_and_stale_input_do_not_retry(self):
        game, provider, supervisor = self.game()
        with self.assertRaisesRegex(ValueError, "UNAVAILABLE_MOVE"):
            game.submit(game.view_id, "Bi")
        with self.assertRaisesRegex(ValueError, "STALE_VIEW"):
            game.submit("old", "Charge")
        self.assertEqual(len(supervisor.calls), 1)
        game.leave()

    def test_no_mapped_legal_slot_uses_current_33_entry_fallback_once(self):
        supervisor = FakeSupervisor(); provider = LegacyModelProvider(supervisor)
        rng = CountRandom()
        selected = provider.choose(configured(), "bot_local", [{"entry_id": "ZengRewardBigBi", "available": True}], {}, rng)
        self.assertEqual(selected, "ZengRewardBigBi")
        self.assertEqual(provider.source, "legal_fallback")
        self.assertEqual((len(supervisor.calls), rng.choices, rng.draws), (0, 1, 0))
        with self.assertRaisesRegex(ValueError, "AI_FALLBACK_EXHAUSTED"):
            provider.fallback([], rng)
        provider.close()

    def test_forced_recovery_uses_no_forward_draw_or_counter(self):
        state = configured()
        state = resolve_round(state, {"A": "Charge", "bot_local": "ZengYi"}, {}, {})["next_state"]
        supervisor = FakeSupervisor(); provider = LegacyModelProvider(supervisor)
        game = SoloGame(PROFILE, session=MatchSession(state), opponent_provider=provider)
        self.assertEqual(supervisor.calls, [])
        game.submit(game.view_id, "Charge")
        self.assertEqual(game.decision_source, "forced_recovery")
        self.assertEqual((provider.model_turns, provider.fallback_turns), (0, 0))
        game.leave()

    def test_cloud_mask_and_new_game_clears_declared_history(self):
        request = default_request(); request["skill_flags"]["Cloud"] = False
        supervisor = FakeSupervisor(); provider = LegacyModelProvider(supervisor)
        game = SoloGame(PROFILE, rules_snapshot=compile_rules(request), opponent_provider=provider)
        self.assertFalse(any(supervisor.calls[0][2][i] for i in (8, 29, 30)))
        game.declarations = {"A": "FreeThree", "bot_local": "BombPragon"}
        game.session = MatchSession(new_match(["A", "bot_local"], "restart", compile_rules(request)))
        game._prepare()
        self.assertEqual(game.declarations, {})
        self.assertEqual([i for i, v in enumerate(supervisor.calls[-1][1]) if v], [14, 77, 92, 155])
        game.leave()


class BoundaryTests(unittest.TestCase):
    def ready(self, mode, **kwargs):
        supervisor = AISupervisor([sys.executable, "-I", str(Path(__file__).with_name("ai_fixture.py")), mode], **kwargs)
        deadline = time.monotonic() + 3
        while supervisor.poll() == "preparing" and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertEqual(supervisor.state, "ready")
        return supervisor

    def test_correlations_stale_discarded_strict_shape_and_fatal_hot_timeout(self):
        expected = {"match_id": "m", "game_id": "g", "turn_index": "1", "rules_hash": "h"}
        for mode in ("stale", "bad_shape", "invalid_json", "crash", "hang"):
            supervisor = self.ready(mode, hot_timeout=0.1)
            pid = supervisor.process.pid
            try:
                if mode == "stale":
                    self.assertEqual(supervisor.infer(expected, [0.0] * 156, [True] * 31), [1.0] * 31)
                else:
                    with self.assertRaises(AIError) as caught:
                        supervisor.infer(expected, [0.0] * 156, [True] * 31)
                    self.assertEqual(caught.exception.fatal, mode in ("crash", "hang"))
            finally:
                supervisor.close()
            self.assertIsNotNone(supervisor.process.poll(), pid)

    def test_cold_deadline_and_cancel_reap_real_process(self):
        supervisor = AISupervisor([sys.executable, "-I", str(Path(__file__).with_name("ai_fixture.py")), "cold_hang"], cold_timeout=0.05)
        time.sleep(0.12)
        self.assertEqual(supervisor.state, "failed")
        self.assertIsNotNone(supervisor.process.poll())
        supervisor = self.ready("stale")
        supervisor.close()
        self.assertEqual(supervisor.state, "cancelled")
        self.assertIsNotNone(supervisor.process.poll())

    def test_independent_worker_reply_validation_before_takeover_and_cancel(self):
        def call(worker, op, payload=None):
            return worker.handle({"v": 2, "id": "ai", "op": op, "payload": payload or {}})
        worker = Worker()
        idle = call(worker, "solo_status")["data"]
        self.assertEqual(set(idle), {"requested_id", "active_id", "state", "compatibility", "model_turns", "fallback_turns"})
        self.assertEqual(idle["state"], "idle")
        self.assertEqual(call(worker, "prepare_solo", {"opponent_id": "arbitrary"})["error"]["code"], "INVALID_OPPONENT")
        fake = FakeSupervisor()
        with patch("deidei_runtime.worker.LegacyModelProvider", wraps=lambda: LegacyModelProvider(fake)):
            self.assertEqual(call(worker, "prepare_solo", {"opponent_id": MODEL_ID})["data"]["state"], "ready")
        prepared = worker.prepared
        bad = {**PROFILE, "rules_request": {}, "rule_pack_manifests": [], "opponent_id": MODEL_ID}
        self.assertEqual(call(worker, "start_solo", bad)["error"]["code"], "INVALID_RULES")
        self.assertIs(worker.prepared, prepared)
        valid = {**PROFILE, "rules_request": default_request(), "rule_pack_manifests": [], "opponent_id": MODEL_ID}
        view = call(worker, "start_solo", valid)["data"]
        self.assertIs(worker.solo.opponent, prepared)
        self.assertIsNone(worker.prepared)
        self.assertEqual(view["opponent_status"]["state"], "active")
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual(call(worker, "prepare_solo", {"opponent_id": MODEL_ID})["error"]["code"], "SESSION_ACTIVE")
        call(worker, "leave"); self.assertTrue(fake.closed)
        self.assertEqual(call(worker, "prepare_solo", {"opponent_id": "random-legal-v1"})["data"]["state"], "ready")
        self.assertEqual(call(worker, "cancel_solo_prepare")["data"]["state"], "cancelled")
        self.assertIsNone(worker.prepared)


if __name__ == "__main__":
    unittest.main()
