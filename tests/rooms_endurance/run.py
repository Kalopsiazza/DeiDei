"""Bounded independent protocol probes. Only starts its own loopback service."""
from __future__ import annotations
import argparse
import asyncio
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import random
import statistics
import subprocess
import sys
import time
from urllib.parse import urlsplit
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tests.rooms_v1.run_acceptance import load_module, evidence, Scenario, ManualClock
from tests.rooms_v1.validate import POLICY, check_ack, check_snapshot, no_secrets, load_cases

BASE = '8a6f8b29f517ab4c5a16466f0894e86995f8a852'


class SplitClock(ManualClock):
    """Independent wall clock jumps; advancing monotonic time never changes offset."""
    def __init__(self) -> None:
        super().__init__()
        self.offset = 0
        self.read_step = 0
        self.wall_reads = 0

    def wall_ms(self) -> int:
        self.wall_reads += 1
        return 1800000000000 + self.value + self.offset + self.wall_reads * self.read_step


class Client:
    live = 0
    peak = 0

    def __init__(self, server: object, connect: object, alias: str, metrics: dict) -> None:
        self.server, self.connect, self.alias, self.metrics = server, connect, alias, metrics
        self.identity = None
        self.ws = None
        self.seq = 0
        self.room = None
        self.policy = dict(POLICY)
        self.latest = None
        self.receipts = []
        self.public = {}
        self.turns = {}
        self.latencies = []
        self.actions = 0

    def violation(self, code: str) -> None:
        if code not in self.metrics['violations']:
            self.metrics['violations'].append(code)

    async def open(self, resume: bool = False) -> dict:
        assert self.ws is None
        u = urlsplit(self.server.url)
        assert u.hostname == '127.0.0.1' and u.scheme == 'ws' and u.path == '/rooms-v1'
        assert Client.live < 48
        self.ws = await self.connect(self.server.url, subprotocols=['deidei.rooms.v1'],
            compression=None, proxy=None, close_timeout=1)
        Client.live += 1; Client.peak = max(Client.peak, Client.live)
        hello = json.loads(await asyncio.wait_for(self.ws.recv(), 3))
        assert hello['protocol'] == 'rooms-1.1'
        self.policy = hello['policy_defaults']
        self.hello = hello
        old = self.identity
        payload = {'session_id': old['session_id'], 'resume_token': old['resume_token']} if resume else {
            'profile': {'nickname': '测试' + self.alias, 'avatar_id': 'leaf'}}
        ack = await self.command('session.resume' if resume else 'session.open', payload)
        self.identity = {**(old or {}), **ack['data']}
        self.seq = max(self.seq, int(self.identity['last_command_seq']))
        if resume: assert self.identity['player_id'] == old['player_id']
        return ack

    async def receive(self) -> dict:
        frame = json.loads(await asyncio.wait_for(self.ws.recv(), 3))
        if frame['type'] == 'snapshot':
            assert self.room == frame['room_id'], 'cross-room snapshot'
            try:
                check_snapshot(frame, self.identity['player_id'], self.room, frame['view']['policy'])
            except ValueError:
                self.violation('SNAPSHOT_SCHEMA_OR_PRIVACY'); raise
            public = deepcopy(frame['view']); public.pop('self'); public['timer'].pop('remaining_ms')
            if public['host_recovery'] and public['host_recovery']['kind'] == 'grace':
                public['host_recovery'].pop('remaining_ms')
            key = (frame['room_id'], frame['seq'])
            if key in self.public and self.public[key] != public:
                self.violation('SAME_SEQ_PUBLIC_CHANGED')
            self.public[key] = public
            # Keep only a bounded window, sufficient for immediate repeated broadcasts.
            if len(self.public) > 32: self.public.pop(next(iter(self.public)))
            last = frame['view']['match'] and frame['view']['match']['last_turn']
            if last:
                key = last['turn_id']
                digest = hashlib.sha256(json.dumps(last, sort_keys=True).encode()).hexdigest()
                if key in self.turns: assert self.turns[key] == digest, 'repeated turn changed result'
                self.turns[key] = digest
                if len(self.turns) > 32: self.turns.pop(next(iter(self.turns)))
            self.latest = frame
        elif frame['type'] == 'membership.ended':
            from tests.rooms_v1.validate import check_membership_end
            check_membership_end(frame, self.identity['player_id'])
            assert frame['room_id'] == self.room
            self.receipts.append(frame); self.room = None; self.latest = None
        return frame

    def message(self, op: str, payload: dict) -> dict:
        self.actions += 1
        if not op.startswith('session.'): self.seq += 1
        return dict(v=1, type='command', request_id=str(uuid4()),
                    command_seq=None if op.startswith('session.') else str(self.seq), op=op, payload=payload)

    async def command(self, op: str, payload: dict, *, error: str | None = None,
                      message: dict | None = None) -> dict:
        msg = message or self.message(op, payload)
        started = time.monotonic()
        await self.ws.send(json.dumps(msg))
        while True:
            f = await self.receive()
            if f['type'] != 'ack': continue
            check_ack(f, msg, {'ok': False, 'error': {'code': error}} if error else {'ok': True})
            if f['ok'] and op in {'room.create', 'room.join'}: self.room = f['data']['room_id']
            if f['ok'] and op == 'room.leave': self.room = None
            self.latencies.append((time.monotonic() - started) * 1000)
            if len(self.latencies) > 20000: self.latencies.pop(0)
            return f

    async def sync(self) -> dict:
        await self.command('room.sync', {'room_id': self.room})
        while True:
            f = await self.receive()
            if f['type'] == 'snapshot': return f

    async def submit(self, entry: str = 'Charge', message: dict | None = None) -> dict:
        match = self.latest['view']['match']
        return await self.command('room.submit', dict(room_id=self.room, match_id=match['match_id'],
            turn_id=match['turn_id'], entry_id=entry), message=message)

    async def close(self) -> None:
        if self.ws is not None:
            await self.ws.close(); self.ws = None; Client.live -= 1


