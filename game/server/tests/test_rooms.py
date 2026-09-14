"""R03 self-tests: hand-written expectations over real loopback sockets."""
import asyncio
from copy import deepcopy
import json
import unittest
from uuid import uuid4

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus
from deidei_core.api import new_match
from deidei_server.testing import create_test_server
from deidei_server.protocol import DEFAULT_POLICY, Rejected, parse, policy, validate


class ManualClock:
    def __init__(self):
        self.value = 0

    def now_ms(self):
        return self.value

    def wall_ms(self):
        return 1800000000000 + self.value

    def advance_ms(self, ms):
        self.value += ms


def funded(ids, match_id):
    s = new_match(ids, match_id)
    for p in s['players'].values():
        p['dd6'] = '120'
    return s


class Client:
    def __init__(self, ws):
        self.ws, self.seq, self.messages, self.view = ws, 0, [], None
        self.identity = None
        self.last_sent = 0

    @classmethod
    async def open(cls, url, resume=None):
        ws = await connect(url, subprotocols=['deidei.rooms.v1'], proxy=None)
        c = cls(ws)
        c.hello = json.loads(await ws.recv())
        assert c.hello['type'] == 'hello'
        response = await c.command('session.resume' if resume else 'session.open',
            dict(session_id=resume['session_id'], resume_token=resume['resume_token']) if resume else
            {'profile': {'nickname': '合成测试', 'avatar_id': 'leaf'}})
        if response['ok']:
            c.identity = response['data'] if not resume else resume
            c.seq = int(response['data']['last_command_seq'])
        return c, response

    def intent(self, op, payload):
        if not op.startswith('session.'):
            self.seq += 1
        return dict(v=1, type='command', request_id=str(uuid4()),
            command_seq=None if op.startswith('session.') else str(self.seq), op=op, payload=payload)

    async def send(self, msg):
        # Exercise production rate limits without disabling them in test mode.
        await asyncio.sleep(max(0, self.last_sent + .052 - asyncio.get_running_loop().time()))
        self.last_sent = asyncio.get_running_loop().time()
        await self.ws.send(json.dumps(msg))
        while True:
            value = json.loads(await asyncio.wait_for(self.ws.recv(), 3))
            self.messages.append(value)
            if value['type'] == 'snapshot':
                self.view = value
            if value['type'] == 'ack' and value['request_id'] == msg['request_id']:
                return value

    async def command(self, op, payload):
        return await self.send(self.intent(op, payload))

    async def sync(self, rid):
        response = await self.command('room.sync', {'room_id': rid})
        assert response['ok'], response
        while True:
            value = json.loads(await asyncio.wait_for(self.ws.recv(), 3))
            self.messages.append(value)
            if value['type'] == 'snapshot' and value['room_id'] == rid:
                self.view = value
                return value['view']

    async def submit(self, rid, view, entry):
        return await self.command('room.submit', dict(room_id=rid, match_id=view['match']['match_id'],
            turn_id=view['match']['turn_id'], entry_id=entry))


class SocketCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.clients = []
        self.servers = []

    async def asyncTearDown(self):
        for c in self.clients:
            await c.ws.close()
        for server in self.servers:
            await server.close()

    async def server(self, **kwargs):
        # Retain the a-suite's explicit 12-second scenarios; new default is tested in test_rooms_11.
        kwargs['policy'] = {'turn_ms': 12000} | kwargs.get('policy', {})
        self.clock = kwargs.pop('clock', ManualClock())
        server = create_test_server(clock=self.clock, **kwargs)
        await server.__aenter__()
        self.servers.append(server)
        return server

    async def client(self, server, resume=None):
        c, reply = await Client.open(server.url, resume)
        self.clients.append(c)
        self.assertTrue(reply['ok'], reply)
        return c

    def ok(self, response):
        self.assertTrue(response['ok'], response)
        return response['data']

    def error(self, response, code):
        self.assertFalse(response['ok'], response)
        self.assertEqual(response['error']['code'], code)

    async def room(self, server, count=2, spectators=0, password=None, options=None):
        players = [await self.client(server) for _ in range(count)]
        opts = {k: server.service.policy[k] for k in ('turn_ms', 'early_reveal', 'spectator_cap')}
        opts.update(options or {})
        data = self.ok(await players[0].command('room.create', dict(password=password, options=opts)))
        for c in players[1:]:
            self.ok(await c.command('room.join', dict(room_code=data['room_code'], password=password, role='player')))
        viewers = []
        for _ in range(spectators):
            c = await self.client(server)
            self.ok(await c.command('room.join', dict(room_code=data['room_code'], password=password, role='spectator')))
            viewers.append(c)
        return players, viewers, data['room_id'], data['room_code']

    async def start(self, players, rid):
        for c in players:
            self.ok(await c.command('room.ready', dict(room_id=rid, ready=True)))
        self.ok(await players[0].command('room.start', dict(room_id=rid)))
        return await players[0].sync(rid)

    async def round(self, server, players, rid, entries):
        v = await players[0].sync(rid)
        for c, e in zip(players, entries):
            if e is not None:
                self.ok(await c.submit(rid, v, e))
        await server.advance_ms(v['timer']['remaining_ms'] if any(e is None for e in entries) else 300)
        return await players[0].sync(rid)


