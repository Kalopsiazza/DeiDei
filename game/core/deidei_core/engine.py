"""Whole-table P1–P4 settlement, independent of UI, sessions and the old engine."""
from copy import deepcopy
import json

from .entries import ATTACKS, BRANCHES, COPYABLE_MOVES, RESOURCES
from .wire import decimal_string, encode_player, encode_resources, encode_state, initial_player

COUNTERS = frozenset({"Reflect", "Absorb", "Cloud"})
SHELLS = frozenset({"XiaoBei", "Shell"})
SPECIAL_DEFENSES = {"ThreeDef": "Three", "PragonDef": "Pragon", "VolvoDef": "Volvo", "NieXiangDef": "NieXiang"}


def finite(value: int, rule: str, comparison: str = "le") -> dict:
    return {"kind": "finite", "sixths": value, "comparison": comparison, "match_rule": rule}


def prepare(state: dict, raw: dict, branches: dict) -> dict:
    """Regenerate conditions inside this view, before any fatal effects exist."""
    actions = deepcopy(raw)
    for pid, a in actions.items():
        move = a["actual_move"]
        a["branch"] = branches.get(pid)
        kind = a["branch"] or move
        a["condition"] = None
        a["eligible_targets"] = []
        a["charge"] = kind == "Charge"
        a["enhanced_xiao"] = kind == "Xiao" and state["players"][pid]["enhanced_xiao"]
        a["attack6"] = ATTACKS.get(kind, 0)
        a["defense_primary"] = finite(a["attack6"], "R06" if a["attack6"] else "R05")
        a["defense_return"] = finite(0, "R06") if a["attack6"] else None
        if kind in {"SelfBi", "LiQiang"}:
            for target, other in actions.items():
                if target == pid:
                    continue
                if kind == "SelfBi":
                    eligible = other["actual_move"] in COUNTERS
                else:
                    eligible = (not other["is_recovery"] and
                                other["actual_move"] == state["players"][target]["last_actual_move"])
                if eligible:
                    a["eligible_targets"].append(target)
            a["eligible_targets"].sort()
            success = bool(a["eligible_targets"])
            a["condition"] = "success" if success else "failure"
            a["attack6"] = 60000 if success else 0
            rule = "R14" if kind == "SelfBi" else "R15"
            if success and kind == "SelfBi":
                defense = {"kind": "unbounded", "match_rule": rule}
            else:
                defense = finite(59994 if success else 0, rule)
            a["defense_primary"] = defense
            a["defense_return"] = defense.copy()
            a["charge"] = kind == "LiQiang" and not success and state["players"][pid]["dd6"] == 0
        elif kind == "ZengYi":
            a["defense_primary"] = {"kind": "unbounded", "match_rule": "R25"}
            a["defense_return"] = a["defense_primary"].copy()
        elif kind == "Def":
            a["defense_primary"] = finite(6, "R08")
        elif kind in SPECIAL_DEFENSES:
            a["defense_primary"] = finite(ATTACKS[SPECIAL_DEFENSES[kind]], "R08", "eq")
        elif kind == "Bomb":
            count = state["players"][pid]["bomb_placement_count"]
            a["defense_primary"] = finite((2, 6, 12, 18)[min(count, 3)], "R19")
        elif kind == "JuYan":
            a["defense_primary"] = finite(2, "R21")
        elif kind == "TianLiJun":
            a["defense_primary"] = finite(54, "R22")
        elif kind in COUNTERS:
            a["defense_primary"] = finite(600, "R11" if kind == "Reflect" else "R12" if kind == "Absorb" else "R13")
        elif kind == "Charge":
            a["defense_primary"] = finite(0, "R12")
    return actions


def blocks(attack: dict, defender: dict) -> bool:
    """R07/R08/R10/R23/R24 matching precedes the numeric comparison."""
    kind = attack["branch"] or attack["actual_move"]
    target = defender["branch"] or defender["actual_move"]
    defense = defender["defense_primary"]
    if kind in SHELLS and target in COUNTERS | {"TianLiJun"}:
        return False
    if target == "Reflect" and kind == "BigBi":
        return False
    if target in {"Absorb", "Cloud"} and kind == "NieXiang":
        return False
    if kind == "Xiao" and attack["enhanced_xiao"] and target in {"Def", "Bomb"}:
        return False
    if defense["kind"] == "unbounded":
        return True
    value = defense["sixths"]
    if kind == "Xiao" and not attack["enhanced_xiao"]:
        return value > 0
    if target == "Def" and kind == "BigBi":
        return True
    if target in SPECIAL_DEFENSES:
        return kind == SPECIAL_DEFENSES[target] and attack["attack6"] == value
    return attack["attack6"] <= value