async def setup(server: object, connect: object, metrics: dict, players: int = 2,
                spectators: int = 1, prefix: str = '') -> list[Client]:
    peers = []
    try:
        for i in range(players + spectators):
            p = Client(server, connect, prefix + str(i), metrics); peers.append(p); await p.open()
        h = peers[0]
        made = await h.command('room.create', {'password': None, 'options': {
            k: h.policy[k] for k in ('turn_ms', 'early_reveal', 'spectator_cap')}})
        for i,p in enumerate(peers[1:],1):
            await p.command('room.join', {'room_code': made['data']['room_code'], 'password': None,
                'role': 'player' if i < players else 'spectator'})
        for p in peers[:players]: await p.command('room.ready', {'room_id':p.room, 'ready':True})
        await h.command('room.start', {'room_id':h.room})
        for p in peers: await p.sync()
        return peers
    except BaseException:
        await asyncio.gather(*(p.close() for p in peers)); raise


async def wait_phase(server: object, h: Client, phase: str, manual: bool) -> None:
    if manual:
        await server.advance_ms(300 if phase == 'revealing' else 1500)
        assert (await h.sync())['view']['phase'] == phase, 'manual phase did not progress'
        return
    for _ in range(100):
        await asyncio.sleep(.1)
        v = await h.sync()
        if v['view']['phase'] == phase: return
    raise AssertionError('phase did not progress within bounded wait')


