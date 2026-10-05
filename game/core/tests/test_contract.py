"""Trust-boundary, entry-cost and invariant checks for CONTRACT-R02 1.0."""
from copy import deepcopy
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile
import unittest

from deidei_core.api import list_options, new_match, resolve_round
from deidei_core.engine import blocks, evaluate, prepare
from deidei_core.wire import decode_state
from test_rules import fixture, pending, snapshot

ZERO = {"dd6": "0", "lightning": "0", "nx_charge": "0", "mature_bombs": "0", "reward_stock": "0"}

# Independent transcription of E01–E33: entry, actual identity, origin, required resources.
ENTRIES = [
    ("Charge", "Charge", "normal", {}), ("Bi", "Bi", "normal", {"dd6": "6"}),
    ("Def", "Def", "normal", {}), ("Three", "Three", "normal", {"dd6": "18"}),
    ("ThreeDef", "ThreeDef", "normal", {}), ("BigBi", "BigBi", "normal", {"dd6": "30"}),
    ("Reflect", "Reflect", "normal", {"dd6": "6"}), ("SelfBi", "SelfBi", "normal", {}),
    ("Cloud", "Cloud", "normal", {}), ("Bomb", "Bomb", "normal", {"dd6": "6"}),
    ("Xiao", "Xiao", "normal", {"dd6": "2"}), ("Pragon", "Pragon", "normal", {"dd6": "12"}),
    ("PragonDef", "PragonDef", "normal", {}), ("Volvo", "Volvo", "normal", {"dd6": "24"}),
    ("VolvoDef", "VolvoDef", "normal", {}), ("RotateThree", "RotateThree", "normal", {"dd6": "36"}),
    ("XiaoBei", "XiaoBei", "normal", {"dd6": "42"}), ("FlipVolvo", "FlipVolvo", "normal", {"dd6": "48"}),
    ("Shell", "Shell", "normal", {"dd6": "60"}), ("Absorb", "Absorb", "normal", {"dd6": "6"}),
    ("NieXiang", "NieXiang", "normal", {"nx_charge": "4"}), ("NieXiangDef", "NieXiangDef", "normal", {}),
    ("JuYan", "JuYan", "normal", {}), ("TianLiJun", "TianLiJun", "normal", {}),
    ("ZhangXinWei", "NieXiang", "zhang", {}), ("LiQiang", "LiQiang", "normal", {}),
    ("BombPragon", "Pragon", "bomb", {"mature_bombs": "1"}), ("BombVolvo", "Volvo", "bomb", {"mature_bombs": "2"}),
    ("BombFlipVolvo", "FlipVolvo", "bomb", {"mature_bombs": "4"}), ("FreeThree", "Three", "lightning", {"lightning": "3"}),
    ("FreeRotateThree", "RotateThree", "lightning", {"lightning": "6"}), ("ZengYi", "ZengYi", "normal", {}),
    ("ZengRewardBigBi", "BigBi", "zeng_reward", {"reward_stock": "1"}),
]

REJECTIONS = [
    ("C002", "Bi", {"dd6": "0"}, "INSUFFICIENT_DD"),
    ("C014", "Xiao", {"dd6": "0", "enhanced_xiao": True}, "INSUFFICIENT_DD"),
    ("C040_empty", "ZhangXinWei", {}, "NO_COPY_RECORD"),
    ("C040_used", "ZhangXinWei", {"latest_copyable_move": "Three", "zhang_used": True}, "ALREADY_USED"),
    ("C057_pragon", "BombPragon", {"pending_bombs": [pending()]}, "INSUFFICIENT_BOMBS"),
    ("C057_volvo", "BombVolvo", {"mature_bombs": "1"}, "INSUFFICIENT_BOMBS"),
    ("C057_flip", "BombFlipVolvo", {"mature_bombs": "3"}, "INSUFFICIENT_BOMBS"),
    ("C057_three", "FreeThree", {"lightning": "2"}, "INSUFFICIENT_LIGHTNING"),
    ("C057_rotate", "FreeRotateThree", {"lightning": "5"}, "INSUFFICIENT_LIGHTNING"),
    ("C072_zhang", "ZhangXinWei", {"latest_copyable_move": "Three", "zhang_used": True}, "ALREADY_USED"),
    ("C072_liq", "LiQiang", {"liq_used": True}, "ALREADY_USED"),
    ("C072_zeng", "ZengYi", {"zeng_state": "spent"}, "ALREADY_USED"),
    ("C077", "NieXiang", {"nx_charge": "3"}, "INSUFFICIENT_CHARGE"),
    ("reward_not_ready", "ZengRewardBigBi", {}, "NO_REWARD"),
]


