"""Validate discussion data and its rendered catalog; never run game logic."""
from __future__ import annotations

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULTS = ROOT / "docs/results/R01-T01-a"
PHASES = ["PREPARE", "PRIMARY", "RETURN", "COMMIT"]
LABELS = {"CONFIRMED": "确认", "DERIVED": "推导", "CODE_CANDIDATE": "代码候选", "PROPOSED": "提案", "OPEN": "待定"}
BEGIN = "<!-- MOVE-CATALOG:BEGIN -->"
END = "<!-- MOVE-CATALOG:END -->"


def shown(fact: dict) -> str:
    value = fact["value"]
    if value is None:
        value = "待定"
    elif value is True:
        value = "是"
    elif value is False:
        value = "否"
    elif isinstance(value, (list, dict)):
        value = json.dumps(value, ensure_ascii=False)
    return f"{str(value).replace('|', '/')}〔{LABELS[fact['status']]}〕"


def render_moves(data: dict) -> str:
    lines = [BEGIN]
    for category, label in data["categories"].items():
        lines.extend(["", f"### {label}", ""])
        for move in data["moves"] + data.get("new_entries", []):
            if move["category"] != category:
                continue
            lines.extend([
                f"#### {format(move['legacy_index'], '02d') if move['legacy_index'] is not None else '新增'} · {move['name']} · {move['id']}", "",
                f"- 身份/来源：{move['resolution']['description']}。角色：{'、'.join(move['roles'])}。",
                f"- P1资格：{shown(move['availability']['rule'])}。成本（P1计算、P4写回）：{shown(move['cost']['rule'])}。",
                f"- 使用限制：{shown(move['use_limit'])}。",
                f"- 高阶复制资格：{shown(move['high_record'])}。P4共同处理：单次费用、实际招式历史、既有炸药队列推进。",
            ])
            if move["resolution"].get("inherits"):
                lines.append(f"- 属性/效果引用：{'; '.join(move['resolution']['inherits'])}；只继承本轮效果，入口成本与实际身份按本条保留。")
            if move["attributes"]:
                lines.extend(["", "| 属性及条件 | 值/比较/匹配 | 生成阶段 | P2有效 | P3有效 |", "| --- | --- | --- | --- | --- |"])
                for attr in move["attributes"]:
                    comparison = f"；比较：{shown(attr['comparison'])}" if "comparison" in attr else ""
                    lines.append(f"| {attr['id']}：{attr['when']} | {shown(attr['value'])}{comparison}；{attr['match']} | {attr['generated_in']} | {shown(attr['active_in']['PRIMARY'])} | {shown(attr['active_in']['RETURN'])} |")
            lines.extend(["", "| 效果 | 判定阶段 | 生效阶段 | 写回阶段 | 条件、对象与结果 |", "| --- | --- | --- | --- | --- |"])
            for effect in move["effects"]:
                lines.append(f"| {effect['id']}{'（直接淘汰）' if effect.get('kind') == 'DIRECT_ELIMINATION' else ''} | {effect['evaluate_in']} | {effect['resolve_in']} | {effect['commit_in'] or '无状态写回'} | {shown(effect['rule'])} |")
            evidence = sorted(set(move["evidence"]))
            lines.extend(["", f"依据：{'；'.join(evidence)}。未定项：{'、'.join(move['open_questions']) or '本条已列字段无独立问题；仍受全局未定项约束'}。", ""])
    lines.append(END)
    return "\n".join(lines)


def check_facts(value: object) -> int:
    count = 0
    if isinstance(value, dict):
        if "status" in value and "value" in value:
            assert value["status"] in LABELS, value
            assert value.get("evidence"), value
            if value["status"] == "OPEN":
                assert any(str(e).startswith("U") for e in value["evidence"]), value
            count += 1
        for nested in value.values():
            count += check_facts(nested)
    elif isinstance(value, list):
        count += sum(check_facts(item) for item in value)
    return count