class Effects:
    """One evaluation's ledger; no state survives between calls or branch trials."""

    def __init__(self, state: dict, actions: dict):
        self.state = state
        self.events = []
        self.kills = {pid: set() for pid in actions}
        self.eliminated = set()
        self.gains = {pid: dict.fromkeys(RESOURCES, 0) for pid in actions}
        self.clears = {pid: [] for pid in actions}

    def event(self, phase: str, kind: str, actor: str | None, target: str | None,
              rules: list[str], *, amount: int | None = None, resource: str | None = None,
              delta: int | None = None, source: str | None = None, result: str = "applied",
              reason: str | None = None, detail: str = "") -> str:
        # Structured components keep IDs unambiguous even for arbitrary match/game strings.
        event_id = json.dumps([
            self.state["match_id"], self.state["game_id"], decimal_string(self.state["turn_index"]),
            phase, kind, actor, target, resource, source, detail,
        ], ensure_ascii=True, separators=(",", ":"))
        self.events.append({
            "event_id": event_id, "phase": phase, "kind": kind, "actor_id": actor,
            "target_id": target, "amount6": None if amount is None else decimal_string(amount),
            "resource": resource, "resource_delta": None if delta is None else decimal_string(delta),
            "source_event_id": source, "rule_ids": rules, "result": result, "reason_code": reason,
        })
        return event_id

    def kill(self, actor: str, target: str) -> None:
        self.kills[actor].add(target)
        self.eliminated.add(target)

    def gain(self, pid: str, resource: str, amount: int, rules: list[str],
             source: str | None = None, actor: str | None = None, detail: str = "") -> None:
        if amount:
            self.gains[pid][resource] += amount
            self.event("P2", "resource_gain", actor or pid, pid, rules,
                       resource=resource, delta=amount, source=source, detail=detail)


def evaluate(state: dict, actions: dict) -> Effects:
    """P2 and P3 only. A one-person branch view still evaluates failed SelfBi."""
    effects = Effects(state, actions)
    returns = []
    for actor in sorted(actions):
        a = actions[actor]
        kind = a["branch"] or a["actual_move"]
        if kind == "SelfBi" and a["condition"] == "failure":
            effects.event("P2", "self_elimination", actor, actor, ["R14"])
            effects.eliminated.add(actor)
        if kind == "Def":
            effects.gain(actor, "nx_charge", 1, ["R20"], detail="base")
        if kind == "Cloud":
            effects.gain(actor, "lightning", 1, ["R13"], detail="cast")
        for target in sorted(actions):
            if target == actor:
                continue
            b = actions[target]
            target_kind = b["branch"] or b["actual_move"]
            if kind in COUNTERS and target_kind == "TianLiJun":
                effects.event("P2", "direct_elimination", actor, target, ["R22"])
                effects.kill(actor, target)
            if a["charge"] and target_kind == "XiaoBei":
                effects.event("P2", "direct_elimination", actor, target, ["R23"])
                effects.kill(actor, target)
            if kind == "TianLiJun" and b["charge"]:
                effects.clears[target].append(actor)
            if not a["attack6"]:
                continue
            if a["condition"] is not None and target not in a["eligible_targets"]:
                continue
            if (kind in SHELLS and target_kind in SHELLS) or (kind == "XiaoBei" and b["charge"]):
                effects.event("P2", "attack", actor, target, ["R23"], amount=a["attack6"],
                              result="suppressed", reason="R23_MATCH")
                continue
            blocked = blocks(a, b)
            rule = {"SelfBi": "R14", "LiQiang": "R15", "Xiao": "R07", "BigBi": "R24",
                    "XiaoBei": "R23", "Shell": "R23", "NieXiang": "R20"}.get(kind, "R06")
            source = effects.event("P2", "attack", actor, target,
                                   [rule, b["defense_primary"]["match_rule"]], amount=a["attack6"],
                                   result="blocked" if blocked else "applied")
            if not blocked:
                effects.kill(actor, target)
            elif target_kind == "Reflect":
                returns.append((target, actor, a["attack6"], source))
            elif target_kind == "Absorb" and a["origin"] != "bomb" and not a["enhanced_xiao"]:
                effects.gain(target, "dd6", a["attack6"], ["R12"], source, actor)
            elif target_kind == "Def" and kind in {"Bi", "Xiao", "BigBi"}:
                effects.gain(target, "nx_charge", 1, ["R20"], source)
    for pid, a in sorted(actions.items()):
        if not a["charge"]:
            continue
        blockers = [other for other, b in sorted(actions.items())
                    if other != pid and b["actual_move"] in {"Absorb", "Cloud"}]
        # R12 cancels one growth; multiple absorbers never subtract the old balance.
        effects.event("P2", "resource_gain", pid, pid, ["R12"], resource="dd6", delta=6,
                      result="suppressed" if blockers else "applied",
                      reason="CHARGE_CANCELLED" if blockers else None, detail="charge")
        if not blockers:
            effects.gains[pid]["dd6"] += 6
        for blocker in blockers:
            if actions[blocker]["actual_move"] == "Absorb":
                effects.gain(blocker, "dd6", 6, ["R12"], actor=pid, detail="charge_absorbed")
    for actor, target, strength, source in returns:
        defense = actions[target]["defense_return"]
        # R28: enumerate this invariant in tests; never invent a missing P3 shield.
        if defense is None:
            raise RuntimeError("classic-1.0.1 has no rule for an independent shield receiving a return")
        blocked = defense["kind"] == "unbounded" or strength <= defense["sixths"]
        effects.event("P3", "return", actor, target, ["R06", "R11"], amount=strength,
                      source=source, result="blocked" if blocked else "applied")
        if not blocked:
            effects.kill(actor, target)
    return effects


