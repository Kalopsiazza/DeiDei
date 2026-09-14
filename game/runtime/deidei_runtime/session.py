"""Serial, in-memory application of immutable core resolutions (ARC A02)."""
from collections import OrderedDict
from copy import deepcopy
import json

from deidei_core.api import list_options, resolve_round


def rejected(code: str, field: str | None = None) -> dict:
    return {"ok": False, "error": {"code": code, "player_id": None, "field": field}}


def expected_turn(state: dict) -> dict:
    return {key: state[key] for key in ("match_id", "game_id", "turn_index")}


class MatchSession:
    def __init__(self, initial_state: dict, context: dict | None = None, max_cached: int = 128):
        # Validate via the public core API before accepting any caller-owned state.
        roster = initial_state.get("roster") if isinstance(initial_state, dict) else None
        player_id = roster[0] if isinstance(roster, list) and roster else ""
        list_options(initial_state, player_id)
        if type(max_cached) is not int or max_cached < 1:
            raise ValueError("max_cached must be a positive integer")
        self._state = deepcopy(initial_state)
        self._context = deepcopy(context) if context is not None else {
            "mode_at_start": "duel" if len(initial_state["roster"]) == 2 else "multiplayer",
            "absence_counts": dict.fromkeys(initial_state["roster"], 0),
        }
        self._cache = OrderedDict()
        self._max_cached = max_cached
        self._closed = False

    def snapshot(self) -> dict:
        return deepcopy(self._state)

    def context_snapshot(self) -> dict:
        return deepcopy(self._context)

    def apply_round(self, request_id: str, expected: dict, submissions: dict, choice_tokens: dict) -> dict:
        if self._closed:
            return rejected("SESSION_CLOSED")
        if not isinstance(request_id, str) or not 1 <= len(request_id) <= 128:
            return rejected("INVALID_REQUEST", "request_id")
        if any(isinstance(value, dict) and any(not isinstance(key, str) for key in value)
               for value in (expected, submissions, choice_tokens)):
            return rejected("INVALID_REQUEST")
        try:
            fingerprint = json.dumps([expected, submissions, choice_tokens], sort_keys=True,
                                     separators=(",", ":"), allow_nan=False)
        except (TypeError, ValueError, RecursionError):
            return rejected("INVALID_REQUEST")
        if request_id in self._cache:
            original, result = self._cache[request_id]
            return deepcopy(result) if fingerprint == original else rejected("REQUEST_CONFLICT")
        if (not isinstance(expected, dict) or set(expected) != {"match_id", "game_id", "turn_index"}
                or any(not isinstance(v, str) for v in expected.values())):
            return rejected("INVALID_REQUEST", "expected")
        if expected != expected_turn(self._state):
            return rejected("STALE_TURN")
        result = resolve_round(self._state, submissions, choice_tokens)
        if result["ok"]:
            self._state = deepcopy(result["next_state"])
            self._cache[request_id] = (fingerprint, deepcopy(result))
            if len(self._cache) > self._max_cached:
                self._cache.popitem(last=False)
        return result

    def close(self) -> None:
        self._closed = True
        self._cache.clear()
