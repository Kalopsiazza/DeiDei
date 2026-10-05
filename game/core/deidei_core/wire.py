"""Strict wire validation, with no global integer limits or state mutation."""
from copy import deepcopy
from decimal import Decimal
import re

from .entries import ACTUAL_MOVES, COPYABLE_MOVES, RULES_VERSION

COUNTS = (
    "dd6", "lightning", "nx_charge", "mature_bombs", "bomb_placement_count",
    "cloud_uses", "tian_uses",
)
FLAGS = ("zhang_used", "liq_used", "enhanced_xiao")
PLAYER_FIELDS = set(COUNTS + FLAGS + (
    "pending_bombs", "last_actual_move", "latest_copyable_move", "zeng_state", "reward_due_turn",
))
STATE_FIELDS = {
    "schema_version", "rules_version", "match_id", "game_id", "game_index", "turn_index",
    "roster", "active_ids", "status", "winner_id", "players",
}


class RuleError(ValueError):
    """A rejected public input, never a partially resolved round."""

    def __init__(self, code: str, player_id: str | None = None, field: str | None = None):
        self.error = {"code": code, "player_id": player_id, "field": field}
        super().__init__(f"{code}: {player_id or '-'} / {field or '-'}")


def decimal_string(value: int) -> str:
    """Do not impose Python 3.11's string-conversion digit cap on game resources."""
    return str(Decimal(value))


def quantity(value: object, field: str, player_id: str | None = None) -> int:
    if not isinstance(value, str) or re.fullmatch(r"0|[1-9][0-9]*", value) is None:
        raise RuleError("INVALID_STATE", player_id, field)
    return int(Decimal(value))


def valid_id(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value) is not None


def initial_player() -> dict:
    return {
        **dict.fromkeys(COUNTS, 0), **dict.fromkeys(FLAGS, False), "pending_bombs": [],
        "last_actual_move": None, "latest_copyable_move": None,
        "zeng_state": "unused", "reward_due_turn": None,
    }


def exact_fields(value: object, fields: set, field: str, player_id: str | None = None) -> None:
    if not isinstance(value, dict) or set(value) != fields:
        raise RuleError("INVALID_STATE", player_id, field)


