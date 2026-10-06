"""Configured rules: independent expectations, compatibility and rejected trust-boundary inputs."""
from copy import deepcopy
import itertools
import json
from pathlib import Path
import unittest

from deidei_core.api import list_options, new_match, required_tokens, resolve_round
from deidei_core.rules import (SKILLS, SKILL_ENTRIES, compile_rules, default_request,
                               pack_ref, parse_pack, validate_snapshot)
from deidei_core.wire import decode_state
from test_rules import CASES, fixture

ROOT = Path(__file__).resolve().parents[3]


def configured(preset="classic", ids=("A", "B"), flags=None, charge=None):
    request = default_request(preset)
    request["skill_flags"].update(flags or {})
    if charge is not None:
        request["preset_params"] = {"firepower_charge_dd6": charge}
    return new_match(list(ids), "configured", compile_rules(request))


def funded(preset="classic", ids=("A", "B"), flags=None, charge=None, changes=None):
    state = configured(preset, ids, flags, charge)
    state["turn_index"] = "6"
    for pid, player in state["players"].items():
        player["dd6"] = "120"
        player.update((changes or {}).get(pid, {}))
    return state


def classic_projection(value):
    if isinstance(value, list):
        return [classic_projection(v) for v in value]
    if not isinstance(value, dict):
        return value
    result = {k: classic_projection(v) for k, v in value.items()
              if k not in {"rules_snapshot", "rules_hash", "base_move", "upgrade"}}
    if result.get("rules_version") == "configured-1.0.0":
        result.update(schema_version=1, rules_version="classic-1.0.1")
    return result


