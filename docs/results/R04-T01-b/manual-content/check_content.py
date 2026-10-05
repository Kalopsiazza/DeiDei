"""Check editorial facts against the existing core; render the reading draft."""
import hashlib
import json
import sys
from copy import deepcopy
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "game/core"))
from deidei_core.engine import prepare
from deidei_core.api import new_match, resolve_round
from deidei_core.entries import ENTRY_MAP, RULES_VERSION, options_for
from deidei_core.wire import initial_player


def check_and_render() -> None:
    content = json.loads((HERE / "content.json").read_text())
    catalog = json.loads((ROOT / "game/desktop/catalog.json").read_text())
    cards = {c["entry_id"]: c for c in content["cards"]}
    originals = {c["entry_id"]: c for c in catalog["entries"]}
    rules = {s["id"]: s["text"].splitlines()[0] for s in catalog["sections"]}
    resources = {r["id"] for r in content["resources"]}
    assert content["rules_version"] == RULES_VERSION
    assert len(cards) == len(content["cards"]) == 33
    assert cards.keys() == originals.keys() == ENTRY_MAP.keys()
    for path, digest in content["sources"].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, path
    chapters = {c["id"]: c for c in content["chapters"]}
    assert len(chapters) == len(content["chapters"])
    assert set(content["beginner_route"]) <= chapters.keys()
    referenced = set()
    for chapter in chapters.values():
        assert set(chapter["related_cards"]) <= cards.keys()
        for section in chapter["sections"]:
            assert section["body"] and section["rule_ids"]
            assert set(section["rule_ids"]) <= rules.keys()
            referenced.update(section["rule_ids"])
    assert referenced == rules.keys(), "every original rule needs a reading route"
    stat_checks = cost_checks = 0
    for entry_id, card in cards.items():
        original = originals[entry_id]
        assert card["name"] == original["name"]
        assert card["category"] == original["ui_group"]
        assert card["qualification"] == original["requirement_text"]
        assert set(card["rule_ids"]) <= rules.keys()
        assert card["lead"] and card["effects"] and card["cautions"]
        assert card["tip"]["text"] and set(card["tip"]["rule_ids"]) <= rules.keys()
        egg = card["easter_egg"]
        assert egg["hidden_by_default"] and egg["is_rule"] is False
        assert set(egg["reveal_on"]) == {"hover", "focus", "tap"}
        assert len({r["entry_id"] for r in card["relations"]}) == len(card["relations"])
        for relation in card["relations"]:
            assert relation["entry_id"] in cards and relation["entry_id"] != entry_id
            assert relation["note"] and set(relation["rule_ids"]) <= rules.keys()
        for index, cost in enumerate(card["costs"]):
            player = initial_player()
            player.update(dd6=600, lightning=20, nx_charge=20, mature_bombs=20,
                          latest_copyable_move="Pragon", zeng_state="ready" if entry_id == "ZengRewardBigBi" else "unused")
            if entry_id == "Cloud":
                player["cloud_uses"] = index
            if entry_id == "TianLiJun":
                player["tian_uses"] = index
            if entry_id == "Xiao":
                player["enhanced_xiao"] = bool(index)
            option = next(o for o in options_for(player) if o["entry_id"] == entry_id)
            for display_key, core_key in [("requires", "required"), ("spends", "spend")]:
                values = cost[display_key]
                assert len({v["resource"] for v in values}) == len(values)
                assert {v["resource"] for v in values} <= resources
                expected = {r: 0 for r in option[core_key]}
                for value in values:
                    resource = "dd6" if value["resource"] == "dd" else value["resource"]
                    amount = Fraction(value["amount"]) * (6 if resource == "dd6" else 1)
                    assert amount.denominator == 1 and amount >= 0
                    expected[resource] = int(amount)
                assert expected == option[core_key], (entry_id, cost["when"], core_key)
            cost_checks += 1
        for index, mode in enumerate(card["combat_modes"]):
            if entry_id == "ZhangXinWei":
                assert mode["attack"]["value"] == mode["defense"]["value"] == "复制招式"
                continue
            actual = ENTRY_MAP[entry_id][0]
            branch = None
            if actual in {"RotateThree", "FlipVolvo"}:
                branch = ("Three" if actual == "RotateThree" else "Volvo") if index == 0 else "SelfBi"
            player, other = initial_player(), initial_player()
            other_move = "Charge"
            if actual == "SelfBi" or branch == "SelfBi":
                if mode["label"] == "自 bi 成功":
                    other_move = "Reflect"
            if actual == "LiQiang":
                other_move = "Bi"
                if index == 0:
                    other["last_actual_move"] = "Bi"
                if index == 2:
                    player["dd6"] = 6
            if entry_id == "Bomb":
                player["bomb_placement_count"] = index
            if entry_id == "Xiao":
                player["enhanced_xiao"] = bool(index)
            state = {"players": {"a": player, "b": other}}
            actions = {"a": {"actual_move": actual, "is_recovery": False},
                       "b": {"actual_move": other_move, "is_recovery": False}}
            result = prepare(state, actions, {"a": branch} if branch else {})["a"]
            attack = str(Fraction(result["attack6"], 6))
            defense = result["defense_primary"]
            defense_value = "∞" if defense["kind"] == "unbounded" else str(Fraction(defense["sixths"], 6))
            assert mode["attack"]["value"] == attack, (entry_id, mode["label"], "attack")
            assert mode["defense"]["value"] == defense_value, (entry_id, mode["label"], "defense")
            if defense["kind"] == "finite":
                assert mode["defense"]["comparison"] == ("equal" if defense["comparison"] == "eq" else "at_most")
            if mode["defense"].get("match") == "attack_collision":
                assert result["defense_return"]["sixths"] == 0
                assert mode["defense"]["return_value"] == "0"
            stat_checks += 1
    aliases = content["presentation"]["search_aliases"]
    assert set(aliases) <= cards.keys()
    glossary = {term["id"]: term for term in content["glossary"]}
    examples = {example["id"]: example for example in content["examples"]}
    assert len(glossary) == len(content["glossary"])
    assert len(examples) == len(content["examples"])
    for term in glossary.values():
        assert term["label"] and term["short"] and term["detail"]
        assert set(term["rule_ids"]) <= rules.keys()
    covered = set()
    round_checks = 0
    for example in examples.values():
        assert example["title"] and example["setup_copy"] and example["result_copy"]
        assert example["scene_label"] and isinstance(example["context_copy"], str)
        assert example["is_live_match"] is False
        assert set(example["players"]) == {"a", "b"}
        assert set(example["rule_ids"]) <= rules.keys()
        assert example["rounds"]
        state = new_match(["a", "b"], match_id="manual:" + example["id"])
        for pid, fields in example["initial_overrides"].items():
            assert fields.keys() <= state["players"][pid].keys()
            state["players"][pid].update(fields)
        used_cards = set()
        for index, round_ in enumerate(example["rounds"], 1):
            used_cards.update(round_["submissions"].values())
            assert used_cards <= cards.keys()
            original = deepcopy(state)
            result = resolve_round(state, round_["submissions"], round_["choice_tokens"])
            assert state == original, (example["id"], index, "input mutation")
            assert result["ok"], (example["id"], index, result)
            ledger, expected = result["ledger"], round_["expected"]
            assert ledger["eliminated_ids"] == expected["eliminated_ids"], (example["id"], index, "eliminated")
            assert result["transition"]["kind"] == expected["transition"], (example["id"], index, "transition")
            assert result["transition"]["winner_id"] == expected["winner_id"], (example["id"], index, "winner")
            for section in ["post_turn_players", "actions"]:
                for pid, fields in expected[section].items():
                    for key, value in fields.items():
                        assert ledger[section][pid][key] == value, (example["id"], index, section, pid, key)
            # Playback is a frozen core result, never a second rule implementation.
            fields = ["dd6", "lightning", "nx_charge", "mature_bombs", "enhanced_xiao", "zeng_state"]
            round_["playback"] = {
                "before": {pid: {**{key: player[key] for key in fields}, "waiting_bombs": str(len(player["pending_bombs"]))} for pid, player in original["players"].items()},
                "after": {pid: {**{key: player[key] for key in fields}, "waiting_bombs": str(len(player["pending_bombs"]))} for pid, player in ledger["post_turn_players"].items()},
                "actions": {pid: {key: action[key] for key in ["entry_id", "actual_move", "branch", "is_recovery"]} for pid, action in ledger["actions"].items()},
                "events": [{key: event[key] for key in ["kind", "result", "actor_id", "target_id"]} for event in ledger["events"] if event["kind"] in {"attack", "return", "direct_elimination"}],
            }
            state = result["next_state"]
            round_checks += 1
        assert set(example["cards"]) == used_cards
        covered.update(used_cards)
    assert covered == cards.keys(), "every card needs a resolved example"
    for card in cards.values():
        beginner = card["beginner"]
        assert beginner["summary"] and beginner["watch_out"]
        assert set(beginner["learn_next"]) <= cards.keys() - {card["entry_id"]}
        assert len(beginner["learn_next"]) <= 3
        assert set(beginner["glossary_ids"]) <= glossary.keys()
        assert beginner["example_ids"] and set(beginner["example_ids"]) <= examples.keys()
        assert 1 <= len(beginner["primary_example_ids"]) <= 3
        assert set(beginner["primary_example_ids"]) <= set(beginner["example_ids"])
        assert all(card["entry_id"] in examples[id]["cards"] for id in beginner["example_ids"])
    onboarding = content["onboarding"]
    assert set(onboarding["start_cards"]) == {"Charge", "Bi", "Def"}
    assert len({step["id"] for step in onboarding["steps"]}) == len(onboarding["steps"])
    for step in onboarding["steps"]:
        assert step["copy"] and step["prompt"] and step["answer"]
        assert set(step["cards"]) <= cards.keys()
        assert set(step["glossary_ids"]) <= glossary.keys()
        assert set(step["example_ids"]) <= examples.keys()
    assert len({question["id"] for question in content["questions"]}) == len(content["questions"])
    for question in content["questions"]:
        assert question["question"] and question["answer"]
        assert set(question["cards"]) <= cards.keys()
        assert set(question["chapters"]) <= chapters.keys()
        assert set(question["rule_ids"]) <= rules.keys()

    lines = ["# 经典图鉴 · 用户内容阅读稿", "", "状态：已接入本地图鉴原型；首次玩家验收待试玩。规则版本 classic-1.0.1。", "",
             "基础条款、引擎、现有 catalog 均保留。下面是面向玩家的阅读层；关联卡牌是带条件的查阅入口，不是完整胜负表。", "",
             "彩蛋是原创课间便签，正式界面默认隐藏，悬停、聚焦或轻触揭示。关键费用、条件与风险始终可见，完整精确说明可展开。", "",
             "## " + onboarding["title"], "", onboarding["intro"], "", onboarding["availability"], ""]
    for index, step in enumerate(onboarding["steps"], 1):
        lines.extend([f"### {index}. {step['title']}", "", step["copy"], "",
                      "想一想：" + step["prompt"], "", "答案：" + step["answer"], ""])
        if step["example_ids"]:
            lines.extend(["可以演示：" + "、".join(examples[id]["title"] for id in step["example_ids"]), ""])
        if step.get("more_copy"):
            lines.extend(["展开再看：" + step["more_copy"], ""])
    lines.extend([onboarding["next"], "", "## 按问题查", ""])
    for question in content["questions"]:
        lines.extend(["### " + question["question"], "", question["answer"], "",
                      "接着看：" + "、".join(cards[id]["name"] for id in question["cards"]), ""])
    brief = content["creative_brief"]
    lines.extend(["## 创意与界面文案", "", brief["goal"], ""])
    copy_labels = {"title": "标题", "subtitle": "副标题", "beginner_button": "入门按钮", "search_placeholder": "搜索提示", "reference_button": "规则入口"}
    lines.extend(f"- {copy_labels[key]}：{value}" for key, value in brief["entry_copy"].items())
    lines.extend(["", "档案栏目：" + " → ".join(brief["panels"].values()), "", "**示例演出分镜**", ""])
    lines.extend(f"- {beat['copy']}：{beat['visual']}" for beat in brief["example_storyboard"])
    lines.extend(["", "操作文案：" + " / ".join(brief["controls"].values()), "", "**设计约束**", ""])
    lines.extend(f"- {text}" for text in brief["constraints"])
    lines.extend(["", "**互动创意与可直接使用的文案**", ""])
    for idea in brief["reading_interactions"]:
        lines.extend([f"### {idea['label']}", "", idea["copy"], "", idea["behavior"], ""])
    lines.extend(["", "**首次玩家验收目标（待实际试玩）**", ""])
    lines.extend(f"- {text}" for text in brief["acceptance"])
    lines.extend(["", "## 按主题细查", "", "进阶路线：" + " → ".join(chapters[id]["title"] for id in content["beginner_route"]), ""])
    for chapter in chapters.values():
        lines.extend([f"### {chapter['title']}", "", chapter["lead"], ""])
        for section in chapter["sections"]:
            lines.extend([f"**{section['title']}**", ""])
            lines.extend(f"- {text}" for text in section["body"])
            lines.extend(["", "关联规则：" + "、".join(f"{id} {rules[id]}" for id in section["rule_ids"]), ""])
        lines.extend(["关联卡牌：" + "、".join(cards[id]["name"] for id in chapter["related_cards"]), ""])
    symbols = {"dd": "DD", "lightning": "雷电", "nx_charge": "聂湘充能", "mature_bombs": "成熟炸药", "reward_stock": "大 bi 奖励"}
    def amounts(values: list[dict]) -> str:
        return " + ".join(f"{v['amount']} {symbols[v['resource']]}" for v in values) or "0"
    for card in cards.values():
        beginner = card["beginner"]
        lines.extend([f"## {card['doc_id']} · {card['name']}", "", "**先看懂**", "", beginner["summary"], "",
                      "注意：" + beginner["watch_out"], "", "先看这几个例子：" + "、".join(examples[id]["title"] for id in beginner["primary_example_ids"]), "",
                      "接着认识：" + ("、".join(cards[id]["name"] for id in beginner["learn_next"]) or "可直接查完整规则"), ""])
        lines.extend(f"- {glossary[id]['label']}：{glossary[id]['short']}" for id in beginner["glossary_ids"])
        lines.extend(["", "**精确属性**", "", card["lead"], "", "分类：" + card["category"] + ("｜" + "、".join(card["tags"]) if card["tags"] else ""), "",
                      "| 条件 | 需要持有 | 实际扣除 |", "| --- | --- | --- |"])
        for cost in card["costs"]:
            condition = cost["when"] + ("；" + cost["qualification"] if cost.get("qualification") else "")
            lines.append(f"| {condition} | {amounts(cost['requires'])} | {amounts(cost['spends'])} |")
        lines.extend(["", "完整资格：" + card["qualification"], "", "| 状态 | 攻击 | 防御 | 作用范围与匹配 |", "| --- | --- | --- | --- |"])
        for mode in card["combat_modes"]:
            defense = mode["defense"]
            prefix = "＝" if defense["comparison"] == "equal" else "≤"
            value = defense["value"] if defense["match"] == "copied_move" else prefix + defense["value"]
            label = "对撞防御 " if defense["match"] == "attack_collision" else ""
            note = defense["scope"] + "；" + mode["note"]
            if mode.get("counterattack"):
                note += "；回击强度取原来袭数值，只返回原攻击者。"
            lines.append(f"| {mode['label']} | {mode['attack']['value']} | {label}{value} | {note} |")
        for title, key in [("效果", "effects"), ("限制与例外", "cautions")]:
            lines.extend(["", f"**{title}**", ""])
            lines.extend(f"- {text}" for text in card[key])
        if card["timeline"]:
            lines.extend(["", "| 时点 | 阶段 | 发生什么 |", "| --- | --- | --- |"])
            lines.extend(f"| {step['at']} | {step['title']} | {step['text']} |" for step in card["timeline"])
        lines.extend(["", "**关联卡牌**", ""])
        lines.extend(f"- {cards[r['entry_id']]['name']}：{r['label']}。{r['note']}。" for r in card["relations"])
        lines.extend(["", "小提示：" + card["tip"]["text"], "", "隐藏彩蛋草案：" + card["easter_egg"]["text"], "",
                      "关联规则：" + "、".join(f"{id} {rules[id]}" for id in card["rule_ids"]), ""])
    lines.extend(["## 两人预设示例", "", "以下为固定初始条件，不代表实时对局，也不保证多人局结果。正式接入按既有引擎账目播放；文字可直接阅读。", ""])
    for example in examples.values():
        lines.extend([f"### {example['title']}（{example['id']}）", "", example["setup_copy"], "",
                      "| 回合 | 左方 | 右方 | 本拍淘汰 |", "| --- | --- | --- | --- |"])
        for index, round_ in enumerate(example["rounds"], 1):
            submissions = round_["submissions"]
            names = [cards[submissions[pid]]["name"] if pid in submissions else "系统休整" for pid in ["a", "b"]]
            eliminated = "、".join(example["players"][pid] for pid in round_["expected"]["eliminated_ids"]) or "无"
            lines.append(f"| {index} | {names[0]} | {names[1]} | {eliminated} |")
        lines.extend(["", example["result_copy"], ""])
    lines.extend(["## 随用随查的术语", "", "术语只在首次需要时解释，不要求入门前通读。", ""])
    lines.extend(f"- **{term['label']}**：{term['short']} {term['detail']}" for term in glossary.values())
    (HERE / "REVIEW.md").write_text("\n".join(lines) + "\n")
    (HERE / "content.json").write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n")
    print(f"PASS: 33 cards, {len(chapters)} chapters, {len(rules)} rules, {len(glossary)} terms, {len(content['questions'])} questions, {len(examples)} examples/{round_checks} resolved rounds, {stat_checks} combat scenarios, {cost_checks} cost scenarios; source hashes unchanged.")
    print("Rendered REVIEW.md from content.json.")


if __name__ == "__main__":
    check_and_render()