def decode_state(state: object) -> dict:
    exact_fields(state, STATE_FIELDS, "state")
    if state["rules_version"] != RULES_VERSION:
        raise RuleError("UNSUPPORTED_RULES_VERSION", field="rules_version")
    if type(state["schema_version"]) is not int or state["schema_version"] != 1:
        raise RuleError("INVALID_STATE", field="schema_version")
    for field in ("match_id", "game_id"):
        if not isinstance(state[field], str) or not state[field]:
            raise RuleError("INVALID_STATE", field=field)
    game = quantity(state["game_index"], "game_index")
    turn = quantity(state["turn_index"], "turn_index")
    if game < 1 or turn < 1:
        raise RuleError("INVALID_STATE", field="game_index" if game < 1 else "turn_index")
    for field in ("roster", "active_ids"):
        ids = state[field]
        if (not isinstance(ids, list) or any(not valid_id(p) for p in ids)
                or len(ids) != len(set(ids))):
            raise RuleError("INVALID_STATE", field=field)
    roster, active = set(state["roster"]), set(state["active_ids"])
    if not 2 <= len(roster) <= 6 or not active <= roster:
        raise RuleError("INVALID_STATE", field="roster" if not 2 <= len(roster) <= 6 else "active_ids")
    status, winner = state["status"], state["winner_id"]
    if not isinstance(status, str) or status not in {"playing", "finished"}:
        raise RuleError("INVALID_STATE", field="status")
    if status == "playing" and (len(active) < 2 or winner is not None):
        raise RuleError("INVALID_STATE", field="active_ids" if len(active) < 2 else "winner_id")
    if status == "finished" and (len(active) > 1 or winner != next(iter(active), None)):
        raise RuleError("INVALID_STATE", field="winner_id")
    exact_fields(state["players"], roster, "players")
    decoded = {**state, "players": {}}
    decoded.update(game_index=game, turn_index=turn, roster=sorted(roster), active_ids=sorted(active))
    for pid in sorted(roster):
        # A Python caller can share objects even though JSON cannot encode aliases.
        p = deepcopy(state["players"][pid])
        decoded["players"][pid] = p
        exact_fields(p, PLAYER_FIELDS, "players", pid)
        for field in COUNTS:
            p[field] = quantity(p[field], field, pid)
        for field in FLAGS:
            if type(p[field]) is not bool:
                raise RuleError("INVALID_STATE", pid, field)
        for field, choices in (("last_actual_move", ACTUAL_MOVES), ("latest_copyable_move", COPYABLE_MOVES)):
            value = p[field]
            if value is not None and (not isinstance(value, str) or value not in choices):
                raise RuleError("INVALID_STATE", pid, field)
        if not isinstance(p["pending_bombs"], list):
            raise RuleError("INVALID_STATE", pid, "pending_bombs")
        bombs = []
        for original_bomb in p["pending_bombs"]:
            bomb = deepcopy(original_bomb)
            exact_fields(bomb, {"game_id", "placed_turn", "mature_at_turn_end"}, "pending_bombs", pid)
            if not isinstance(bomb["game_id"], str) or not bomb["game_id"]:
                raise RuleError("INVALID_STATE", pid, "pending_bombs.game_id")
            placed = quantity(bomb["placed_turn"], "pending_bombs.placed_turn", pid)
            mature = quantity(bomb["mature_at_turn_end"], "pending_bombs.mature_at_turn_end", pid)
            if placed < 1 or mature != placed + 1:
                raise RuleError("INVALID_STATE", pid, "pending_bombs.mature_at_turn_end")
            if pid in active:
                if bomb["game_id"] != state["game_id"]:
                    raise RuleError("INVALID_STATE", pid, "pending_bombs.game_id")
                # Finished ledgers retain a placement made on the final turn.
                if placed > turn or (status == "playing" and placed == turn) or mature < turn:
                    raise RuleError("INVALID_STATE", pid, "pending_bombs.placed_turn")
            bomb.update(placed_turn=placed, mature_at_turn_end=mature)
            bombs.append(bomb)
        p["pending_bombs"] = sorted(bombs, key=lambda b: (b["game_id"], b["placed_turn"], b["mature_at_turn_end"]))
        zeng = p["zeng_state"]
        if not isinstance(zeng, str) or zeng not in {"unused", "recovery", "waiting", "ready", "spent"}:
            raise RuleError("INVALID_STATE", pid, "zeng_state")
        due = p["reward_due_turn"]
        if zeng == "waiting":
            due = quantity(due, "reward_due_turn", pid)
            remaining = 2 if status == "playing" else 3
            if due < 5 or (pid in active and (due < turn or due > turn + remaining)):
                raise RuleError("INVALID_STATE", pid, "reward_due_turn")
            p["reward_due_turn"] = due
        elif due is not None:
            raise RuleError("INVALID_STATE", pid, "reward_due_turn")
        if pid in active and status == "playing":
            if zeng == "recovery" and (turn < 2 or p["last_actual_move"] != "ZengYi"):
                raise RuleError("INVALID_STATE", pid, "zeng_state")
            if zeng in {"ready", "spent"} and turn < 6:
                raise RuleError("INVALID_STATE", pid, "zeng_state")
    return decoded


def encode_player(player: dict) -> dict:
    result = deepcopy(player)
    for field in COUNTS:
        result[field] = decimal_string(result[field])
    for bomb in result["pending_bombs"]:
        for field in ("placed_turn", "mature_at_turn_end"):
            bomb[field] = decimal_string(bomb[field])
    if result["reward_due_turn"] is not None:
        result["reward_due_turn"] = decimal_string(result["reward_due_turn"])
    return result


def encode_state(state: dict) -> dict:
    result = deepcopy(state)
    result["game_index"] = decimal_string(result["game_index"])
    result["turn_index"] = decimal_string(result["turn_index"])
    result["players"] = {pid: encode_player(p) for pid, p in sorted(state["players"].items())}
    return result


def encode_resources(resources: dict) -> dict:
    return {key: decimal_string(value) for key, value in resources.items()}