async def play(server: object, peers: list[Client], players: int, rng: random.Random,
               manual: bool, fault: int = 0) -> None:
    h = peers[0]
    order = list(range(players)); rng.shuffle(order)
    for i in order:
        p = peers[i]
        if fault == 1 and i == 1:
            match = p.latest['view']['match']
            msg = p.message('room.submit', dict(room_id=p.room, match_id=match['match_id'],
                turn_id=match['turn_id'], entry_id='Charge'))
            # Request reaches the real service; this transport never reads its first ack.
            await p.ws.send(json.dumps(msg)); await server.drain(); await asyncio.sleep(.03)
            await p.close(); await p.open(resume=True)
            await p.command('room.submit', msg['payload'], message=msg)
        else:
            ack = await p.submit()
            if fault == 2 and i == 1:
                # Resend the exact accepted command envelope; do not create a new intent.
                msg = dict(v=1,type='command',request_id=ack['request_id'], command_seq=str(p.seq),
                    op='room.submit',payload=dict(room_id=p.room,match_id=p.latest['view']['match']['match_id'],
                    turn_id=p.latest['view']['match']['turn_id'],entry_id='Charge'))
                await p.command('room.submit',msg['payload'],message=msg)
    await wait_phase(server,h,'revealing',manual)
    last=h.latest['view']['match']['last_turn']
    assert all(p['dd6']=='6' for p in last['core_resolution']['ledger']['post_turn_players'].values()), 'duplicate charge'
    assert last['effective_transition']['kind']=='continue_game'
    for p in peers[1:]:
        v=await p.sync(); assert v['view']['match']['last_turn']==last
    await wait_phase(server,h,'selecting',manual)
    for p in peers[1:]: await p.sync()
    order=list(range(players));rng.shuffle(order)
    for i in order: await peers[i].submit('Bi' if i==0 else 'Charge')
    await wait_phase(server,h,'revealing',manual)
    last=h.latest['view']['match']['last_turn']
    assert last['effective_transition']['winner_id']==h.identity['player_id']
    assert last['effective_transition']['kind']=='sole_survivor'
    await wait_phase(server,h,'result',manual)
    for p in peers[1:]:
        v=await p.sync();assert v['view']['match']['effective_outcome']['winner_id']==h.identity['player_id']


def summary_latency(values: list[float]) -> dict:
    values=sorted(values)
    return {'count':len(values),'p50_ms':statistics.median(values),'p95_ms':values[min(len(values)-1,int(len(values)*.95))],
            'max_ms':max(values)} if values else {'count':0}


async def sequences(service: object, connect: object, count: int, seed: int | None = None) -> dict:
    results=[]
    for seed in (range(count) if seed is None else [seed]):
        metrics={'violations':[]};peers=[];clock=SplitClock();stage='setup'
        try:
            async with service.create_test_server(clock=clock,rng=random.Random(seed), timeout_chooser=lambda state, options:'Charge') as server:
                try:
                    players=6 if seed==0 else 2+seed%5;spectators=6 if seed==0 else seed%3
                    peers=await setup(server,connect,metrics,players,spectators)
                    stage='two-round-match-with-replay' if seed%3 else 'two-round-match'
                    await play(server,peers,players,random.Random(seed),True,seed%3)
                    assert sum(p.actions for p in peers)<=2000
                    assert not metrics['violations']
                finally: await asyncio.gather(*(p.close() for p in peers))
            results.append(dict(seed=seed,status='PASS',stage='finished',actions=sum(p.actions for p in peers)))
        except Exception as e:
            results.append(dict(seed=seed,status='FAIL',stage=stage,error=type(e).__name__,violations=metrics['violations']))
        print('seed',seed,results[-1]['status'],flush=True)
    return dict(scope='real sockets + injected clock; seeds vary seats, observer count, order and replay fault',
                sequences=results,passed=sum(x['status']=='PASS' for x in results),status='PASS' if all(x['status']=='PASS' for x in results) else 'FAIL')


