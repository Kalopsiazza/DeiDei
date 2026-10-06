"""Precommitted legacy distributions with one fallback budget per turn."""
import math
from copy import deepcopy

from .ai_supervisor import AISupervisor, AIError
from .opponent import choose_entry, OPPONENT_ID
from .legacy_projection import ACTION_MAP, observation, compatibility

MODEL_ID = "legacy-maskable-ppo-v1"
IDS = (OPPONENT_ID, MODEL_ID)

class OpponentProvider:
    requested_id = OPPONENT_ID
    def __init__(self):
        self.active_id, self.state = OPPONENT_ID, "ready"
        self.model_turns = self.fallback_turns = 0
        self.compatibility = {"missing_features": []}
        self.source, self.fallback_used = "random_legal", False

    def status(self):
        return {"requested_id": self.requested_id, "active_id": self.active_id, "state": self.state,
                "compatibility": deepcopy(self.compatibility), "model_turns": self.model_turns, "fallback_turns": self.fallback_turns}

    def choose(self, state, bot_id, options, declarations, rng):
        self.source, self.fallback_used = "random_legal", False
        entry = choose_entry(options, rng)
        if entry is None:
            self.source = "forced_recovery"
        return entry

    def fallback(self, options, rng):
        if self.fallback_used:
            raise ValueError("AI_FALLBACK_EXHAUSTED")
        self.fallback_used, self.source = True, "legal_fallback"
        return choose_entry(options, rng)

    def applied(self):
        self.model_turns += self.source == "legacy_model"
        self.fallback_turns += self.source == "legal_fallback"

    def close(self):
        self.active_id, self.state = None, "cancelled"


class RandomLegalProvider(OpponentProvider):
    pass


class LegacyModelProvider(OpponentProvider):
    requested_id = MODEL_ID
    def __init__(self, supervisor=None):
        super().__init__()
        self.supervisor = supervisor if supervisor is not None else AISupervisor()
        self.active_id, self.state, self.errors = None, "preparing", 0

    def status(self):
        if self.state in ("preparing", "ready"):
            self.state = self.supervisor.poll()
            self.active_id = MODEL_ID if self.state == "ready" else None
        elif self.state == "active" and getattr(self.supervisor, "process", None) is not None and self.supervisor.process.poll() is not None:
            self.degrade()
        return super().status()

    def degrade(self):
        self.supervisor.close("failed")
        self.active_id, self.state = OPPONENT_ID, "degraded"

    def choose(self, state, bot_id, options, declarations, rng):
        self.fallback_used = False
        self.compatibility = compatibility(state, declarations)
        if not any(o["available"] for o in options):
            self.source = "forced_recovery"
            return None
        if self.state == "degraded":
            return self.fallback(options, rng)
        legal = {o["entry_id"] for o in options if o["available"]}
        mask = [entry in legal for entry in ACTION_MAP]
        try:
            if not any(mask):
                raise AIError()
            expected = {key: state[key] for key in ("match_id", "game_id", "turn_index", "rules_hash")}
            values = self.supervisor.infer(expected, observation(state, bot_id, declarations), mask)
            if (not isinstance(values, list) or len(values) != 31
                    or any(type(v) not in (int, float) or not math.isfinite(v) or v < 0 for v in values)):
                raise AIError()
            values = [v if available else 0.0 for v, available in zip(values, mask)]
            total = sum(values)
            if not math.isfinite(total) or total <= 0:
                raise AIError()
            draw, cumulative, picked = rng.random(), 0.0, None
            for entry, value in zip(ACTION_MAP, values):
                cumulative += value / total
                if value and draw < cumulative:
                    picked = entry; break
            if picked is None:
                picked = next(entry for entry, value in reversed(list(zip(ACTION_MAP, values))) if value)
            self.source = "legacy_model"
            return picked
        except AIError as error:
            self.errors += 1
            if error.fatal or self.errors >= 2:
                self.degrade()
            return self.fallback(options, rng)

    def rejected_candidate(self, options, rng):
        self.errors += 1
        if self.errors >= 2:
            self.degrade()
        return self.fallback(options, rng)

    def applied(self):
        super().applied()
        if self.source == "legacy_model":
            self.errors = 0

    def close(self):
        self.supervisor.close()
        super().close()
