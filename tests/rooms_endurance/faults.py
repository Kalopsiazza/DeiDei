"""Independent Q01-Q20 observations; no production source mutations."""
from __future__ import annotations
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import random
import sys
from types import SimpleNamespace
from uuid import uuid4

from tests.rooms_endurance.run import Client, SplitClock, setup, play
from tests.rooms_v1.run_acceptance import Scenario
from tests.rooms_v1.validate import check_ack, load_cases


def check_rate_state(before: dict, after: dict, member_id: str,
                     connected: bool | None = None) -> None:
    """Compare one causal window; the injected monotonic clock never advances here."""
    assert before['room_id'] == after['room_id'], 'rate probe changed room'
    expected = deepcopy(before['view']); expected.pop('self')
    actual = deepcopy(after['view']); actual.pop('self')
    if connected is None:
        assert before['seq'] == after['seq'], 'sync/rate changed room seq'
    else:
        member = next(m for m in expected['members'] if m['player_id'] == member_id)
        assert member['connected'] is not connected, 'connection transition missing'
        member['connected'] = connected
        assert int(after['seq']) > int(before['seq']), 'public connection change needs newer seq'
    # Full match, members, policy and exact deadline stay covered, including during resume.
    assert actual == expected, 'unexpected public change in rate observation window'


async def rate(service: object, connect: object) -> dict:
    metrics={'violations':[]};peers=[]
    async with service.create_test_server(clock=SplitClock()) as server:
        try:
            peers=await setup(server,connect,metrics,2,0);h,p=peers
            before=await p.sync();last_good=p.seq;rejected=None
            for _ in range(48):
                msg=p.message('room.sync',{'room_id':p.room})
                await p.ws.send(json.dumps(msg))
                while True:
                    f=await p.receive()
                    if f['type']=='ack':break
                if not f['ok']:
                    check_ack(f,msg,{'ok':False,'error':{'code':'RATE_LIMITED','field':None,'retryable':True}})
                    rejected=msg;break
                check_ack(f,msg,{'ok':True});last_good=int(msg['command_seq'])
            assert rejected is not None,'bounded burst did not reach rate boundary'
            # Observe rejection before introducing a real connected-state change.
            after_rate=await h.sync();member_id=p.identity['player_id']
            check_rate_state(before,after_rate,member_id)
            await p.close();await server.drain()
            after_disconnect=await h.sync()
            check_rate_state(after_rate,after_disconnect,member_id,False)
            resumed=await p.open(resume=True)
            after_resume=await h.sync()
            check_rate_state(after_disconnect,after_resume,member_id,True)
            assert resumed['data']['last_command_seq']==str(last_good),'rate consumed last_seq'
            # Same rejected ID can now succeed: no rejected business cache entry was written.
            await p.command('room.sync',rejected['payload'],message=rejected)
            after=await p.sync()
            check_rate_state(after_resume,after,member_id)
            assert not metrics['violations'], 'snapshot invariant violation'
            return dict(last_seq_unchanged=True,rejected_id_reusable=True,room_unchanged_in_each_sync_window=True,
                room_seq=dict(before=before['seq'],after_rate=after_rate['seq'],
                    after_disconnect=after_disconnect['seq'],after_resume=after_resume['seq'],after_replay=after['seq']),
                connected=[True,False,True],match_policy_and_exact_time_unchanged=True)
        finally:await asyncio.gather(*(p.close() for p in peers))