async def endurance(service: object, connect: object, seconds: int, rooms: int) -> dict:
    before=set(asyncio.all_tasks());metrics={'violations':[]};peers=[];samples=[];matches=[0]*rooms;failures=[]
    started=time.monotonic();deadline=started+seconds
    async with service.create_test_server(rng=random.Random(703),timeout_chooser=lambda state,options:'Charge') as server:
        async def room_loop(index: int) -> None:
            ps=[];stage='setup'
            try:
                ps=await setup(server,connect,metrics,2,1,str(index)+'-');peers.extend(ps)
                while time.monotonic()<deadline:
                    stage='match';await play(server,ps,2,random.Random(index+matches[index]),False,matches[index]%3)
                    matches[index]+=1
                    stage='return-lobby';h=ps[0]
                    await h.command('room.return_lobby',{'room_id':h.room})
                    for p in ps[:2]:await p.command('room.ready',{'room_id':p.room,'ready':True})
                    await h.command('room.start',{'room_id':h.room})
                    for p in ps:await p.sync()
            except asyncio.CancelledError: raise
            except Exception as e: failures.append(dict(room=index,stage=stage,error=type(e).__name__))
            finally:await asyncio.gather(*(p.close() for p in ps))
        jobs=[asyncio.create_task(room_loop(i)) for i in range(rooms)]
        try:
            while time.monotonic()<deadline:
                rss=subprocess.run(['ps','-o','rss=','-p',str(os.getpid())],capture_output=True,text=True)
                samples.append(dict(elapsed_s=round(time.monotonic()-started,3),rss_kib=int(rss.stdout.strip()) if rss.returncode==0 and rss.stdout.strip().isdigit() else None,
                    live_connections=Client.live,tasks=len(asyncio.all_tasks()),completed_matches=sum(matches)))
                if len(samples) >= 3 and samples[-1]['completed_matches'] == samples[-3]['completed_matches']:
                    metrics['violations'].append('PROGRESS_STALLED') if 'PROGRESS_STALLED' not in metrics['violations'] else None
                print('endurance',samples[-1],flush=True)
                await asyncio.sleep(min(30,max(0,deadline-time.monotonic())))
        finally:
            for job in jobs:job.cancel()
            await asyncio.gather(*jobs,return_exceptions=True)
    await asyncio.sleep(.05)
    leaked=[t for t in asyncio.all_tasks()-before if not t.done()]
    assert Client.live==0 and not leaked,'owned connection/task leak'
    return dict(status='FAIL' if failures or metrics['violations'] else 'PASS',scope='real clock, own in-process loopback service, 2 players + 1 observer per room',
        requested_seconds=seconds,elapsed_seconds=time.monotonic()-started,rooms=rooms,completed_matches=matches,
        failures=failures,violations=metrics['violations'],samples=samples,latency=summary_latency([v for p in peers for v in p.latencies]),
        peak_connections=Client.peak,connections_after=Client.live,tasks_leaked=len(leaked),subprocesses='ps samples only; each awaited and exited')


async def main_async(args: argparse.Namespace) -> dict:
    source=evidence(args.product/'game/server');core=evidence(args.product/'game/core')
    assert source['sha']==args.sha and core['sha']==args.sha and not source['dirty'] and not core['dirty']
    load_module(args.product/'game/core','deidei_core.api','deidei_core/api.py')
    service=load_module(args.product/'game/server','deidei_server.testing','deidei_server/testing.py')
    import websockets
    assert websockets.__version__=='17.0.1'
    from websockets.asyncio.client import connect
    if args.mode=='endurance':result=await endurance(service,connect,args.seconds,args.rooms)
    elif args.mode=='seeds':result=await sequences(service,connect,args.seeds,args.seed)
    else:
        from tests.rooms_endurance.faults import faults
        result=await faults(service,connect,args.product)
    assert evidence(args.product/'game/server')==source
    return dict(source=source,core=core,tools=evidence(ROOT/'tests/rooms_endurance'),**result)


def main() -> int:
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--product',type=Path,required=True);p.add_argument('--sha',required=True)
    p.add_argument('--mode',choices=['endurance','seeds','faults'],required=True);p.add_argument('--seconds',type=int,default=900)
    p.add_argument('--seed',type=int);p.add_argument('--rooms',type=int,default=4);p.add_argument('--seeds',type=int,default=100);p.add_argument('--output',type=Path,required=True)
    a=p.parse_args();assert 1<=a.seconds<=900 and 1<=a.rooms<=4 and 1<=a.seeds<=100
    try: result=asyncio.run(main_async(a))
    except Exception as e:result=dict(status='ERROR',error=type(e).__name__)
    a.output.write_text(json.dumps(result,indent=2)+'\n');return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
