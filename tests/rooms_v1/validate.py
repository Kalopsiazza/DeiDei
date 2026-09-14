"""Strict wire checks and declarative, independently authored expectations."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import re
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tests.rules_v1_001.validate_fixtures import (  # noqa: E402
    ENTRIES, validate_state, validate_resources, validate_action, validate_player,
)

HERE = Path(__file__).resolve().parent
POLICY = dict(turn_ms=12000, early_reveal=True, spectator_cap=6,
              host_disconnect_grace_ms=30000, reveal_ms=1500, min_select_ms=300)
ERRORS = set('INVALID_MESSAGE UNSUPPORTED_PROTOCOL UNAUTHENTICATED ALREADY_AUTHENTICATED SESSION_EXPIRED SESSION_REPLACED ALREADY_IN_ROOM ROOM_ACCESS_DENIED ROOM_FULL SPECTATORS_FULL SPECTATORS_DISABLED MATCH_IN_PROGRESS ROOM_GONE ROOM_NOT_MEMBER NOT_HOST WRONG_PHASE NOT_READY NOT_ACTIVE FORCED_RECOVERY UNAVAILABLE_MOVE ALREADY_SUBMITTED STALE_TURN TURN_CLOSED REQUEST_CONFLICT HOST_RECONNECTING RATE_LIMITED SERVER_BUSY STALE_COMMAND ROOM_STATE_TOO_LARGE INTERNAL_ERROR'.split())
CLOSE_REASONS = set('HOST_LEFT HOST_TIMEOUT HOST_ABSENT SERVER_RESTART ROOM_IDLE INTERNAL_ERROR ROOM_STATE_TOO_LARGE'.split())
DATA = {
    'session.open': 'session_id player_id resume_token boot_id last_command_seq',
    'session.resume': 'session_id player_id boot_id last_command_seq',
    'room.create': 'room_id room_code', 'room.join': 'room_id room_code role',
    'room.ready': 'room_id ready', 'room.role': 'room_id role',
    'room.start': 'room_id match_id', 'room.submit': 'room_id match_id turn_id accepted_entry_id',
    'room.sync': 'room_id', 'room.return_lobby': 'room_id', 'room.leave': 'room_id left',
}
SECRET_KEYS = {'resume_token', 'resume_token_digest', 'password', 'password_hash',
               'salt', 'choice_tokens', 'pending_submissions', 'stack', 'debug', 'traceback'}


def need(condition: Any, message: str) -> None:
    if not condition:
        raise ValueError(message)


def fields(obj: Any, names: str | set, where: str) -> None:
    names = set(names.split()) if isinstance(names, str) else names
    need(type(obj) is dict and set(obj) == names, where + ': exact fields required')


def decimal(value: Any, positive: bool = False) -> None:
    need(type(value) is str and re.fullmatch(r'0|[1-9][0-9]*', value), 'decimal string required')
    need(not positive or value != '0', 'positive decimal required')


def integer(value: Any, low: int = 0, high: int = 2**53 - 1) -> None:
    need(type(value) is int and low <= value <= high, 'safe integer required')


def identifier(value: Any) -> None:
    need(type(value) is str and re.fullmatch(r'[A-Za-z0-9_:-]{1,96}', value), 'invalid identifier')


def no_secrets(obj: Any) -> None:
    if isinstance(obj, dict):
        need(not SECRET_KEYS.intersection(obj), 'private field in public response')
        for value in obj.values():
            no_secrets(value)
    elif isinstance(obj, list):
        for value in obj:
            no_secrets(value)


def strict_json(raw: str) -> Any:
    def pairs(items: list) -> dict:
        obj = {}
        for key, value in items:
            need(key not in obj, 'duplicate JSON key')
            obj[key] = value
        return obj
    def constant(_: str) -> None:
        raise ValueError('non-finite JSON number')
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)


def subset(actual: Any, expected: Any, path: str = 'value') -> None:
    """Lists are exact length/order; only dictionaries permit omitted public fields."""
    need(type(actual) is type(expected), path + ': type mismatch')
    if isinstance(expected, dict):
        for key, value in expected.items():
            need(key in actual, path + ': missing field ' + key)
            subset(actual[key], value, path + '.' + key)
    elif isinstance(expected, list):
        need(len(actual) == len(expected), path + ': list length mismatch')
        for index, (a, e) in enumerate(zip(actual, expected)):
            subset(a, e, path + '.' + str(index))
    else:
        need(actual == expected, path + ': expectation mismatch')


def at(obj: Any, path: str) -> Any:
    for part in path.split('.') if path else []:
        if part == 'length':
            obj = len(obj)
        else:
            obj = obj[int(part)] if isinstance(obj, list) else obj[part]
    return obj


def expect_paths(actual: dict, expected: dict) -> None:
    need(bool(expected), 'empty snapshot expectation')
    for path, value in expected.items():
        subset(at(actual, path), value, path)


def check_ack(ack: dict | None, command: dict, expected: dict) -> None:
    need(ack is not None, 'missing ack')
    ok = ack.get('ok')
    need(type(ok) is bool, 'ack.ok must be boolean')
    fields(ack, 'v type request_id ok ' + ('data' if ok else 'error'), 'ack')
    need(type(ack['v']) is int and ack['v'] == 1 and ack['type'] == 'ack', 'ack envelope')
    need(ack['request_id'] == command['request_id'], 'ack request mismatch')
    if 'one_of' in expected:
        options = expected['one_of']
        expected = next((e for e in options if e.get('ok') is ok), {})
        need(bool(expected), 'ack not among allowed alternatives')
    expected = deepcopy(expected)
    if not ok and isinstance(expected.get('error', {}).get('code'), list):
        need(ack['error']['code'] in expected['error']['code'], 'unexpected rejection code')
        expected['error']['code'] = ack['error']['code']
    subset(ack, expected)
    if ok:
        fields(ack['data'], DATA[command['op']], 'ack.data')
        data = ack['data']
        for key in ('room_id', 'session_id', 'player_id', 'boot_id', 'match_id', 'turn_id'):
            if key in data:
                identifier(data[key])
        if 'last_command_seq' in data:
            decimal(data['last_command_seq'])
        if 'resume_token' in data:
            need(type(data['resume_token']) is str and bool(data['resume_token']), 'token required')
        if 'room_code' in data:
            need(type(data['room_code']) is str and re.fullmatch('[A-Z2-9]{8}', data['room_code']), 'room code')
        if 'role' in data:
            need(data['role'] in {'player', 'spectator'}, 'ack role')
        if 'ready' in data:
            need(type(data['ready']) is bool, 'ack ready')
        if 'left' in data:
            need(data['left'] is True, 'ack left')
        for key in ('room_id', 'match_id', 'turn_id', 'ready', 'role'):
            if key in data and key in command.get('payload', {}):
                need(type(data[key]) is type(command['payload'][key]) and data[key] == command['payload'][key], 'ack changed request identity/value')
        if command['op'] == 'room.submit':
            need(data['accepted_entry_id'] == command['payload']['entry_id'], 'wrong accepted entry')
        if command['op'] != 'session.open':
            no_secrets(data)
    else:
        fields(ack['error'], 'code field retryable', 'error')
        error = ack['error']
        need(error['code'] in ERRORS, 'unknown error code')
        allowed_fields = {'v', 'type', 'request_id', 'command_seq', 'op', 'payload', 'profile', 'nickname', 'avatar_id', 'session_id', 'resume_token', 'password', 'options', 'turn_ms', 'early_reveal', 'spectator_cap', 'room_id', 'room_code', 'role', 'ready', 'match_id', 'turn_id', 'entry_id'}
        field = error['field']
        need(field is None or (type(field) is str and all(part in allowed_fields for part in field.split('.'))), 'error field must identify a command field, never diagnostic text')
        need(type(error['retryable']) is bool, 'retryable type')
        need(error['retryable'] == (error['code'] in {'RATE_LIMITED', 'SERVER_BUSY'}), 'retryable value')
        no_secrets(error)


def check_hello(hello: dict) -> None:
    fields(hello, 'v type boot_id connection_id protocol rules_version server_time_ms policy_defaults capabilities', 'hello')
    subset(hello, dict(v=1, type='hello', protocol='rooms-1.0', rules_version='classic-1.0.1'))
    identifier(hello['boot_id'])
    identifier(hello['connection_id'])
    integer(hello['server_time_ms'])
    fields(hello['policy_defaults'], set(POLICY), 'hello.policy')
    fields(hello['capabilities'], 'max_players allowed_turn_ms spectator_max', 'capabilities')
    subset(hello['capabilities'], dict(max_players=6, allowed_turn_ms=[5000, 8000, 12000, 20000, 30000]))
    integer(hello['capabilities']['spectator_max'], 0, 12)


def check_snapshot(snapshot: dict, player_id: str, room_id: str, policy: dict) -> None:
    fields(snapshot, 'v type room_id seq server_time_ms view', 'snapshot')
    subset(snapshot, dict(v=1, type='snapshot', room_id=room_id))
    decimal(snapshot['seq'], True)
    integer(snapshot['server_time_ms'])
    no_secrets(snapshot)
    view = snapshot['view']
    fields(view, 'source room_code host_id phase has_password policy members match self timer pause close_reason', 'view')
    need(view['source'] == 'online', 'fixture disguised as online')
    need(view['phase'] in {'lobby', 'selecting', 'revealing', 'result', 'paused', 'closed'}, 'phase')
    need(type(view['has_password']) is bool, 'has_password')
    fields(view['policy'], set(POLICY), 'policy')
    need(view['policy'] == policy, 'policy mismatch')
    need(type(view['members']) is list, 'members list')
    members = {}
    seats = set()
    for member in view['members']:
        fields(member, 'player_id nickname avatar_id role seat connected ready participation submission_state absence_count', 'member')
        pid = member['player_id']
        identifier(pid)
        need(pid not in members, 'duplicate member')
        members[pid] = member
        need(type(member['nickname']) is str and 1 <= len(member['nickname']) <= 20, 'nickname')
        need(member['avatar_id'] in {'leaf', 'sun', 'moon', 'star'}, 'avatar')
        need(member['role'] in {'player', 'spectator'}, 'member role')
        if member['role'] == 'player':
            integer(member['seat'], 0, 5)
            need(member['seat'] not in seats, 'seat overwritten')
            seats.add(member['seat'])
        else:
            need(member['seat'] is None, 'spectator seat')
        for key in ('ready', 'connected'):
            need(type(member[key]) is bool, 'member boolean')
        integer(member['absence_count'], 0, 3)
        need(member['participation'] in {'lobby', 'active', 'eliminated', 'departing', 'spectating'}, 'participation')
        need(member['submission_state'] in {'none', 'thinking', 'submitted', 'forced', 'out'}, 'submission state')
    need(sum(m['role'] == 'spectator' for m in members.values()) <= policy['spectator_cap'], 'spectator capacity')
    if view['phase'] != 'closed':
        need(view['host_id'] in members and members[view['host_id']]['role'] == 'player', 'missing host')
    own = view['self']
    fields(own, 'player_id role seat options accepted_entry_id', 'self')
    need(own['player_id'] == player_id, 'another identity private view')
    if player_id in members:
        subset(own, {k: members[player_id][k] for k in ('role', 'seat')})
    active = (view['phase'] == 'selecting' and player_id in members
              and members[player_id]['participation'] == 'active')
    need(type(own['options']) is list, 'options list')
    if active:
        need([o.get('entry_id') for o in own['options']] == ENTRIES, '33 ordered options required')
        for option in own['options']:
            fields(option, 'entry_id doc_id available reason_code required spend forced', 'option')
            need(type(option['available']) is bool and type(option['forced']) is bool, 'option flags')
            need(option['doc_id'] == f"E{ENTRIES.index(option['entry_id']) + 1:02}", 'option doc id')
            need(option['reason_code'] is None if option['available'] else type(option['reason_code']) is str and bool(option['reason_code']), 'option reason')
            validate_resources(option['required'], 'required')
            validate_resources(option['spend'], 'spend')
    else:
        need(own['options'] == [], 'non-active options leaked')
    need(own['accepted_entry_id'] is None or own['accepted_entry_id'] in ENTRIES, 'accepted entry')
    if own['role'] == 'spectator' or view['phase'] in {'lobby', 'closed'}:
        need(own['accepted_entry_id'] is None, 'non-player pending leaked')
    fields(view['timer'], 'kind deadline_at_ms remaining_ms', 'timer')
    timer = view['timer']
    need(timer['kind'] in {'none', 'select', 'reveal', 'host_grace'}, 'timer kind')
    if timer['kind'] == 'none':
        need(timer['deadline_at_ms'] is None and timer['remaining_ms'] is None, 'none timer')
    else:
        integer(timer['deadline_at_ms'])
        integer(timer['remaining_ms'])
    if view['pause'] is not None:
        fields(view['pause'], 'reason resume_phase phase_remaining_ms', 'pause')
        need(view['pause']['reason'] == 'HOST_DISCONNECTED', 'pause reason')
        integer(view['pause']['phase_remaining_ms'])
    need(view['close_reason'] is None or view['close_reason'] in CLOSE_REASONS, 'close reason')
    match = view['match']
    if match is not None:
        fields(match, 'match_id mode_at_start turn_id public_state roster_profiles last_turn effective_outcome', 'match')
        need(match['mode_at_start'] in {'duel', 'multiplayer'}, 'mode')
        identifier(match['match_id'])
        identifier(match['turn_id'])
        need(type(match['roster_profiles']) is list, 'roster profiles')
        for profile in match['roster_profiles']:
            fields(profile, 'player_id nickname avatar_id seat', 'roster profile')
        validate_state(match['public_state'], 'public_state')
        need(match['public_state']['match_id'] == match['match_id'], 'public match identity')
        if match['last_turn'] is not None:
            result = match['last_turn']
            fields(result, 'turn_id core_resolution room_forfeits effective_transition effective_state action_sources', 'RoomTurnResult')
            validate_state(result['effective_state'], 'effective_state')
            core = result['core_resolution']
            fields(core, 'ok ledger next_state transition', 'public core resolution')
            need(core['ok'] is True, 'public failed resolution')
            fields(core['ledger'], 'match_id game_id turn_index actions events kills eliminated_ids post_turn_players', 'public ledger')
            validate_state(core['next_state'], 'core.next_state')
            active = set(core['ledger']['actions'])
            for pid, action in core['ledger']['actions'].items():
                validate_action(action, active, 'public action', actual=True)
            for player in core['ledger']['post_turn_players'].values():
                validate_player(player, 'public player')
            for transition in (core['transition'], result['effective_transition']):
                fields(transition, 'kind from_game_id to_game_id winner_id', 'transition')
                need(transition['kind'] in {'continue_game', 'restart_survivors', 'sole_survivor', 'nobody_survives'}, 'transition kind')
            from tests.rules_v1_001.run_acceptance import check_events
            check_events(core['ledger']['events'], {'state': {'active_ids': list(active)}})
            for forfeit in result['room_forfeits']:
                fields(forfeit, 'player_id reason', 'forfeit')
                need(forfeit['reason'] in {'voluntary_leave', 'three_absences'}, 'forfeit reason')
            need(all(v in {'human', 'timeout_auto', 'forced'} for v in result['action_sources'].values()), 'action sources')
        if match['effective_outcome'] is not None:
            fields(match['effective_outcome'], 'kind winner_id reason', 'outcome')
            need(match['effective_outcome']['kind'] in {'sole_survivor', 'nobody_survives'}, 'outcome kind')
            need(match['effective_outcome']['reason'] in {'rules', 'room_forfeit'}, 'outcome reason')


def public_view(snapshot: dict, *, keep_self: bool = False) -> dict:
    obj = deepcopy(snapshot['view'])
    if not keep_self:
        obj.pop('self')
    return obj


def load_cases(path: Path = HERE / 'cases.json') -> list[dict]:
    cases = strict_json(path.read_text())
    need(type(cases) is list and bool(cases), 'case list required')
    seen = set()
    for case in cases:
        fields(case, 'case_id title clauses policy people initial steps needs_gui clock forbidden', 'case')
        cid = case['case_id']
        need(type(cid) is str and re.fullmatch(r'N(0[1-9]|[12][0-9]|3[0-6])/[A-Za-z0-9_-]+', cid), 'case id')
        need(cid not in seen, 'duplicate case id')
        seen.add(cid)
        need(case['clauses'] and all(re.fullmatch(r'[PWA][0-9]{2}', c) for c in case['clauses']), 'source clauses')
        fields(case['policy'], set(POLICY), 'case.policy')
        need(case['policy']['turn_ms'] in [5000, 8000, 12000, 20000, 30000], 'turn policy')
        need(type(case['policy']['early_reveal']) is bool, 'early policy')
        integer(case['policy']['spectator_cap'], 0, 12)
        need(case['policy']['host_disconnect_grace_ms'] in [0, 15000, 30000, 60000], 'grace policy')
        need(type(case['needs_gui']) is bool and case['clock'] in {'manual', 'real'}, 'case runtime')
        need(type(case['people']) is dict and bool(case['people']), 'identities required')
        need(case['forbidden'] == ['other_pending', 'credentials', 'cross_room', 'unpublished_resources'], 'privacy obligations')
        need(type(case['initial']) is dict, 'initial state required')
        for profile in case['people'].values():
            fields(profile, 'nickname avatar_id', 'sample identity')
            need(type(profile['nickname']) is str and 1 <= len(profile['nickname']) <= 20, 'sample nickname')
            need(profile['avatar_id'] in {'leaf', 'sun', 'moon', 'star'}, 'sample avatar')
        if 'state' in case['initial']:
            validate_state(case['initial']['state'], 'sample initial state')
        need(case['steps'] and any(s['do'] == 'view' for s in case['steps']), 'snapshot expectations required')
        for step in case['steps']:
            need(step.get('do') in {'connect', 'command', 'advance', 'view', 'disconnect', 'resume', 'replay', 'parallel', 'raw', 'remember', 'compare', 'core', 'silence', 'gui', 'slow', 'privacy', 'chooser_count', 'different_match', 'rate'}, 'unknown driver step')
            if step['do'] == 'command':
                fields(step['message'], 'v type request_id command_seq op payload', 'sample command')
                need(step['message']['op'] in DATA or step.get('ack', {}).get('ok') is False, 'unknown valid op')
                need(type(step.get('ack', {}).get('ok')) is bool, 'explicit expected ack required')
                if not step['ack']['ok']:
                    codes = step['ack']['error']['code']
                    need(set(codes if isinstance(codes, list) else [codes]) <= ERRORS, 'expected error code')
            if step['do'] == 'view':
                need(step.get('expect'), 'empty view oracle')
                need('phase' in step['expect'], 'phase expectation required')
            if step['do'] == 'core':
                expected = step.get('expected', {})
                need({'post_turn_players', 'actions', 'kills', 'eliminated_ids', 'next_state', 'transition', 'required_events', 'forbidden_events'} <= set(expected), 'incomplete core oracle')
                validate_state(expected['next_state'], 'expected core state')
                validate_state(step['input']['state'], 'core input state')
            if step['do'] == 'advance':
                integer(step['ms'])
    need({c.split('/')[0] for c in seen} == {f'N{i:02}' for i in range(1, 37)}, 'missing N01-N36 family')
    for key, expected in [('turn_ms', {5000, 12000, 30000}), ('spectator_cap', {0, 6, 12}), ('host_disconnect_grace_ms', {0, 30000, 60000})]:
        need(expected <= {c['policy'][key] for c in cases}, 'missing policy variants: ' + key)
    return cases


if __name__ == '__main__':
    try:
        suite = load_cases()
        print(json.dumps(dict(status='FIXTURES_VALID', cases=len(suite), families=36, server_status='NOT_RUN')))
    except (ValueError, KeyError, TypeError) as error:
        print(json.dumps(dict(status='INVALID_FIXTURES', reason=str(error))))
        raise SystemExit(1)