def select_branches(state: dict, raw: dict, tokens: dict) -> dict:
    choosers = {pid for pid, a in raw.items() if a["actual_move"] in BRANCHES}
    chosen = {}
    for pid in sorted(choosers):
        # ponytail: at most six players; two small pure trials need no cache or solver.
        view = {other: a for other, a in raw.items() if other == pid or other not in choosers}
        candidates = BRANCHES[raw[pid]["actual_move"]]
        scores = []
        for candidate in candidates:
            effects = evaluate(state, prepare(state, view, {pid: candidate}))
            scores.append((pid not in effects.eliminated, len(effects.kills[pid])))
        chosen[pid] = candidates[tokens[pid] if scores[0] == scores[1] else int(scores[1] > scores[0])]
    return chosen


def settle(state: dict, actions: dict, effects: Effects) -> dict:
    """P4: pay once, preserve the full ledger, then advance the match."""
    players = deepcopy(state["players"])
    turn = state["turn_index"]
    for pid, a in sorted(actions.items()):
        p = players[pid]
        for resource, cost in a["spend"].items():
            if not cost:
                continue
            if resource == "reward_stock":
                p["zeng_state"] = "spent"
            else:
                if p[resource] < cost:
                    raise RuntimeError("P1 admitted an unaffordable spend")
                p[resource] -= cost
            effects.event("P4", "resource_spend", pid, pid, ["R09"], resource=resource, delta=-cost)
        for resource, amount in effects.gains[pid].items():
            if resource != "reward_stock":
                p[resource] += amount
        move = a["actual_move"]
        if a["entry_id"] == "ZhangXinWei":
            p["zhang_used"] = True
        if move == "LiQiang":
            p["liq_used"] = True
        if move == "Cloud":
            p["cloud_uses"] += 1
        if move == "TianLiJun":
            p["tian_uses"] += 1
        if move == "Xiao" and a["enhanced_xiao"]:
            p["enhanced_xiao"] = False
            effects.event("P4", "resource_spend", pid, pid, ["R07"], resource="enhanced_xiao", delta=-1)
        if move == "JuYan":
            if not p["enhanced_xiao"]:
                effects.event("P4", "resource_gain", pid, pid, ["R21"], resource="enhanced_xiao", delta=1)
            p["enhanced_xiao"] = True
        p["last_actual_move"] = move
        if move in COPYABLE_MOVES and a["attack6"] >= 12:
            p["latest_copyable_move"] = move
        effects.event("P4", "history_updated", pid, pid, ["R16", "R17"])
        if move == "Bomb":
            p["bomb_placement_count"] += 1
            p["pending_bombs"].append({
                "game_id": state["game_id"], "placed_turn": turn, "mature_at_turn_end": turn + 1,
            })
            effects.event("P4", "resource_gain", pid, pid, ["R19"], resource="pending_bombs", delta=1)
        pending = []
        for index, bomb in enumerate(p["pending_bombs"]):
            if bomb["mature_at_turn_end"] <= turn:
                p["mature_bombs"] += 1
                effects.event("P4", "bomb_mature", pid, pid, ["R19"],
                              resource="mature_bombs", delta=1, detail=decimal_string(index))
            else:
                pending.append(bomb)
        p["pending_bombs"] = pending
        clear_amount = p["dd6"]
        for actor in effects.clears[pid]:
            # Every Tian has its own effect, but the same DD balance is removed only once.
            effects.event("P4", "resource_clear", actor, pid, ["R22"], resource="dd6", delta=-clear_amount)
            clear_amount = 0
            p["dd6"] = 0
        if move == "ZengYi":
            for resource in ("dd6", "lightning", "nx_charge", "mature_bombs", "bomb_placement_count"):
                if p[resource]:
                    effects.event("P4", "resource_clear", pid, pid, ["R25"], resource=resource, delta=-p[resource])
                p[resource] = 0
            if p["pending_bombs"]:
                effects.event("P4", "resource_clear", pid, pid, ["R25"],
                              resource="pending_bombs", delta=-len(p["pending_bombs"]))
            p["pending_bombs"] = []
            if p["enhanced_xiao"]:
                effects.event("P4", "resource_clear", pid, pid, ["R25"], resource="enhanced_xiao", delta=-1)
            if p["latest_copyable_move"] is not None:
                effects.event("P4", "history_updated", pid, pid, ["R17", "R25"], detail="copy_record_cleared")
            p["enhanced_xiao"] = False
            p["latest_copyable_move"] = None
            p["zeng_state"] = "waiting" if a["is_recovery"] else "recovery"
            p["reward_due_turn"] = turn + 3 if a["is_recovery"] else None
        if p["zeng_state"] == "waiting" and p["reward_due_turn"] <= turn:
            p["zeng_state"] = "ready"
            p["reward_due_turn"] = None
            effects.event("P4", "reward_granted", pid, pid, ["R25"], resource="reward_stock", delta=1)
    eliminated = sorted(effects.eliminated)
    survivors = sorted(set(actions) - effects.eliminated)
    next_state = deepcopy(state)
    next_state.update(players=deepcopy(players), active_ids=survivors)
    winner = None
    if not eliminated:
        kind = "continue_game"
        next_state["turn_index"] += 1
    elif len(survivors) >= 2:
        kind = "restart_survivors"
        next_state["game_index"] += 1
        next_state["game_id"] = state["match_id"] + ":g" + decimal_string(next_state["game_index"])
        next_state["turn_index"] = 1
        for pid in survivors:
            next_state["players"][pid] = initial_player()
    else:
        kind = "sole_survivor" if survivors else "nobody_survives"
        winner = survivors[0] if survivors else None
        next_state.update(status="finished", winner_id=winner)
    wire_actions = {}
    for pid, a in sorted(actions.items()):
        action = {key: deepcopy(value) for key, value in a.items() if key != "charge"}
        action["attack6"] = decimal_string(action["attack6"])
        action["spend"] = encode_resources(action["spend"])
        for field in ("defense_primary", "defense_return"):
            if action[field] is not None and action[field]["kind"] == "finite":
                action[field]["sixths"] = decimal_string(action[field]["sixths"])
        wire_actions[pid] = action
    events = sorted(effects.events, key=lambda e: (
        e["phase"], e["actor_id"] or "", e["target_id"] or "", e["kind"], e["event_id"],
    ))
    return {
        "ok": True,
        "ledger": {
            "match_id": state["match_id"], "game_id": state["game_id"], "turn_index": decimal_string(turn),
            "actions": wire_actions, "events": events,
            "kills": {pid: sorted(targets) for pid, targets in sorted(effects.kills.items())},
            "eliminated_ids": eliminated,
            "post_turn_players": {pid: encode_player(players[pid]) for pid in sorted(actions)},
        },
        "next_state": encode_state(next_state),
        "transition": {"kind": kind, "from_game_id": state["game_id"],
                       "to_game_id": next_state["game_id"], "winner_id": winner},
    }