class Rooms(SocketCase):
    async def test_N01_N02_identity_password_and_nonexistent(self):
        server = await self.server()
        players, _, rid, code = await self.room(server, password=' 合成密码 ')
        v = await players[0].sync(rid)
        self.assertEqual(len(code), 8)
        self.assertEqual(v['members'][0]['seat'], 0)
        self.assertFalse(v['members'][0]['ready'])
        self.assertTrue(v['has_password'])
        self.assertEqual(v['policy'], DEFAULT_POLICY | {'turn_ms': 12000})
        guest = await self.client(server)
        for room_code, password in [(code, '合成密码'), ('AAAAAAAA', ' 合成密码 ')]:
            self.error(await guest.command('room.join', dict(room_code=room_code, password=password, role='player')), 'ROOM_ACCESS_DENIED')
        raw = json.dumps(v)
        for secret in ('resume_token', 'digest', 'salt', '合成密码'):
            self.assertNotIn(secret, raw)
        self.assertEqual(len(v['members']), 2)

    async def test_N03_N04_atomic_capacity_and_spectators(self):
        server = await self.server()
        players, viewers, rid, code = await self.room(server, 5, 6)
        racers = [await self.client(server) for _ in range(2)]
        replies = await asyncio.gather(*(c.command('room.join', dict(room_code=code,password=None,role='player')) for c in racers))
        self.assertEqual(sum(r['ok'] for r in replies), 1)
        self.error(next(r for r in replies if not r['ok']), 'ROOM_FULL')
        loser = racers[next(i for i,r in enumerate(replies) if not r['ok'])]
        self.error(await loser.command('room.join', dict(room_code=code,password=None,role='spectator')), 'SPECTATORS_FULL')
        v = await players[0].sync(rid)
        self.assertEqual(sum(m['role']=='player' for m in v['members']), 6)
        self.assertEqual(sum(m['role']=='spectator' for m in v['members']), 6)

    async def test_N05_N06_N07_permissions_readiness_roles(self):
        server = await self.server()
        players, viewers, rid, code = await self.room(server, spectators=1)
        host, guest = players
        self.error(await host.command('room.start',dict(room_id=rid)), 'NOT_READY')
        self.error(await guest.command('room.start',dict(room_id=rid)), 'NOT_HOST')
        self.error(await viewers[0].command('room.ready',dict(room_id=rid,ready=True)), 'NOT_ACTIVE')
        self.error(await host.command('room.role',dict(room_id=rid,role='spectator')), 'HOST_ROLE_FIXED')
        self.ok(await host.command('room.ready',dict(room_id=rid,ready=True)))
        self.ok(await viewers[0].command('room.leave',dict(room_id=rid)))
        self.assertTrue((await host.sync(rid))['members'][0]['ready'])
        self.ok(await guest.command('room.role',dict(room_id=rid,role='spectator')))
        self.assertFalse(any(m['ready'] for m in (await host.sync(rid))['members']))
        self.ok(await guest.command('room.role',dict(room_id=rid,role='player')))
        self.ok(await guest.command('room.ready',dict(room_id=rid,ready=True)))
        await guest.ws.close()
        await server.drain()
        self.ok(await host.command('room.ready',dict(room_id=rid,ready=True)))
        self.error(await host.command('room.start',dict(room_id=rid)), 'NOT_READY')

    async def test_N08_N32_match_join_and_membership(self):
        server = await self.server()
        players, _, rid, code = await self.room(server)
        v = await self.start(players,rid)
        outsider = await self.client(server)
        self.error(await outsider.command('room.sync',dict(room_id=rid)), 'ROOM_NOT_MEMBER')
        self.error(await outsider.command('room.join',dict(room_code=code,password=None,role='player')), 'MATCH_IN_PROGRESS')
        self.ok(await outsider.command('room.join',dict(room_code=code,password=None,role='spectator')))
        self.assertEqual((await outsider.sync(rid))['self']['options'], [])
        self.error(await outsider.submit(rid,v,'Charge'), 'NOT_ACTIVE')
        forged = outsider.intent('room.submit',dict(room_id=rid,match_id=v['match']['match_id'],turn_id=v['match']['turn_id'],entry_id='Charge',player_id=players[0].identity['player_id']))
        self.error(await outsider.send(forged), 'INVALID_MESSAGE')

    async def test_N09_cache_create_resume_conflict_and_eviction(self):
        server = await self.server()
        host = await self.client(server)
        msg = host.intent('room.create',dict(password=None,options=dict(turn_ms=12000,early_reveal=True,spectator_cap=6)))
        reply = await host.send(msg)
        rid = self.ok(reply)['room_id']
        await host.ws.close()
        await server.drain()
        host = await self.client(server,host.identity)
        self.assertEqual(await host.send(msg),reply)
        conflict = deepcopy(msg)
        conflict['payload']['password']='changed'
        self.error(await host.send(conflict),'REQUEST_CONFLICT')
        for _ in range(129):
            self.ok(await host.command('room.sync',dict(room_id=rid)))
        self.error(await host.send(msg),'STALE_COMMAND')
        self.assertEqual(len(server.service.rooms),1)

    async def test_N10_private_differential_sync_resume_and_failure(self):
        views = []
        for secret in ('Bi','Def'):
            server = await self.server(new_match_factory=funded)
            players, viewers, rid, _ = await self.room(server,3,1)
            v = await self.start(players,rid)
            self.ok(await players[1].submit(rid,v,secret))
            self.assertEqual((await players[1].sync(rid))['self']['accepted_entry_id'],secret)
            self.error(await viewers[0].submit(rid,v,'Charge'),'NOT_ACTIVE')
            await viewers[0].ws.close()
            await server.drain()
            observer = await self.client(server,viewers[0].identity)
            public = await observer.sync(rid)
            other = await players[0].sync(rid)
            self.assertIsNone(public['self']['accepted_entry_id'])
            self.assertIsNone(public['match']['last_turn'])
            self.assertEqual(other['match']['public_state']['players'][players[1].identity['player_id']]['dd6'],'120')
            self.assertEqual(next(m for m in public['members'] if m['player_id']==players[1].identity['player_id'])['submission_state'],'submitted')
            # Normalize transport/identity fields only; compare the complete remaining view.
            ids = {c.identity['player_id']:f'p{i}' for i,c in enumerate(players+[viewers[0]])}
            ids[v['match']['match_id']]='match'
            ids[public['room_code']]='CODE'
            def normalize(value):
                if isinstance(value,dict):
                    return {normalize(k):normalize(x) for k,x in value.items()}
                if isinstance(value,list):
                    return [normalize(x) for x in value]
                if isinstance(value,str):
                    for src,dst in ids.items():
                        value=value.replace(src,dst)
                return value
            normalized=normalize(public)
            normalized['match']['public_state']['roster'].sort()
            normalized['match']['public_state']['active_ids'].sort()
            views.append(normalized)
        self.assertEqual(views[0],views[1])

    async def test_N11_early_true_false_minimum_and_no_double_settle(self):
        for early in (True,False):
            server=await self.server()
            players,_,rid,_=await self.room(server,options={'early_reveal':early})
            v=await self.start(players,rid)
            for c in players:
                self.ok(await c.submit(rid,v,'Charge'))
            await server.advance_ms(299)
            self.assertEqual((await players[0].sync(rid))['phase'],'selecting')
            await server.advance_ms(1)
            v=await players[0].sync(rid)
            self.assertEqual(v['phase'],'revealing' if early else 'selecting')
            if not early:
                await server.advance_ms(11700)
                v=await players[0].sync(rid)
            self.assertEqual(v['match']['last_turn']['effective_state']['players'][players[0].identity['player_id']]['dd6'],'6')
            for _ in range(3):
                self.assertEqual((await players[0].sync(rid))['match']['last_turn'],v['match']['last_turn'])

    async def test_N12_deadline_minus_one_and_exact(self):
        for delta,accepted in ((11999,True),(12000,False)):
            server=await self.server(timeout_chooser=lambda state,options:'Charge')
            players,_,rid,_=await self.room(server,options={'early_reveal':False})
            v=await self.start(players,rid)
            self.ok(await players[0].submit(rid,v,'Charge'))
            server.clock.advance_ms(delta)  # command itself must drain due work
            response=await players[1].submit(rid,v,'Def')
            if accepted:
                self.ok(response)
                await server.advance_ms(1)
            else:
                self.error(response,'TURN_CLOSED')
            end=await players[0].sync(rid)
            source=end['match']['last_turn']['action_sources'][players[1].identity['player_id']]
            self.assertEqual(source,'human' if accepted else 'timeout_auto')

    async def test_N13_invalid_wire_and_oversized_frame(self):
        server=await self.server()
        players,_,rid,_=await self.room(server)
        v=await self.start(players,rid)
        self.error(await players[1].submit(rid,v,'Bi'),'UNAVAILABLE_MOVE')
        self.assertEqual(next(m for m in (await players[0].sync(rid))['members'] if m['player_id']==players[1].identity['player_id'])['absence_count'],0)
        for raw in ('{"v":1,"v":1}', '{"v":NaN}', '{}', b'binary'):
            c=await self.client(server)
            await c.ws.send(raw)
            response=json.loads(await c.ws.recv())
            self.error(response,'INVALID_MESSAGE')
        c=await self.client(server)
        await c.ws.send('x'*16385)
        with self.assertRaises(ConnectionClosed) as context:
            await c.ws.recv()
        self.assertEqual(context.exception.rcvd.code,1009)
        self.assertEqual((await players[0].sync(rid))['match']['public_state']['players'][players[0].identity['player_id']]['dd6'],'0')

    async def test_N14_N15_N16_submit_replay_conflict_stale(self):
        server=await self.server(new_match_factory=funded)
        players,_,rid,_=await self.room(server)
        v=await self.start(players,rid)
        msg=players[0].intent('room.submit',dict(room_id=rid,match_id=v['match']['match_id'],turn_id=v['match']['turn_id'],entry_id='Bi'))
        reply=await players[0].send(msg)
        self.ok(reply)
        self.assertEqual(await players[0].send(msg),reply)
        bad=deepcopy(msg); bad['payload']['entry_id']='Charge'
        self.error(await players[0].send(bad),'REQUEST_CONFLICT')
        self.error(await players[0].submit(rid,v,'Charge'),'ALREADY_SUBMITTED')
        self.ok(await players[1].submit(rid,v,'Def'))
        await server.advance_ms(300)
        end=await players[0].sync(rid)
        self.assertEqual(end['match']['last_turn']['effective_state']['players'][players[0].identity['player_id']]['dd6'],'114')
        await server.advance_ms(1500)
        self.error(await players[0].submit(rid,v,'Bi'),'STALE_TURN')
        self.assertEqual(await players[0].send(msg),reply)

    async def test_N17_duel_chooser_and_multiplayer_charge(self):
        observed=[]
        def chooser(state, options):
            observed.append((deepcopy(state),deepcopy(options)))
            self.assertNotIn('pending',state)
            return 'Def'
        for count in (2,3):
            server=await self.server(timeout_chooser=chooser)
            players,_,rid,_=await self.room(server,count)
            v=await self.start(players,rid)
            self.ok(await players[0].submit(rid,v,'Cloud'))
            await server.advance_ms(12000)
            end=await players[0].sync(rid)
            action=end['match']['last_turn']['core_resolution']['ledger']['actions'][players[1].identity['player_id']]
            self.assertEqual(action['entry_id'],'Def' if count==2 else 'Charge')
        self.assertEqual(len(observed),1)
        self.assertTrue(all(o['available'] for o in observed[0][1]))

    async def test_N18_N23_N34_restart_mode_absence_and_one_index(self):
        server=await self.server(new_match_factory=funded)
        players,_,rid,_=await self.room(server,4)
        v=await self.start(players,rid)
        self.ok(await players[3].command('room.leave',dict(room_id=rid)))
        for c,e in zip(players[:3],('Bi','Bi','Charge')):
            self.ok(await c.submit(rid,v,e))
        await server.advance_ms(12000)
        end=await players[0].sync(rid)
        result=end['match']['last_turn']
        self.assertEqual(result['core_resolution']['transition']['kind'],'restart_survivors')
        self.assertEqual(result['effective_state']['game_index'],'2')
        self.assertEqual(result['effective_state']['active_ids'],sorted(c.identity['player_id'] for c in players[:2]))
        await server.advance_ms(1500)
        await server.advance_ms(12000)
        end=await players[0].sync(rid)
        self.assertEqual(end['match']['mode_at_start'],'multiplayer')
        for c in players[:2]:
            self.assertEqual(end['match']['last_turn']['core_resolution']['ledger']['actions'][c.identity['player_id']]['entry_id'],'Charge')
        # Naturally eliminated player retains the original seat, not a spectator slot.
        m=next(m for m in end['members'] if m['player_id']==players[2].identity['player_id'])
        self.assertEqual((m['role'],m['participation']),('player','eliminated'))
        self.error(await players[2].submit(rid,end,'Charge'),'NOT_ACTIVE')

    async def test_N19_absences_manual_invalid_resume_and_third_removal(self):
        server=await self.server()
        players,_,rid,_=await self.room(server,3)
        await self.start(players,rid)
        host,guest,other=players
        for n in (1,2):
            end=await self.round(server,players,rid,['Charge',None,'Charge'])
            self.assertEqual(next(m for m in end['members'] if m['player_id']==guest.identity['player_id'])['absence_count'],n)
            await server.advance_ms(1500)
        await guest.ws.close(); await server.drain()
        guest=await self.client(server,guest.identity); players[1]=guest
        v=await guest.sync(rid)
        self.assertEqual(next(m for m in v['members'] if m['player_id']==guest.identity['player_id'])['absence_count'],2)
        self.error(await guest.submit(rid,v,'Shell'),'UNAVAILABLE_MOVE')
        self.assertEqual(next(m for m in (await host.sync(rid))['members'] if m['player_id']==guest.identity['player_id'])['absence_count'],2)
        self.ok(await guest.submit(rid,v,'Charge'))
        self.assertEqual(next(m for m in (await host.sync(rid))['members'] if m['player_id']==guest.identity['player_id'])['absence_count'],0)
        for c in (host,other): self.ok(await c.submit(rid,v,'Charge'))
        await server.advance_ms(1800)
        for n in (1,2,3):
            end=await self.round(server,players,rid,['Charge',None,'Charge'])
            if n<3: await server.advance_ms(1500)
        result=end['match']['last_turn']
        self.assertEqual(result['room_forfeits'],[{'player_id':guest.identity['player_id'],'reason':'three_absences'}])
        self.assertEqual(result['core_resolution']['ledger']['actions'][guest.identity['player_id']]['entry_id'],'Charge')
        self.assertNotIn(guest.identity['player_id'],[m['player_id'] for m in end['members']])
        self.error(await guest.command('room.sync',dict(room_id=rid)),'ROOM_NOT_MEMBER')

    async def test_N20_forced_recovery_online_offline(self):
        for disconnected in (False,True):
            server=await self.server()
            players,_,rid,_=await self.room(server,3)
            await self.start(players,rid)
            await self.round(server,players,rid,['Charge',None,'Charge'])
            await server.advance_ms(1500)
            await self.round(server,players,rid,['Charge','ZengYi','Charge'])
            await server.advance_ms(1500)
            v=await players[1].sync(rid)
            self.assertTrue(all(o['forced'] for o in v['self']['options']))
            self.error(await players[1].submit(rid,v,'Charge'),'FORCED_RECOVERY')
            if disconnected:
                await players[1].ws.close(); await server.drain()
            for c in (players[0],players[2]): self.ok(await c.submit(rid,v,'Charge'))
            await server.advance_ms(300)
            end=await players[0].sync(rid)
            pid=players[1].identity['player_id']
            self.assertEqual(end['match']['last_turn']['action_sources'][pid],'forced')
            self.assertTrue(end['match']['last_turn']['core_resolution']['ledger']['actions'][pid]['is_recovery'])
            self.assertEqual(next(m for m in end['members'] if m['player_id']==pid)['absence_count'],int(disconnected))

    async def test_N21_multiplayer_rule_actions(self):
        for entries,winner in [(('SelfBi','Reflect','Absorb'),0),(('Pragon','Def','Charge'),0)]:
            server=await self.server(new_match_factory=funded)
            players,_,rid,_=await self.room(server,3)
            await self.start(players,rid)
            end=await self.round(server,players,rid,entries)
            self.assertEqual(end['match']['last_turn']['effective_transition']['winner_id'],players[winner].identity['player_id'])
            self.assertEqual(set(end['match']['last_turn']['core_resolution']['ledger']['actions']),{c.identity['player_id'] for c in players})

    async def test_N22_N24_forfeit_winner_none_and_one(self):
        for count in (2,3):
            server=await self.server(new_match_factory=funded)
            players,_,rid,_=await self.room(server,count)
            v=await self.start(players,rid)
            for c,e in zip(players,['Charge']+['Bi']*(count-1)):
                self.ok(await c.submit(rid,v,e))
            for c in players[1:]: self.ok(await c.command('room.leave',dict(room_id=rid)))
            await server.advance_ms(300)
            end=await players[0].sync(rid)
            result=end['match']['last_turn']
            self.assertEqual(result['effective_transition']['kind'],'nobody_survives')
            self.assertIsNone(result['effective_transition']['winner_id'])
            self.assertEqual(result['effective_state']['game_index'],'1')
            self.assertEqual(len(result['room_forfeits']),count-1)
            self.assertEqual(result['core_resolution']['ledger']['kills'][players[0].identity['player_id']],[])
        server=await self.server()
        players,_,rid,_=await self.room(server)
        v=await self.start(players,rid)
        self.ok(await players[1].command('room.leave',dict(room_id=rid)))
        self.ok(await players[0].submit(rid,v,'Charge'))
        await server.advance_ms(12000)
        end=await players[0].sync(rid)
        self.assertEqual(end['match']['last_turn']['effective_transition']['winner_id'],players[0].identity['player_id'])

    async def test_N25_reveal_leave_does_not_rewrite(self):
        server=await self.server()
        players,_,rid,_=await self.room(server,3)
        await self.start(players,rid)
        end=await self.round(server,players,rid,['Charge']*3)
        before=deepcopy(end['match']['last_turn'])
        self.ok(await players[2].command('room.leave',dict(room_id=rid)))
        self.assertEqual((await players[0].sync(rid))['match']['last_turn'],before)
        await server.advance_ms(1500)
        end=await self.round(server,players[:2],rid,['Charge','Charge'])
        if end['phase']=='selecting':
            await server.advance_ms(11700)
            end=await players[0].sync(rid)
        self.assertEqual(end['match']['last_turn']['room_forfeits'],[{'player_id':players[2].identity['player_id'],'reason':'voluntary_leave'}])

    async def test_N26_host_leave_and_absence_close(self):
        # NET1.1/P20/P22 replace immediate-default and third-host-absence expectations.
        for leave in (True,False):
            server=await self.server(timeout_chooser=lambda state,options:'Charge')
            players,_,rid,_=await self.room(server)
            await self.start(players,rid)
            if leave:
                self.ok(await players[0].command('room.leave',dict(room_id=rid)))
                self.assertEqual((await players[1].sync(rid))['pending_close']['after'],'current_turn')
                await server.advance_ms(12000)
            else:
                for n in range(4):
                    v=await players[1].sync(rid)
                    self.ok(await players[1].submit(rid,v,'Charge'))
                    await server.advance_ms(12000)
                    if n<3: await server.advance_ms(1500)
            end=await players[1].sync(rid)
            self.assertEqual(end['phase'],'closed')
            self.assertEqual(end['close_reason'],'HOST_LEFT' if leave else 'HOST_ABSENT')
            self.assertIsNone(end['match']['effective_outcome'])

    async def test_N27_recovery_without_pause_and_grace(self):
        # P20 keeps selecting/revealing deadlines running; P21 reserves grace for no-round hosts.
        server=await self.server()
        players,_,rid,_=await self.room(server,options={'early_reveal':False})
        v=await self.start(players,rid)
        self.ok(await players[0].submit(rid,v,'Charge'))
        await server.advance_ms(2000)
        await players[0].ws.close(); await server.drain()
        recovery=await players[1].sync(rid)
        self.assertEqual(recovery['phase'],'selecting')
        self.assertIsNone(recovery['pause'])
        self.assertEqual(recovery['host_recovery']['kind'],'rounds')
        await server.advance_ms(5000)
        host=await self.client(server,players[0].identity)
        v=await host.sync(rid)
        self.assertEqual(v['timer']['remaining_ms'],5000)
        self.assertEqual(v['self']['accepted_entry_id'],'Charge')
        for grace in (0,30000,60000):
            server=await self.server(policy={'host_disconnect_grace_ms':grace})
            players,_,rid,_=await self.room(server)
            await players[0].ws.close(); await server.drain()
            await server.advance_ms(grace)
            self.assertEqual((await players[1].sync(rid))['close_reason'],'HOST_TIMEOUT')

    async def test_N28_N29_generation_lobby_expiry_and_fake_token(self):
        server=await self.server()
        players,_,rid,_=await self.room(server)
        old=players[1]
        new=await self.client(server,old.identity)
        await old.ws.close(); await server.drain()
        self.assertTrue(next(m for m in (await players[0].sync(rid))['members'] if m['player_id']==old.identity['player_id'])['connected'])
        bad=dict(old.identity,resume_token='x'*43)
        c,reply=await Client.open(server.url,bad); self.clients.append(c)
        self.error(reply,'SESSION_EXPIRED')
        await new.ws.close(); await server.drain()
        await server.advance_ms(30000)
        self.assertEqual(len((await players[0].sync(rid))['members']),1)
        resumed=await self.client(server,new.identity)
        self.error(await resumed.command('room.sync',dict(room_id=rid)),'ROOM_NOT_MEMBER')

    async def test_N30_N36_six_players_two_spectators_three_matches(self):
        server=await self.server()
        players,viewers,rid,_=await self.room(server,6,2)
        previous=[]
        for match in range(3):
            v=await self.start(players,rid)
            self.assertNotIn(v['match']['match_id'],previous); previous.append(v['match']['match_id'])
            end=await self.round(server,players,rid,['SelfBi']*6)
            self.assertEqual(end['match']['last_turn']['effective_transition']['kind'],'nobody_survives')
            snapshots=[await c.sync(rid) for c in players+viewers]
            self.assertTrue(all(x['match']==end['match'] for x in snapshots))
            self.assertEqual(len({c.view['seq'] for c in players+viewers}),1)
            self.assertTrue(all(x['self']['options']==[] for x in snapshots))
            await server.advance_ms(1500)
            self.assertEqual((await players[0].sync(rid))['phase'],'result')
            self.ok(await players[0].command('room.return_lobby',dict(room_id=rid)))
            v=await players[0].sync(rid)
            self.assertFalse(any(m['ready'] for m in v['members']))
            self.assertEqual(sum(m['role']=='spectator' for m in v['members']),2)
            print(f'LOOPBACK N36 match={match+1} players=6 spectators=2 outcome=nobody_survives consistent=true')

    async def test_N31_isolated_rooms_and_departed_authority(self):
        server=await self.server()
        a,_,rid,code=await self.room(server,3)
        b,_,other,_=await self.room(server,2)
        va,vb=await asyncio.gather(self.start(a,rid),self.start(b,other))
        await asyncio.gather(a[0].submit(rid,va,'Charge'),b[0].submit(other,vb,'Def'))
        self.error(await a[1].command('room.sync',dict(room_id=other)),'ROOM_NOT_MEMBER')
        self.ok(await a[2].command('room.leave',dict(room_id=rid)))
        self.ok(await a[2].command('room.join',dict(room_code=(await b[0].sync(other))['room_code'],password=None,role='spectator')))
        a[2].messages.clear()
        self.ok(await a[1].submit(rid,va,'Charge'))
        await server.advance_ms(12000)
        await a[2].sync(other)
        self.assertTrue(all(m.get('room_id')!=rid for m in a[2].messages))
        self.assertEqual((await b[0].sync(other))['match']['public_state']['match_id'],vb['match']['match_id'])

    async def test_N33_rate_limits_origin_path_and_protocol(self):
        server=await self.server()
        for kwargs,url in [({'origin':'https://example.org'},server.url),({},server.url.replace('/rooms-v1','/wrong')),({'subprotocols':['other']},server.url)]:
            with self.assertRaises(InvalidStatus):
                ws=await connect(url,proxy=None,**({'subprotocols':['deidei.rooms.v1']}|kwargs))
                await ws.close()
        c=await self.client(server)
        for index in range(48):
            await c.ws.send(json.dumps(c.intent('room.sync',{'room_id':str(uuid4())})))
            if index % 4 == 3:
                await asyncio.sleep(.01)  # drain writers while still exceeding 20 commands/second
        replies=[]
        with suppress_closed():
            for _ in range(50):
                reply=json.loads(await asyncio.wait_for(c.ws.recv(),3))
                replies.append(reply)
                if reply.get('error',{}).get('code')=='RATE_LIMITED':
                    break
        self.assertTrue(any(r.get('error',{}).get('code')=='RATE_LIMITED' for r in replies))
        self.assertNotIn('Traceback',json.dumps(replies))

    async def test_N34_C065_reward_consumed_replay_no_second_grant(self):
        server=await self.server()
        players,_,rid,_=await self.room(server)
        await self.start(players,rid)
        for entries in [('ZengYi','Def'),(None,'Def'),('Def','Def'),('Def','Def'),('Def','Def')]:
            v=await players[0].sync(rid)
            replay=None
            for c,e in zip(players,entries):
                if e is not None:
                    msg=c.intent('room.submit',dict(room_id=rid,match_id=v['match']['match_id'],turn_id=v['match']['turn_id'],entry_id=e))
                    response=await c.send(msg); self.ok(response)
                    if c is players[0]: replay=(msg,response)
            await server.advance_ms(300)
            await server.advance_ms(1500)
        v=await players[0].sync(rid)
        pid=players[0].identity['player_id']
        self.assertEqual(v['match']['public_state']['players'][pid]['zeng_state'],'ready')
        self.ok(await players[0].submit(rid,v,'ZengRewardBigBi'))
        self.ok(await players[1].submit(rid,v,'Cloud'))
        await server.advance_ms(300)
        before=(await players[0].sync(rid))['match']['last_turn']
        self.assertEqual(before['effective_state']['players'][pid]['zeng_state'],'spent')
        self.assertEqual(await players[0].send(replay[0]),replay[1])
        self.assertEqual((await players[0].sync(rid))['match']['last_turn'],before)

    async def test_N36_real_clock_timeout(self):
        server=await self.server(clock=None,policy={'turn_ms':5000,'early_reveal':False},timeout_chooser=lambda s,o:'Charge')
        players,_,rid,_=await self.room(server)
        await self.start(players,rid)
        await asyncio.sleep(5.05)
        end=await players[0].sync(rid)
        self.assertEqual(end['phase'],'revealing')
        self.assertEqual(set(end['match']['last_turn']['action_sources'].values()),{'timeout_auto'})
        for pid,p in end['match']['last_turn']['effective_state']['players'].items():
            self.assertEqual(p['dd6'],'6')
        with self.assertRaises(ValueError): await server.advance_ms(1)


class suppress_closed:
    def __enter__(self): return self
    def __exit__(self,kind,value,tb): return kind is not None and issubclass(kind,ConnectionClosed)


class Boundaries(unittest.TestCase):
    def test_schema_and_policy_reject_unknown_boolean_depth(self):
        for p in ({'turn_ms':True},{'spectator_cap':13},{'seed':4},{'reveal_ms':1},{'host_disconnect_grace_ms':1}):
            with self.assertRaises(Rejected): policy(p)
        for p in ({'turn_ms':5000,'spectator_cap':0},{'turn_ms':30000,'spectator_cap':12,'host_disconnect_grace_ms':60000}):
            self.assertEqual(policy(p)|p,policy(p))
        for raw in ('{"x":Infinity}', '{"x":1,"x":2}', '['*14+'0'+']'*14):
            with self.assertRaises(Rejected): parse(raw)
        c=dict(v=1,type='command',request_id=str(uuid4()),command_seq=True,op='room.sync',payload={'room_id':'room'})
        with self.assertRaises(Rejected): validate(c)


if __name__=='__main__':
    unittest.main()
