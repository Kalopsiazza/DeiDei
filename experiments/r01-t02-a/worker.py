"""Protocol v1 adapter; fixed samples only, original rules remain read-only."""
import dataclasses
import enum
import json
import random
import sys
from pathlib import Path

if not getattr(sys, 'frozen', False):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from deidei_env import PlayerState, Move, simulate_turn, choose_easy_move

LIMIT = 65536
CASES = {
    'charge_charge': (Move.Charge, Move.Charge, 0, 0),
    'bi_charge': (Move.Bi, Move.Charge, 6, 0),
    'bi_def': (Move.Bi, Move.Def, 6, 0),
    'reflect_bi': (Move.Reflect, Move.Bi, 6, 6),
}


def handle(req: dict) -> dict:
    if (not isinstance(req, dict) or set(req) != {'v', 'id', 'op', 'payload'}
            or type(req['v']) is not int or req['v'] != 1
            or not isinstance(req['id'], str) or not 1 <= len(req['id']) <= 80
            or not isinstance(req['payload'], dict)):
        raise ValueError('Invalid envelope')
    op, p = req['op'], req['payload']
    if op in ('health', 'shutdown') and p == {}:
        return {'worker': 'ready' if op == 'health' else 'stopping'}
    if op == 'run_case' and set(p) == {'case_id'} and isinstance(p['case_id'], str) and p['case_id'] in CASES:
        a, b, da, db = CASES[p['case_id']]
        result = simulate_turn(PlayerState(dd=da), PlayerState(dd=db), a, b)
        return {'case_id': p['case_id'], 'source': 'original deidei_env.py',
                'result': dataclasses.asdict(result)}
    if op == 'choose_easy' and set(p) == {'seed'} and type(p['seed']) is int and 0 <= p['seed'] <= 2**32 - 1:
        move = choose_easy_move(PlayerState(dd=6), PlayerState(dd=6), random.Random(p['seed']))
        return {'ai': 'Easy heuristic', 'seed': p['seed'], 'move': move.name,
                'public_state': {'cpu_dd': 6, 'player_dd': 6}}
    raise ValueError('Unknown operation or invalid payload')


def serve() -> None:
    while True:
        raw = sys.stdin.buffer.readline(LIMIT + 1)
        if not raw:
            return
        req = None
        try:
            if len(raw) > LIMIT:
                # Drain this frame in bounded chunks before accepting the next one.
                while raw and not raw.endswith(b'\n'):
                    raw = sys.stdin.buffer.readline(LIMIT + 1)
                raise ValueError('Frame exceeds 64 KiB')
            if not raw.endswith(b'\n'):
                raise ValueError('Incomplete frame')
            req = json.loads(raw.decode('utf-8'))
            data = handle(req)
            response = {'v': 1, 'id': req['id'], 'ok': True, 'data': data}
        except (ValueError, TypeError, KeyError, RecursionError):
            response = {'v': 1, 'id': req.get('id') if isinstance(req, dict) and isinstance(req.get('id'), str) and len(req['id']) <= 80 else None,
                        'ok': False, 'error': {'code': 'BAD_REQUEST', 'message': 'Invalid protocol frame or payload'}}
        except Exception as exc:
            print(type(exc).__name__, file=sys.stderr, flush=True)
            response = {'v': 1, 'id': req['id'], 'ok': False,
                        'error': {'code': 'WORKER_ERROR', 'message': 'Rule call failed'}}
        print(json.dumps(response, default=lambda x: x.name if isinstance(x, enum.Enum) else str(x), ensure_ascii=False), flush=True)
        if response['ok'] and req['op'] == 'shutdown':
            return


if __name__ == '__main__':
    serve()
