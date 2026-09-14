"""Synchronous room transactions. Network writes never run inside a transaction."""
from copy import deepcopy
from uuid import uuid4

from deidei_core.api import list_options, new_match, resolve_round
from deidei_core.entries import ENTRY_MAP, BRANCHES
from .protocol import require


def turn_id(state: dict) -> str:
    return state['game_id'] + ':t' + state['turn_index']


class Room:
    def __init__(self, service, host, code: str, policy: dict, password: tuple | None):
        self.service, self.id, self.code = service, str(uuid4()), code
        self.host_id, self.policy, self.password = host.player_id, dict(policy), password
        self._had_password = password is not None
        self.members, self.pending, self.tokens, self.departing = {}, {}, {}, set()
        self.state = self.last_turn = self.outcome = self.pause = self.close_reason = None
        self.profiles, self.mode = [], None
        self.phase, self.seq, self.deadline = 'lobby', 0, None
        self.last_activity = service.clock.now_ms()
        self.closed_at = None
        self.add(host, 'player')

    def add(self, session, role: str) -> None:
        require(self.phase != 'closed', 'ROOM_GONE')
        require(role != 'player' or self.phase == 'lobby', 'MATCH_IN_PROGRESS')
        count = sum(m['role'] == role for m in self.members.values())
        if role == 'spectator':
            require(self.policy['spectator_cap'] > 0, 'SPECTATORS_DISABLED')
            require(count < self.policy['spectator_cap'], 'SPECTATORS_FULL')
        else:
            require(count < 6, 'ROOM_FULL')
        occupied = {m['seat'] for m in self.members.values()}
        seat = next(i for i in range(6) if i not in occupied) if role == 'player' else None
        self.members[session.player_id] = dict(player_id=session.player_id, **session.profile,
            role=role, seat=seat, connected=True, ready=False,
            participation='lobby' if role == 'player' else 'spectating',
            submission_state='none', absence_count=0)
        session.room_id, session.closed_room = self.id, None
        if role == 'player':
            self.clear_ready()
        self.changed()

    def changed(self) -> None:
        self.seq += 1
        self.service.dirty.add(self.id)

    def clear_ready(self) -> None:
        for m in self.members.values():
            m['ready'] = False

    def active(self, pid: str) -> bool:
        return self.state is not None and pid in self.state['active_ids']

    def free_ids(self) -> list[str]:
        return [pid for pid in self.state['active_ids']
                if self.state['players'][pid]['zeng_state'] != 'recovery']

    def prepare(self, now: int) -> None:
        self.phase, self.deadline, self.select_started = 'selecting', now + self.policy['turn_ms'], now
        self.pending = {}
        self.tokens = {pid: self.service.token_rng.randrange(2) for pid in self.state['active_ids']}
        for pid, m in self.members.items():
            m['submission_state'] = ('forced' if self.state['players'][pid]['zeng_state'] == 'recovery'
                else 'thinking') if self.active(pid) else 'out'
        self.maybe_early(now)

    def maybe_early(self, now: int) -> None:
        free = self.free_ids()
        if not free or (self.policy['early_reveal'] and all(pid in self.pending for pid in free)):
            self.deadline = max(self.select_started + self.policy['min_select_ms'], now)

    def command(self, session, op: str, p: dict, now: int) -> dict:
        pid = session.player_id
        require(pid in self.members and session.room_id == self.id, 'ROOM_NOT_MEMBER')
        require(self.phase != 'closed', 'ROOM_GONE')
        m = self.members[pid]
        if op == 'room.sync':
            return dict(room_id=self.id)
        if op == 'room.leave':
            if pid == self.host_id:
                self.close('HOST_LEFT', now)
            else:
                phase = self.pause['resume_phase'] if self.phase == 'paused' else self.phase
                active = self.last_turn['effective_state']['active_ids'] if phase == 'revealing' else (self.state['active_ids'] if self.state else [])
                ongoing = phase in ('selecting', 'revealing') and pid in active
                finished = self.last_turn and self.last_turn['effective_state']['status'] == 'finished'
                if ongoing and not finished:
                    self.departing.add(pid)
                    m['participation'] = 'departing'
                    m['connected'] = False
                else:
                    self.remove(pid)
                self.changed()
            session.room_id = session.closed_room = None
            session.touched = now
            return dict(room_id=self.id, left=True)
        require(self.phase != 'paused', 'HOST_RECONNECTING')
        if op == 'room.ready':
            require(m['role'] == 'player', 'NOT_ACTIVE')
            require(self.phase == 'lobby', 'WRONG_PHASE')
            if m['ready'] != p['ready']:
                m['ready'] = p['ready']
                self.changed()
            return dict(room_id=self.id, ready=m['ready'])
        if op == 'room.role':
            require(pid != self.host_id, 'NOT_HOST')
            require(self.phase == 'lobby', 'WRONG_PHASE')
            if m['role'] != p['role']:
                count = sum(v['role'] == p['role'] for v in self.members.values())
                cap = 6 if p['role'] == 'player' else self.policy['spectator_cap']
                require(cap > 0, 'SPECTATORS_DISABLED')
                require(count < cap, 'ROOM_FULL' if p['role'] == 'player' else 'SPECTATORS_FULL')
                del self.members[pid]
                self.add(session, p['role'])
                self.clear_ready()
            return dict(room_id=self.id, role=p['role'])
        if op == 'room.start':
            require(pid == self.host_id, 'NOT_HOST')
            require(self.phase == 'lobby', 'WRONG_PHASE')
            players = [v for v in self.members.values() if v['role'] == 'player']
            require(2 <= len(players) <= 6 and all(v['ready'] and v['connected'] for v in players), 'NOT_READY')
            match_id = str(uuid4())
            self.state = deepcopy(self.service.new_match_factory([v['player_id'] for v in players], match_id))
            require(self.state['match_id'] == match_id and
                    set(self.state['active_ids']) == {v['player_id'] for v in players}, 'INTERNAL_ERROR')
            for v in players:
                list_options(self.state, v['player_id'])
                v.update(participation='active', absence_count=0)
            self.mode = 'duel' if len(players) == 2 else 'multiplayer'
            self.profiles = [{k: v[k] for k in ('player_id', 'nickname', 'avatar_id', 'seat')} for v in players]
            self.last_turn = self.outcome = None
            self.departing.clear()
            self.prepare(now)
            self.changed()
            return dict(room_id=self.id, match_id=match_id)
        if op == 'room.submit':
            require(m['role'] == 'player' and self.active(pid) and pid not in self.departing, 'NOT_ACTIVE')
            require(p['match_id'] == self.state['match_id'] and p['turn_id'] == turn_id(self.state), 'STALE_TURN')
            require(self.phase == 'selecting', 'TURN_CLOSED')
            require(self.state['players'][pid]['zeng_state'] != 'recovery', 'FORCED_RECOVERY')
            require(pid not in self.pending, 'ALREADY_SUBMITTED')
            require(any(o['entry_id'] == p['entry_id'] and o['available']
                        for o in list_options(self.state, pid)), 'UNAVAILABLE_MOVE', 'entry_id')
            self.pending[pid] = p['entry_id']
            m.update(submission_state='submitted', absence_count=0)
            self.maybe_early(now)
            self.changed()
            return dict(room_id=self.id, match_id=p['match_id'], turn_id=p['turn_id'], accepted_entry_id=p['entry_id'])
        if op == 'room.return_lobby':
            require(pid == self.host_id, 'NOT_HOST')
            require(self.phase == 'result', 'WRONG_PHASE')
            self.phase, self.state, self.last_turn, self.outcome = 'lobby', None, None, None
            self.pending, self.tokens, self.profiles = {}, {}, []
            self.clear_ready()
            for v in self.members.values():
                v.update(participation='lobby' if v['role'] == 'player' else 'spectating',
                         submission_state='none', absence_count=0)
            self.changed()
            return dict(room_id=self.id)
        require(False, 'INVALID_MESSAGE')

    def remove(self, pid: str) -> None:
        m = self.members.pop(pid, None)
        self.departing.discard(pid)
        s = self.service.by_player.get(pid)
        if s and s.room_id == self.id:
            s.room_id = None
            s.touched = self.service.clock.now_ms()
        if m and m['role'] == 'player' and self.phase == 'lobby':
            self.clear_ready()

    def close(self, reason: str, now: int) -> None:
        if self.phase == 'closed':
            return
        self.phase, self.close_reason, self.closed_at = 'closed', reason, now
        self.deadline = self.pause = None
        self.pending, self.tokens, self.departing = {}, {}, set()
        for pid in self.members:
            s = self.service.by_player[pid]
            if s.room_id == self.id:
                s.room_id, s.closed_room, s.touched = None, self.id, now
        self.password = None
        self.changed()

    def disconnected(self, session, now: int) -> None:
        if self.phase == 'closed' or session.player_id not in self.members:
            return
        self.members[session.player_id]['connected'] = False
        if session.player_id == self.host_id:
            grace = self.policy['host_disconnect_grace_ms']
            if not grace:
                self.close('HOST_TIMEOUT', now)
                return
            self.pause = dict(reason='HOST_DISCONNECTED', resume_phase=self.phase,
                phase_remaining_ms=None if self.deadline is None else max(0, self.deadline - now))
            self.phase, self.deadline = 'paused', now + grace
        self.changed()

    def resumed(self, session, now: int) -> None:
        m = self.members.get(session.player_id)
        if not m or self.phase == 'closed':
            return
        m['connected'] = True
        if session.player_id == self.host_id and self.phase == 'paused':
            self.phase = self.pause['resume_phase']
            remaining = self.pause['phase_remaining_ms']
            self.deadline = None if remaining is None else now + remaining
            if self.phase == 'selecting':
                # Preserve the unconsumed minimum display time as well as the deadline.
                self.select_started += now - session.disconnected_at
            self.pause = None
        self.changed()

    def settle(self, at: int) -> None:
        submissions, sources, forfeits = dict(self.pending), {}, []
        for pid in self.state['active_ids']:
            m = self.members[pid]
            forced = self.state['players'][pid]['zeng_state'] == 'recovery'
            sources[pid] = 'forced' if forced else 'human' if pid in self.pending else 'timeout_auto'
            if pid not in self.pending and (not forced or not m['connected']):
                m['absence_count'] = min(3, m['absence_count'] + 1)
            if pid in self.departing or m['absence_count'] >= 3:
                forfeits.append(dict(player_id=pid, reason='voluntary_leave' if pid in self.departing else 'three_absences'))
            if not forced and pid not in submissions:
                legal = [o for o in list_options(self.state, pid) if o['available']]
                submissions[pid] = ('Charge' if self.mode == 'multiplayer' else
                    self.service.timeout_chooser(deepcopy(self.state), deepcopy(legal)))
                require(any(o['entry_id'] == submissions[pid] for o in legal), 'INTERNAL_ERROR')
        tokens = {}
        for pid, entry in submissions.items():
            move, origin = ENTRY_MAP[entry]
            if origin == 'zhang':
                move = self.state['players'][pid]['latest_copyable_move']
            if move in BRANCHES:
                tokens[pid] = self.tokens[pid]
        result = resolve_round(self.state, submissions, tokens)
        require(result['ok'], 'INTERNAL_ERROR')
        # Host termination wins before any unpublished resolution is exposed.
        if any(f['player_id'] == self.host_id for f in forfeits):
            self.close('HOST_ABSENT', at)
            return
        effective, transition = deepcopy(result['next_state']), deepcopy(result['transition'])
        removed = {f['player_id'] for f in forfeits}
        survivors = sorted(set(effective['active_ids']) - removed)
        changed = survivors != effective['active_ids']
        if changed:
            players = deepcopy(self.state['players']) | deepcopy(result['ledger']['post_turn_players'])
            if len(survivors) >= 2:
                fresh = new_match(survivors, self.state['match_id'])
                index = str(int(self.state['game_index']) + 1)
                gid = self.state['match_id'] + ':g' + index
                effective = {**fresh, 'game_id': gid, 'game_index': index,
                    'roster': self.state['roster'][:], 'players': players | fresh['players']}
                transition = dict(kind='restart_survivors', from_game_id=self.state['game_id'], to_game_id=gid, winner_id=None)
            else:
                winner = survivors[0] if survivors else None
                effective = {**deepcopy(self.state), 'players': players, 'active_ids': survivors,
                             'status': 'finished', 'winner_id': winner}
                transition = dict(kind='sole_survivor' if survivors else 'nobody_survives',
                                  from_game_id=self.state['game_id'], to_game_id=None, winner_id=winner)
        for f in forfeits:
            self.remove(f['player_id'])
        for pid, m in self.members.items():
            if m['role'] == 'player':
                m['participation'] = 'active' if pid in effective['active_ids'] else 'eliminated'
        # Validate the effective state through the public API before publishing it.
        list_options(effective, effective['roster'][0])
        self.last_turn = dict(turn_id=turn_id(self.state), core_resolution=public_resolution(result),
            room_forfeits=forfeits, effective_transition=transition, effective_state=public_state(effective), action_sources=sources)
        self.outcome = (dict(kind=transition['kind'], winner_id=transition['winner_id'],
                            reason='room_forfeit' if changed else 'rules')
                        if effective['status'] == 'finished' else None)
        self.phase, self.deadline = 'revealing', at + self.policy['reveal_ms']
        self.changed()

    def tick(self, now: int) -> None:
        while self.deadline is not None and self.deadline <= now and self.phase != 'closed':
            at = self.deadline
            if self.phase == 'paused':
                self.close('HOST_TIMEOUT', at)
            elif self.phase == 'selecting':
                self.settle(at)
            elif self.phase == 'revealing':
                self.state = deepcopy(self.last_turn['effective_state'])
                if self.state['status'] == 'finished':
                    self.phase, self.deadline = 'result', None
                    self.pending, self.tokens = {}, {}
                else:
                    self.prepare(at)
                self.changed()
        for pid, m in list(self.members.items()):
            if pid == self.host_id or m['connected'] or pid in self.departing:
                continue
            s = self.service.by_player[pid]
            lobby = self.phase == 'lobby' or (self.phase == 'paused' and self.pause['resume_phase'] == 'lobby')
            if (lobby or m['role'] == 'spectator') and s.disconnected_at is not None and now >= s.disconnected_at + 30000:
                self.remove(pid)
                self.changed()
        if self.phase in ('lobby', 'result') and now >= self.last_activity + 7200000:
            self.close('ROOM_IDLE', now)

    def snapshot(self, session, now: int) -> dict:
        pid = session.player_id
        m = self.members[pid]
        own = session.room_id == self.id and pid not in self.departing
        selecting = own and self.phase == 'selecting' and self.active(pid)
        options = list_options(self.state, pid) if selecting else []
        members = [dict(v) for key, v in self.members.items() if key not in self.departing]
        kind = {'selecting': 'select', 'revealing': 'reveal', 'paused': 'host_grace'}.get(self.phase, 'none')
        timer = dict(kind=kind, deadline_at_ms=None, remaining_ms=None)
        if self.deadline is not None:
            timer.update(deadline_at_ms=self.service.clock.wall_ms() + self.deadline - now,
                         remaining_ms=max(0, self.deadline - now))
        match = None if self.state is None else dict(match_id=self.state['match_id'], mode_at_start=self.mode,
            turn_id=turn_id(self.state), public_state=public_state(self.state), roster_profiles=deepcopy(self.profiles),
            last_turn=deepcopy(self.last_turn), effective_outcome=deepcopy(self.outcome))
        return dict(v=1, type='snapshot', room_id=self.id, seq=str(self.seq), server_time_ms=self.service.clock.wall_ms(),
            view=dict(source='online', room_code=self.code, host_id=self.host_id, phase=self.phase,
                has_password=self.has_password, policy=dict(self.policy), members=members, match=match,
                self=dict(player_id=pid, role=m['role'], seat=m['seat'], options=options,
                          accepted_entry_id=self.pending.get(pid) if own and self.phase != 'closed' else None),
                timer=timer, pause=deepcopy(self.pause), close_reason=self.close_reason))

    @property
    def has_password(self) -> bool:
        return self.password is not None if self.phase != 'closed' else self._had_password


