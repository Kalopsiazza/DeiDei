"""Authored protocol expectations, expanded without importing a server or rule engine."""
from __future__ import annotations
from copy import deepcopy
import hashlib
import json
from pathlib import Path

try:
    from .validate import HERE, POLICY, ROOT
except ImportError:
    from validate import HERE, POLICY, ROOT

CASES = []


class Case:
    def __init__(self, family: int, variant: str, title: str, clauses: str, **policy: object) -> None:
        self.number = 0
        self.data = dict(case_id=f'N{family:02}/{variant}', title=title, clauses=clauses.split(),
                         policy={**POLICY, **policy}, people={}, initial={}, steps=[], needs_gui=False,
                         clock='manual', forbidden=['other_pending', 'credentials', 'cross_room', 'unpublished_resources'])
        CASES.append(self.data)

    def add(self, action: str, **args: object) -> None:
        self.data['steps'].append({'do': action, **args})

    def open(self, alias: str) -> None:
        self.data['people'][alias] = dict(nickname='测试' + alias, avatar_id='leaf')
        self.add('connect', **{'as': alias})

    def command(self, alias: str, op: str, payload: dict, *, error: str | None = None,
                save: str | None = None, rid: str | None = None, ack_data: dict | None = None) -> dict:
        self.number += 1
        message = dict(v=1, type='command', request_id=rid or f'cmd-{self.number}',
                       command_seq='@next', op=op, payload=payload)
        ack = dict(ok=False, error=dict(code=error)) if error else dict(ok=True)
        if ack_data is not None:
            ack['data'] = ack_data
        step = {'do': 'command', 'as': alias, 'message': message, 'ack': ack}
        if save:
            step['save'] = save
        self.data['steps'].append(step)
        return step

    def room(self, players: tuple = ('h', 'p'), spectators: tuple = (), *, start: bool = True,
             password: str | None = None, name: str = 'room') -> None:
        for person in players + spectators:
            self.data['initial'].setdefault('roles', {})[person] = 'spectator' if person in spectators else 'player'
            self.open(person)
        self.command(players[0], 'room.create', dict(password=password, options={k: self.data['policy'][k] for k in ('turn_ms', 'early_reveal', 'spectator_cap')}), save=name, rid='create-' + name)
        for person in players[1:] + spectators:
            self.join(person, 'spectator' if person in spectators else 'player', password=password, room=name)
        if start:
            for person in players:
                self.ready(person, room=name)
            self.command(players[0], 'room.start', {'room_id': '$' + name + '.room_id'}, save='start')
        self.view(players[0], 'selecting' if start else 'lobby', **{'members.length': len(players + spectators)})

    def join(self, alias: str, role: str = 'player', *, password: str | None = None, error: str | None = None, room: str = 'room') -> dict:
        return self.command(alias, 'room.join', dict(room_code='$' + room + '.room_code', password=password, role=role), error=error)

    def ready(self, alias: str, value: bool = True, *, room: str = 'room', error: str | None = None) -> None:
        self.command(alias, 'room.ready', dict(room_id='$' + room + '.room_id', ready=value), error=error)

    def submit(self, alias: str, entry: str = 'Charge', *, error: str | None = None, rid: str | None = None) -> None:
        self.command(alias, 'room.submit', dict(room_id='$room.room_id', match_id='$match.match_id', turn_id='$match.turn_id', entry_id=entry), error=error, rid=rid)

    def view(self, alias: str, phase: str, **expected: object) -> None:
        self.add('view', **{'as': alias}, expect={'phase': phase, **expected})

    def wait(self, ms: int) -> None:
        self.add('advance', ms=ms)

    def next(self, alias: str = 'h') -> None:
        self.wait(self.data['policy']['reveal_ms'])
        self.view(alias, 'selecting')

    def sync(self, alias: str, *, error: str | None = None, room: str = 'room') -> None:
        self.command(alias, 'room.sync', dict(room_id='$' + room + '.room_id'), error=error)

    def leave(self, alias: str) -> None:
        self.command(alias, 'room.leave', dict(room_id='$room.room_id'))

    def same(self, alias: str, name: str, path: str, *, remember: bool = False, equal: bool = True) -> None:
        self.add('remember' if remember else 'compare', **{'as': alias}, name=name, path=path,
                 **({} if remember else {'equal': equal}))


def fixture(number: str, index: int = 0) -> dict:
    return json.loads((ROOT / 'tests/rules_v1_001/fixtures' / (number + '.json')).read_text())[index]


