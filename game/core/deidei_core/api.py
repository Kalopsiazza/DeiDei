"""R02's three public functions accept and return JSON-compatible dictionaries."""
from .entries import BRANCHES, ENTRY_MAP, RESOURCES, RULES_VERSION, options_for
from .engine import evaluate, prepare, select_branches, settle
from .wire import RuleError, decode_state, encode_resources, encode_state, initial_player, valid_id


def new_match(player_ids: list[str], match_id: str) -> dict:
    """Create a match; invalid identifiers raise ValueError without any side effects."""
    if (not isinstance(player_ids, list) or not 2 <= len(player_ids) <= 6
            or any(not valid_id(pid) for pid in player_ids) or len(set(player_ids)) != len(player_ids)):
        raise ValueError("player_ids must contain 2–6 distinct ASCII player identifiers")
    if not isinstance(match_id, str) or not match_id:
        raise ValueError("match_id must be a nonempty string")
    ids = sorted(player_ids)
    return encode_state({
        "schema_version": 1, "rules_version": RULES_VERSION, "match_id": match_id,
        "game_id": match_id + ":g1", "game_index": 1, "turn_index": 1,
        "roster": ids, "active_ids": ids.copy(), "status": "playing", "winner_id": None,
        "players": {pid: initial_player() for pid in ids},
    })


def list_options(state: dict, player_id: str) -> list[dict]:
    """List all 33 entries. Malformed state or unknown identity raises ValueError."""
    decoded = decode_state(state)
    if not valid_id(player_id) or player_id not in decoded["players"]:
        raise ValueError("player_id must belong to the roster")
    options = options_for(decoded["players"][player_id],
                          player_id in decoded["active_ids"] and decoded["status"] == "playing")
    return [{**option, "required": encode_resources(option["required"]),
             "spend": encode_resources(option["spend"])} for option in options]


def resolve_round(state: dict, submissions: dict, choice_tokens: dict) -> dict:
    """Resolve a complete fixed input; rejection never returns a partial next state.

    Repeating this pure calculation is safe. Applying it once belongs to the
    future runtime session, which owns request IDs and stale-turn rejection.
    """
    try:
        decoded = decode_state(state)
        if decoded["status"] == "finished":
            raise RuleError("MATCH_FINISHED")
        if not isinstance(submissions, dict):
            raise RuleError("INVALID_SUBMISSION", field="submissions")
        active = decoded["active_ids"]
        free = {pid for pid in active if decoded["players"][pid]["zeng_state"] != "recovery"}
        if set(submissions) != free:
            differing = set(submissions) ^ free
            pid = next(iter(sorted(p for p in differing if valid_id(p))), None)
            raise RuleError("INVALID_SUBMISSION", pid, "submissions")
        raw = {}
        for pid in active:
            p = decoded["players"][pid]
            recovery = p["zeng_state"] == "recovery"
            entry = "ZengYi" if recovery else submissions[pid]
            if not isinstance(entry, str) or entry not in ENTRY_MAP:
                raise RuleError("INVALID_SUBMISSION", pid, "entry_id")
            spend = dict.fromkeys(RESOURCES, 0)
            if not recovery:
                option = next(o for o in options_for(p) if o["entry_id"] == entry)
                if not option["available"]:
                    raise RuleError("UNAVAILABLE_MOVE", pid, "entry_id")
                spend = option["spend"]
            move, origin = ENTRY_MAP[entry]
            if origin == "zhang":
                move = p["latest_copyable_move"]
            raw[pid] = {"entry_id": entry, "actual_move": move, "origin": origin,
                        "is_recovery": recovery, "spend": spend}
        if not isinstance(choice_tokens, dict):
            raise RuleError("INVALID_CHOICE_TOKEN", field="choice_tokens")
        choosers = {pid for pid, a in raw.items() if a["actual_move"] in BRANCHES}
        if set(choice_tokens) - choosers:
            extra = sorted(pid for pid in set(choice_tokens) - choosers if valid_id(pid))
            raise RuleError("INVALID_CHOICE_TOKEN", extra[0] if extra else None, "choice_tokens")
        for pid in sorted(choosers):
            if pid not in choice_tokens:
                raise RuleError("MISSING_CHOICE_TOKEN", pid, "choice_tokens")
            if type(choice_tokens[pid]) is not int or choice_tokens[pid] not in (0, 1):
                raise RuleError("INVALID_CHOICE_TOKEN", pid, "choice_tokens")
        branches = select_branches(decoded, raw, choice_tokens)
        actions = prepare(decoded, raw, branches)
        return settle(decoded, actions, evaluate(decoded, actions))
    except RuleError as exc:
        return {"ok": False, "error": exc.error}
