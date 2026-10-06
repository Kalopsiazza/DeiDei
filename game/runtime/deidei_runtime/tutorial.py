"""Guided local practice; the ordinary session/core still owns every resolution."""
from uuid import uuid4

from deidei_core.api import new_match
from .session import MatchSession
from .solo import SoloGame

BASIC_ENTRIES = ('Charge', 'Def', 'Bi')
GUIDED_ENTRIES = ('Charge', 'Def', 'Bi')
GUIDED_OPPONENT = ('Charge', 'Bi', 'Charge')


class TutorialGame(SoloGame):
    def __init__(self, profile: dict, **kwargs):
        self.stage, self.step = 'guided', 0
        # ponytail: bounded native replay cache; no general lesson engine for three lessons.
        self.advanced = []
        super().__init__(profile, **kwargs)
        self.profiles['bot_local']['nickname'] = '教学对手'

    def _prepare(self) -> None:
        super()._prepare()
        self.bot_entry = (GUIDED_OPPONENT[self.step] if self.stage == 'guided' else
                          'Charge' if self.state['players']['bot_local']['dd6'] == '0' else 'Bi')

    def submit(self, view_id: str, entry_id: str) -> dict:
        if self.closed:
            raise ValueError('SESSION_CLOSED')
        if view_id in self.accepted:
            return super().submit(view_id, entry_id)
        if view_id != self.view_id:
            raise ValueError('STALE_VIEW')
        if entry_id not in BASIC_ENTRIES:
            raise ValueError('UNAVAILABLE_MOVE')
        if self.stage == 'guided' and entry_id != GUIDED_ENTRIES[self.step]:
            raise ValueError('TUTORIAL_TRY_TARGET')
        return super().submit(view_id, entry_id)

    def get_view(self) -> dict:
        if self.closed:
            raise ValueError('SESSION_CLOSED')
        if self.phase == 'submitting' and self.clock() - self.phase_at >= self.submit_delay:
            self.phase, self.phase_at = 'revealed', self.clock()
        return self._view()

    def advance(self, view_id: str) -> dict:
        if self.closed:
            raise ValueError('SESSION_CLOSED')
        if view_id in self.advanced:
            return self.get_view()
        if view_id != self.view_id:
            raise ValueError('STALE_VIEW')
        if self.phase != 'revealed':
            raise ValueError('NOT_REVEALED')
        self.advanced.append(view_id)
        self.advanced = self.advanced[-128:]
        ended = self.resolution['transition']['kind'] in ('sole_survivor', 'nobody_survives')
        if self.stage == 'challenge' and ended and self.resolution['transition']['winner_id'] == self.self_id:
            self.stage = 'complete'
        elif self.stage == 'guided' and self.step < 2:
            self.step += 1
            self._prepare()
        elif ended:
            self.stage, self.step = 'challenge', 0
            self.session.close()
            self.session = MatchSession(new_match(list(self.profiles), str(uuid4()), self.rules_snapshot))
            self.accepted.clear()
            self._prepare()
        else:
            self._prepare()
        return self._view()

    def _view(self) -> dict:
        view = super()._view()
        view['mode'] = 'tutorial'
        view['options'] = [option for option in view['options'] if option['entry_id'] in BASIC_ENTRIES]
        view['timer'] = {'mode': 'untimed', 'remaining_ms': None, 'total_ms': None}
        view['tutorial'] = {
            'stage': self.stage, 'step': self.step,
            'target_entry_id': GUIDED_ENTRIES[self.step] if self.stage == 'guided' else None,
            'won': bool(self.phase == 'revealed' and self.resolution and self.resolution['transition']['winner_id'] == self.self_id),
            'ended': bool(self.phase == 'revealed' and self.resolution and self.resolution['transition']['kind'] in ('sole_survivor', 'nobody_survives')),
        }
        return view
