"""Versioned worker/session rules with real core, plus a real JSONL subprocess."""
from copy import deepcopy
import json
import os
from pathlib import Path
from random import Random
import subprocess
import sys
import unittest

from deidei_core.api import new_match, resolve_round
from deidei_core.rules import compile_rules, default_request, pack_ref, parse_pack
from deidei_runtime.session import MatchSession, expected_turn
from deidei_runtime.solo import SoloGame
from deidei_runtime.tutorial import TutorialGame
from deidei_runtime.view import public_round, rules_view, pack_view
from deidei_runtime.worker import Worker

ROOT = Path(__file__).resolve().parents[3]
PROFILE = {"profile_id": "local-configured", "nickname": "规则测试", "avatar_id": "leaf"}


def pack_request(name):
    manifest = parse_pack((ROOT / "docs/rules/packs" / (name + ".deidei-pack.json")).read_bytes())
    preset = manifest["presets"][0]
    return {"schema_version": 1, "preset_id": f"pack:{manifest['id']}:{preset['id']}",
            "skill_flags": deepcopy(preset["skill_defaults"]), "preset_params": {},
            "pack_refs": [pack_ref(manifest)]}, manifest


class ChargeRandom(Random):
    def choice(self, values):
        return "Charge" if "Charge" in values else values[0]


class CountTokens(Random):
    def __init__(self, seed):
        super().__init__(seed)
        self.calls = 0

    def randrange(self, *args):
        self.calls += 1
        return super().randrange(*args)


