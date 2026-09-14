"""Capture unmodified Room/core DTOs from an explicitly supplied service checkout.

Only the session/clock container is synthetic. No WebSocket or Electron claim.
Run from any directory: python3 capture-room-results.py /path/to/service-checkout
"""
from pathlib import Path
from types import SimpleNamespace
from random import Random
import hashlib
import json
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
files = sorted((root / 'game/server/deidei_server').glob('*.py')) + sorted((root / 'game/core/deidei_core').glob('*.py'))
hashes = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
sys.path[:0] = [str(root / 'game/server'), str(root / 'game/core')]
from deidei_server.room import Room, turn_id
from deidei_server.protocol import DEFAULT_POLICY
from deidei_core.api import new_match


class Clock:
    t = 0

    def now_ms(self) -> int:
        return self.t

    def wall_ms(self) -> int:
        return 1800000000000 + self.t


def funded(ids: list[str], match_id: str) -> dict:
    state = new_match(ids, match_id)
    for p in state['players'].values():
        p['dd6'] = '6'
    return state


frames = {}
for name, moves, leave in [('ordinary', ['Charge', 'Charge'], False),
                          ('rules_winner', ['Bi', 'Charge'], False),
                          ('rules_nobody', ['SelfBi', 'SelfBi'], False),
                          ('forfeit_winner', ['Charge', 'Charge'], True),
                          ('forfeit_nobody', ['SelfBi', 'Charge'], True)]:
    clock = Clock()
    sessions = {pid: SimpleNamespace(player_id=pid, profile={'nickname': pid, 'avatar_id': 'leaf'},
                room_id=None, closed_room=None, touched=0, disconnected_at=None, connection=None)
                for pid in ['A', 'B', 'Z']}
    service = SimpleNamespace(clock=clock, dirty=set(), by_player=sessions, token_rng=Random(100),
                new_match_factory=funded, timeout_chooser=lambda state, options: 'Charge', host_leave_timing='after_turn')
    room = Room(service, sessions['A'], 'ABCD1234', DEFAULT_POLICY, None)
    room.add(sessions['B'], 'player')
    room.add(sessions['Z'], 'spectator')
    for pid in ['A', 'B']:
        room.command(sessions[pid], 'room.ready', {'room_id': room.id, 'ready': True}, 0)
    room.command(sessions['A'], 'room.start', {'room_id': room.id}, 0)
    for pid, entry in zip(['A', 'B'], moves):
        room.command(sessions[pid], 'room.submit', dict(room_id=room.id, match_id=room.state['match_id'], turn_id=turn_id(room.state), entry_id=entry), 0)
    if leave:
        room.command(sessions['B'], 'room.leave', {'room_id': room.id}, 0)
    clock.t = room.deadline
    room.tick(clock.t)
    frames[name + '_reveal'] = room.snapshot(sessions['Z'], clock.t)
    clock.t = room.deadline
    room.tick(clock.t)
    frames[name + '_next'] = room.snapshot(sessions['Z'], clock.t)

assert hashes == {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}, 'source changed during capture'
print(json.dumps({'source': 'real Room + real core; synthetic clock/session container; no socket',
                  'service_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
                  'service_dirty': bool(subprocess.check_output(['git', 'status', '--porcelain', '--', 'game/server', 'game/core'], cwd=root, text=True).strip()),
                  'source_sha256': hashes, 'frames': frames}, ensure_ascii=False, indent=2))