async def wall(service: object, connect: object, phase: str, ticking: bool = False) -> dict:
    clock=SplitClock();clock.read_step=1 if ticking else 0;metrics={'violations':[]};peers=[]
    async with service.create_test_server(clock=clock) as server:
        try:
            peers=await setup(server,connect,metrics,2,1);h,p,s=peers
            key='timer'
            if phase=='revealing':
                await h.submit();await p.submit();await server.advance_ms(300)
            elif phase=='grace':
                await play(server,peers,2,random.Random(1),True)
                await h.close();await server.drain();key='host_recovery'
            before=await p.sync();deadline=before['view'][key]['deadline_at_ms']
            server_time=before['server_time_ms'];old_remaining=before['view'][key]['remaining_ms']
            for jump in (86400000,-86400000,0):
                clock.offset=jump;await server.advance_ms(1)
                for observer in (p,s):
                    v=await observer.sync()
                    assert v['view'][key]['deadline_at_ms']==deadline,'wall changed exact deadline'
                    assert v['server_time_ms']==server_time+((86400000,-86400000,0).index(jump)+1),'public time not anchored'
                    assert v['view'][key]['remaining_ms']==old_remaining-((86400000,-86400000,0).index(jump)+1)
            # Only monotonic advance can cross the actual phase/grace boundary.
            await server.advance_ms(old_remaining-4)
            assert (await p.sync())['view']['phase']==before['view']['phase']
            await server.advance_ms(1)
            now=await p.sync()
            expected={'selecting':'revealing','revealing':'selecting','grace':'closed'}[phase]
            assert now['view']['phase']==expected
            if phase=='grace':assert now['view']['close_reason']=='HOST_TIMEOUT'
            assert not metrics['violations']
            return dict(phase=phase,wall_jumps=3,exact_deadline=True,mono_boundary=True)
        finally:await asyncio.gather(*(p.close() for p in peers))


async def malformed(service: object, connect: object) -> dict:
    metrics={'violations':[]};peers=[]
    async with service.create_test_server(clock=SplitClock()) as server:
        try:
            peers=await setup(server,connect,metrics,2,0);p=peers[1]
            for text in ('{"v":1,"v":1}','{"request_id":"bad-id"}'):
                await p.ws.send(text)
                while True:
                    f=await p.receive()
                    if f['type']=='ack':break
                check_ack(f,{'request_id':None},{'ok':False,'error':{'code':'INVALID_MESSAGE','field':None,'retryable':False}})
            await p.ws.send('x'*16385)
            await p.ws.wait_closed();assert p.ws.close_code==1009
            assert (await peers[0].sync())['view']['phase']=='selecting'
            return dict(malformed_exact=True,oversize_close=1009,other_connection_live=True)
        finally:await asyncio.gather(*(p.close() for p in peers))


async def queue_budget(service: object, connect: object) -> dict:
    """Real Connection.put/writer, controlled blocking send; not a socket throughput claim."""
    module=sys.modules['deidei_server.server'];protocol=sys.modules['deidei_server.protocol']
    class BlockedSocket:
        def __init__(self):self.entered=asyncio.Event();self.release=asyncio.Event();self.closed=[]
        async def send(self,text):self.entered.set();await self.release.wait()
        async def close(self,code,reason):self.closed.append((code,reason))
    results={}
    async with service.create_test_server(clock=SplitClock()) as server:
        metrics={'violations':[]};peers=await setup(server,connect,metrics,2,0)
        try:
            template=await peers[0].sync()
            for mode in ('count','bytes','coalesce'):
                ws=BlockedSocket();c=module.Connection(server.service,ws)
                session=module.Session({'nickname':'合成','avatar_id':'leaf'},b'not-a-real-credential',0)
                session.connection=c;session.room_id=template['room_id'];c.session=session
                server.service.sessions[session.id]=session
                writer=asyncio.create_task(c.writer())
                def ack(size=None):
                    obj=dict(v=1,type='ack',request_id=str(uuid4()),ok=True,data=dict(session_id=session.id,
                        player_id=session.player_id,boot_id=server.service.boot_id,last_command_seq='1'))
                    if size is not None:
                        extra=size-len(protocol.dumps(obj).encode());assert extra>=0
                        obj['data']['last_command_seq']='1'+'0'*extra
                        assert len(protocol.dumps(obj).encode())==size
                    return obj
                try:
                    c.put(ack());await asyncio.wait_for(ws.entered.wait(),1)
                    assert len(c.queue)==0
                    if mode=='count':
                        for _ in range(32):c.put(ack())
                        assert len(c.queue)==32 and not c.closing
                        c.put(ack());assert c.closing and len(c.queue)==32
                    elif mode=='bytes':
                        c.put(ack(1048576));c.put(ack(1048576))
                        assert c.queued_bytes==2097152 and not c.closing
                        c.put(ack());assert c.closing and c.queued_bytes==2097152
                    else:
                        c.put(ack())
                        for seq in ('101','102'):
                            snap=deepcopy(template);snap['seq']=seq;c.put(snap)
                        c.put(ack());snap=deepcopy(template);snap['seq']='103';c.put(snap)
                        decoded=[json.loads(x[0]) for x in c.queue]
                        assert [x['type'] for x in decoded]==['ack','snapshot','ack','snapshot']
                        assert [x['seq'] for x in decoded if x['type']=='snapshot']==['102','103']
                        assert c.queued_bytes==sum(x[1] for x in c.queue)
                    await asyncio.sleep(0)
                    if mode!='coalesce':assert ws.closed==[(1008,'SLOW_CONSUMER')]
                    results[mode]='PASS'
                finally:
                    writer.cancel();await asyncio.gather(writer,return_exceptions=True)
                    server.service.sessions.pop(session.id,None)
        finally:await asyncio.gather(*(p.close() for p in peers))
    return dict(scope='internal controlled writer; exact queued count/bytes, in-flight frame excluded',**results)