class ContractCases(unittest.TestCase):
    def reject(self, state, submissions, tokens, code, field=None):
        before = snapshot([state, submissions, tokens])
        result = resolve_round(state, submissions, tokens)
        self.assertEqual(set(result), {"ok", "error"})
        self.assertFalse(result["ok"])
        self.assertEqual(set(result["error"]), {"code", "player_id", "field"})
        self.assertEqual(result["error"]["code"], code, result)
        if field is not None:
            self.assertEqual(result["error"]["field"], field, result)
        self.assertEqual(snapshot([state, submissions, tokens]), before)

    def test_initial_state_exact_and_separate(self):
        state = new_match(["B", "A"], "match")
        pristine = {
            "dd6": "0", "lightning": "0", "nx_charge": "0", "mature_bombs": "0", "pending_bombs": [],
            "bomb_placement_count": "0", "cloud_uses": "0", "tian_uses": "0", "zhang_used": False,
            "liq_used": False, "enhanced_xiao": False, "last_actual_move": None, "latest_copyable_move": None,
            "zeng_state": "unused", "reward_due_turn": None,
        }
        self.assertEqual(state, {
            "schema_version": 1, "rules_version": "classic-1.0.1", "match_id": "match", "game_id": "match:g1",
            "game_index": "1", "turn_index": "1", "roster": ["A", "B"], "active_ids": ["A", "B"],
            "status": "playing", "winner_id": None, "players": {"A": pristine, "B": pristine},
        })
        self.assertIsNot(state["roster"], state["active_ids"])
        self.assertIsNot(state["players"]["A"]["pending_bombs"], state["players"]["B"]["pending_bombs"])
        expected = deepcopy(state)
        expected["turn_index"] = "2"
        for p in expected["players"].values():
            p.update(dd6="6", last_actual_move="Charge")
        self.assertEqual(resolve_round(state, {"A": "Charge", "B": "Charge"}, {})["next_state"], expected)

    def test_new_match_bad_inputs(self):
        for ids in ([], ["A"], ["A"] * 2, list("ABCDEFG"), "AB", ["A", ""], ["A", "中文"], ["A", "x" * 65], ["A", True], ["A", []], ["A", "a\n"]):
            with self.assertRaises(ValueError):
                new_match(ids, "match")
        for mid in (None, "", 1, True, []):
            with self.assertRaises(ValueError):
                new_match(["A", "B"], mid)
        self.assertEqual(len(new_match(list("ABCDEF"), "match")["active_ids"]), 6)

    def test_options_have_stable_order_schema_and_do_not_mutate(self):
        state = fixture({"A": "Charge", "B": "Charge"})
        before = snapshot(state)
        options = list_options(state, "A")
        self.assertEqual(snapshot(state), before)
        self.assertEqual([o["entry_id"] for o in options], [e[0] for e in ENTRIES])
        self.assertEqual([o["doc_id"] for o in options], [f"E{i:02d}" for i in range(1, 34)])
        for option in options:
            self.assertEqual(set(option), {"entry_id", "doc_id", "available", "reason_code", "required", "spend", "forced"})
            self.assertIs(type(option["available"]), bool)
            self.assertIs(type(option["forced"]), bool)
            self.assertEqual(set(option["required"]), set(ZERO))
            self.assertEqual(set(option["spend"]), set(ZERO))
        options[0]["spend"]["dd6"] = "999"
        self.assertEqual(list_options(state, "A")[0]["spend"], ZERO)

    def test_python_input_aliases_have_json_equivalent_results(self):
        state = fixture({"A": "Charge", "B": "Charge"})
        bomb = pending()
        state["players"]["A"]["pending_bombs"] = [bomb, bomb]
        state["players"]["B"] = state["players"]["A"]
        before = snapshot(state)
        result = resolve_round(state, {"A": "Charge", "B": "Charge"}, {})
        self.assertTrue(result["ok"], result)
        self.assertEqual(snapshot(state), before)
        self.assertEqual(result, resolve_round(json.loads(json.dumps(state)), {"A": "Charge", "B": "Charge"}, {}))
        players = result["next_state"]["players"]
        self.assertEqual(players["A"]["mature_bombs"], "2")
        self.assertIsNot(players["A"], players["B"])
        self.assertIsNot(players["A"]["pending_bombs"], players["B"]["pending_bombs"])

    def check_entry(self, index, data):
        entry, actual, origin, cost = data
        state = fixture({"A": entry, "B": "Def"}, {"A": {
            "lightning": "6", "nx_charge": "6", "mature_bombs": "4", "latest_copyable_move": "NieXiang",
            "zeng_state": "ready" if entry == "ZengRewardBigBi" else "unused",
        }})
        option = list_options(state, "A")[index]
        expected = {**ZERO, **cost}
        self.assertTrue(option["available"], option)
        self.assertEqual(option["required"], expected)
        self.assertEqual(option["spend"], expected)
        tokens = {"A": 0} if actual in {"RotateThree", "FlipVolvo"} else {}
        before = snapshot(state)
        r = resolve_round(state, {"A": entry, "B": "Def"}, tokens)
        self.assertTrue(r["ok"], r)
        self.assertEqual(snapshot(state), before)
        action = r["ledger"]["actions"]["A"]
        self.assertEqual(action["spend"], expected)
        self.assertEqual(action["origin"], origin)
        self.assertEqual(action["actual_move"], actual)
        for key, value in expected.items():
            events = [e for e in r["ledger"]["events"] if e["actor_id"] == "A" and e["resource"] == key and e["kind"] == "resource_spend"]
            self.assertEqual(len(events), int(value != "0"), (entry, key))
            if events:
                self.assertEqual(events[0]["resource_delta"], "-" + value)
        if entry == "NieXiang":
            self.assertEqual(r["ledger"]["post_turn_players"]["A"]["nx_charge"], "2")
        if entry == "ZhangXinWei":
            self.assertEqual(r["ledger"]["post_turn_players"]["A"]["nx_charge"], "6")

    def test_enhanced_required_differs_from_spend(self):
        state = fixture({"A": "Xiao", "B": "Charge"}, {"A": {"dd6": "2", "enhanced_xiao": True}})
        option = next(o for o in list_options(state, "A") if o["entry_id"] == "Xiao")
        self.assertEqual(option["required"], {**ZERO, "dd6": "2"})
        self.assertEqual(option["spend"], ZERO)

    def test_counts_gate_cost_and_forced_options(self):
        state = fixture({"A": "Cloud", "B": "Charge"}, {"A": {"cloud_uses": "1", "tian_uses": "2", "dd6": "0"}})
        options = {o["entry_id"]: o for o in list_options(state, "A")}
        self.assertEqual(options["Cloud"]["required"]["dd6"], "6")
        self.assertEqual(options["TianLiJun"]["required"]["dd6"], "3")
        for entry in ("Cloud", "TianLiJun"):
            self.assertEqual(options[entry]["reason_code"], "INSUFFICIENT_DD")
        state["players"]["A"].update(zeng_state="recovery", last_actual_move="ZengYi")
        for o in list_options(state, "A"):
            self.assertTrue(o["forced"])
            self.assertFalse(o["available"])
            self.assertEqual(o["reason_code"], "FORCED_RECOVERY")
        for move in ("Charge", "ZengYi"):
            self.reject(state, {"A": move, "B": "Charge"}, {}, "INVALID_SUBMISSION")
        r = resolve_round(state, {"B": "Charge"}, {})
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["ledger"]["actions"]["A"]["entry_id"], "ZengYi")

    def test_submission_and_token_contract(self):
        state = fixture({"A": "Charge", "B": "Charge"})
        for submissions in (None, [], {}, {"A": "Charge"}, {"A": "Charge", "B": "Charge", "C": "Charge"},
                            {"A": [], "B": "Charge"}, {"A": "NoMove", "B": "Charge"}, {"A": "Suicide", "B": "Charge"}):
            self.reject(state, submissions, {}, "INVALID_SUBMISSION")
        for token in (None, [], {"A": 0}, {"C": 1}):
            self.reject(state, {"A": "Charge", "B": "Charge"}, token, "INVALID_CHOICE_TOKEN")
        moves = {"A": "RotateThree", "B": "Charge"}
        self.reject(state, moves, {}, "MISSING_CHOICE_TOKEN")
        for token in (True, False, "0", 2, -1, None, [], 0.0):
            self.reject(state, moves, {"A": token}, "INVALID_CHOICE_TOKEN")
        state["players"]["A"]["latest_copyable_move"] = "FlipVolvo"
        self.reject(state, {"A": "ZhangXinWei", "B": "Charge"}, {}, "MISSING_CHOICE_TOKEN")

    def test_finished_and_inactive(self):
        state = fixture({"A": "SelfBi", "B": "Charge"})
        finished = resolve_round(state, {"A": "SelfBi", "B": "Charge"}, {})["next_state"]
        self.reject(finished, {"B": "Charge"}, {}, "MATCH_FINISHED")
        for pid in ("A", "B"):
            self.assertTrue(all(o["reason_code"] == "NOT_ACTIVE" for o in list_options(finished, pid)))
        state = fixture({"A": "Three", "B": "Three", "C": "Bomb"})
        restarted = resolve_round(state, {"A": "Three", "B": "Three", "C": "Bomb"}, {})["next_state"]
        self.assertTrue(all(o["reason_code"] == "NOT_ACTIVE" for o in list_options(restarted, "C")))
        # An inactive account may retain an earlier game's pending bomb, never used by the new game.
        self.assertTrue(resolve_round(restarted, {"A": "Charge", "B": "Charge"}, {})["ok"])
        self.reject(restarted, {"A": "Charge", "B": "Charge", "C": "Charge"}, {}, "INVALID_SUBMISSION")

    def test_finished_after_zeng_start_or_recovery(self):
        for recovery in (False, True):
            state = new_match(["A", "B"], "end")
            if recovery:
                state["turn_index"] = "2"
                state["players"]["A"].update(zeng_state="recovery", last_actual_move="ZengYi")
            moves = {"B": "SelfBi"} if recovery else {"A": "ZengYi", "B": "SelfBi"}
            r = resolve_round(state, moves, {})
            self.assertTrue(r["ok"], r)
            self.assertEqual(r["next_state"]["winner_id"], "A")
            self.assertEqual(r["next_state"]["players"]["A"]["zeng_state"], "waiting" if recovery else "recovery")
            self.reject(r["next_state"], {}, {}, "MATCH_FINISHED")

    def test_state_fields_and_identity_validation(self):
        good = new_match(["A", "B"], "input")
        bad_states = [None, [], {}, {**good, "extra": None}]
        for key in good:
            bad = deepcopy(good)
            del bad[key]
            bad_states.append(bad)
        for field, value in (
            ("schema_version", True), ("schema_version", "1"), ("schema_version", 2),
            ("roster", ["A", "A"]), ("roster", ["A", []]), ("roster", ["A", "\n"]),
            ("active_ids", ["A"]), ("active_ids", ["A", "C"]), ("active_ids", ["A", "A", "B"]),
            ("status", "paused"), ("status", []), ("winner_id", "A"), ("status", "finished"),
            ("players", {"A": good["players"]["A"]}), ("match_id", ""), ("game_id", None),
            ("game_index", "0"), ("turn_index", "0"),
        ):
            bad_states.append({**good, field: value})
        for state in bad_states:
            self.reject(state, {"A": "Charge", "B": "Charge"}, {}, "INVALID_STATE")
        self.reject({**good, "rules_version": "classic-1.0"}, {}, {}, "UNSUPPORTED_RULES_VERSION")
        for value in ("unknown", "BombVolvo", "Suicide", "", [], True):
            bad = deepcopy(good)
            bad["players"]["A"]["last_actual_move"] = value
            self.reject(bad, {}, {}, "INVALID_STATE", "last_actual_move")
        for value in ("Bi", "SelfBi", "LiQiang", "Reflect", "ZengYi", "FreeThree", [], True):
            bad = deepcopy(good)
            bad["players"]["A"]["latest_copyable_move"] = value
            self.reject(bad, {}, {}, "INVALID_STATE", "latest_copyable_move")
        for field in ("zhang_used", "liq_used", "enhanced_xiao"):
            for value in (0, 1, "false", None):
                bad = deepcopy(good)
                bad["players"]["A"][field] = value
                self.reject(bad, {}, {}, "INVALID_STATE", field)
        for field in good["players"]["A"]:
            bad = deepcopy(good)
            del bad["players"]["A"][field]
            self.reject(bad, {}, {}, "INVALID_STATE", "players")
        bad = deepcopy(good)
        bad["players"]["A"]["extra"] = 0
        self.reject(bad, {}, {}, "INVALID_STATE", "players")

    def test_all_quantity_fields_reject_noncanonical_numbers(self):
        for field in ("dd6", "lightning", "nx_charge", "mature_bombs", "bomb_placement_count", "cloud_uses", "tian_uses", "game_index", "turn_index"):
            for invalid in ("00", "01", "-1", "+1", "1.0", "1e2", "NaN", "Infinity", "１", "1\n", " 1", "", 1, 1.0, True, False, None, []):
                state = new_match(["A", "B"], "numbers")
                target = state if field in {"game_index", "turn_index"} else state["players"]["A"]
                target[field] = invalid
                self.reject(state, {"A": "Charge", "B": "Charge"}, {}, "INVALID_STATE", field)

    def test_pending_and_reward_time_validation(self):
        bad_pending = [None, {}, [1], [{**pending(), "extra": 1}], [{**pending(), "game_id": "old-game"}],
                       [{**pending(), "placed_turn": "6"}], [{**pending(), "placed_turn": "4"}],
                       [{**pending(), "mature_at_turn_end": "7"}], [pending(4)],
                       [{**pending(), "mature_at_turn_end": 6}], [{**pending(), "placed_turn": True}]]
        for bombs in bad_pending:
            state = fixture({"A": "Charge", "B": "Charge"}, {"A": {"pending_bombs": bombs}})
            self.reject(state, {"A": "Charge", "B": "Charge"}, {}, "INVALID_STATE")
        for zeng, due in (("bad", None), ([], None), ("unused", "8"), ("recovery", "8"),
                          ("waiting", None), ("waiting", "5"), ("waiting", "9"), ("waiting", 8), ("ready", "8"), ("spent", "8")):
            state = fixture({"A": "Charge", "B": "Charge"}, {"A": {"zeng_state": zeng, "reward_due_turn": due}})
            self.reject(state, {"A": "Charge", "B": "Charge"}, {}, "INVALID_STATE")
        for zeng in ("recovery", "waiting", "ready", "spent"):
            state = new_match(["A", "B"], "too-early")
            state["players"]["A"].update(zeng_state=zeng, last_actual_move="ZengYi", reward_due_turn="5" if zeng == "waiting" else None)
            self.reject(state, {"B": "Charge"}, {}, "INVALID_STATE")

    def test_large_integers_remain_exact_without_global_digit_settings(self):
        state = new_match(["A", "B"], "large")
        huge = "9" * 5000
        state["players"]["A"]["dd6"] = huge
        r = resolve_round(state, {"A": "Charge", "B": "Charge"}, {})
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["next_state"]["players"]["A"]["dd6"], "1" + "0" * 4999 + "5")
        self.assertEqual(state["players"]["A"]["dd6"], huge)
        self.assertTrue(list_options(r["next_state"], "A")[1]["available"])

    def test_import_and_public_calls_without_external_io_or_dependencies(self):
        script = r'''
import sys
sys.path.insert(0, sys.argv[1])
def audit(event, args):
    if event == "open":
        path, mode, flags = args
        # Reading Python's module files is intrinsic to importing; game data IO is forbidden.
        if not isinstance(path, str) or not path.endswith((".py", ".pyc", ".so")) or flags & 3:
            raise AssertionError((event, path))
    if event.startswith(("socket.", "subprocess.", "os.system", "os.fork", "os.posix_spawn")):
        raise AssertionError(event)
sys.addaudithook(audit)
from deidei_core.api import new_match, list_options, resolve_round
state = new_match(["A", "B"], "isolated")
assert len(list_options(state, "A")) == 33
assert resolve_round(state, {"A": "Charge", "B": "Charge"}, {})["ok"]
for prefix in ("tkinter", "torch", "numpy", "gym", "deidei_env", "rl_ai"):
    assert not any(name == prefix or name.startswith(prefix + ".") for name in sys.modules)
'''
        with tempfile.TemporaryDirectory() as directory:
            process = subprocess.run([sys.executable, "-B", "-S", "-c", script,
                                      str(Path(__file__).resolve().parents[1])],
                                     cwd=directory, capture_output=True, text=True, timeout=10)
        self.assertEqual(process.returncode, 0, process.stdout + process.stderr)

    def test_wire_output_exact_action_event_and_ledger_fields(self):
        state = fixture({"A": "SelfBi", "B": "Reflect", "C": "Pragon"})
        r = resolve_round(state, {"A": "SelfBi", "B": "Reflect", "C": "Pragon"}, {})
        self.assertEqual(set(r), {"ok", "ledger", "next_state", "transition"})
        self.assertEqual(set(r["ledger"]), {"match_id", "game_id", "turn_index", "actions", "events", "kills", "eliminated_ids", "post_turn_players"})
        for a in r["ledger"]["actions"].values():
            self.assertEqual(set(a), {"entry_id", "actual_move", "origin", "branch", "condition", "eligible_targets",
                                     "is_recovery", "enhanced_xiao", "attack6", "defense_primary", "defense_return", "spend"})
            self.assertRegex(a["attack6"], r"^(0|[1-9][0-9]*)$")
            for d in (a["defense_primary"], a["defense_return"]):
                if d is not None:
                    self.assertEqual(set(d), {"kind", "match_rule"} if d["kind"] == "unbounded" else {"kind", "sixths", "comparison", "match_rule"})
        events = r["ledger"]["events"]
        self.assertEqual(events, sorted(events, key=lambda e: (e["phase"], e["actor_id"] or "", e["target_id"] or "", e["kind"], e["event_id"])))
        for event in events:
            self.assertEqual(set(event), {"event_id", "phase", "kind", "actor_id", "target_id", "amount6", "resource",
                                         "resource_delta", "source_event_id", "rule_ids", "result", "reason_code"})
            if event["kind"] in {"direct_elimination", "self_elimination"}:
                self.assertIsNone(event["amount6"])

    def test_C075_every_entry_and_fixed_branch_return_reachability(self):
        returned = set()
        for entry, move, origin, cost in ENTRIES:
            branches = ("Three", "SelfBi") if move == "RotateThree" else ("Volvo", "SelfBi") if move == "FlipVolvo" else (None,)
            for branch in branches:
                state = decode_state(fixture({"A": entry, "B": "Reflect"}, {"A": {"latest_copyable_move": "NieXiang", "nx_charge": "4"}}))
                raw = {
                    "A": {"entry_id": entry, "actual_move": move, "origin": origin, "is_recovery": False, "spend": {k: int(v) for k, v in {**ZERO, **cost}.items()}},
                    "B": {"entry_id": "Reflect", "actual_move": "Reflect", "origin": "normal", "is_recovery": False, "spend": {**dict.fromkeys(ZERO, 0), "dd6": 6}},
                }
                actions = prepare(state, raw, {"A": branch} if branch else {})
                returns = [e for e in evaluate(state, actions).events if e["kind"] == "return"]
                kind = branch or move
                expected = kind in {"Bi", "Xiao", "Pragon", "Three", "Volvo", "NieXiang"}
                self.assertEqual(bool(returns), expected, (entry, branch))
                for event in returns:
                    self.assertEqual(event["amount6"], str(actions["A"]["attack6"]))
                    self.assertEqual(event["target_id"], "A")
                    self.assertEqual(actions["A"]["defense_return"]["sixths"], 0)
                    returned.add(entry)
        self.assertEqual(returned, {"Bi", "Xiao", "Pragon", "Three", "Volvo", "NieXiang", "ZhangXinWei", "RotateThree",
                                  "FlipVolvo", "BombPragon", "BombVolvo", "BombFlipVolvo", "FreeThree", "FreeRotateThree"})

    def test_C076_copy_record_threshold_and_exclusions(self):
        for move, other, changes, expected, tokens in (
            ("Pragon", "PragonDef", {}, "Pragon", {}), ("Bi", "Def", {}, "Volvo", {}),
            ("SelfBi", "Reflect", {}, "Volvo", {}), ("LiQiang", "Reflect", {"B": {"last_actual_move": "Reflect"}}, "Volvo", {}),
            ("Reflect", "Three", {}, "Volvo", {}), ("RotateThree", "Reflect", {}, "RotateThree", {"A": 0}),
        ):
            state = fixture({"A": move, "B": other}, {"A": {"latest_copyable_move": "Volvo"}, **changes})
            r = resolve_round(state, {"A": move, "B": other}, tokens)
            self.assertTrue(r["ok"], r)
            self.assertEqual(r["ledger"]["post_turn_players"]["A"]["latest_copyable_move"], expected)

    def test_R10_counter_numeric_boundary_is_separate_from_category(self):
        # Attribute-level checks; strength 100 is not an additional public move.
        for defense in ("Reflect", "Absorb", "Cloud"):
            state = decode_state(fixture({"A": "Pragon", "B": defense}))
            raw = {pid: {"entry_id": move, "actual_move": move, "origin": "normal", "is_recovery": False, "spend": dict.fromkeys(ZERO, 0)}
                   for pid, move in (("A", "Pragon"), ("B", defense))}
            actions = prepare(state, raw, {})
            actions["A"]["attack6"] = 600
            self.assertTrue(blocks(actions["A"], actions["B"]))
            actions["A"]["attack6"] = 601
            self.assertFalse(blocks(actions["A"], actions["B"]))

    def test_R18_regenerates_liqiang_condition_in_each_local_view(self):
        moves = {"A": "RotateThree", "B": "FlipVolvo", "C": "LiQiang", "D": "Absorb", "E": "Charge"}
        state = fixture(moves, {"B": {"last_actual_move": "FlipVolvo"}, "C": {"dd6": "0"}})
        r = resolve_round(state, moves, {"A": 1, "B": 0})
        self.assertTrue(r["ok"], r)
        # A's local LiQiang fails and charges: Three kills C/E, SelfBi only D.
        # In the full table B repeats, making LiQiang successful; do not reselect A.
        self.assertEqual(r["ledger"]["actions"]["A"]["branch"], "Three")
        self.assertEqual(r["ledger"]["actions"]["B"]["branch"], "SelfBi")
        self.assertEqual(r["ledger"]["actions"]["C"]["condition"], "success")
        self.assertEqual(r["ledger"]["actions"]["C"]["eligible_targets"], ["B"])
        self.assertEqual(r["ledger"]["kills"], {"A": ["E"], "B": ["D"], "C": [], "D": [], "E": []})
        self.assertEqual(r["ledger"]["eliminated_ids"], ["D", "E"])

    def test_R18_both_die_prefers_more_own_kills(self):
        moves = {"A": "RotateThree", "B": "Shell", "C": "Charge"}
        r = resolve_round(fixture(moves), moves, {"A": 1})
        self.assertEqual(r["ledger"]["actions"]["A"]["branch"], "Three")
        self.assertEqual(r["ledger"]["kills"], {"A": ["C"], "B": ["A", "C"], "C": []})

    def test_R21_buff_survives_intervening_moves_then_consumes_once(self):
        state = new_match(["A", "B"], "buff")
        for move in ("JuYan", "Charge", "Def"):
            r = resolve_round(state, {"A": move, "B": "Def"}, {})
            self.assertTrue(r["ok"], r)
            state = r["next_state"]
            self.assertTrue(state["players"]["A"]["enhanced_xiao"])
        r = resolve_round(state, {"A": "Xiao", "B": "JuYan"}, {})
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["next_state"]["players"]["A"]["dd6"], "6")
        self.assertFalse(r["next_state"]["players"]["A"]["enhanced_xiao"])
        r = resolve_round(r["next_state"], {"A": "Xiao", "B": "JuYan"}, {})
        self.assertEqual(r["next_state"]["players"]["A"]["dd6"], "4")
        self.assertFalse(r["ledger"]["actions"]["A"]["enhanced_xiao"])

    def test_direct_elimination_has_no_damage_or_return(self):
        for moves, kills in (({"A": "TianLiJun", "B": "Reflect"}, {"A": [], "B": ["A"]}),
                             ({"A": "XiaoBei", "B": "Charge"}, {"A": [], "B": ["A"]})):
            r = resolve_round(fixture(moves), moves, {})
            self.assertEqual(r["ledger"]["kills"], kills)
            direct = [e for e in r["ledger"]["events"] if e["kind"] == "direct_elimination"]
            self.assertEqual(len(direct), 1)
            self.assertIsNone(direct[0]["amount6"])
            self.assertFalse(any(e["kind"] == "return" for e in r["ledger"]["events"]))

    def test_six_player_continuous_fixed_seed_invariants(self):
        rng = random.Random(20260913)
        rounds = 0
        for index in range(12):
            state = new_match(list("ABCDEF"), f"seed-{index}")
            for _ in range(35):
                if state["status"] == "finished":
                    break
                submissions, tokens = {}, {}
                for pid in state["active_ids"]:
                    options = [o["entry_id"] for o in list_options(state, pid) if o["available"]]
                    if not options:
                        self.assertEqual(state["players"][pid]["zeng_state"], "recovery")
                        continue
                    entry = rng.choice(options)
                    submissions[pid] = entry
                    actual = state["players"][pid]["latest_copyable_move"] if entry == "ZhangXinWei" else entry
                    if actual in {"RotateThree", "FlipVolvo", "BombFlipVolvo", "FreeRotateThree"}:
                        tokens[pid] = rng.randrange(2)
                before = snapshot(state)
                result = resolve_round(state, submissions, tokens)
                self.assertTrue(result["ok"], result)
                self.assertEqual(snapshot(state), before)
                self.assertEqual(result, resolve_round(json.loads(json.dumps(state)), submissions, tokens))
                self.assertLessEqual(set(result["next_state"]["active_ids"]), set(state["active_ids"]))
                state = result["next_state"]
                decode_state(state)
                rounds += 1
        self.assertGreater(rounds, 12)


for index, entry in enumerate(ENTRIES):
    def test_entry(self, index=index, entry=entry):
        self.check_entry(index, entry)
    setattr(ContractCases, f"test_E{index + 1:02d}_{entry[0]}_qualification_and_spend", test_entry)

for cid, entry, changes, reason in REJECTIONS:
    def test_rejection(self, entry=entry, changes=changes, reason=reason):
        state = fixture({"A": entry, "B": "Charge"}, {"A": changes})
        option = next(o for o in list_options(state, "A") if o["entry_id"] == entry)
        self.assertFalse(option["available"])
        self.assertEqual(option["reason_code"], reason)
        self.reject(state, {"A": entry, "B": "Charge"}, {}, "UNAVAILABLE_MOVE", "entry_id")
    setattr(ContractCases, f"test_{cid}_rejection", test_rejection)


if __name__ == "__main__":
    unittest.main()
