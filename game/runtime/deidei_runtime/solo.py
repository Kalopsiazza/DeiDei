"""One local player, one precommitted random opponent, visible timed phases."""
from collections import OrderedDict
from copy import deepcopy
from random import Random, SystemRandom
import time
from uuid import uuid4

from deidei_core.api import list_options, new_match
from .opponent import choose_entry, needs_token, OPPONENT_NAME
from .session import MatchSession, expected_turn
from .view import options_view, participants_view, ledger_summary, progress, TRANSITIONS


class SoloGame:
    def __init__(self, profile: dict, *, session: MatchSession | None = None,
                 rng: Random | None = None, token_rng: Random | None = None,
                 clock=time.monotonic, submit_delay: float = 0.2, reveal_delay: float = 0.8):
        self.self_id = profile["profile_id"]
        self.profiles = {self.self_id: {k: profile[k] for k in ("nickname", "avatar_id")},
                         "bot_local": {"nickname": OPPONENT_NAME, "avatar_id": "sun"}}
        self.session = session if session is not None else MatchSession(new_match(list(self.profiles), str(uuid4())))
        self.rng = rng if rng is not None else SystemRandom()
        self.token_rng = token_rng if token_rng is not None else SystemRandom()
        self.clock, self.submit_delay, self.reveal_delay = clock, submit_delay, reveal_delay
        self.closed = False
        self.accepted = OrderedDict()
        self.resolutions = []
        self._prepare()

    def _prepare(self) -> None:
        self.state = self.session.snapshot()
        self.expected = expected_turn(self.state)
        self.view_id = f"{self.state['match_id']}:{self.state['game_index']}:{self.state['turn_index']}"
        self.options = options_view(self.state, self.self_id)
        self.selected = None
        self.resolution = None
        self.phase = "selecting"
        # Choose before accepting user input. Neither function receives the user's selection.
        self.bot_entry = choose_entry(list_options(self.state, "bot_local"), self.rng)
        self.tokens = {pid: self.token_rng.randrange(2) for pid in self.state["active_ids"]}
        if self.options[0]["forced"]:
            self._apply(None)

    def _apply(self, entry_id: str | None) -> None:
        submissions = {}
        if self.bot_entry is not None:
            submissions["bot_local"] = self.bot_entry
        if entry_id is not None:
            submissions[self.self_id] = entry_id
        tokens = {pid: self.tokens[pid] for pid, entry in submissions.items()
                  if needs_token(entry, self.state["players"][pid])}
        result = self.session.apply_round(self.view_id, self.expected, submissions, tokens)
        if not result["ok"]:
            raise ValueError(result["error"]["code"])
        self.resolution = result
        self.resolutions.append(deepcopy(result))
        self.accepted[self.view_id] = entry_id
        if len(self.accepted) > 128:
            self.accepted.popitem(last=False)
        self.selected = entry_id
        self.phase, self.phase_at = "submitting", self.clock()

    def submit(self, view_id: str, entry_id: str) -> dict:
        if self.closed:
            raise ValueError("SESSION_CLOSED")
        if view_id in self.accepted:
            if self.accepted[view_id] != entry_id:
                raise ValueError("REQUEST_CONFLICT")
            return self.get_view()
        if view_id != self.view_id:
            raise ValueError("STALE_VIEW")
        if self.phase != "selecting":
            raise ValueError("NOT_SELECTING")
        if not any(o["entry_id"] == entry_id and o["available"] for o in self.options):
            raise ValueError("UNAVAILABLE_MOVE")
        self._apply(entry_id)
        return self._view()

    def get_view(self) -> dict:
        if self.closed:
            raise ValueError("SESSION_CLOSED")
        now = self.clock()
        # ponytail: one visible phase per read; no scheduler or invisible catch-up loop.
        if self.phase == "submitting" and now - self.phase_at >= self.submit_delay:
            self.phase, self.phase_at = "revealed", now
        elif self.phase == "revealed" and now - self.phase_at >= self.reveal_delay:
            if self.resolution["transition"]["kind"] in ("sole_survivor", "nobody_survives"):
                self.phase = "result"
            else:
                self._prepare()
        return self._view()

    def _view(self) -> dict:
        revealed = self.phase in ("revealed", "result")
        resolution = self.resolution if revealed else None
        submitted = self.phase != "selecting"
        summary = ledger_summary(resolution, self.profiles) if resolution else [
            "曾义自动休整，等待揭晓。" if submitted and self.selected is None else
            "已提交，等待共同揭晓。" if submitted else "选择一张可用牌，再提交。对手本拍已预先选定。"]
        players = resolution["ledger"]["post_turn_players"] if resolution else self.state["players"]
        for pid, player in players.items():
            summary.append(progress(player, "本人" if pid == self.self_id else self.profiles[pid]["nickname"]))
        outcome = None
        if self.phase == "result":
            transition = self.resolution["transition"]
            outcome = {"winner_id": transition["winner_id"], "reason": TRANSITIONS[transition["kind"]]}
        return deepcopy({"source": "live", "view_id": self.view_id, **self.expected, "phase": self.phase,
                         "participants": participants_view(self.state, self.profiles, submitted, resolution),
                         "self_id": self.self_id, "options": self.options, "selected_entry_id": self.selected,
                         "submitted": submitted, "timer": {"mode": "untimed", "remaining_ms": None, "total_ms": None},
                         "summary": summary, "outcome": outcome})

    def leave(self) -> dict:
        view = self._view()
        self.session.close()
        self.closed = True
        return {**view, "phase": "error", "options": [], "summary": ["本场已结束。"], "outcome": None}