def main() -> None:
    data = json.loads((RESULTS / "MOVE-CATALOG.json").read_text())
    tree = ast.parse((ROOT / "deidei_env.py").read_text())
    assignment = next(n for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "ALL_MOVES" for t in n.targets))
    expected = [item.attr for item in assignment.value.elts]
    enum = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "Move")
    enum_names = [n.targets[0].id for n in enum.body if isinstance(n, ast.Assign)]
    moves = data["moves"]
    assert len(moves) == len(expected) == 31
    assert [m["id"] for m in moves] == expected
    new_entries = data.get("new_entries", [])
    assert [m["id"] for m in new_entries] == ["ZengYi", "ZengRewardBigBi"]
    all_moves = moves + new_entries
    all_ids = [m["id"] for m in all_moves]
    assert len(set(all_ids)) == len(all_ids)
    assert "high_record_candidates" not in data
    assert set(data["copy_exclusions"]["value"]) <= set(all_ids)
    for index, move in enumerate(all_moves):
        if index < len(moves):
            assert move["legacy_index"] == index
            assert move["legacy_enum"] == enum_names.index(move["id"]) + 1
        else:
            assert move["legacy_index"] is None and move["legacy_enum"] is None
        assert move["category"] in data["categories"]
        resolution = move["resolution"]
        assert resolution["phase"] == "PREPARE"
        assert resolution["actual_move"] in all_ids or resolution["actual_move"] == "$own_latest_high_move"
        assert resolution["origin"] in {"normal", "bomb", "lightning", "zhang", "zeng_reward"}
        assert all(branch in all_ids for branch in resolution["branch_candidates"])
        if resolution["kind"] == "selector":
            assert len(resolution["branch_candidates"]) == 2
            assert resolution["actual_move"] == move["id"]
        if resolution["kind"] == "substitute":
            assert move["id"] == "ZhangXinWei"
            assert resolution["actual_move"] == "$own_latest_high_move"
        assert move["availability"]["evaluate_in"] == "PREPARE"
        assert move["cost"]["computed_in"] == "PREPARE" and move["cost"]["commit_in"] == "COMMIT"
        assert set(move["open_questions"]) <= {f"U{i:02d}" for i in range(4, 9)}
        attributes = move["attributes"]
        assert len({a["id"] for a in attributes}) == len(attributes)
        if move["resolution"]["kind"] not in {"source_entry", "substitute"}:
            assert any(a["kind"] == "defense" for a in attributes), move["id"]
        else:
            assert move["resolution"]["inherits"] and not attributes
        for attr in attributes:
            assert attr["generated_in"] in PHASES
            assert set(attr["active_in"]) == {"PRIMARY", "RETURN"}
            if attr["id"] == "clash_defense":
                assert attr["active_in"]["PRIMARY"]["value"] is True
                assert attr["active_in"]["RETURN"]["value"] is False
        assert move["effects"]
        assert len({e["id"] for e in move["effects"]}) == len(move["effects"])
        for effect in move["effects"]:
            assert effect["evaluate_in"] in PHASES and effect["resolve_in"] in PHASES
            assert PHASES.index(effect["evaluate_in"]) <= PHASES.index(effect["resolve_in"])
            assert effect["commit_in"] in {None, "COMMIT"}
            if "kind" in effect:
                assert effect["kind"] == "DIRECT_ELIMINATION"
                assert not {"damage", "attack_power"} & effect.keys()
    facts = check_facts(data)
    rendered = render_moves(data)
    document = (RESULTS / "RULE-FRAMEWORK.md").read_text()
    actual = document[document.index(BEGIN):document.index(END) + len(END)]
    assert actual == rendered, "Catalog markdown differs from MOVE-CATALOG.json"
    assert data["framework_version"] == "0.38" and data["discussion_round"] == 40
    print(f"PASS: 31 legacy IDs/indexes/enums + {len(new_entries)} unnumbered discussion entries; phase fields and references; {facts} sourced facts; markdown matches JSON.")
    print("This validates documentation structure, not gameplay outcomes or AI compatibility.")


if __name__ == "__main__":
    main()