async def removed_eliminated(service: object, connect: object) -> dict:
    clock=SplitClock();metrics={'violations':[]};peers=[]
    async with service.create_test_server(clock=clock) as server:
        try:
            peers=await setup(server,connect,metrics,3,1)
            for p in peers[:3]:await p.submit()
            await server.advance_ms(300);await server.advance_ms(1500)
            for p in peers:await p.sync()
            for i,p in enumerate(peers[:3]):await p.submit('Bi' if i<2 else 'Charge')
            await server.advance_ms(300);v=await peers[0].sync();q=peers[2]
            member=next(m for m in v['view']['members'] if m['player_id']==q.identity['player_id'])
            assert member['participation']=='eliminated' and member['role']=='player'
            await q.close();await server.drain();await server.advance_ms(30000);await q.open(resume=True)
            while not q.receipts:await q.receive()
            assert q.receipts[-1]['reason']=='disconnect_grace_expired' and q.room is None
            return dict(eliminated_kept_seat=True,expired_receipt=True)
        finally:await asyncio.gather(*(p.close() for p in peers))


async def lost_ack(service: object, connect: object) -> dict:
    peers=[];metrics={'violations':[]}
    async with service.create_test_server(clock=SplitClock(),rng=random.Random(12)) as server:
        try:
            peers=await setup(server,connect,metrics,3,1)
            await play(server,peers,3,random.Random(12),True,1)
            assert not metrics['violations'];return dict(original_ack_not_read=True,charge_once=True,match_finished=True)
        finally:await asyncio.gather(*(p.close() for p in peers))


async def faults(service: object, connect: object, product: Path, only: list[str] | None = None) -> dict:
    rows=[]
    async def probe(qid,fn):
        if only and not any(qid==x or qid.split('/')[0]==x for x in only):return
        try:result=await fn();row=dict(case_id=qid,status='PASS',evidence=result)
        except Exception as e:row=dict(case_id=qid,status='FAIL',error=type(e).__name__)
        rows.append(row);print(qid,row['status'],flush=True)
    await probe('Q01/rate',lambda:rate(service,connect))
    await probe('Q02/malformed',lambda:malformed(service,connect))
    await probe('Q03/clock_reads',lambda:wall(service,connect,'selecting',True))
    for phase in ('selecting','revealing','grace'):
        await probe('Q04/'+phase,lambda phase=phase:wall(service,connect,phase))
    await probe('Q11/eliminated_grace',lambda:removed_eliminated(service,connect))
    await probe('Q12/lost_ack',lambda:lost_ack(service,connect))
    await probe('Q16/restart',lambda:restart(product,connect))
    await probe('Q19/exact_writer',lambda:queue_budget(service,connect))
    mapping={'Q05':['N38','N39'],'Q10':['N40','N41'],'Q11':['N45','N28/lobby'],
        'Q13':['N46'],'Q14':['N04/cap_6','N04/eliminated_keep_seat','N05','N06'],
        'Q15':['N10'],'Q19':['N31'],'Q20':['N03','N28/replacement']}
    shared={};api=sys.modules['deidei_core.api']
    for qid,selectors in mapping.items():
        for case in load_cases():
            if any(case['case_id']==s or case['case_id'].split('/')[0]==s for s in selectors):
                async def execute(case=case):
                    scenario=Scenario(case,api,connect,shared);scenario.desktop_path=product/'game/desktop'
                    await scenario.run(service.create_test_server)
                    return dict(source_case=case['case_id'],scope='real sockets; N46 also real client with scripted delivery')
                await probe(qid+'/'+case['case_id'],execute)
    return dict(status='FAIL' if any(r['status']=='FAIL' for r in rows) else 'PASS',cases=rows,
        not_run=[dict(case_id='Q17',reason='real Electron lifecycle is separate'),
                 dict(case_id='Q18',reason='100 seeds and 900-second run reported separately')])


