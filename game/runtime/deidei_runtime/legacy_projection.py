"""31 action slots and AI-first public 156-value projection; no ML imports."""
import json
from pathlib import Path

ACTION_MAP = tuple(json.loads(Path(__file__).with_name("legacy-action-map-v1.json").read_text())["entries"])


def clipped_decimal(value, denominator):
    """Compare arbitrary precision wire decimals before bounded float conversion."""
    text, cap = str(value), str(denominator)
    if not text.isascii() or not text.isdigit() or (len(text) > 1 and text.startswith("0")):
        raise ValueError("Invalid public resource")
    return 1.0 if (len(text), text) >= (len(cap), cap) else int(text) / denominator


def decimal_next(text):
    values = list(text)
    index = len(values) - 1
    while index >= 0 and values[index] == "9":
        values[index] = "0"; index -= 1
    if index < 0:
        values.insert(0, "1")
    else:
        values[index] = str(int(values[index]) + 1)
    return "".join(values)


def player_observation(player, game_id, turn_index, declaration):
    values = [0.0] * 78
    for index, name, cap in ((0, "dd6", 120), (1, "lightning", 12), (2, "cloud_uses", 10),
                            (3, "bomb_placement_count", 10), (4, "mature_bombs", 10),
                            (8, "tian_uses", 10), (10, "nx_charge", 10)):
        values[index] = clipped_decimal(player[name], cap)
    targets = [turn_index, decimal_next(turn_index), decimal_next(decimal_next(turn_index))]
    for index, target in enumerate(targets):
        count = sum(b["game_id"] == game_id and b["mature_at_turn_end"] == target for b in player["pending_bombs"])
        values[5 + index] = min(count / 5, 1.0)
    for index, name in ((9, "enhanced_xiao"), (11, "zhang_used"), (12, "liq_used")):
        values[index] = float(player[name])
    latest = player["latest_copyable_move"]
    values[13] = float(latest is not None)
    values[14 + (ACTION_MAP.index(latest) if latest in ACTION_MAP else 0 if latest is None else 31)] = 1.0
    values[46 + (ACTION_MAP.index(declaration) if declaration in ACTION_MAP else 31)] = 1.0
    return values


def observation(state, bot_id, declarations):
    other = next(pid for pid in state["roster"] if pid != bot_id)
    # Deliberately ordered AI, then human. No pending selections, tokens or session objects cross IPC.
    return (player_observation(state["players"][bot_id], state["game_id"], state["turn_index"], declarations.get(bot_id))
            + player_observation(state["players"][other], state["game_id"], state["turn_index"], declarations.get(other)))


def compatibility(state=None, declarations=None):
    missing = set()
    if state and state.get("rules_snapshot"):
        snapshot = state["rules_snapshot"]
        if snapshot["skill_flags"]["ZengYi"]:
            missing.add("ZengYi")
        if snapshot["parameters"]["lucky_probability_bps"]:
            missing.add("lucky_upgrade")
        if snapshot["parameters"]["charge_gain_dd6"] != "6":
            missing.add("configured_charge_gain")
        for p in state["players"].values():
            if p["zeng_state"] != "unused":
                missing.add("zeng_state")
    for value in (declarations or {}).values():
        if value in ("ZengYi", "ZengRewardBigBi", "forced_recovery"):
            missing.add(value)
    return {"missing_features": sorted(missing)}

