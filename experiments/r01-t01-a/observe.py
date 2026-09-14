"""Read-only observations of the pinned legacy engine; no new game rules."""
from __future__ import annotations

import ast
from copy import deepcopy
from dataclasses import asdict
from enum import Enum
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT))
from deidei_env import (  # noqa: E402
    ALL_MOVES, Move, PlayerState, build_action, is_legal_move, simulate_turn,
)


def encode(value: object) -> object:
    if isinstance(value, Enum):
        return value.name
    raise TypeError(type(value).__name__)


def observe(name: str, pm: Move, cm: Move, p: PlayerState | None = None,
            c: PlayerState | None = None) -> dict:
    p = deepcopy(p) if p is not None else PlayerState()
    c = deepcopy(c) if c is not None else PlayerState()
    before = deepcopy((p, c))
    legal = [is_legal_move(p, c, pm), is_legal_move(c, p, cm)]
    actions = [asdict(build_action(p, c, pm)), asdict(build_action(c, p, cm))]
    result = simulate_turn(p, c, pm, cm)
    return {
        "id": name, "moves": [pm, cm], "before": [asdict(s) for s in before],
        "legal": legal, "actions_before_liqiang": actions,
        "outcome": result.outcome, "after": [asdict(result.nextP), asdict(result.nextC)],
        "dd_gain_fields": [result.ddGainP, result.ddGainC],
        "input_after": [asdict(p), asdict(c)], "input_mutated": (p, c) != before,
    }


