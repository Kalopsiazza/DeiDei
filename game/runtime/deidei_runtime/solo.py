"""One local player, one precommitted random opponent, visible timed phases."""
from collections import OrderedDict
from copy import deepcopy
from random import Random, SystemRandom
import time
from uuid import uuid4

from deidei_core.api import list_options, new_match, required_tokens
from .opponent import OPPONENT_NAME
from .legacy_model import RandomLegalProvider, LegacyModelProvider, MODEL_ID
from .session import MatchSession, expected_turn
from .view import options_view, participants_view, ledger_summary, progress, public_round, rules_view, pack_view, TRANSITIONS


class SoloGame:
    def __init__(self, profile: dict, *, session: MatchSession | None = None,
                 rng: Random | None = None, token_rng: Random | None = None,
                 lucky_rng: Random | None = None, rules_snapshot: dict | None = None,
                 rule_pack_manifests: list | None = None,
                 opponent_provider=None,
                 clock=time.monotonic, submit_delay: float = 0.9, reveal_delay: float = 3.0):
        self.self_id = profile["profile_id"]
        self.profiles = {self.self_id: {k: profile[k] for k in ("nickname", "avatar_id")},
                         "bot_local": {"nickname": OPPONENT_NAME, "avatar_id": "sun"}}
        self.session = session if session is not None else MatchSession(new_match(list(self.profiles), str(uuid4()), rules_snapshot))
        self.rules_snapshot = self.session.snapshot().get("rules_snapshot")
        self.rule_pack_manifests = deepcopy(rule_pack_manifests or [])
        self.rng = rng if rng is not None else SystemRandom()
        self.token_rng = token_rng if token_rng is not None else SystemRandom()
        self.lucky_rng = lucky_rng if lucky_rng is not None else SystemRandom()
        self.opponent = opponent_provider if opponent_provider is not None else RandomLegalProvider()
        if isinstance(self.opponent, LegacyModelProvider) and (self.session.schema_version != 2 or self.opponent.status()["state"] != "ready"):
            raise ValueError("AI_NOT_READY")
        self.opponent.state = "active"
        if self.opponent.requested_id == MODEL_ID:
            self.profiles["bot_local"]["nickname"] = "旧版模型对手"
        self.declarations, self.declaration_game_id = {}, self.session.snapshot()["game_id"]
        self.clock, self.submit_delay, self.reveal_delay = clock, submit_delay, reveal_delay
        self.closed = False
        self.accepted = OrderedDict()
        self.resolutions = []
        self._prepare()

    def _prepare(self) -> None:
        self.state = self.session.snapshot()
        if self.declaration_game_id != self.state["game_id"]:
            self.declarations = {}
            self.declaration_game_id = self.state["game_id"]
        self.expected = expected_turn(self.state)
        self.view_id = f"{self.state['match_id']}:{self.state['game_index']}:{self.state['turn_index']}"
        self.options = options_view(self.state, self.self_id)
        self.selected = None
        self.resolution = None
        self.phase = "selecting"
        # Choose before accepting user input. Neither function receives the user's selection.
        self.bot_options = list_options(self.state, "bot_local")
        self.bot_entry = self.opponent.choose(self.state, "bot_local", self.bot_options, self.declarations, self.rng)
        self.tokens = {pid: self.token_rng.randrange(2) for pid in self.state["active_ids"]}
        self.lucky_tokens = ({pid: self.lucky_rng.randrange(10000) for pid in self.state["active_ids"]}
                             if self.state["schema_version"] == 2 else {})
        if self.options[0]["forced"]:
            self._apply(None)

    def _apply(self, entry_id: str | None) -> None:
        submissions = {}
        if self.bot_entry is not None:
            submissions["bot_local"] = self.bot_entry
        if entry_id is not None:
            submissions[self.self_id] = entry_id
        def apply():
            try:
                consumers = required_tokens(self.state, submissions)
            except ValueError as error:
                return {"ok": False, "error": getattr(error, "error", {"code": "INVALID_STATE", "player_id": None})}
            tokens = {pid: self.tokens[pid] for pid in consumers["choice"]}
            lucky = {pid: self.lucky_tokens[pid] for pid in consumers["lucky"]}
            return self.session.apply_round(self.view_id, self.expected, submissions, tokens,
                                            lucky if self.state["schema_version"] == 2 else None)
        result = apply()
        error = result.get("error", {})
        if (not result["ok"] and isinstance(self.opponent, LegacyModelProvider)
                and error.get("player_id") == "bot_local"
                and error.get("code") in ("UNAVAILABLE_MOVE", "RULE_DISABLED", "INVALID_SUBMISSION")):
            self.bot_entry = self.opponent.rejected_candidate(self.bot_options, self.rng)
            if self.bot_entry is None:
                submissions.pop("bot_local", None)
            else:
                submissions["bot_local"] = self.bot_entry
            result = apply()
        if not result["ok"]:
            raise ValueError(result["error"]["code"])
        self.opponent.applied()
        self.decision_source = self.opponent.source
        self.declarations = {pid: "forced_recovery" if action["is_recovery"] else action["entry_id"]
                             for pid, action in result["ledger"]["actions"].items()}
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
        timer = {"mode": "untimed", "remaining_ms": None, "total_ms": None}
        if self.phase == "revealed":
            total_ms = round(self.reveal_delay * 1000)
            timer = {"mode": "reveal",
                     "remaining_ms": max(0, total_ms - round((self.clock() - self.phase_at) * 1000)),
                     "total_ms": total_ms}
        view = {"mode": "solo", "self_role": "player",
                         "self_participation": "active" if self.self_id in (resolution["next_state"]["active_ids"] if resolution else self.state["active_ids"]) else "eliminated",
                         "public_round": public_round(resolution, self.view_id) if resolution else None,
                         "source": "live", "game_index": self.state["game_index"], "view_id": self.view_id, **self.expected, "phase": self.phase,
                         "participants": participants_view(self.state, self.profiles, submitted, resolution),
                         "self_id": self.self_id, "options": self.options, "selected_entry_id": self.selected,
                         "submitted": submitted, "timer": timer,
                         "summary": summary, "outcome": outcome}
        if self.rules_snapshot is not None:
            view.update(rules_snapshot=rules_view(self.rules_snapshot), rule_pack_manifests=[pack_view(m) for m in self.rule_pack_manifests],
                        opponent_status=self.opponent.status(), decision_source=self.decision_source if revealed else None)
        return deepcopy(view)

    def leave(self) -> dict:
        view = self._view()
        self.session.close()
        self.opponent.close()
        self.closed = True
        return {**view, "phase": "error", "public_round": None, "options": [], "summary": ["本场已结束。"], "outcome": None}
