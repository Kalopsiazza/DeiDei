"""Fixed-seed synthetic sequences, real sockets/core with the existing import-only manual clock."""
import argparse
import asyncio
from copy import deepcopy
import json
from pathlib import Path
from random import Random
import sys

ROOT = Path(__file__).resolve().parents[2]
for directory in ('game/core', 'game/server', 'game/server/tests'):
    sys.path.insert(0, str(ROOT / directory))
from deidei_server.testing import create_test_server
from test_rooms import Client, ManualClock


async def sequence(seed: int) -> dict:
    rng, clock = Random(seed), ManualClock()
    count, spectators = rng.randint(2, 6), rng.randint(0, 6)
    clients = []
    async with create_test_server(clock=clock, rng=Random(seed), timeout_chooser=lambda state, options: 'Charge') as server:
        try:
            for _ in range(count + spectators):
                c, ack = await Client.open(server.url)
                assert ack['ok']
                clients.append(c)
            players, viewers = clients[:count], clients[count:]
            host = players[0]
            ack = await host.command('room.create', dict(password=None, options=dict(turn_ms=10000, early_reveal=True, spectator_cap=6)))
            assert ack['ok']
            rid, code = ack['data']['room_id'], ack['data']['room_code']
            for i, c in enumerate(clients[1:], 1):
                assert (await c.command('room.join', dict(room_code=code, password=None, role='player' if i < count else 'spectator')))['ok']
            for c in players:
                assert (await c.command('room.ready', dict(room_id=rid, ready=True)))['ok']
            assert (await host.command('room.start', dict(room_id=rid)))['ok']
            game = (await host.sync(rid))['match']['match_id']
            for turn in range(3):
                view = await host.sync(rid)
                entries = ['Charge' if turn == 0 else 'Def' if turn == 1 else 'SelfBi'] * count
                if turn == 1:
                    entries[rng.randrange(count)] = 'Bi'
                message = host.intent('room.submit', dict(room_id=rid, match_id=game, turn_id=view['match']['turn_id'], entry_id=entries[0]))
                first = await host.send(message)
                assert first['ok'] and await host.send(message) == first
                if turn == 0:
                    future = rng.choice([5000, 8000, 10000, 12000, 20000, 30000])
                    assert (await host.command('room.set_turn_limit', dict(room_id=rid, turn_ms=future, expected_policy_revision='1')))['ok']
                    assert (await host.sync(rid))['timer']['deadline_at_ms'] == view['timer']['deadline_at_ms']
                    for viewer in viewers:
                        public = await viewer.sync(rid)
                        assert public['self']['accepted_entry_id'] is None and public['self']['options'] == []
                for c, entry in zip(players[1:], entries[1:]):
                    assert (await c.submit(rid, view, entry))['ok']
                clock.advance_ms(300)
                await server.drain()
                reveal = await host.sync(rid)
                assert reveal['phase'] == 'revealing'
                ledger = deepcopy(reveal['match']['last_turn'])
                for c in clients:
                    current = await c.sync(rid)
                    assert current['match']['last_turn'] == ledger
                if turn == 0:
                    assert all(p['dd6'] == '6' for p in ledger['effective_state']['players'].values())
                clock.advance_ms(1500)
                await server.drain()
                if turn < 2:
                    assert (await host.sync(rid))['current_turn_ms'] == future
            result = await host.sync(rid)
            assert result['phase'] == 'result' and result['match']['effective_outcome']['kind'] == 'nobody_survives'
            assert (await host.command('room.return_lobby', dict(room_id=rid)))['ok']
            lobby = await host.sync(rid)
            assert lobby['phase'] == 'lobby' and len(lobby['members']) == count + spectators
            assert all(not m['ready'] for m in lobby['members'])
            return dict(seed=seed, players=count, spectators=spectators, result='PASS', turns=3)
        finally:
            for c in clients:
                await c.ws.close()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--seeds', type=int, default=100)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    assert 1 <= args.seeds <= 1000
    results = []
    for seed in range(args.seeds):
        try:
            results.append(await sequence(seed))
        except Exception as error:
            results.append(dict(seed=seed, result='FAIL', error=type(error).__name__))
            break
        if seed % 10 == 9:
            print('Sequences completed:', seed + 1, flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(dict(status='PASS' if len(results) == args.seeds and all(r['result'] == 'PASS' for r in results) else 'FAIL', requested=args.seeds, transport='real sockets; injected clock; fixed seed test inputs', sequences=results), indent=2)+'\n')
    assert len(results) == args.seeds and all(r['result'] == 'PASS' for r in results)


if __name__ == '__main__':
    asyncio.run(main())
