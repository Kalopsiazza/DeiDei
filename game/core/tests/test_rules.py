"""Hand-written expectations from classic-1.0.1 C001–C082, not legacy outputs.

Parameterized cases are separate unittest methods, so reported counts are real
executions. T02's independent fixtures are intentionally neither read nor edited.
"""
from copy import deepcopy
import hashlib
import itertools
import json
import unittest

from deidei_core.api import list_options, new_match, resolve_round


def snapshot(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def fixture(moves, changes=None):
    state = new_match(list(moves), "fixture")
    state.update(game_id="game-1", turn_index="6")
    for pid, p in state["players"].items():
        p["dd6"] = "60"
        p.update((changes or {}).get(pid, {}))
    return state


def pending(turn=5):
    return {"game_id": "game-1", "placed_turn": str(turn), "mature_at_turn_end": str(turn + 1)}


# case ID, variant, submissions (None = system recovery), input overrides,
# kills (unspecified actors have no kills), eliminated, player checks, action checks, tokens.
CASES = []


def case(cid, moves, *, variant="main", changes=None, kills=None, eliminated=(), players=None, actions=None, tokens=None):
    CASES.append((cid, variant, moves, changes or {}, kills or {}, list(eliminated), players or {}, actions or {}, tokens or {}))


case("C001", {"A": "Charge", "B": "Charge"}, players={"A": {"dd6": "66"}, "B": {"dd6": "66"}})
case("C003", {"A": "Bi", "B": "Bi"}, players={"A": {"dd6": "54"}, "B": {"dd6": "54"}})
case("C004", {"A": "Three", "B": "Pragon", "C": "Bi"}, kills={"A": ["B", "C"], "B": ["C"]},
     eliminated=["B", "C"], players={"A": {"dd6": "42"}, "B": {"dd6": "48"}, "C": {"dd6": "54"}})
case("C005", {"A": "Def", "B": "Bi"}, players={"A": {"nx_charge": "2"}, "B": {"dd6": "54"}})
case("C006", {"A": "Def", "B": "BigBi"}, players={"A": {"nx_charge": "2"}, "B": {"dd6": "30", "last_actual_move": "BigBi"}})
case("C007", {"A": "Def", "B": "Pragon"}, kills={"B": ["A"]}, eliminated=["A"], players={"A": {"nx_charge": "1"}})
for defense, attack in (("ThreeDef", "Three"), ("PragonDef", "Pragon"), ("VolvoDef", "Volvo"), ("NieXiangDef", "NieXiang")):
    case("C008", {"A": defense, "B": "Xiao"}, variant=defense, players={"B": {"dd6": "58"}})
    case("C009", {"A": defense, "B": "Bi"}, variant=defense, kills={"B": ["A"]}, eliminated=["A"])
    case("C010", {"A": defense, "B": attack}, variant=defense,
         changes={"B": {"nx_charge": "4"}} if attack == "NieXiang" else {},
         players={"B": {"nx_charge": "0", "dd6": "60"}} if attack == "NieXiang" else {})
case("C011", {"A": "VolvoDef", "B": "Volvo", "C": "BombVolvo"}, changes={"C": {"mature_bombs": "2"}},
     players={"C": {"mature_bombs": "0", "dd6": "60"}})
for variant, move, enhanced in (("plain", "Xiao", False), ("enhanced", "Xiao", True), ("bi", "Bi", False)):
    case("C012", {"A": "JuYan", "B": move}, variant=variant, changes={"B": {"enhanced_xiao": enhanced}},
         kills={"B": ["A"]} if move == "Bi" else {}, eliminated=["A"] if move == "Bi" else [],
         players={"A": {"enhanced_xiao": True}}, actions={"A": {"defense_primary": {"kind": "finite", "sixths": "2", "comparison": "le", "match_rule": "R21"}}})
case("C013", {"A": "JuYan", "B": "Charge"}, changes={"A": {"enhanced_xiao": True}}, players={"A": {"enhanced_xiao": True}, "B": {"dd6": "66"}})
case("C015", {"A": "Xiao", "B": "Def"}, changes={"A": {"dd6": "2", "enhanced_xiao": True}},
     kills={"A": ["B"]}, eliminated=["B"], players={"A": {"dd6": "2", "enhanced_xiao": False}, "B": {"nx_charge": "1"}})
for count in (0, 1, 2, 3, 8):
    case("C016", {"A": "Xiao", "B": "Bomb"}, variant=str(count),
         changes={"A": {"enhanced_xiao": True}, "B": {"bomb_placement_count": str(count)}}, kills={"A": ["B"]}, eliminated=["B"],
         players={"A": {"dd6": "60"}, "B": {"dd6": "54", "bomb_placement_count": str(count + 1), "pending_bombs": [pending(6)]}})
case("C017", {"A": "Three", "B": "Pragon", "C": "Absorb"}, kills={"A": ["B"]}, eliminated=["B"], players={"C": {"dd6": "84"}})
case("C018", {"A": "Three", "B": "Absorb", "C": "Absorb"}, players={"B": {"dd6": "72"}, "C": {"dd6": "72"}})
case("C019", {"A": "Charge", "B": "Charge", "C": "Absorb", "D": "Absorb"},
     players={"A": {"dd6": "60"}, "B": {"dd6": "60"}, "C": {"dd6": "66"}, "D": {"dd6": "66"}})
case("C020", {"A": "Cloud", "B": "Charge", "C": "Charge", "D": "Three"}, kills={"D": ["B", "C"]}, eliminated=["B", "C"],
     players={"A": {"dd6": "60", "lightning": "1", "cloud_uses": "1"}, "B": {"dd6": "60"}, "C": {"dd6": "60"}})
case("C021", {"A": "Volvo", "B": "Absorb"}, players={"A": {"dd6": "36"}, "B": {"dd6": "78"}})
case("C022", {"A": "BombVolvo", "B": "Absorb"}, changes={"A": {"mature_bombs": "2"}},
     players={"A": {"dd6": "60", "mature_bombs": "0"}, "B": {"dd6": "54"}})
case("C023", {"A": "FreeThree", "B": "Absorb"}, changes={"A": {"lightning": "3", "dd6": "0"}},
     players={"A": {"lightning": "0", "dd6": "0"}, "B": {"dd6": "72"}})
for defense in ("Absorb", "Reflect"):
    case("C024", {"A": "Xiao", "B": defense}, variant=defense, changes={"A": {"enhanced_xiao": True}},
         kills={"B": ["A"]} if defense == "Reflect" else {}, eliminated=["A"] if defense == "Reflect" else [],
         players={"A": {"dd6": "60", "enhanced_xiao": False}, "B": {"dd6": "54"}})
case("C025", {"A": "SelfBi", "B": "Absorb", "C": "Three"}, changes={"A": {"latest_copyable_move": "Three"}},
     kills={"A": ["B"]}, eliminated=["B"], players={"A": {"latest_copyable_move": "Three"}, "B": {"dd6": "72"}})
case("C026", {"A": "SelfBi", "B": "Reflect", "C": "Pragon"}, kills={"A": ["B"], "B": ["C"]}, eliminated=["B", "C"])
case("C027", {"A": "SelfBi", "B": "Charge"}, eliminated=["A"], players={"B": {"dd6": "66"}})
case("C028", {"A": "SelfBi", "B": "SelfBi"}, eliminated=["A", "B"])
case("C029", {"A": "LiQiang", "B": "Charge"}, changes={"A": {"dd6": "0"}},
     players={"A": {"dd6": "6", "liq_used": True, "last_actual_move": "LiQiang"}, "B": {"dd6": "66"}})
case("C030", {"A": "LiQiang", "B": "Xiao"}, changes={"A": {"dd6": "6"}}, kills={"B": ["A"]}, eliminated=["A"],
     players={"A": {"dd6": "6", "liq_used": True}})
case("C031", {"A": "LiQiang", "B": "Bi", "C": "Pragon"}, changes={"B": {"last_actual_move": "Bi"}, "C": {"last_actual_move": "Charge"}},
     kills={"A": ["B"], "C": ["B"]}, eliminated=["B"], actions={"A": {"condition": "success", "eligible_targets": ["B"]}})
case("C032", {"A": "LiQiang", "B": "LiQiang", "C": "Bi"}, changes={"C": {"last_actual_move": "Bi"}},
     kills={"A": ["C"], "B": ["C"]}, eliminated=["C"], players={"A": {"liq_used": True}, "B": {"liq_used": True}})
for move in ("Reflect", "Absorb"):
    case("C033", {"A": "LiQiang", "B": move}, variant=move, changes={"B": {"last_actual_move": move}},
         kills={"A": ["B"]}, eliminated=["B"], players={"B": {"dd6": "54"}})
case("C034", {"A": "RotateThree", "B": "LiQiang", "C": "Reflect"}, changes={"A": {"last_actual_move": "RotateThree"}},
     kills={"A": ["C"]}, eliminated=["C"], tokens={"A": 0},
     actions={"A": {"branch": "SelfBi", "condition": "success"}, "B": {"condition": "success", "eligible_targets": ["A"]}})
case("C035", {"A": "FreeThree", "B": "LiQiang"}, changes={"A": {"lightning": "3", "last_actual_move": "Three"}},
     kills={"B": ["A"]}, eliminated=["A"], actions={"A": {"actual_move": "Three", "origin": "lightning"}})
case("C036", {"A": "RotateThree", "B": "LiQiang"}, changes={"A": {"last_actual_move": "Three"}, "B": {"dd6": "6"}},
     kills={"A": ["B"]}, eliminated=["B"], tokens={"A": 0}, actions={"A": {"branch": "Three"}, "B": {"condition": "failure"}})
case("C037", {"A": "ZhangXinWei", "B": "LiQiang", "C": "Reflect"},
     changes={"A": {"dd6": "0", "latest_copyable_move": "RotateThree", "last_actual_move": "RotateThree"}},
     kills={"A": ["C"]}, eliminated=["C"], tokens={"A": 0}, players={"A": {"dd6": "0", "zhang_used": True}},
     actions={"A": {"actual_move": "RotateThree", "origin": "zhang", "branch": "SelfBi"}})
case("C038", {"A": "ZhangXinWei", "B": "NieXiangDef"}, changes={"A": {"dd6": "0", "latest_copyable_move": "NieXiang"}},
     players={"A": {"dd6": "0", "nx_charge": "0", "zhang_used": True}}, actions={"A": {"attack6": "21", "origin": "zhang"}})
case("C039", {"A": "ZhangXinWei", "B": "Absorb"}, changes={"A": {"latest_copyable_move": "Pragon"}},
     players={"A": {"dd6": "60"}, "B": {"dd6": "66"}}, actions={"A": {"origin": "zhang"}})
case("C041", {"A": "Bi", "B": "Bi"}, changes={"A": {"latest_copyable_move": "Three"}},
     players={"A": {"last_actual_move": "Bi", "latest_copyable_move": "Three"}})
case("C042", {"A": "Reflect", "B": "BigBi", "C": "Pragon"}, kills={"B": ["A", "C"], "A": ["C"]}, eliminated=["A", "C"])
case("C043", {"A": "TianLiJun", "B": "Absorb", "C": "Charge"}, changes={"C": {"dd6": "12"}},
     kills={"B": ["A"]}, eliminated=["A"], players={"C": {"dd6": "0"}, "B": {"dd6": "60"}})
case("C044", {"A": "TianLiJun", "B": "Reflect", "C": "SelfBi"}, kills={"B": ["A"], "C": ["B"]}, eliminated=["A", "B"])
case("C045", {"A": "TianLiJun", "B": "BigBi"}, players={"A": {"dd6": "60", "tian_uses": "1"}, "B": {"dd6": "30"}})
case("C046", {"A": "TianLiJun", "B": "Charge"}, changes={"A": {"dd6": "3", "tian_uses": "1"}, "B": {"dd6": "12"}},
     players={"A": {"dd6": "0", "tian_uses": "2"}, "B": {"dd6": "0"}})
case("C047", {"A": "XiaoBei", "B": "Shell", "C": "Absorb"}, kills={"A": ["C"], "B": ["C"]}, eliminated=["C"], players={"C": {"dd6": "54"}})
case("C048", {"A": "XiaoBei", "B": "Charge"}, kills={"B": ["A"]}, eliminated=["A"], players={"B": {"dd6": "66"}})
case("C049", {"A": "XiaoBei", "B": "Charge", "C": "Shell"}, kills={"B": ["A"], "C": ["B"]}, eliminated=["A", "B"])
case("C050", {"A": "XiaoBei", "B": "Charge", "C": "Absorb"}, kills={"B": ["A"], "A": ["C"]}, eliminated=["A", "C"],
     players={"B": {"dd6": "60"}, "C": {"dd6": "60"}})
for move in ("XiaoBei", "Shell"):
    case("C051", {"A": move, "B": "TianLiJun"}, variant=move, kills={"A": ["B"]}, eliminated=["B"])
for move in ("Absorb", "Cloud"):
    case("C052", {"A": "NieXiang", "B": move}, variant=move, changes={"A": {"nx_charge": "6", "dd6": "0"}},
         kills={"A": ["B"]}, eliminated=["B"], players={"A": {"nx_charge": "2", "dd6": "0"},
         "B": {"dd6": "54"} if move == "Absorb" else {"lightning": "1"}})
case("C053", {"A": "NieXiang", "B": "Reflect"}, changes={"A": {"nx_charge": "4"}}, kills={"B": ["A"]}, eliminated=["A"])
for count, move, defense in ((0, "Xiao", "2"), (1, "Bi", "6"), (2, "Pragon", "12"), (3, "Three", "18"), (7, "Three", "18")):
    case("C055", {"A": "Bomb", "B": move}, variant=str(count), changes={"A": {"bomb_placement_count": str(count)}},
         actions={"A": {"defense_primary": {"kind": "finite", "sixths": defense, "comparison": "le", "match_rule": "R19"}}})
case("C056", {"A": "Bomb", "B": "Bi", "C": "Bi"}, changes={"A": {"bomb_placement_count": "1"}})
case("C058", {"A": "BombFlipVolvo", "B": "Absorb", "C": "Charge", "D": "Charge"}, changes={"A": {"mature_bombs": "4"}},
     kills={"A": ["C", "D"]}, eliminated=["C", "D"], tokens={"A": 1},
     players={"A": {"mature_bombs": "0", "dd6": "60"}, "B": {"dd6": "66"}}, actions={"A": {"branch": "Volvo"}})
case("C059", {"A": "FreeRotateThree", "B": "ThreeDef"}, changes={"A": {"lightning": "6", "dd6": "0"}}, tokens={"A": 1},
     players={"A": {"lightning": "0", "dd6": "0"}}, actions={"A": {"actual_move": "RotateThree", "branch": "Three"}})
case("C060", {"A": "RotateThree", "B": "FlipVolvo", "C": "Absorb", "D": "Charge", "E": "Charge"},
     kills={"A": ["D", "E"], "B": ["A", "D", "E"]}, eliminated=["A", "D", "E"], tokens={"A": 1, "B": 1},
     players={"C": {"dd6": "108"}}, actions={"A": {"branch": "Three"}, "B": {"branch": "Volvo"}})
case("C061", {"A": "RotateThree", "B": "RotateThree"}, tokens={"A": 1, "B": 1},
     actions={"A": {"branch": "Three"}, "B": {"branch": "Three"}})
for token in (0, 1):
    case("C062", {"A": "RotateThree", "B": "Shell"}, variant=str(token), tokens={"A": token}, kills={"B": ["A"]}, eliminated=["A"],
         players={"A": {"dd6": "24"}}, actions={"A": {"branch": "SelfBi" if token else "Three"}})
    case("C063", {"A": "RotateThree", "B": "Absorb", "C": "Charge"}, variant=str(token), tokens={"A": token},
         kills={"A": ["B" if token else "C"]}, eliminated=["B" if token else "C"], actions={"A": {"branch": "SelfBi" if token else "Three"}})
RECOVERY = {"zeng_state": "recovery", "last_actual_move": "ZengYi"}
case("C066", {"A": None, "B": "LiQiang", "C": "Bi"}, changes={"A": RECOVERY, "B": {"dd6": "6"}, "C": {"last_actual_move": "Charge"}},
     kills={"C": ["B"]}, eliminated=["B"], actions={"A": {"is_recovery": True}, "B": {"condition": "failure", "eligible_targets": []}})
case("C067", {"A": None, "B": "LiQiang", "C": "Bi"}, changes={"A": RECOVERY, "C": {"last_actual_move": "Bi"}},
     kills={"B": ["C"]}, eliminated=["C"], actions={"B": {"condition": "success", "eligible_targets": ["C"]}})
for zeng in ("waiting", "ready", "recovery"):
    change = RECOVERY if zeng == "recovery" else {"zeng_state": zeng, "reward_due_turn": "8" if zeng == "waiting" else None}
    case("C068", {"A": None if zeng == "recovery" else "Def", "B": "BigBi", "C": "Charge"}, variant=zeng,
         changes={"A": change}, kills={"B": ["C"]}, eliminated=["C"])
case("C070", {"A": "ZengRewardBigBi", "B": "LiQiang"}, changes={"A": {"zeng_state": "ready", "last_actual_move": "BigBi"}},
     kills={"B": ["A"]}, eliminated=["A"], players={"A": {"zeng_state": "spent", "dd6": "60"}})
case("C071", {"A": "Charge", "B": "Bi"}, changes={"A": {"zeng_state": "waiting", "reward_due_turn": "8"}}, kills={"B": ["A"]}, eliminated=["A"])
case("C074", {"A": "Three", "B": "Three", "C": "Bi", "D": "Def"},
     changes={pid: {"lightning": "7", "nx_charge": "9", "cloud_uses": "4", "tian_uses": "2", "zhang_used": True,
                    "liq_used": True, "enhanced_xiao": True, "latest_copyable_move": "Volvo", "mature_bombs": "2",
                    "pending_bombs": [pending()], "bomb_placement_count": "9", "zeng_state": "ready"} for pid in ("A", "B")},
     kills={"A": ["C", "D"], "B": ["C", "D"]}, eliminated=["C", "D"])
case("C078", {"A": "Def", "B": "BigBi", "C": "BigBi"}, players={"A": {"nx_charge": "3"}, "B": {"dd6": "30"}, "C": {"dd6": "30"}})
for entry, change, expected in (
    ("RotateThree", {}, {"dd6": "24"}), ("FlipVolvo", {}, {"dd6": "12"}),
    ("BombFlipVolvo", {"mature_bombs": "4"}, {"dd6": "60", "mature_bombs": "0"}),
    ("FreeRotateThree", {"lightning": "6"}, {"dd6": "60", "lightning": "0"}),
):
    case("C080", {"A": entry, "B": "Absorb"}, variant=entry, changes={"A": change}, tokens={"A": 0},
         kills={"A": ["B"]}, eliminated=["B"], players={"A": expected, "B": {"dd6": "54"}}, actions={"A": {"branch": "SelfBi"}})
case("C082", {"A": "Def", "B": "BigBi", "C": "Charge"},
     changes={"A": {"dd6": "0", "zeng_state": "waiting", "reward_due_turn": "6"}, "B": {"dd6": "30"}, "C": {"dd6": "0"}},
     kills={"B": ["C"]}, eliminated=["C"], players={"A": {"nx_charge": "2", "zeng_state": "ready", "reward_due_turn": None}})


class RulesCases(unittest.TestCase):
    def assert_round(self, state, moves, tokens=None):
        submissions = {pid: move for pid, move in moves.items() if move is not None}
        before = snapshot([state, submissions, tokens or {}])
        result = resolve_round(state, submissions, tokens or {})
        self.assertEqual(snapshot([state, submissions, tokens or {}]), before)
        self.assertTrue(result["ok"], result)
        return result

    def check_case(self, data):
        cid, variant, moves, changes, kills, eliminated, players, actions, tokens = data
        state = fixture(moves, changes)
        result = self.assert_round(state, moves, tokens)
        ledger = result["ledger"]
        self.assertEqual(ledger["kills"], {pid: sorted(kills.get(pid, [])) for pid in moves})
        self.assertEqual(ledger["eliminated_ids"], sorted(eliminated))
        for pid, fields in players.items():
            for key, expected in fields.items():
                self.assertEqual(ledger["post_turn_players"][pid][key], expected, (cid, variant, pid, key))
        for pid, fields in actions.items():
            for key, expected in fields.items():
                self.assertEqual(ledger["actions"][pid][key], expected, (cid, variant, pid, key))
        alive = sorted(set(moves) - set(eliminated))
        nxt = result["next_state"]
        self.assertEqual(nxt["active_ids"], alive)
        self.assertEqual(set(ledger["post_turn_players"]), set(moves))
        self.assertEqual(set(nxt["players"]), set(moves))
        winner = None
        if not eliminated:
            kind = "continue_game"
            self.assertEqual(nxt["turn_index"], "7")
            self.assertEqual(nxt["players"], ledger["post_turn_players"])
        elif len(alive) >= 2:
            kind = "restart_survivors"
            self.assertEqual(nxt["game_index"], "2")
            self.assertEqual(nxt["game_id"], "fixture:g2")
            self.assertEqual(nxt["turn_index"], "1")
            pristine = new_match(["P", "Q"], "initial")["players"]["P"]
            for pid in alive:
                self.assertEqual(nxt["players"][pid], pristine)
            for pid in eliminated:
                self.assertEqual(nxt["players"][pid], ledger["post_turn_players"][pid])
        else:
            kind = "sole_survivor" if alive else "nobody_survives"
            winner = alive[0] if alive else None
            self.assertEqual(nxt["status"], "finished")
            self.assertEqual(nxt["turn_index"], "6")
            self.assertEqual(nxt["players"], ledger["post_turn_players"])
        self.assertEqual(result["transition"], {"kind": kind, "from_game_id": "game-1",
                         "to_game_id": "fixture:g2" if kind == "restart_survivors" else "game-1", "winner_id": winner})
        self.assertEqual(nxt["winner_id"], winner)
        events = ledger["events"]
        ids = {e["event_id"] for e in events}
        self.assertEqual(len(ids), len(events))
        self.assertFalse(any(e["kind"] == "attack" and e["amount6"] == "0" for e in events))
        for event in events:
            if event["kind"] == "return":
                source = next(e for e in events if e["event_id"] == event["source_event_id"])
                self.assertEqual(source["kind"], "attack")
                self.assertEqual(event["amount6"], source["amount6"])
                self.assertEqual(event["actor_id"], source["target_id"])
                self.assertEqual(event["target_id"], source["actor_id"])
        if cid in {"C026", "C042", "C053"}:
            returns = [e for e in events if e["kind"] == "return"]
            self.assertEqual(len(returns), 1)
            self.assertEqual(returns[0]["amount6"], "21" if cid == "C053" else "12")
            self.assertEqual(returns[0]["result"], "applied")
        if cid == "C067":
            self.assertFalse(any(e["kind"] == "attack" and e["actor_id"] == "B" and e["target_id"] == "A" for e in events))
        if cid == "C082":
            self.assertEqual(len([e for e in events if e["kind"] == "reward_granted"]), 1)
        # Every returned state remains a legal input, including retained inactive accounts.
        list_options(nxt, next(iter(moves)))
        return result

    def test_C054_bomb_sequence(self):
        state = new_match(["A", "B"], "sequence")
        state["players"]["A"]["dd6"] = "6"
        state = self.assert_round(state, {"A": "Bomb", "B": "Charge"})["next_state"]
        self.assertEqual(state["players"]["A"]["mature_bombs"], "0")
        self.assertEqual(state["players"]["A"]["pending_bombs"], [{"game_id": "sequence:g1", "placed_turn": "1", "mature_at_turn_end": "2"}])
        self.assertFalse(next(o for o in list_options(state, "A") if o["entry_id"] == "BombPragon")["available"])
        state = self.assert_round(state, {"A": "Charge", "B": "Charge"})["next_state"]
        self.assertEqual(state["players"]["A"]["mature_bombs"], "1")
        state = self.assert_round(state, {"A": "BombPragon", "B": "PragonDef"})["next_state"]
        self.assertEqual(state["players"]["A"]["mature_bombs"], "0")
        self.assertEqual(state["players"]["A"]["dd6"], "6")

    def test_C064_zeng_clear_sequence(self):
        state = fixture({"A": "ZengYi", "B": "Charge"}, {"A": {
            "dd6": "30", "lightning": "3", "nx_charge": "4", "mature_bombs": "2",
            "pending_bombs": [pending()], "bomb_placement_count": "3", "enhanced_xiao": True,
            "latest_copyable_move": "Three", "cloud_uses": "1", "tian_uses": "1", "zhang_used": True, "liq_used": True,
        }})
        for turn, move in ((6, "ZengYi"), (7, None)):
            r = self.assert_round(state, {"A": move, "B": "Charge"})
            state = r["next_state"]
            p = state["players"]["A"]
            self.assertEqual(r["ledger"]["actions"]["A"]["defense_primary"]["kind"], "unbounded")
            for field in ("dd6", "lightning", "nx_charge", "mature_bombs", "bomb_placement_count"):
                self.assertEqual(p[field], "0")
            self.assertEqual(p["pending_bombs"], [])
            self.assertFalse(p["enhanced_xiao"])
            self.assertIsNone(p["latest_copyable_move"])
            self.assertEqual(p["cloud_uses"], "1")
            self.assertEqual(p["tian_uses"], "1")
            self.assertTrue(p["zhang_used"] and p["liq_used"])
            self.assertEqual(p["zeng_state"], "recovery" if turn == 6 else "waiting")
        self.assertEqual(p["reward_due_turn"], "10")
        self.assertEqual(state["players"]["B"]["dd6"], "72")

    def reward_sequence(self):
        state = new_match(["A", "B"], "sequence")
        for move in ("ZengYi", None, "Charge", "Charge"):
            state = self.assert_round(state, {"A": move, "B": "Charge"})["next_state"]
        return state

    def test_C065_reward_and_copy_sequence(self):
        state = self.reward_sequence()
        self.assertEqual(state["turn_index"], "5")
        self.assertFalse(next(o for o in list_options(state, "A") if o["entry_id"] == "ZengRewardBigBi")["available"])
        state = self.assert_round(state, {"A": "Charge", "B": "Charge"})["next_state"]
        self.assertEqual(state["players"]["A"]["dd6"], "18")
        self.assertEqual(state["players"]["A"]["zeng_state"], "ready")
        for charge, move in (("2", "ZengRewardBigBi"), ("4", "ZhangXinWei")):
            state = self.assert_round(state, {"A": move, "B": "Def"})["next_state"]
            self.assertEqual(state["players"]["A"]["dd6"], "18")
            self.assertEqual(state["players"]["A"]["zeng_state"], "spent")
            self.assertEqual(state["players"]["A"]["latest_copyable_move"], "BigBi")
            self.assertEqual(state["players"]["B"]["nx_charge"], charge)
        self.assertTrue(state["players"]["A"]["zhang_used"])

    def test_C069_history_after_restart(self):
        state = fixture({"A": "Three", "B": "Three", "C": "Bi"})
        state = self.assert_round(state, {"A": "Three", "B": "Three", "C": "Bi"})["next_state"]
        result = self.assert_round(state, {"A": "LiQiang", "B": "LiQiang"})
        for pid in ("A", "B"):
            self.assertEqual(result["ledger"]["actions"][pid]["condition"], "failure")
            self.assertEqual(result["next_state"]["players"][pid]["dd6"], "6")
            self.assertTrue(result["next_state"]["players"][pid]["liq_used"])

    def test_C073_order_replay_isolation(self):
        for data in CASES:
            if data[0] not in {"C017", "C026", "C060", "C063"}:
                continue
            _, _, moves, changes, *_, tokens = data
            state = fixture(moves, changes)
            baseline = self.assert_round(state, moves, tokens)
            for order in itertools.permutations(moves):
                permuted = deepcopy(state)
                permuted["roster"] = list(order)
                permuted["active_ids"] = list(order)
                permuted["players"] = {pid: permuted["players"][pid] for pid in order}
                result = self.assert_round(json.loads(json.dumps(permuted)), {pid: moves[pid] for pid in order}, tokens)
                self.assertEqual(result, baseline)
            baseline["next_state"]["players"][next(iter(moves))]["pending_bombs"].append({"probe": True})
            self.assertEqual(self.assert_round(state, moves, tokens), resolve_round(state, moves, tokens))

    def test_C079_cloud_cost_sequence(self):
        state = new_match(["A", "B"], "sequence")
        state = self.assert_round(state, {"A": "Cloud", "B": "Charge"})["next_state"]
        self.assertEqual(state["players"]["B"]["dd6"], "0")
        before = snapshot(state)
        self.assertFalse(resolve_round(state, {"A": "Cloud", "B": "Charge"}, {})["ok"])
        self.assertEqual(snapshot(state), before)
        state = self.assert_round(state, {"A": "Charge", "B": "Charge"})["next_state"]
        state = self.assert_round(state, {"A": "Cloud", "B": "Charge"})["next_state"]
        self.assertEqual(state["players"]["A"]["dd6"], "0")
        self.assertEqual(state["players"]["A"]["lightning"], "2")
        self.assertEqual(state["players"]["B"]["dd6"], "6")

    def test_C081_pure_reward_retry(self):
        state = self.reward_sequence()
        before = snapshot(state)
        a = self.assert_round(state, {"A": "Charge", "B": "Charge"})
        b = self.assert_round(state, {"A": "Charge", "B": "Charge"})
        self.assertEqual(a, b)
        self.assertEqual(snapshot(state), before)
        self.assertEqual(a["next_state"]["players"]["A"]["dd6"], "18")
        self.assertEqual(a["next_state"]["players"]["A"]["zeng_state"], "ready")
        self.assertEqual(len([e for e in a["ledger"]["events"] if e["kind"] == "reward_granted"]), 1)
        used = self.assert_round(a["next_state"], {"A": "ZengRewardBigBi", "B": "Def"})
        self.assertEqual(used["next_state"]["players"]["A"]["zeng_state"], "spent")
        self.assertFalse(any(e["kind"] == "reward_granted" for e in used["ledger"]["events"]))


for data in CASES:
    def test(self, data=data):
        self.check_case(data)
    setattr(RulesCases, f"test_{data[0]}_{data[1]}", test)


if __name__ == "__main__":
    unittest.main()