# Explicit classic-1.0.1 DTO projection: future private core fields aren't serialized.
def fields(value: dict, names: str) -> dict:
    return {key: deepcopy(value[key]) for key in names.split()}


def public_player(player: dict) -> dict:
    p = fields(player, 'dd6 lightning nx_charge mature_bombs bomb_placement_count cloud_uses tian_uses '
               'zhang_used liq_used enhanced_xiao last_actual_move latest_copyable_move zeng_state reward_due_turn')
    p['pending_bombs'] = [fields(b, 'game_id placed_turn mature_at_turn_end') for b in player['pending_bombs']]
    return p


def public_state(state: dict) -> dict:
    result = fields(state, 'schema_version rules_version match_id game_id game_index turn_index '
                    'roster active_ids status winner_id')
    result['players'] = {pid: public_player(p) for pid, p in state['players'].items()}
    return result


def public_resolution(result: dict) -> dict:
    ledger = fields(result['ledger'], 'match_id game_id turn_index kills eliminated_ids')
    ledger['post_turn_players'] = {pid: public_player(p) for pid, p in result['ledger']['post_turn_players'].items()}
    ledger['actions'] = {}
    for pid, action in result['ledger']['actions'].items():
        a = fields(action, 'entry_id actual_move origin is_recovery branch condition eligible_targets enhanced_xiao attack6')
        a['spend'] = fields(action['spend'], 'dd6 lightning nx_charge mature_bombs reward_stock')
        for key in ('defense_primary', 'defense_return'):
            defense = action[key]
            a[key] = None if defense is None else fields(defense,
                'kind match_rule' if defense['kind'] == 'unbounded' else 'kind sixths comparison match_rule')
        ledger['actions'][pid] = a
    ledger['events'] = [fields(e, 'event_id phase kind actor_id target_id amount6 resource resource_delta source_event_id rule_ids result reason_code') for e in result['ledger']['events']]
    return dict(ok=True, ledger=ledger, next_state=public_state(result['next_state']),
                transition=fields(result['transition'], 'kind from_game_id to_game_id winner_id'))