class ConfiguredRuntime(unittest.TestCase):
    def call(self, worker, op, payload=None, version=2):
        return worker.handle({"v": version, "id": "configured-request", "op": op, "payload": payload or {}})

    def test_old_health_start_and_new_stateless_requests_do_not_replace_session(self):
        worker = Worker()
        self.assertEqual(self.call(worker, "health", version=1), {"v": 1, "id": "configured-request", "ok": True,
                         "data": {"runtime": "r02-t04-a", "rules_version": "classic-1.0.1", "opponent": "random-legal-v1"}})
        old = self.call(worker, "start_solo", PROFILE, version=1)["data"]
        self.assertNotIn("rules_snapshot", old)
        session = worker.solo
        self.assertEqual(self.call(worker, "health")["data"]["capabilities"]["core_state_schema"], 2)
        self.assertEqual(len(self.call(worker, "rules.describe")["data"]["presets"]), 4)
        request, manifest = pack_request("fast-opening")
        compiled = self.call(worker, "rules.compile", {"rules_request": request, "rule_pack_manifests": [manifest]})
        self.assertEqual(compiled["data"]["rules_snapshot"]["parameters"]["opening_dd6"], "6")
        validated = self.call(worker, "rules.validate_pack", {"pack_json": json.dumps(manifest)})
        self.assertEqual(validated["data"]["pack_ref"], pack_ref(manifest))
        self.assertIs(worker.solo, session)
        self.assertFalse(session.closed)
        self.assertEqual(self.call(worker, "get_view")["error"]["code"], "UNSUPPORTED_PROTOCOL")
        self.assertEqual(self.call(worker, "get_view", version=1)["data"], old)
        self.assertFalse(self.call(worker, "rules.describe", version=1)["ok"])
        duplicate = json.dumps(manifest).replace('"kind": "declarative"', '"kind": "declarative", "kind": "declarative"')
        self.assertEqual(self.call(worker, "rules.validate_pack", {"pack_json": duplicate})["error"]["code"], "INVALID_RULE_PACK")

    def test_failed_start_retains_old_session_then_success_changes_fixed_version(self):
        worker = Worker()
        self.call(worker, "start_solo", PROFILE, version=1)
        original = worker.solo
        request = default_request("loan")
        bad = deepcopy(request); bad["skill_flags"]["Cloud"] = 1
        self.assertEqual(self.call(worker, "start_solo", {**PROFILE, "rules_request": bad, "rule_pack_manifests": []})["error"]["code"], "INVALID_RULES")
        self.assertIs(worker.solo, original)
        self.assertFalse(original.closed)
        started = self.call(worker, "start_solo", {**PROFILE, "rules_request": request, "rule_pack_manifests": []})
        self.assertTrue(started["ok"], started)
        self.assertTrue(original.closed)
        self.assertEqual(started["v"], 2)
        self.assertEqual(started["data"]["rules_hash"], compile_rules(request)["rules_hash"])
        for op in ("get_view", "leave"):
            self.assertEqual(self.call(worker, op, version=1)["error"]["code"], "UNSUPPORTED_PROTOCOL")
        self.assertTrue(self.call(worker, "leave")["ok"])
        self.assertIsNone(worker.solo)

    def test_session_hash_tokens_conflicts_and_private_replay_apply_once(self):
        state = new_match(["A", "B"], "session-lucky", compile_rules(default_request("lucky")))
        for p in state["players"].values(): p["dd6"] = "6"
        session = MatchSession(state)
        expected = expected_turn(state)
        self.assertEqual(set(expected), {"match_id", "game_id", "turn_index", "rules_hash"})
        self.assertEqual(session.apply_round("same", {k: v for k, v in expected.items() if k != "rules_hash"}, {}, {}, {})["error"]["code"], "INVALID_REQUEST")
        self.assertEqual(session.apply_round("same", {**expected, "rules_hash": "sha256:" + "0" * 64}, {}, {}, {})["error"]["code"], "STALE_TURN")
        self.assertEqual(session.apply_round("same", expected, {"A": "Bi", "B": "Bi"}, {}, {})["error"]["code"], "MISSING_LUCKY_TOKEN")
        args = ("same", expected, {"A": "Bi", "B": "Bi"}, {}, {"A": 0, "B": 9999})
        result = session.apply_round(*args)
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["ledger"]["actions"]["A"]["actual_move"], "Pragon")
        self.assertEqual(session.apply_round(*args), result)
        self.assertEqual(session.apply_round(*args[:-1], {"A": 1, "B": 9999})["error"]["code"], "REQUEST_CONFLICT")
        replay = session.replay_inputs()
        self.assertEqual(len(replay), 1)
        self.assertEqual(replay[0]["rules_snapshot"], state["rules_snapshot"])
        self.assertEqual(replay[0]["lucky_tokens"], {"A": 0, "B": 9999})
        replay[0]["lucky_tokens"]["A"] = 9
        self.assertEqual(session.replay_inputs()[0]["lucky_tokens"]["A"], 0)
        v1 = MatchSession(new_match(["A", "B"], "classic"))
        self.assertEqual(v1.apply_round("old", expected_turn(v1.snapshot()), {"A": "Charge", "B": "Charge"}, {}, {})["error"]["code"], "INVALID_LUCKY_TOKEN")

    def test_reserved_independent_streams_retry_and_two_sessions_do_not_mix(self):
        branch, lucky = CountTokens(9), CountTokens(10)
        now = [0.0]
        solo = SoloGame(PROFILE, rules_snapshot=compile_rules(default_request("firepower")), rng=ChargeRandom(1),
                        token_rng=branch, lucky_rng=lucky, clock=lambda: now[0])
        self.assertEqual((branch.calls, lucky.calls), (2, 2))
        original = deepcopy(solo.tokens), deepcopy(solo.lucky_tokens)
        for _ in range(4): solo.get_view()
        submitted = solo.submit(solo.view_id, "Charge")
        self.assertEqual(solo.submit(solo.view_id, "Charge"), submitted)
        self.assertEqual((solo.tokens, solo.lucky_tokens), original)
        self.assertEqual((branch.calls, lucky.calls), (2, 2))
        self.assertEqual(solo.session.snapshot()["players"][PROFILE["profile_id"]]["dd6"], "12")
        other = SoloGame(PROFILE, rules_snapshot=compile_rules(default_request("loan")), rng=ChargeRandom(1))
        other.submit(other.view_id, "Charge")
        self.assertEqual(other.session.snapshot()["players"][PROFILE["profile_id"]]["dd6"], "12")
        self.assertNotEqual(solo.rules_snapshot["rules_hash"], other.rules_snapshot["rules_hash"])
        self.assertNotIn("lucky_tokens", json.dumps(submitted))
        self.assertNotIn("choice_tokens", json.dumps(submitted))
        now[0] = 2
        reveal = solo.get_view()
        self.assertEqual(reveal["phase"], "revealed")
        now[0] = 6
        self.assertEqual(solo.get_view()["phase"], "selecting")
        self.assertEqual((branch.calls, lucky.calls), (4, 4))
        self.assertEqual(solo.rules_snapshot["parameters"]["charge_gain_dd6"], "12")

    def test_pack_changes_real_balances_and_certain_luck_visible_identity(self):
        request, manifest = pack_request("fast-opening")
        solo = SoloGame(PROFILE, rules_snapshot=compile_rules(request, [manifest]), rule_pack_manifests=[manifest], rng=ChargeRandom(1))
        self.assertTrue(all(p["resources"]["dd6"] == "6" for p in solo.get_view()["participants"]))
        solo.submit(solo.view_id, "Charge")
        self.assertTrue(all(p["dd6"] == "18" for p in solo.session.snapshot()["players"].values()))
        request, manifest = pack_request("certain-luck")
        state = new_match([PROFILE["profile_id"], "bot_local"], "certain", compile_rules(request, [manifest]))
        for p in state["players"].values(): p["dd6"] = "6"
        now = [0.0]
        solo = SoloGame(PROFILE, session=MatchSession(state), rule_pack_manifests=[manifest], rng=ChargeRandom(1), clock=lambda: now[0])
        solo.submit(solo.view_id, "Bi"); now[0] = 2
        view = solo.get_view()
        action = view["public_round"]["actions"][PROFILE["profile_id"]]
        self.assertEqual((action["entry_id"], action["base_move"], action["actual_move"], action["origin"]), ("Bi", "Bi", "Pragon", "normal"))
        self.assertEqual(action["upgrade"], {"kind": "lucky_upgrade", "from": "Bi", "to": "Pragon", "probability_bps": 10000})
        self.assertEqual(action["spend"]["dd6"], "6")
        self.assertTrue(any("幸运变招" in line for line in view["summary"]))

    def test_new_public_fields_have_complete_whitelists(self):
        state = new_match(["A", "B"], "private", compile_rules(default_request("lucky")))
        for p in state["players"].values(): p["dd6"] = "6"
        result = resolve_round(state, {"A": "Bi", "B": "Def"}, {}, {"A": 0})
        action = result["ledger"]["actions"]["A"]
        action["private"] = action["spend"]["private"] = action["upgrade"]["private"] = "private-sentinel"
        snapshot = result["next_state"]["rules_snapshot"]
        snapshot["private"] = snapshot["parameters"]["private"] = "private-sentinel"
        self.assertNotIn("private-sentinel", json.dumps(public_round(result, "test")))
        self.assertNotIn("private-sentinel", json.dumps(rules_view(snapshot)))
        _, manifest = pack_request("fast-opening")
        for target in (manifest, manifest["presets"][0], manifest["presets"][0]["skill_defaults"], manifest["presets"][0]["parameters"]):
            target["private"] = "private-sentinel"
        self.assertNotIn("private-sentinel", json.dumps(pack_view(manifest)))

    def test_v2_tutorial_restarts_with_pinned_classic_rules(self):
        now = [0.0]
        classic = compile_rules(default_request())
        game = TutorialGame(PROFILE, rules_snapshot=classic, clock=lambda: now[0])
        first = game.get_view()["match_id"]
        for entry in ("Charge", "Def", "Bi"):
            game.submit(game.view_id, entry); now[0] += 2
            game.get_view(); game.advance(game.view_id)
        self.assertNotEqual(game.get_view()["match_id"], first)
        self.assertEqual(game.session.snapshot()["schema_version"], 2)
        self.assertEqual(game.get_view()["rules_snapshot"], classic)
        self.assertTrue(all(p["resources"]["dd6"] == "0" for p in game.get_view()["participants"]))

    def test_real_worker_jsonl_versions_and_configured_start(self):
        request, manifest = pack_request("fast-opening")
        frames = [{"v": 1, "id": "health1", "op": "health", "payload": {}},
                  {"v": 2, "id": "health2", "op": "health", "payload": {}},
                  {"v": 2, "id": "pack", "op": "rules.validate_pack", "payload": {"pack_json": json.dumps(manifest)}},
                  {"v": 2, "id": "start", "op": "start_solo", "payload": {**PROFILE, "rules_request": request, "rule_pack_manifests": [manifest]}},
                  {"v": 1, "id": "mixed", "op": "get_view", "payload": {}},
                  {"v": 2, "id": "view", "op": "get_view", "payload": {}},
                  {"v": 2, "id": "leave", "op": "leave", "payload": {}}]
        env = dict(os.environ, PYTHONPATH=os.pathsep.join(str(ROOT / path) for path in ("game/core", "game/runtime")))
        process = subprocess.run([sys.executable, "-u", "-m", "deidei_runtime.worker"], cwd=ROOT, env=env,
                                 input="".join(json.dumps(f) + "\n" for f in frames), text=True, capture_output=True, timeout=10)
        self.assertEqual(process.returncode, 0, process.stderr)
        replies = [json.loads(line) for line in process.stdout.splitlines()]
        self.assertEqual([r["v"] for r in replies], [f["v"] for f in frames])
        self.assertEqual(replies[4]["error"]["code"], "UNSUPPORTED_PROTOCOL")
        self.assertTrue(all(replies[i]["ok"] for i in (0, 1, 2, 3, 5, 6)))
        self.assertEqual(replies[3]["data"]["rules_snapshot"], compile_rules(request, [manifest]))
        self.assertTrue(all(p["resources"]["dd6"] == "6" for p in replies[3]["data"]["participants"]))
        self.assertEqual(replies[3]["data"], replies[5]["data"])


if __name__ == "__main__":
    unittest.main()