class ConfiguredRules(unittest.TestCase):
    def run_round(self, state, moves, lucky=None, choice=None):
        before = deepcopy(state)
        result = resolve_round(state, moves, choice or {}, lucky or {})
        self.assertEqual(state, before)
        self.assertTrue(result["ok"], result)
        decode_state(result["next_state"])
        return result

    def test_every_classic_case_v2_equals_v1(self):
        snapshot = compile_rules(default_request())
        for cid, variant, moves, changes, *_rest, tokens in CASES:
            with self.subTest(case=cid, variant=variant):
                old = fixture(moves, changes)
                state = {**deepcopy(old), "schema_version": 2, "rules_version": "configured-1.0.0",
                         "rules_snapshot": deepcopy(snapshot), "rules_hash": snapshot["rules_hash"]}
                submissions = {pid: move for pid, move in moves.items() if move is not None}
                self.assertEqual(list_options(old, "A"), list_options(state, "A"))
                self.assertEqual(classic_projection(resolve_round(state, submissions, tokens, {})),
                                 resolve_round(old, submissions, tokens))

    def test_all_256_flags_keep_charge_def_and_disabled_entry_order(self):
        for bits in itertools.product((False, True), repeat=8):
            flags = dict(zip(SKILLS, bits))
            state = configured(flags=flags)
            options = list_options(state, "A")
            self.assertEqual([o["doc_id"] for o in options], [f"E{i:02d}" for i in range(1, 34)])
            self.assertTrue(options[0]["available"])
            self.assertTrue(options[2]["available"])
            by_entry = {o["entry_id"]: o for o in options}
            for skill, entries in SKILL_ENTRIES.items():
                if not flags[skill]:
                    for entry in entries:
                        self.assertEqual(by_entry[entry]["reason_code"], "RULE_DISABLED")
                        rejected = resolve_round(state, {"A": entry, "B": "Charge"}, {}, {})
                        self.assertEqual(rejected["error"]["code"], "RULE_DISABLED")
            result = self.run_round(state, {"A": "Def", "B": "Charge"})
            self.assertEqual(result["next_state"]["players"]["A"]["nx_charge"], "1" if flags["NieXiang"] else "0")

    def test_disabled_mechanism_state_is_rejected(self):
        invalid = {"Cloud": {"lightning": "1", "cloud_uses": "1"},
                   "Bomb": {"mature_bombs": "1", "bomb_placement_count": "1",
                            "pending_bombs": [{"game_id": "configured:g1", "placed_turn": "5", "mature_at_turn_end": "6"}]},
                   "NieXiang": {"nx_charge": "1", "latest_copyable_move": "NieXiang"},
                   "JuYan": {"enhanced_xiao": True}, "LiQiang": {"liq_used": True},
                   "TianLiJun": {"tian_uses": "1"}, "ZhangXinWei": {"zhang_used": True, "latest_copyable_move": "Three"},
                   "ZengYi": {"zeng_state": "ready"}}
        for skill, fields in invalid.items():
            for field, value in fields.items():
                with self.subTest(skill=skill, field=field):
                    state = funded(flags={skill: False}, changes={"A": {field: value}})
                    with self.assertRaises(ValueError):
                        decode_state(state)

    def test_disabled_copy_history_and_nx_effects(self):
        state = funded(flags={"ZhangXinWei": False, "NieXiang": False})
        result = self.run_round(state, {"A": "BigBi", "B": "Def"})
        players = result["next_state"]["players"]
        self.assertEqual(players["A"]["last_actual_move"], "BigBi")
        self.assertIsNone(players["A"]["latest_copyable_move"])
        self.assertEqual(players["B"]["nx_charge"], "0")

    def test_firepower_both_values_and_absorbers_preserve_old_balance(self):
        for amount in ("12", "30"):
            state = funded("firepower", ids=tuple("ABCD"), charge=amount,
                           changes={"A": {"dd6": "6"}, "B": {"dd6": "12"}, "C": {"dd6": "6"}, "D": {"dd6": "6"}})
            result = self.run_round(state, {"A": "Charge", "B": "Charge", "C": "Absorb", "D": "Absorb"})
            players = result["next_state"]["players"]
            self.assertEqual([players[p]["dd6"] for p in "AB"], ["6", "12"])
            self.assertEqual([players[p]["dd6"] for p in "CD"], [str(int(amount)*2)]*2)

    def test_firepower_cloud_tian_and_xiaobei(self):
        for mode in ("Cloud", "TianLiJun", "XiaoBei"):
            state = funded("firepower", charge="30", changes={"A": {"dd6": "6"}})
            result = self.run_round(state, {"A": "Charge", "B": mode})
            ledger = result["ledger"]["post_turn_players"]
            self.assertEqual(ledger["A"]["dd6"], "6" if mode == "Cloud" else "0" if mode == "TianLiJun" else "36")
            if mode == "Cloud":
                self.assertEqual(ledger["B"]["lightning"], "1")
            if mode == "XiaoBei":
                self.assertEqual(result["ledger"]["eliminated_ids"], ["B"])

    def test_firepower_liqiang_zero_failure_only(self):
        for balance in ("0", "6"):
            state = funded("firepower", charge="30", changes={"A": {"dd6": balance}})
            result = self.run_round(state, {"A": "LiQiang", "B": "Def"})
            self.assertEqual(result["next_state"]["players"]["A"]["dd6"], "30" if balance == "0" else "6")

    def test_loan_each_game_not_each_turn_and_recovery_no_refill(self):
        state = configured("loan", ids=tuple("ABC"))
        self.assertEqual([p["dd6"] for p in state["players"].values()], ["6"]*3)
        result = self.run_round(state, {"A": "Bi", "B": "Def", "C": "Charge"})
        self.assertEqual(result["transition"]["kind"], "restart_survivors")
        self.assertEqual(result["ledger"]["post_turn_players"]["C"]["dd6"], "12")
        next_state = result["next_state"]
        self.assertEqual([next_state["players"][p]["dd6"] for p in "AB"], ["6", "6"])
        result = self.run_round(next_state, {"A": "Charge", "B": "Charge"})
        self.assertEqual(result["next_state"]["players"]["A"]["dd6"], "12")
        result = self.run_round(result["next_state"], {"A": "ZengYi", "B": "Charge"})
        self.assertEqual(result["next_state"]["players"]["A"]["dd6"], "0")
        result = self.run_round(result["next_state"], {"B": "Charge"})
        self.assertTrue(result["ledger"]["actions"]["A"]["is_recovery"])
        self.assertEqual(result["next_state"]["players"]["A"]["dd6"], "0")

    def test_lucky_boundaries_original_cost_and_single_step(self):
        for token in (0, 2499, 2500, 9999):
            state = funded("lucky")
            result = self.run_round(state, {"A": "Bi", "B": "Def"}, {"A": token})
            action = result["ledger"]["actions"]["A"]
            self.assertEqual(action["base_move"], "Bi")
            self.assertEqual(action["actual_move"], "Pragon" if token < 2500 else "Bi")
            self.assertEqual(action["spend"]["dd6"], "6")
            self.assertEqual(action["attack6"], "12" if token < 2500 else "6")
            self.assertEqual(result["ledger"]["eliminated_ids"], ["B"] if token < 2500 else [])
            self.assertEqual(result, resolve_round(state, {"A": "Bi", "B": "Def"}, {}, {"A": token}))

    def test_each_normal_lucky_attack_keeps_original_price(self):
        for entry, actual, cost, strength in (("Bi", "Pragon", "6", "12"), ("Pragon", "Three", "12", "18"),
                                              ("Three", "Volvo", "18", "24"), ("Volvo", "BigBi", "24", "30")):
            result = self.run_round(funded("lucky"), {"A": entry, "B": "Absorb"}, {"A": 0})
            action = result["ledger"]["actions"]["A"]
            self.assertEqual((action["base_move"], action["actual_move"], action["spend"]["dd6"], action["attack6"]), (entry, actual, cost, strength))

    def test_lucky_sources_absorb_and_copy_identity(self):
        cases = [("BombPragon", {"mature_bombs": "1"}, "Pragon", "Three", "bomb", "0"),
                 ("BombVolvo", {"mature_bombs": "2"}, "Volvo", "BigBi", "bomb", "0"),
                 ("FreeThree", {"lightning": "3"}, "Three", "Volvo", "lightning", "24"),
                 ("ZhangXinWei", {"latest_copyable_move": "Pragon"}, "Pragon", "Three", "zhang", "18")]
        for entry, changes, base, actual, origin, gain in cases:
            state = funded("lucky", changes={"A": changes, "B": {"dd6": "6"}})
            result = self.run_round(state, {"A": entry, "B": "Absorb"}, {"A": 0})
            action = result["ledger"]["actions"]["A"]
            self.assertEqual((action["entry_id"], action["base_move"], action["actual_move"], action["origin"]), (entry, base, actual, origin))
            self.assertEqual(result["ledger"]["post_turn_players"]["B"]["dd6"], gain)
        state = funded("lucky", changes={"B": {"dd6": "6"}})
        result = self.run_round(state, {"A": "Bi", "B": "Absorb"}, {"A": 0})
        self.assertEqual(result["next_state"]["players"]["A"]["latest_copyable_move"], "Pragon")
        result = self.run_round(result["next_state"], {"A": "ZhangXinWei", "B": "Absorb"}, {"A": 0})
        self.assertEqual(result["ledger"]["actions"]["A"]["actual_move"], "Three")

    def test_upgrade_matching_bigbi_defense_reflect_and_liqiang(self):
        state = funded("lucky")
        result = self.run_round(state, {"A": "Volvo", "B": "Def"}, {"A": 0})
        self.assertEqual(result["ledger"]["eliminated_ids"], [])
        result = self.run_round(state, {"A": "Bi", "B": "Reflect"}, {"A": 0})
        returns = [e for e in result["ledger"]["events"] if e["kind"] == "return"]
        self.assertEqual([e["amount6"] for e in returns], ["12"])
        state["players"]["B"]["last_actual_move"] = "Three"
        result = self.run_round(state, {"A": "LiQiang", "B": "Pragon"}, {"B": 0})
        self.assertEqual(result["ledger"]["actions"]["A"]["condition"], "success")

    def test_composites_cap_and_nonattack_have_no_lucky_consumers(self):
        for entry in ("BigBi", "ZengRewardBigBi", "RotateThree", "FlipVolvo", "BombFlipVolvo", "FreeRotateThree", "Xiao", "NieXiang", "SelfBi", "LiQiang", "Shell", "XiaoBei", "ZengYi", "Charge", "Def"):
            state = funded("lucky", changes={"A": {"lightning": "6", "mature_bombs": "4", "nx_charge": "4",
                           "zeng_state": "ready" if entry == "ZengRewardBigBi" else "unused"}})
            moves = {"A": entry, "B": "Def"}
            tokens = required_tokens(state, moves)
            self.assertEqual(tokens["lucky"], [])
            result = self.run_round(state, moves, choice={p: 1 for p in tokens["choice"]})
            self.assertIsNone(result["ledger"]["actions"]["A"]["upgrade"])

    def test_token_exact_set_types_and_original_legality(self):
        state = funded("lucky")
        for tokens in (None, [], {}, {"B": 0}, {"A": 0, "B": 0}, {"A": True}, {"A": 0.0}, {"A": -1}, {"A": 10000}):
            result = resolve_round(state, {"A": "Bi", "B": "Def"}, {}, tokens)
            self.assertFalse(result["ok"], tokens)
        state["players"]["A"]["dd6"] = "0"
        self.assertEqual(resolve_round(state, {"A": "Bi", "B": "Def"}, {}, {"A": 0})["error"]["code"], "UNAVAILABLE_MOVE")
        old = new_match(["A", "B"], "v1")
        self.assertFalse(resolve_round(old, {"A": "Charge", "B": "Def"}, {}, {})["ok"])

    def test_strict_requests_hash_and_session_isolation(self):
        request = default_request()
        mutations = [{"schema_version": True}, {"schema_version": 2}, {"preset_id": "other"},
                     {"extra": 1}, {"skill_flags": {}}, {"skill_flags": dict.fromkeys(SKILLS, 1)},
                     {"preset_params": {"opening_dd6": "6"}}, {"pack_refs": [{}]}]
        for mutation in mutations:
            with self.assertRaises(ValueError):
                compile_rules({**request, **mutation})
        snapshot = compile_rules(default_request("loan"))
        snapshot["parameters"]["opening_dd6"] = "0"
        with self.assertRaises(ValueError):
            validate_snapshot(snapshot)
        a, b = configured("firepower"), configured("loan")
        for _ in range(3):
            a = self.run_round(a, {"A": "Charge", "B": "Charge"})["next_state"]
            b = self.run_round(b, {"A": "Charge", "B": "Charge"})["next_state"]
        self.assertEqual(a["players"]["A"]["dd6"], "36")
        self.assertEqual(b["players"]["A"]["dd6"], "24")

    def test_packs_real_resource_and_100_percent_transform(self):
        for filename, expected_opening, expected_charge in (("fast-opening.deidei-pack.json", "6", "18"), ("certain-luck.deidei-pack.json", "0", "6")):
            manifest = parse_pack((ROOT / "docs/rules/packs" / filename).read_bytes())
            ref = pack_ref(manifest)
            request = {**default_request(), "preset_id": f"pack:{ref['id']}:{manifest['presets'][0]['id']}", "pack_refs": [ref]}
            rules = compile_rules(request, [manifest])
            state = new_match(["A", "B"], "pack", rules)
            self.assertEqual(state["players"]["A"]["dd6"], expected_opening)
            result = self.run_round(state, {"A": "Charge", "B": "Charge"})
            self.assertEqual(result["next_state"]["players"]["A"]["dd6"], expected_charge)
            if filename.startswith("certain"):
                result = self.run_round(result["next_state"], {"A": "Bi", "B": "Def"}, {"A": 9999})
                self.assertEqual(result["ledger"]["actions"]["A"]["actual_move"], "Pragon")
            damaged = deepcopy(manifest)
            damaged["author"] = "different"
            with self.assertRaises(ValueError):
                compile_rules(request, [damaged])

    def test_pack_rejects_duplicate_keys_depth_script_url_control_and_limits(self):
        raw = (ROOT / "docs/rules/packs/fast-opening.deidei-pack.json").read_text()
        bad = [raw.replace('"kind": "declarative"', '"kind": "declarative", "kind": "declarative"'),
               '['*9+'0'+']'*9, ' '*8193]
        base = json.loads(raw)
        for mutation in ({"script": "x"}, {"name": "https://bad.test"}, {"author": "bad\ntext"},
                         {"author": "bad\u200btext"}, {"name": "x"*41}, {"version": "01.0.0"}, {"presets": []}):
            bad.append(json.dumps({**base, **mutation}))
        changed = deepcopy(base)
        changed["presets"][0]["parameters"]["lucky_probability_bps"] = True
        bad.append(json.dumps(changed))
        for value in bad:
            with self.assertRaises((ValueError, UnicodeError)):
                parse_pack(value)

    def test_fixed_cross_language_golden_vectors_and_zero_luck_pack(self):
        for vector in json.loads((ROOT / "docs/rules/packs/golden-vectors.json").read_text()):
            self.assertEqual(compile_rules(vector["request"], vector["manifests"]), vector["snapshot"])
            if "pack_ref" in vector:
                self.assertEqual(pack_ref(vector["manifests"][0]), vector["pack_ref"])
        manifest = parse_pack((ROOT / "docs/rules/packs/fast-opening.deidei-pack.json").read_bytes())
        ref = pack_ref(manifest)
        rules = compile_rules({**default_request(), "preset_id": "pack:community.fast-opening:fast-opening", "pack_refs": [ref]}, [manifest])
        state = new_match(["A", "B"], "zero-luck", rules)
        self.assertEqual(required_tokens(state, {"A": "Bi", "B": "Def"})["lucky"], [])
        result = self.run_round(state, {"A": "Bi", "B": "Def"})
        self.assertEqual(result["ledger"]["actions"]["A"]["actual_move"], "Bi")
        self.assertFalse(resolve_round(state, {"A": "Bi", "B": "Def"}, {}, {"A": 0})["ok"])