async def restart(product: Path, connect: object) -> dict:
    """Actual production CLI restart and a separate offline JSONL worker."""
    import os
    import signal
    env={**os.environ,'PYTHONPATH':os.pathsep.join(str(product/'game'/p) for p in ('core','server','runtime')),'PYTHONNOUSERSITE':'1'}
    owned=[];peers=[];boots=[];metrics={'violations':[]}
    async def start():
        proc=await asyncio.create_subprocess_exec(sys.executable,'-u','-m','deidei_server','--port','0',env=env,
            stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL)
        owned.append(proc)
        line=await asyncio.wait_for(proc.stdout.readline(),5)
        assert line.startswith(b'Listening: ws://127.0.0.1:')
        return proc,SimpleNamespace(url=line.decode().strip().split(' ',1)[1])
    async def stop(proc):
        if proc.returncode is None:proc.send_signal(signal.SIGINT)
        await asyncio.wait_for(proc.wait(),5)
    try:
        proc,server=await start();p=Client(server,connect,'restart',metrics);peers.append(p);await p.open()
        boots.append(p.hello['boot_id']);old=p.identity.copy()
        await p.command('room.create',{'password':None,'options':{k:p.policy[k] for k in ('turn_ms','early_reveal','spectator_cap')}})
        room_code=(await p.sync())['view']['room_code']
        await p.close();await stop(proc)
        proc,server=await start();p=Client(server,connect,'new',metrics);peers.append(p)
        p.ws=await connect(server.url,subprotocols=['deidei.rooms.v1'],compression=None,proxy=None);Client.live+=1
        hello=json.loads(await p.ws.recv());boots.append(hello['boot_id'])
        assert boots[0]!=boots[1]
        await p.command('session.resume',{'session_id':old['session_id'],'resume_token':old['resume_token']},error='SESSION_EXPIRED')
        await p.close();await p.open()
        await p.command('room.join',{'room_code':room_code,'password':None,'role':'player'},error='ROOM_ACCESS_DENIED')
        worker=await asyncio.create_subprocess_exec(sys.executable,'-u','-m','deidei_runtime.worker',env=env,
            stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.DEVNULL);owned.append(worker)
        for i,(op,payload) in enumerate([('health',{}),('start_solo',dict(profile_id='test_restart',nickname='测试',avatar_id='leaf')),('leave',{}),('shutdown',{})]):
            msg=dict(v=1,id=str(i),op=op,payload=payload);worker.stdin.write((json.dumps(msg)+'\n').encode());await worker.stdin.drain()
            response=json.loads(await asyncio.wait_for(worker.stdout.readline(),5));assert response['ok'] and response['id']==str(i)
            if op=='start_solo':assert response['data']['source']=='live'
        await asyncio.wait_for(worker.wait(),5);assert worker.returncode==0
        return dict(new_boot=True,old_identity='SESSION_EXPIRED',old_room='ROOM_ACCESS_DENIED',offline_live=True,owned_processes=3)
    finally:
        await asyncio.gather(*(p.close() for p in peers))
        for proc in owned:
            if proc.returncode is None:
                proc.terminate()
                try:await asyncio.wait_for(proc.wait(),5)
                except asyncio.TimeoutError:proc.kill();await proc.wait()
        assert all(p.returncode is not None for p in owned)
