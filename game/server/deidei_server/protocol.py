"""Strict rooms-1.0 input and policy validation; no game state enters commands."""
import json
import re
import unicodedata
from uuid import UUID

DEFAULT_POLICY = dict(turn_ms=12000, early_reveal=True, spectator_cap=6,
                      host_disconnect_grace_ms=30000, reveal_ms=1500, min_select_ms=300)
TURN_TIMES = [5000, 8000, 12000, 20000, 30000]
FIELDS = {
    'session.open': {'profile'}, 'session.resume': {'session_id', 'resume_token'},
    'room.create': {'password', 'options'}, 'room.join': {'room_code', 'password', 'role'},
    'room.ready': {'room_id', 'ready'}, 'room.role': {'room_id', 'role'},
    'room.start': {'room_id'}, 'room.submit': {'room_id', 'match_id', 'turn_id', 'entry_id'},
    'room.sync': {'room_id'}, 'room.return_lobby': {'room_id'}, 'room.leave': {'room_id'},
}


class Rejected(ValueError):
    def __init__(self, code: str, field: str | None = None):
        self.code, self.field = code, field
        super().__init__(code)


def require(condition: bool, code: str = 'INVALID_MESSAGE', field: str | None = None) -> None:
    if not condition:
        raise Rejected(code, field)


def exact(value: object, keys: set[str]) -> None:
    require(isinstance(value, dict) and set(value) == keys)


def integer(value: object, low: int, high: int) -> bool:
    return type(value) is int and low <= value <= high


def identifier(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_:-]{1,96}', value) is not None


def clean_text(value: object, low: int, high: int) -> bool:
    return (isinstance(value, str) and low <= len(value) <= high
            and all(unicodedata.category(c) not in ('Cc', 'Cs') for c in value))


def pairs(items: list) -> dict:
    result = {}
    for key, value in items:
        require(key not in result)
        result[key] = value
    return result


def parse(text: object) -> dict:
    require(isinstance(text, str) and len(text.encode('utf-8')) <= 16384)
    try:
        msg = json.loads(text, object_pairs_hook=pairs,
                         parse_constant=lambda _: require(False))
        def depth(value: object, level: int = 0) -> None:
            require(level <= 12)
            if isinstance(value, dict):
                for item in value.values():
                    depth(item, level + 1)
            elif isinstance(value, list):
                for item in value:
                    depth(item, level + 1)
        depth(msg)
    except (ValueError, TypeError, RecursionError, UnicodeError):
        raise Rejected('INVALID_MESSAGE') from None
    return msg


def validate(msg: dict) -> dict:
    exact(msg, {'v', 'type', 'request_id', 'command_seq', 'op', 'payload'})
    require(type(msg['v']) is int and msg['v'] == 1, 'UNSUPPORTED_PROTOCOL')
    require(msg['type'] == 'command')
    try:
        require(isinstance(msg['request_id'], str) and str(UUID(msg['request_id'])) == msg['request_id'])
    except (ValueError, AttributeError):
        raise Rejected('INVALID_MESSAGE', 'request_id') from None
    op, p, seq = msg['op'], msg['payload'], msg['command_seq']
    require(isinstance(op, str) and op in FIELDS)
    exact(p, FIELDS[op])
    if op.startswith('session.'):
        require(seq is None)
    else:
        require(isinstance(seq, str) and re.fullmatch(r'[1-9][0-9]{0,19}', seq) is not None
                and int(seq) <= 18446744073709551615, field='command_seq')
    if op == 'session.open':
        exact(p['profile'], {'nickname', 'avatar_id'})
        require(clean_text(p['profile']['nickname'], 1, 20), field='nickname')
        require(p['profile']['avatar_id'] in ('leaf', 'sun', 'moon', 'star'), field='avatar_id')
    for key in ('room_id', 'session_id', 'match_id', 'turn_id', 'entry_id'):
        if key in p:
            require(identifier(p[key]), field=key)
    if 'resume_token' in p:
        require(isinstance(p['resume_token'], str) and
                re.fullmatch(r'[A-Za-z0-9_-]{43}', p['resume_token']) is not None)
    if 'room_code' in p:
        require(isinstance(p['room_code'], str) and re.fullmatch(r'[A-Z0-9]{8}', p['room_code']) is not None)
    if 'password' in p:
        require(p['password'] is None or clean_text(p['password'], 0, 32), field='password')
    if 'role' in p:
        require(p['role'] in ('player', 'spectator'), field='role')
    if 'ready' in p:
        require(type(p['ready']) is bool, field='ready')
    if 'options' in p:
        exact(p['options'], {'turn_ms', 'early_reveal', 'spectator_cap'})
        policy(p['options'])
    return msg


def policy(overrides: dict | None = None) -> dict:
    overrides = {} if overrides is None else overrides
    require(isinstance(overrides, dict) and set(overrides) <= {
        'turn_ms', 'early_reveal', 'spectator_cap', 'host_disconnect_grace_ms'})
    result = DEFAULT_POLICY | overrides
    require(type(result['turn_ms']) is int and result['turn_ms'] in TURN_TIMES)
    require(type(result['early_reveal']) is bool)
    require(integer(result['spectator_cap'], 0, 12))
    require(type(result['host_disconnect_grace_ms']) is int and
            result['host_disconnect_grace_ms'] in (0, 15000, 30000, 60000))
    return result


def ack(request_id: str | None, data: dict | None = None, error: Rejected | None = None) -> dict:
    result = dict(v=1, type='ack', request_id=request_id, ok=error is None)
    if error:
        result['error'] = dict(code=error.code, field=error.field,
                               retryable=error.code in ('RATE_LIMITED', 'SERVER_BUSY'))
    else:
        result['data'] = data
    return result


def dumps(value: dict) -> str:
    return json.dumps(value, ensure_ascii=True, allow_nan=False, separators=(',', ':'))