def main() -> None:
    tree = ast.parse((ROOT / "gui_deidei.py").read_text())
    maps = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            if node.targets[0].id in {"MOVE_NAMES_CN", "MOVE_DETAILS_CN"}:
                maps[node.targets[0].id] = {
                    key.attr: {"value": ast.literal_eval(value), "line": key.lineno}
                    for key, value in zip(node.value.keys, node.value.values)
                }
    assert len(ALL_MOVES) == 31 and len(set(ALL_MOVES)) == 31
    assert set(m.name for m in ALL_MOVES) == set(maps["MOVE_NAMES_CN"])
    inventory = []
    cases = []
    for index, move in enumerate(ALL_MOVES):
        state = PlayerState(dd=60, lightning=6, bombLayers=4, nxCharge=4,
                            hasHighAttackRecord=True, lastHighAttack=Move.Pragon)
        case = observe("catalog-" + move.name, move, Move.Charge, state)
        cases.append(case)
        inventory.append({"index": index, "enum_value": move.value, "code_name": move.name,
                          "gui": maps["MOVE_NAMES_CN"][move.name],
                          "detail": maps["MOVE_DETAILS_CN"][move.name]})
    def add(name: str, pm: Move, cm: Move, p: dict | None = None,
            c: dict | None = None) -> None:
        cases.append(observe(name, pm, cm, PlayerState(**(p or {})), PlayerState(**(c or {}))))
    add("both-charge", Move.Charge, Move.Charge)
    add("bi-bi", Move.Bi, Move.Bi, {"dd": 6}, {"dd": 6})
    add("bi-pragon", Move.Bi, Move.Pragon, {"dd": 6}, {"dd": 12})
    add("illegal-bi", Move.Bi, Move.Charge, {"dd": 5, "bombPending": [1, 0, 0]})
    for defense in (Move.Def, Move.ThreeDef, Move.PragonDef, Move.VolvoDef, Move.NieXiangDef, Move.JuYan):
        add("bi-vs-" + defense.name, Move.Bi, defense, {"dd": 6})
    add("reflect-bi", Move.Reflect, Move.Bi, {"dd": 6}, {"dd": 6})
    add("suicide-reflect", Move.Suicide, Move.Reflect, {}, {"dd": 6})
    add("suicide-charge", Move.Suicide, Move.Charge)
    add("suicide-suicide", Move.Suicide, Move.Suicide)
    add("rotate-reflect", Move.RotateThree, Move.Reflect, {"dd": 36}, {"dd": 6})
    add("rotate-flip", Move.RotateThree, Move.FlipVolvo, {"dd": 36}, {"dd": 48})
    add("flip-rotate", Move.FlipVolvo, Move.RotateThree, {"dd": 48}, {"dd": 36})
    for units in (0, 1, 2):
        add("enhanced-xiao-dd-" + str(units), Move.Xiao, Move.Def,
            {"dd": units, "juyanBuff": True})
    add("enhanced-xiao-juyan", Move.Xiao, Move.JuYan, {"dd": 2, "juyanBuff": True})
    add("enhanced-xiao-absorb", Move.Xiao, Move.Absorb,
        {"dd": 2, "juyanBuff": True}, {"dd": 6})
    add("buff-survives-charge", Move.Charge, Move.Charge, {"juyanBuff": True})
    add("absorb-free-three", Move.Absorb, Move.FreeThree, {"dd": 6}, {"lightning": 3})
    add("absorb-bomb-pragon", Move.Absorb, Move.BombPragon, {"dd": 6}, {"bombLayers": 1})
    add("zhang-own-record", Move.ZhangXinWei, Move.Def,
        {"hasHighAttackRecord": True, "lastHighAttack": Move.Pragon, "lastMove": Move.Charge})
    add("zhang-opponent-only-record", Move.ZhangXinWei, Move.Def, {},
        {"hasHighAttackRecord": True, "lastHighAttack": Move.Pragon})
    add("zhang-spent", Move.ZhangXinWei, Move.Charge,
        {"zhangUsed": True, "hasHighAttackRecord": True, "lastHighAttack": Move.Pragon})
    add("absorb-zhang", Move.Absorb, Move.ZhangXinWei, {"dd": 6},
        {"hasHighAttackRecord": True, "lastHighAttack": Move.Pragon})
    add("liqiang-bi-repeat", Move.LiQiang, Move.Bi, {}, {"dd": 6, "lastMove": Move.Bi})
    add("liqiang-zhang-repeat", Move.LiQiang, Move.Pragon, {},
        {"dd": 12, "lastMove": Move.ZhangXinWei, "lastHighAttack": Move.Pragon,
         "hasHighAttackRecord": True, "zhangUsed": True})
    add("liqiang-free-previous", Move.LiQiang, Move.Three, {},
        {"dd": 18, "lastMove": Move.FreeThree, "lastHighAttack": Move.Three})
    add("liqiang-free-current", Move.LiQiang, Move.FreeThree, {},
        {"lightning": 3, "lastMove": Move.Three})
    add("liqiang-both-after-charge", Move.LiQiang, Move.LiQiang,
        {"lastMove": Move.Charge}, {"lastMove": Move.Charge})
    add("liqiang-both-after-nomove", Move.LiQiang, Move.LiQiang)
    for count in range(5):
        for attack, units in ((Move.Xiao, 2), (Move.Bi, 6), (Move.Pragon, 12), (Move.Three, 18), (Move.Volvo, 24)):
            add(f"bomb-{count}-vs-{attack.name}", Move.Bomb, attack,
                {"dd": 6, "bombUses": count}, {"dd": units})
    first = observe("bomb-T", Move.Bomb, Move.Charge, PlayerState(dd=6))
    cases.append(first)
    second_p = PlayerState(**first["after"][0])
    second_c = PlayerState(**first["after"][1])
    cases.append(observe("bomb-T-plus-1", Move.Charge, Move.Charge, second_p, second_c))
    p, c = PlayerState(dd=6), PlayerState()
    original = deepcopy((p, c))
    a = simulate_turn(p, c, Move.Bomb, Move.Charge)
    a_saved = deepcopy(asdict(a))
    b = simulate_turn(p, c, Move.Bomb, Move.Charge)
    repeated = {"before": [asdict(s) for s in original], "first": a_saved,
                "second": asdict(b), "input_after": [asdict(p), asdict(c)],
                "first_result_after_second_call": asdict(a)}
    by_id = {row["id"]: row for row in cases}
    assert by_id["bi-bi"]["outcome"].name == "Continue"
    assert by_id["bi-bi"]["after"][0]["dd"] == 0
    assert by_id["bomb-T"]["input_mutated"]
    assert by_id["enhanced-xiao-dd-0"]["legal"][0] is False
    print(json.dumps({"input_sha": "aeabaf681197eb110da919e310ad1f4833433bba",
                      "inventory": inventory, "cases": cases, "repeated_bomb": repeated},
                     ensure_ascii=False, indent=2, default=encode))


if __name__ == "__main__":
    main()
