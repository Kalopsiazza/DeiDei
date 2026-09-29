"""Read-only diagnostic of the submitted Q01 assertion, not a product patch."""
import asyncio
import json
import linecache
from pathlib import Path
import sys
import traceback

root = Path.cwd()
sys.path[:0] = [str(root / 'independent'), str(root / 'product/game/core'), str(root / 'product/game/server')]
from tests.rooms_endurance.run import SplitClock, setup
from tests.rooms_endurance.faults import rate
from tests.rooms_v1.validate import check_ack
from deidei_server import testing
from websockets.asyncio.client import connect
import websockets
assert websockets.__version__ == '17.0.1'

async def diagnostic():
    report = {'product_sha': 'd0c96408a3aa8c14174099da4247bcac953fb9f7',
              'tests_sha': 'baeff0bf476e1efd91358e9c3bb6350208d8a647'}
    try:
        await rate(testing, connect)
        report['original_probe'] = {'status': 'PASS'}
    except AssertionError as error:
        frame = traceback.extract_tb(error.__traceback__)[-1]
        statement = linecache.getline(frame.filename, frame.lineno).strip()
        report['original_probe'] = {'status': 'FAIL', 'file': Path(frame.filename).name,
                                    'line': frame.lineno, 'statement': statement}
        assert "before['seq']==after['seq']" in statement, report['original_probe']
    peers = []
    metrics = {'violations': []}
    async with testing.create_test_server(clock=SplitClock()) as server:
        try:
            peers = await setup(server, connect, metrics, 2, 0)
            host, member = peers
            before = await member.sync()
            last_good, rejected = member.seq, None
            for _ in range(48):
                msg = member.message('room.sync', {'room_id': member.room})
                await member.ws.send(json.dumps(msg))
                while True:
                    reply = await member.receive()
                    if reply['type'] == 'ack':
                        break
                if not reply['ok']:
                    check_ack(reply, msg, {'ok': False, 'error': {'code': 'RATE_LIMITED', 'field': None, 'retryable': True}})
                    rejected = msg
                    break
                check_ack(reply, msg, {'ok': True})
                last_good = int(msg['command_seq'])
            assert rejected is not None
            after_rate = await host.sync()
            assert after_rate['seq'] == before['seq']
            assert after_rate['view']['match'] == before['view']['match']
            assert after_rate['view']['policy_revision'] == before['view']['policy_revision']
            await member.close()
            await server.drain()
            after_disconnect = await host.sync()
            assert int(after_disconnect['seq']) > int(after_rate['seq'])
            resumed = await member.open(resume=True)
            assert resumed['data']['last_command_seq'] == str(last_good)
            after_resume = await host.sync()
            assert int(after_resume['seq']) > int(after_disconnect['seq'])
            await member.command('room.sync', rejected['payload'], message=rejected)
            after_replay = await member.sync()
            assert after_replay['seq'] == after_resume['seq']
            assert after_replay['view']['match'] == before['view']['match']
            assert after_replay['view']['policy_revision'] == before['view']['policy_revision']
            assert not metrics['violations']
            report['isolated_behavior'] = {'status': 'PASS', 'rate_ack_correlated': True,
                'rate_did_not_advance_business_seq': True, 'rejected_id_reusable': True,
                'before_room_seq': before['seq'], 'after_rate_room_seq': after_rate['seq'],
                'after_disconnect_room_seq': after_disconnect['seq'],
                'after_resume_room_seq': after_resume['seq'], 'after_replay_room_seq': after_replay['seq'],
                'match_and_policy_unchanged': True}
        finally:
            await asyncio.gather(*(p.close() for p in peers))
    return report

out = asyncio.run(diagnostic())
(root / 'evidence/rate-diagnostic.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(out, indent=2))
