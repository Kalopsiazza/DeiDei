"""Public DesktopView formatting only; qualifications and outcomes come from core."""
import json
from decimal import Decimal
from math import gcd
from pathlib import Path

from deidei_core.api import list_options

CATALOG = {e["entry_id"]: e for e in json.loads(
    (Path(__file__).resolve().parents[2] / "desktop/catalog.json").read_text(encoding="utf-8"))["entries"]}
RESOURCE_NAMES = {"dd6": "DD", "lightning": "雷电", "nx_charge": "充能",
                  "mature_bombs": "成熟层", "reward_stock": "奖励"}
TRANSITIONS = {"continue_game": "双方仍在场，继续下一拍。", "restart_survivors": "存活者进入新局，资源归零。",
               "sole_survivor": "唯一存活者", "nobody_survives": "全员淘汰，无人获胜"}


def dd_text(value: str) -> str:
    whole, remainder = divmod(int(Decimal(value)), 6)
    whole_text = str(Decimal(whole))
    if not remainder:
        return whole_text
    divisor = gcd(remainder, 6)
    fraction = f"{remainder // divisor}/{6 // divisor}"
    return f"{whole_text}又{fraction}" if whole else fraction


def resource_text(resources: dict) -> str:
    values = [f"{dd_text(value) if key == 'dd6' else value} {name}"
              for key, name in RESOURCE_NAMES.items() if (value := resources[key]) != "0"]
    return " · ".join(values) or "0 DD"


def options_view(state: dict, player_id: str) -> list[dict]:
    result = []
    for option in list_options(state, player_id):
        entry = CATALOG[option["entry_id"]]
        result.append({**option, **{key: entry[key] for key in ("name", "ui_group", "detail_rule_ids")},
                       "cost_text": resource_text(option["spend"]),
                       "requirement_text": "持有 " + resource_text(option["required"])})
    return result


def participants_view(state: dict, profiles: dict, submitted: bool, resolution: dict | None) -> list[dict]:
    players = resolution["ledger"]["post_turn_players"] if resolution else state["players"]
    active = resolution["next_state"]["active_ids"] if resolution else state["active_ids"]
    result = []
    for pid in state["roster"]:
        player = players.get(pid, state["players"][pid])
        resources = {k: player[k] for k in ("dd6", "lightning", "nx_charge", "mature_bombs", "enhanced_xiao",
                                            "cloud_uses", "tian_uses", "bomb_placement_count")}
        resources["reward_stock"] = "1" if player["zeng_state"] == "ready" else "0"
        result.append({"player_id": pid, **profiles[pid], "alive": pid in active, "resources": resources,
                       "submission_state": "out" if pid not in active else "submitted" if submitted else "thinking"})
    return result


def progress(player: dict, name: str) -> str:
    return (f"{name}进度：待成熟 {len(player['pending_bombs'])} · 炸药放置 {player['bomb_placement_count']} 次 · "
            f"云 {player['cloud_uses']} 次 / 田利军 {player['tian_uses']} 次 · "
            f"张新伟{'已用' if player['zhang_used'] else '未用'}，记录 "
            f"{CATALOG.get(player['latest_copyable_move'], {}).get('name', '无')} · "
            f"历强{'已用' if player['liq_used'] else '未用'} · 曾义 "
            f"{dict(unused='未用', recovery='休整', waiting='等待奖励', ready='奖励可用', spent='奖励已用')[player['zeng_state']]}"
            + (f"（第 {player['reward_due_turn']} 拍末到期）" if player['reward_due_turn'] else ""))


def ledger_summary(resolution: dict, profiles: dict) -> list[str]:
    ledger = resolution["ledger"]
    summary = []
    origins = dict(normal="原招", zhang="复制", bomb="炸药兑换", lightning="雷电兑换", zeng_reward="奖励兑换")
    for pid, action in ledger["actions"].items():
        name = profiles[pid]["nickname"]
        entry = CATALOG[action["entry_id"]]["name"]
        actual = CATALOG[action["actual_move"]]["name"]
        branch = f" → {CATALOG[action['branch']]['name']}" if action["branch"] else ""
        condition = {"success": " · 成功", "failure": " · 失败", None: ""}[action["condition"]]
        summary.append(f"{name}：{'曾义自动休整' if action['is_recovery'] else entry}"
                       f"（{origins[action['origin']]}：{actual}{branch}{condition}）；实付 {resource_text(action['spend'])}。")
    summary.append(TRANSITIONS[resolution["transition"]["kind"]])
    for event in ledger["events"]:
        if event["resource_delta"] is not None:
            pid = event["target_id"] or event["actor_id"]
            summary.append(f"{profiles.get(pid, {}).get('nickname', '系统')}："
                           f"{RESOURCE_NAMES.get(event['resource'], event['resource'])} {event['resource_delta']}"
                           f"{'（六分之一单位）' if event['resource'] == 'dd6' else ''} · {event['kind']}。")
    return summary