def core_case(family: int, number: str, index: int = 0) -> Case:
    f = fixture(number, index)
    c = Case(family, number + '_' + f['variant'], '完整核心预期：' + f['variant'], 'P05 P06 W06 A05 A08')
    c.data['initial']['state'] = f['input']['state']
    players = tuple(f['input']['state']['roster'])
    c.room(players)
    for person, entry in f['input']['submissions'].items():
        c.submit(person, entry)
    c.wait(300)
    c.view(players[0], 'revealing')
    c.add('core', **{'as': players[0]}, input=f['input'], expected=f['expected'])
    return c


def build() -> list[dict]:
    CASES.clear()
    c = Case(1, 'create', '创建无密码房并检查房主与私有视图', 'P02 P03 W01 W02 W05')
    c.room(('h',), start=False)
    c.view('h', 'lobby', **{'has_password': False, 'members.h.seat': 0, 'members.h.ready': False, 'members.h.role': 'player', 'self.options': [], 'match': None})

    for variant, password, error in [('correct', '合成房密', None), ('wrong', '不正确', 'ROOM_ACCESS_DENIED'), ('missing', None, 'ROOM_ACCESS_DENIED')]:
        c = Case(2, variant, '密码正确入座；错误与不存在房号同码', 'P02 W02 W07 A03')
        c.room(('h',), password='合成房密', start=False)
        c.open('p'); c.join('p', password=password, error=error)
        c.view('h', 'lobby', **{'members.length': 1 if error else 2, 'has_password': True})
        if error:
            c.command('p', 'room.join', dict(room_code='ZZZZZZZZ', password=password, role='player'), error=error)
            c.view('h', 'lobby', **{'members.length': 1})

    c = Case(3, 'last_seat', '两条独立连接竞争最后席位', 'P02 W03 A02')
    c.room(('h', 'p', 'q', 'r', 't'), start=False)
    for alias in ('x', 'y'): c.open(alias)
    commands = []
    for alias in ('x', 'y'):
        step = c.join(alias); c.data['steps'].pop()
        step['ack'] = {'one_of': [{'ok': True}, {'ok': False, 'error': {'code': 'ROOM_FULL'}}]}
        commands.append(step)
    c.add('parallel', commands=commands, successes=1)
    c.view('h', 'lobby', **{'members.length': 6, 'members.h.seat': 0, 'members.t.seat': 4})

    for cap in (0, 6, 12):
        c = Case(4, 'cap_' + str(cap), '独立观众容量与六席分开', 'P02 P13 W03 W05', spectator_cap=cap)
        players = ('h', 'p', 'q', 'r', 't', 'u')
        spectators = tuple('s' + str(i) for i in range(cap))
        c.room(players, spectators, start=False)
        c.open('extra'); c.join('extra', 'spectator', error='SPECTATORS_DISABLED' if cap == 0 else 'SPECTATORS_FULL')
        c.view('h', 'lobby', **{'members.length': 6 + cap})

    c = Case(4, 'eliminated_keep_seat', '淘汰者占原参战席而不消耗观众容量', 'P02 P07 W03 W05')
    c.data['initial']['players'] = {'h': {'dd6': '6'}, 'p': {'dd6': '6'}}
    spectators = tuple('s' + str(i) for i in range(6))
    c.room(('h', 'p', 'q'), spectators)
    c.submit('h', 'Bi'); c.submit('p', 'Bi'); c.submit('q'); c.wait(300)
    c.view('h', 'revealing', **{'members.q.participation': 'eliminated', 'members.q.seat': 2, 'members.length': 9})
    c.open('x'); c.join('x', 'spectator', error='SPECTATORS_FULL')
    c.view('q', 'revealing', **{'self.options': [], 'self.role': 'player'})

    for op in ('room.ready', 'room.start', 'room.submit', 'forged'):
        c = Case(5, op.replace('.', '_'), '观众权限与未知身份字段', 'P03 P09 W03 A06')
        c.room(spectators=('s',), start=op == 'room.submit')
        payload = {'room_id': '$room.room_id'}
        if op == 'room.ready': payload['ready'] = True
        if op == 'room.submit': payload.update(match_id='$match.match_id', turn_id='$match.turn_id', entry_id='Charge')
        if op == 'forged': payload.update(ready=True, player_id='$h.player_id')
        error = 'INVALID_MESSAGE' if op == 'forged' else ('NOT_HOST' if op == 'room.start' else 'NOT_ACTIVE')
        step = c.command('s', 'room.ready' if op == 'forged' else op, payload, error=error)
        if op == 'room.ready': step['ack']['error']['code'] = ['NOT_ACTIVE', 'WRONG_PHASE']
        c.view('h', 'selecting' if op == 'room.submit' else 'lobby', **{'members.h.ready': op == 'room.submit', 'self.accepted_entry_id': None})

    for who in ('h', 'p', 'disconnected'):
        c = Case(6, who, '全连线全准备且仅房主可开局', 'P03 W03')
        c.room(start=False)
        if who == 'h': c.ready('p')
        else: c.ready('h')
        if who == 'disconnected': c.ready('p'); c.add('disconnect', **{'as': 'p'})
        c.command('h', 'room.start', {'room_id': '$room.room_id'}, error='NOT_READY')
        c.view('h', 'lobby', **{'match': None})
        if who == 'disconnected': c.add('resume', **{'as': 'p'})
        c.ready('h'); c.ready('p')
        c.command('p', 'room.start', {'room_id': '$room.room_id'}, error='NOT_HOST')
        c.command('h', 'room.start', {'room_id': '$room.room_id'})
        c.view('h', 'selecting', **{'match.mode_at_start': 'duel'})

    for change in ('player_join', 'player_leave', 'role', 'spectator_join_leave', 'host_role'):
        c = Case(7, change, '大厅成员变更是否清准备', 'P03 W02 W03')
        c.room(start=False); c.ready('h'); c.ready('p')
        if change == 'player_join': c.open('q'); c.join('q')
        elif change == 'player_leave': c.leave('p')
        elif change == 'role': c.command('p', 'room.role', dict(room_id='$room.room_id', role='spectator'))
        elif change == 'spectator_join_leave': c.open('s'); c.join('s', 'spectator'); c.leave('s')
        else: c.command('h', 'room.role', dict(room_id='$room.room_id', role='spectator'), error='WRONG_PHASE')
        c.view('h', 'lobby', **{'members.h.ready': change in {'spectator_join_leave', 'host_role'}})

    c = Case(8, 'mid_match', '开场后只允许观众加入', 'P02 P07 W03')
    c.room(); c.open('x'); c.join('x', error='MATCH_IN_PROGRESS'); c.join('x', 'spectator')
    c.view('x', 'selecting', **{'self.options': [], 'self.accepted_entry_id': None, 'members.x.participation': 'spectating'})

    for kind in ('same', 'conflict', 'resume_retry', 'evicted'):
        c = Case(9, kind, '创建幂等与缓存淘汰后的旧序号', 'P04 W04 A03')
        c.room(('h',), start=False)
        c.same('h', 'room_before', 'room_code', remember=True)
        if kind == 'resume_retry': c.add('disconnect', **{'as': 'h'}); c.add('resume', **{'as': 'h'})
        if kind == 'evicted':
            for _ in range(129): c.sync('h'); c.wait(60)
        c.add('replay', request_id='create-room', **({'payload_patch': {'password': 'different'}} if kind == 'conflict' else {'ack': dict(ok=False, error=dict(code='STALE_COMMAND'))} if kind == 'evicted' else {}))
        c.view('h', 'lobby', **{'members.length': 1})
        c.same('h', 'room_before', 'room_code')

    for entry in ('Bi', 'Def'):
        c = Case(10, 'secret_' + entry, '只改变他人秘密牌的完整JSON非干扰对照', 'P04 P09 W04 W05 A06')
        c.data['initial']['players'] = {'h': {'dd6': '6'}}
        c.room(spectators=('s',)); c.submit('h', entry)
        c.view('h', 'selecting', **{'self.accepted_entry_id': entry, 'match.public_state.players.h.dd6': '6'})
        for observer in ('p', 's'):
            c.sync(observer); c.view(observer, 'selecting', **{'self.accepted_entry_id': None, 'members.h.submission_state': 'submitted', 'match.last_turn': None})
            c.add('privacy', **{'as': observer}, key='select-' + observer, compare=entry == 'Def')
        c.add('resume', **{'as': 'p'}); c.sync('p'); c.view('p', 'selecting')
        c.add('privacy', **{'as': 'p'}, key='resume-p', compare=entry == 'Def')
        c.submit('p', 'Pragon', error='UNAVAILABLE_MOVE'); c.view('p', 'selecting')
        c.add('privacy', **{'as': 'p'}, key='failure-p', compare=entry == 'Def')

    for turn_ms in (5000, 12000, 30000):
        for early in (True, False):
            c = Case(11, f'{turn_ms}_{early}', '提前揭晓与最短展示、截止均只结算一次', 'P04 W04 A04', turn_ms=turn_ms, early_reveal=early)
            c.room(); c.submit('h'); c.submit('p'); c.wait(299)
            c.view('h', 'selecting', **{'match.last_turn': None})
            c.wait(1 if early else turn_ms - 299)
            c.view('h', 'revealing', **{'match.last_turn.effective_state.players.h.dd6': '6', 'match.last_turn.effective_state.players.p.dd6': '6'})
            c.same('h', 'ledger', 'match.last_turn', remember=True); c.sync('h')
            c.same('h', 'ledger', 'match.last_turn')

    for delta in (-1, 0):
        c = Case(12, 'before' if delta < 0 else 'at', '截止之前1ms接受、恰好截止拒绝', 'P04 W04 A02', early_reveal=False)
        c.room(); c.submit('h'); c.wait(12000 + delta)
        c.submit('p', error='TURN_CLOSED' if delta == 0 else None)
        if delta == 0: c.data['steps'][-1]['ack']['error']['code'] = ['TURN_CLOSED', 'STALE_TURN']
        if delta < 0: c.wait(1)
        c.view('h', 'revealing', **{'match.last_turn.action_sources.p': 'human' if delta < 0 else 'timeout_auto', 'match.last_turn.effective_state.players.p.dd6': '6'})
        c.same('h', 'result', 'match.last_turn', remember=True); c.wait(1); c.sync('h'); c.same('h', 'result', 'match.last_turn')

    for variant in ('illegal', 'missing', 'duplicate', 'nan', 'large', 'bool_number', 'extra'):
        c = Case(13, variant, '坏消息拒绝且不改公开状态或影响其他连接', 'P04 W01 W07 A06')
        c.room(); c.same('h', 'state', 'match.public_state', remember=True)
        if variant == 'illegal': c.submit('p', 'Pragon', error='UNAVAILABLE_MOVE')
        elif variant in ('missing', 'extra', 'bool_number'):
            payload = dict(room_id='$room.room_id', match_id='$match.match_id', turn_id='$match.turn_id', entry_id='Charge')
            if variant == 'missing': payload.pop('entry_id')
            if variant == 'extra': payload['balance'] = '999'
            step = c.command('p', 'room.submit', payload, error='INVALID_MESSAGE')
            if variant == 'bool_number': step['message']['command_seq'] = True
        else:
            text = '{"v":1,"v":1}' if variant == 'duplicate' else '{"v":NaN}' if variant == 'nan' else 'x' * 16385
            c.add('raw', **{'as': 'p'}, text=text, **({'close': 1009} if variant == 'large' else {'error': 'INVALID_MESSAGE'}))
        c.sync('h'); c.view('h', 'selecting', **{'members.p.absence_count': 0, 'members.p.submission_state': 'thinking'})
        c.same('h', 'state', 'match.public_state'); c.submit('h')

    c = Case(14, 'submit_replay', '同一提交重试不重复支出、异载荷冲突', 'P04 W04')
    c.data['initial']['players'] = {'h': {'dd6': '6'}, 'p': {'dd6': '6'}}
    c.room(); c.submit('h', 'Bi', rid='first'); c.add('replay', request_id='first')
    c.add('replay', request_id='first', payload_patch={'entry_id': 'Def'})
    c.submit('p', 'Bi'); c.wait(300)
    c.view('h', 'revealing', **{'match.last_turn.effective_state.players.h.dd6': '0'})
    c.same('h', 'paid', 'match.last_turn', remember=True); c.add('replay', request_id='first'); c.same('h', 'paid', 'match.last_turn')

    c = Case(15, 'locked', '新ID不能替换已经提交的入口', 'P04 W03 W04')
    c.room(); c.submit('h', rid='first'); c.submit('h', 'Def', error='ALREADY_SUBMITTED')
    c.view('h', 'selecting', **{'self.accepted_entry_id': 'Charge'})

    for evict in (False, True):
        c = Case(16, 'evicted' if evict else 'fresh_old_turn', '过期match/turn不能重新消费', 'P04 W04')
        c.room(); c.submit('h', rid='old'); c.submit('p'); c.wait(300); c.next()
        if evict:
            for _ in range(129): c.sync('h'); c.wait(60)
        c.same('h', 'state', 'match.public_state', remember=True)
        c.add('replay', request_id='old', **({'ack': dict(ok=False, error=dict(code='STALE_COMMAND'))} if evict else {'fresh': 'old-fresh', 'ack': dict(ok=False, error=dict(code='STALE_TURN'))}))
        c.view('h', 'selecting', **{'self.accepted_entry_id': None}); c.same('h', 'state', 'match.public_state')

    for count in (2, 3):
        c = Case(17, 'players_' + str(count), '双人注入合法代理、多人固定攒', 'P05 W06 A02 A08')
        c.data['initial']['timeout_entry'] = 'Def'
        players = ('h', 'p', 'q')[:count]
        c.room(players); c.wait(12000)
        for alias in players:
            c.view('h', 'revealing', **{f'match.last_turn.action_sources.{alias}': 'timeout_auto', f'match.last_turn.core_resolution.ledger.actions.{alias}.entry_id': 'Def' if count == 2 else 'Charge', f'members.{alias}.absence_count': 1})
        c.add('chooser_count', count=2 if count == 2 else 0)

    c = Case(18, 'six_to_two', '六人降到双人仍保持多人超时策略', 'P03 P05 P07 A05')
    c.data['initial']['players'] = {'h': {'dd6': '6'}, 'p': {'dd6': '6'}}
    c.room(('h', 'p', 'q', 'r', 't', 'u'))
    c.submit('h', 'Bi'); c.submit('p', 'Bi')
    for alias in ('q', 'r', 't', 'u'): c.submit(alias)
    c.wait(300); c.view('h', 'revealing', **{'members.q.participation': 'eliminated', 'members.length': 6})
    c.next(); c.wait(12000)
    c.view('h', 'revealing', **{'match.mode_at_start': 'multiplayer', 'match.last_turn.core_resolution.ledger.actions.h.entry_id': 'Charge', 'match.last_turn.core_resolution.ledger.actions.p.entry_id': 'Charge'})
    c.add('chooser_count', count=0)

    for intervention in ('manual', 'illegal', 'resume', 'none'):
        c = Case(19, intervention, '连续缺席只由有效手动提交清零', 'P05 W03 W04')
        c.room(('h', 'p', 'q'))
        for turn in (1, 2):
            c.submit('h'); c.submit('q'); c.wait(12000)
            c.view('h', 'revealing', **{'members.p.absence_count': turn}); c.next()
        if intervention == 'manual': c.submit('p')
        elif intervention == 'illegal': c.submit('p', 'Pragon', error='UNAVAILABLE_MOVE')
        elif intervention == 'resume': c.add('disconnect', **{'as': 'p'}); c.add('resume', **{'as': 'p'})
        c.submit('h'); c.submit('q'); c.wait(300 if intervention == 'manual' else 12000)
        c.view('h', 'revealing', **({'members.p.absence_count': 0, 'match.last_turn.room_forfeits': []} if intervention == 'manual' else {'members.length': 2, 'match.last_turn.room_forfeits': [{'player_id': 'p', 'reason': 'three_absences'}], 'match.last_turn.effective_transition.kind': 'restart_survivors'}))

    for connected in (True, False):
        c = Case(20, 'online' if connected else 'offline', '强制休整在线不计不清、离线只计一次', 'P05 W03 W06')
        c.data['initial']['timeout_entry'] = 'ZengYi'
        c.room(); c.submit('h'); c.wait(12000); c.next()
        if not connected: c.add('disconnect', **{'as': 'p'})
        c.submit('h'); c.wait(300)
        c.view('h', 'revealing', **{'members.p.absence_count': 1 if connected else 2, 'match.last_turn.action_sources.p': 'forced', 'match.last_turn.core_resolution.ledger.actions.p.is_recovery': True})

    for number in ('C026', 'C050', 'C043'):
        core_case(21, number)

    for third in (False, True):
        c = Case(22, 'three_absences' if third else 'submitted_leave', '离开仍保留当拍动作，forfeit不伪造击杀', 'P05 P06 W06 A05')
        c.room(('h', 'p', 'q'))
        if third:
            for _ in range(2):
                c.submit('h'); c.submit('q'); c.wait(12000); c.next()
        else:
            c.submit('p'); c.leave('p')
        c.submit('h'); c.submit('q'); c.wait(12000 if third else 300)
        c.view('h', 'revealing', **{'match.last_turn.core_resolution.ledger.actions.p.entry_id': 'Charge', 'match.last_turn.core_resolution.ledger.kills.h': [], 'match.last_turn.room_forfeits': [{'player_id': 'p', 'reason': 'three_absences' if third else 'voluntary_leave'}], 'match.last_turn.effective_state.active_ids': ['h', 'q']})

    c = Case(23, 'single_restart', '规则重开和房间移除只增加一次局号', 'P06 W06 A05')
    c.data['initial']['players'] = {a: {'dd6': '6'} for a in ('h', 'p', 'q')}
    c.room(('h', 'p', 'q', 'r'))
    for a in ('h', 'p', 'q'): c.submit(a, 'Bi')
    c.submit('r'); c.leave('p'); c.wait(300)
    c.view('h', 'revealing', **{'match.last_turn.core_resolution.next_state.game_index': '2', 'match.last_turn.effective_state.game_index': '2', 'match.last_turn.effective_state.active_ids': ['h', 'q'], 'match.last_turn.core_resolution.ledger.actions.p.spend.dd6': '6'})

    for variant in ('winner_leaves', 'two_leave'):
        c = Case(24, variant, '退出自然赢家与同时两位退出', 'P06 W06 A05')
        c.data['initial']['players'] = {'p': {'dd6': '6'}}
        c.room(('h', 'p', 'q') if variant == 'two_leave' else ('h', 'p'))
        c.submit('h'); c.submit('p', 'Bi' if variant == 'winner_leaves' else 'Charge'); c.leave('p')
        if variant == 'two_leave': c.submit('q'); c.leave('q')
        c.wait(300)
        c.view('h', 'revealing', **{'match.last_turn.effective_transition.kind': 'nobody_survives' if variant == 'winner_leaves' else 'sole_survivor', 'match.last_turn.effective_transition.winner_id': None if variant == 'winner_leaves' else 'h'})
        c.wait(1500); c.view('h', 'result')

    for terminal in (False, True):
        c = Case(25, 'terminal' if terminal else 'continue', '揭晓期间离房不修改已公开回合', 'P06 W04 W06')
        if terminal: c.data['initial']['players'] = {'p': {'dd6': '6'}}
        c.room(); c.submit('h'); c.submit('p', 'Bi' if terminal else 'Charge'); c.wait(300)
        c.view('h', 'revealing'); c.same('h', 'revealed', 'match.last_turn', remember=True)
        c.leave('p'); c.sync('h'); c.same('h', 'revealed', 'match.last_turn')
        c.wait(1500); c.view('h', 'result' if terminal else 'selecting')
        if not terminal:
            c.submit('h'); c.wait(12000); c.view('h', 'revealing', **{'match.last_turn.room_forfeits': [{'player_id': 'p', 'reason': 'voluntary_leave'}]})

    for reason in ('leave', 'absent'):
        c = Case(26, reason, '房主离开或第三次缺席全房终止', 'P06 W07 A05')
        c.room(('h', 'p', 'q'))
        if reason == 'leave': c.leave('h')
        else:
            for i in range(3):
                c.submit('p'); c.submit('q'); c.wait(12000)
                if i < 2: c.next('p')
        c.view('p', 'closed', **{'close_reason': 'HOST_LEFT' if reason == 'leave' else 'HOST_ABSENT', 'self.options': [], 'self.accepted_entry_id': None, 'match.effective_outcome': None})

    for grace in (0, 30000, 60000):
        for recover in (False, True):
            if grace == 0 and recover: continue
            c = Case(27, f'{grace}_' + ('resume' if recover else 'expire'), '房主断线冻结剩余时长与已交牌', 'P08 W05 W07 A04', host_disconnect_grace_ms=grace)
            c.room(); c.submit('p'); c.wait(1000); c.add('disconnect', **{'as': 'h'})
            if grace:
                c.view('p', 'paused', **{'pause.phase_remaining_ms': 11000, 'pause.resume_phase': 'selecting', 'members.p.absence_count': 0})
            if recover:
                c.wait(grace - 1); c.add('resume', **{'as': 'h'})
                c.view('p', 'selecting', **{'self.accepted_entry_id': 'Charge', 'timer.remaining_ms': 11000, 'members.p.absence_count': 0})
                c.submit('h'); c.wait(300); c.view('p', 'revealing')
            else:
                if grace: c.wait(grace)
                c.view('p', 'closed', **{'close_reason': 'HOST_TIMEOUT'})

    c = Case(27, 'reveal_resume', '揭晓暂停恢复剩余1000ms，不重新结算', 'P08 W05 A04')
    c.room(); c.submit('h'); c.submit('p'); c.wait(300)
    c.view('p', 'revealing'); c.same('p', 'revealed', 'match.last_turn', remember=True)
    c.wait(500); c.add('disconnect', **{'as': 'h'})
    c.view('p', 'paused', **{'pause.phase_remaining_ms': 1000, 'pause.resume_phase': 'revealing'})
    c.wait(29999); c.add('resume', **{'as': 'h'})
    c.view('p', 'revealing', **{'timer.remaining_ms': 1000}); c.same('p', 'revealed', 'match.last_turn')
    c.wait(999); c.view('p', 'revealing'); c.wait(1); c.view('p', 'selecting')

    for mode in ('lobby', 'playing', 'replacement'):
        c = Case(28, mode, '普通成员断线宽限与连接世代', 'P08 W02 A03 A04')
        c.room(start=mode == 'playing')
        if mode == 'replacement':
            c.add('resume', **{'as': 'p'}); c.ready('p'); c.view('h', 'lobby', **{'members.p.connected': True})
        elif mode == 'lobby':
            c.add('disconnect', **{'as': 'p'}); c.wait(29999); c.view('h', 'lobby', **{'members.length': 2})
            c.wait(1); c.view('h', 'lobby', **{'members.length': 1})
        else:
            c.add('disconnect', **{'as': 'p'}); c.submit('h'); c.wait(12000)
            c.view('h', 'revealing', **{'members.p.absence_count': 1})

    for variant in ('correct', 'forged', 'removed'):
        c = Case(29, variant, '恢复凭证不依赖昵称且退出不复活', 'P08 W02 W03 A03')
        c.room(); c.submit('p')
        if variant == 'removed': c.leave('p')
        c.add('resume', **{'as': 'p'}, **({'token': 'synthetic-invalid-token', 'error': 'SESSION_EXPIRED'} if variant == 'forged' else {}))
        if variant == 'correct': c.view('p', 'selecting', **{'self.accepted_entry_id': 'Charge', 'self.seat': 1})
        elif variant == 'removed': c.sync('p', error='ROOM_NOT_MEMBER'); c.view('h', 'selecting', **{'members.length': 1})
        else: c.view('h', 'selecting', **{'members.p.submission_state': 'submitted'})

    c = Case(30, 'next_match', '回大厅原角色不变、准备归零、新match隔离旧请求', 'P07 W03 W04')
    c.data['initial']['players'] = {'h': {'dd6': '6'}}
    c.room(spectators=('s',)); c.submit('h', 'Bi', rid='old'); c.submit('p'); c.wait(300); c.wait(1500)
    c.view('h', 'result'); c.same('h', 'match', 'match.match_id', remember=True)
    c.command('h', 'room.return_lobby', dict(room_id='$room.room_id'))
    c.view('h', 'lobby', **{'members.h.ready': False, 'members.p.ready': False, 'members.p.role': 'player', 'members.s.role': 'spectator'})
    c.ready('h'); c.ready('p'); c.command('h', 'room.start', dict(room_id='$room.room_id'))
    c.view('h', 'selecting'); c.add('different_match', **{'as': 'h'}, old_request='old')
    c.add('replay', request_id='old', fresh='old-match-new-id', ack=dict(ok=False, error=dict(code='STALE_TURN')))
    c.view('h', 'selecting', **{'self.accepted_entry_id': None, 'match.public_state.players.h.dd6': '0'})

    for slow in (False, True):
        c = Case(31, 'slow' if slow else 'rooms', '两房并行与旧房成员解除授权', 'P09 W04 A02 A06')
        c.room(('h', 'p'), ('s',), start=False)
        if slow: c.add('slow', **{'as': 's'})
        c.room(('x', 'y'), start=False, name='other')
        c.command('x', 'room.sync', dict(room_id='$room.room_id'), error='ROOM_NOT_MEMBER')
        c.view('x', 'lobby', **{'members.length': 2, 'members.x.seat': 0})
        for i in range(80 if slow else 1):
            c.ready('h', bool(i % 2)); c.wait(60)
        c.sync('x', room='other'); c.view('x', 'lobby', **{'members.x.ready': False, 'members.y.ready': False})
        c.leave('p'); c.join('p', room='other'); c.ready('h'); c.view('p', 'lobby', **{'members.length': 3, 'members.x.seat': 0})
        c.add('silence', **{'as': 'p'})

    for op in ('set_state', 'debug', 'seed', 'forged_room'):
        c = Case(32, op, '拒绝任意状态注入及跨房成员访问', 'P14 W03 A06 A08')
        c.room(); c.same('h', 'state', 'match.public_state', remember=True)
        c.command('p', 'room.sync' if op == 'forged_room' else op, dict(room_id='unowned-room') if op == 'forged_room' else dict(state={'dd6': '999'}), error='ROOM_NOT_MEMBER' if op == 'forged_room' else 'INVALID_MESSAGE')
        c.view('h', 'selecting'); c.same('h', 'state', 'match.public_state')

    c = Case(33, 'errors', '错误无堆栈和秘密，普通连接继续服务', 'P09 P13 W07 A06')
    c.room(); c.command('p', 'room.join', dict(room_code='AAAAAAAA', password='synthetic-password', role='player'), error='ALREADY_IN_ROOM')
    c.submit('p', 'UnknownEntry', error='INVALID_MESSAGE'); c.sync('h')
    c.view('h', 'selecting', **{'members.h.absence_count': 0, 'match.last_turn': None})

    c = Case(33, 'burst_limit', '单连接突发45条，正常连接继续工作', 'P13 W07 A06')
    c.room(start=False); c.wait(1000)
    c.add('rate', **{'as': 'p'})
    c.sync('h'); c.view('h', 'lobby', **{'members.length': 2})

    c = Case(33, 'room_capacity', '64房容量上界与第65个创建拒绝', 'P13 W07 A06')
    c.room(('h',), start=False)
    for i in range(1, 65):
        alias = 'owner' + str(i); c.open(alias)
        c.command(alias, 'room.create', dict(password=None, options={k: c.data['policy'][k] for k in ('turn_ms', 'early_reveal', 'spectator_cap')}), error='SERVER_BUSY' if i == 64 else None)
    c.sync('h'); c.view('h', 'lobby', **{'members.length': 1})

    c = Case(34, 'C065_reward_replay', '自然奖励到账并消费后重放旧提交不再发奖', 'P04 P05 W04 W06 A02')
    f = fixture('C065'); c.data['initial']['state'] = f['input']['state']; c.room(('A', 'B'))
    for index, (inp, expected) in enumerate(zip(f['input']['steps'], f['expected']['steps'])):
        for alias, entry in inp['submissions'].items(): c.submit(alias, entry, rid=f't{index+1}-{alias}')
        c.wait(300); c.view('A', 'revealing')
        state = f['input']['state'] if index == 0 else f['expected']['steps'][index-1]['next_state']
        c.add('core', **{'as': 'A'}, input={'state': state, **inp}, expected=expected)
        if index >= 5:
            c.same('A', 'spent', 'match.last_turn', remember=True); c.add('replay', request_id='t5-A'); c.same('A', 'spent', 'match.last_turn')
        if index != len(f['input']['steps']) - 1: c.next('A')
    core_case(34, 'C074')

    c = Case(34, 'room_mode_absence_reset', '规则重开保留房间模式和缺席次数', 'P05 P06 W06 A05')
    c.room(('h', 'p', 'q')); c.submit('h'); c.submit('p'); c.wait(12000)
    c.view('h', 'revealing', **{'members.q.absence_count': 1}); c.next()
    c.submit('h', 'Bi'); c.submit('p', 'Bi'); c.wait(12000)
    c.view('h', 'revealing', **{'match.mode_at_start': 'multiplayer', 'members.q.absence_count': 2, 'members.q.participation': 'eliminated', 'match.last_turn.effective_state.game_index': '2', 'match.last_turn.effective_state.players.h.dd6': '0'})

    c = Case(35, 'electron_manual', '网络失败返回菜单、晚到旧房快照与离线档案', 'P10 P12 W08 A07')
    c.data['needs_gui'] = True
    c.room(start=False)
    c.add('gui', actions=['连接服务后终止socket', '返回菜单启动真实离线单人', '投递旧scene generation快照', '比较ProfileStore前后文件', '完成一场离线游戏'], expected={'source': 'offline', 'old_room_visible': False, 'profile_unchanged': True, 'fixture_fallback': False})

    for real in (False, True):
        c = Case(36, 'real_clock' if real else 'six_players_three_matches', '真实socket六连接两观众三场，另有真时钟截止', 'P11 P15 W05 W06 A08', turn_ms=5000)
        c.data['clock'] = 'real' if real else 'manual'
        c.room(('h', 'p', 'q', 'r', 't', 'u'), ('s', 's2'))
        if real:
            for alias in ('h', 'p', 'q', 'r', 't'): c.submit(alias)
            c.wait(5200)
            c.view('h', 'revealing', **{'match.last_turn.action_sources.u': 'timeout_auto'})
        else:
            for match in range(3):
                for alias in ('h', 'p', 'q', 'r', 't', 'u'): c.submit(alias)
                c.wait(300); c.next()
                c.submit('h', 'Bi')
                for alias in ('p', 'q', 'r', 't', 'u'): c.submit(alias)
                c.wait(300)
                for alias in ('h', 'p', 'q', 'r', 't', 'u', 's', 's2'):
                    c.view(alias, 'revealing', **{'match.last_turn.effective_transition.kind': 'sole_survivor', 'match.last_turn.effective_transition.winner_id': 'h'})
                c.wait(1500); c.view('h', 'result')
                if match < 2:
                    c.command('h', 'room.return_lobby', dict(room_id='$room.room_id'))
                    for alias in ('h', 'p', 'q', 'r', 't', 'u'): c.ready(alias)
                    c.command('h', 'room.start', dict(room_id='$room.room_id')); c.view('h', 'selecting')
    return deepcopy(CASES)


if __name__ == '__main__':
    cases = build()
    (HERE / 'cases.json').write_text(json.dumps(cases, ensure_ascii=False, indent=2) + '\n')
    print(f'Authored {len(cases)} samples; server NOT_RUN')
