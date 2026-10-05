"""Security and lifecycle regressions that complement the room scenario tests."""
import asyncio
from copy import deepcopy
import json
from unittest.mock import patch
from random import Random
from uuid import uuid4

from deidei_server.protocol import ack, DEFAULT_POLICY
from deidei_server.room import public_resolution
from deidei_server.server import Connection, RoomServer
from deidei_core.api import new_match, resolve_round
from test_rooms import SocketCase, Client, funded


class SecurityLifecycle(SocketCase):
    async def test_policy_limits_and_room_copy(self):
        for turn,cap,grace in ((5000,0,0),(12000,6,30000),(30000,12,60000)):
            s=await self.server(policy={'turn_ms':turn,'spectator_cap':cap,'host_disconnect_grace_ms':grace})
            players,_,rid,code=await self.room(s)
            self.assertEqual(players[0].hello['capabilities']['spectator_max'],cap)
            v=await players[0].sync(rid)
            self.assertEqual(v['policy']['turn_ms'],turn)
            self.assertEqual(v['policy']['host_disconnect_grace_ms'],grace)
            c=await self.client(s)
            if cap==0:
                self.error(await c.command('room.join',dict(room_code=code,password=None,role='spectator')),'SPECTATORS_DISABLED')
            s.service.policy['turn_ms']=8000
            self.assertEqual((await players[0].sync(rid))['policy']['turn_ms'],turn)

    async def test_tombstone_idle_session_expiry_and_no_code_reuse(self):
        s=await self.server()
        players,_,rid,code=await self.room(s)
        self.ok(await players[0].command('room.leave',dict(room_id=rid)))
        self.assertEqual((await players[1].sync(rid))['close_reason'],'HOST_LEFT')
        await s.advance_ms(60000)
        self.error(await players[1].command('room.sync',dict(room_id=rid)),'ROOM_GONE')
        new=self.ok(await players[0].command('room.create',dict(password=None,options=dict(turn_ms=12000,early_reveal=True,spectator_cap=6))))
        self.assertNotEqual(code,new['room_code'])
        idle=await self.client(s)
        identity=idle.identity
        await idle.ws.close()
        await s.advance_ms(600000)
        c,reply=await Client.open(s.url,identity); self.clients.append(c)
        self.error(reply,'SESSION_EXPIRED')
        await s.advance_ms(7200000)
        self.assertEqual((await players[0].sync(new['room_id']))['close_reason'],'ROOM_IDLE')

    async def test_import_clock_negative_and_cli_no_backdoor(self):
        s=await self.server()
        with self.assertRaises(ValueError): await s.advance_ms(-1)
        with self.assertRaises(ValueError): await s.advance_ms(True)
        for op in ('set_state','exec','seed'):
            c=await self.client(s)
            self.error(await c.command(op,{}),'INVALID_MESSAGE')
        with self.assertRaises(ValueError):
            await s.service.start('0.0.0.0',0)

    async def test_closed_room_on_invalid_core_output(self):
        s=await self.server()
        players,_,rid,_=await self.room(s)
        v=await self.start(players,rid)
        for c in players: self.ok(await c.submit(rid,v,'Charge'))
        with patch('deidei_server.room.resolve_round',return_value={'ok':False,'error':{'code':'SYNTHETIC'}}):
            await s.advance_ms(300)
        end=await players[0].sync(rid)
        self.assertEqual(end['close_reason'],'INTERNAL_ERROR')
        self.assertIsNone(end['match']['last_turn'])
        self.assertIsNone(end['match']['effective_outcome'])

    async def test_N23_core_restart_and_departing_survivor(self):
        s=await self.server(new_match_factory=funded)
        players,_,rid,_=await self.room(s,4)
        v=await self.start(players,rid)
        for c,e in zip(players,('Bi','Bi','Charge','Bi')):
            self.ok(await c.submit(rid,v,e))
        self.ok(await players[3].command('room.leave',dict(room_id=rid)))
        await s.advance_ms(300)
        end=await players[0].sync(rid)
        r=end['match']['last_turn']
        self.assertEqual(r['core_resolution']['next_state']['game_index'],'2')
        self.assertEqual(len(r['core_resolution']['next_state']['active_ids']),3)
        self.assertEqual(r['effective_state']['game_index'],'2')
        self.assertEqual(len(r['effective_state']['active_ids']),2)
        for pid in r['effective_state']['active_ids']:
            self.assertEqual(r['effective_state']['players'][pid]['dd6'],'0')
        # A naturally eliminated player leaving during reveal must be removed now.
        self.ok(await players[2].command('room.leave',dict(room_id=rid)))
        self.assertNotIn(players[2].identity['player_id'],s.service.rooms[rid].members)
        self.assertEqual((await players[0].sync(rid))['match']['last_turn'],r)

    async def test_N20_online_recovery_keeps_prior_absence(self):
        s=await self.server(timeout_chooser=lambda state,options:'ZengYi')
        players,_,rid,_=await self.room(s)
        v=await self.start(players,rid)
        self.ok(await players[0].submit(rid,v,'Def'))
        await s.advance_ms(12000)
        await s.advance_ms(1500)
        v=await players[0].sync(rid)
        self.ok(await players[0].submit(rid,v,'Def'))
        await s.advance_ms(300)
        end=await players[0].sync(rid)
        guest=next(m for m in end['members'] if m['player_id']==players[1].identity['player_id'])
        self.assertEqual(guest['absence_count'],1)
        self.assertEqual(end['match']['last_turn']['action_sources'][guest['player_id']],'forced')

    async def test_N27_reveal_continues_and_departure_while_host_offline(self):
        # ARC1.1 removes pause: a host disconnect must not extend an existing reveal.
        s=await self.server()
        players,_,rid,_=await self.room(s,3)
        await self.start(players,rid)
        end=await self.round(s,players,rid,['Charge']*3)
        original=deepcopy(end['match']['last_turn'])
        await s.advance_ms(500)
        await players[0].ws.close(); await s.drain()
        self.ok(await players[2].command('room.leave',dict(room_id=rid)))
        await s.advance_ms(700)
        host=await self.client(s,players[0].identity)
        resumed=await host.sync(rid)
        self.assertEqual(resumed['phase'],'revealing')
        self.assertEqual(resumed['timer']['remaining_ms'],300)
        self.assertEqual(resumed['match']['last_turn'],original)
        await s.advance_ms(300)
        self.assertEqual((await host.sync(rid))['phase'],'selecting')

    async def test_N25_result_leave_keeps_published_winner(self):
        s=await self.server(new_match_factory=funded)
        players,_,rid,_=await self.room(s)
        await self.start(players,rid)
        end=await self.round(s,players,rid,['Charge','Bi'])
        winner=players[1].identity['player_id']
        self.assertEqual(end['match']['last_turn']['effective_transition']['winner_id'],winner)
        self.ok(await players[1].command('room.leave',dict(room_id=rid)))
        self.assertEqual((await players[0].sync(rid))['match']['last_turn'],end['match']['last_turn'])
        await s.advance_ms(1500)
        self.assertEqual((await players[0].sync(rid))['match']['effective_outcome']['winner_id'],winner)

    async def test_N31_bounded_slow_writer_does_not_block_room(self):
        s=await self.server()
        players,viewers,rid,_=await self.room(s,2,1)
        observer=next(c for c in s.service.connections if c.session.player_id==viewers[0].identity['player_id'])
        blocked=asyncio.Event()
        original_send=observer.ws.send
        async def slow_send(message):
            await blocked.wait()
            await original_send(message)
        observer.ws.send=slow_send  # simulate a congested transport, retain real socket peers
        observer.put(ack(str(uuid4()),{}))
        await s.drain()
        for _ in range(33): observer.put(ack(str(uuid4()),{}))
        self.assertTrue(observer.closing)
        self.assertLessEqual(len(observer.queue),32)
        v=await self.start(players,rid)
        for c in players: self.ok(await c.submit(rid,v,'Charge'))
        await s.advance_ms(300)
        self.assertEqual((await players[0].sync(rid))['phase'],'revealing')
        blocked.set()

    async def test_snapshot_coalescing_and_byte_ceiling(self):
        s=await self.server()
        players,_,rid,_=await self.room(s)
        c=next(c for c in s.service.connections if c.session.player_id==players[0].identity['player_id'])
        await s.drain()
        c.queue.clear(); c.queued_bytes=0
        view=s.service.rooms[rid].snapshot(c.session,s.clock.now_ms())
        for n in range(50): c.put(dict(view,seq=str(n)))
        self.assertEqual(len(c.queue),1)
        self.assertEqual(json.loads(c.queue[0][0])['seq'],'49')
        c.put(ack(str(uuid4()),{'synthetic':'x'*(2*1024*1024)}))
        self.assertTrue(c.closing)
        self.assertLessEqual(c.queued_bytes,2*1024*1024)

    async def test_snapshot_size_terminates_only_affected_room(self):
        s=await self.server()
        a,_,rid,_=await self.room(s)
        b,_,other,_=await self.room(s)
        room=s.service.rooms[rid]
        original=room.snapshot
        def oversized(session,now):
            v=original(session,now)
            if room.phase!='closed': v['view']['match']={'synthetic':'x'*(1024*1024)}
            return v
        room.snapshot=oversized
        v=await a[0].sync(rid)
        self.assertEqual(v['close_reason'],'ROOM_STATE_TOO_LARGE')
        self.assertEqual((await b[0].sync(other))['phase'],'lobby')

    async def test_join_failure_limit_and_service_capacity(self):
        s=await self.server()
        players,_,rid,code=await self.room(s,password='test-only')
        c=await self.client(s)
        for _ in range(10):
            self.error(await c.command('room.join',dict(room_code=code,password='wrong',role='player')),'ROOM_ACCESS_DENIED')
        self.error(await c.command('room.join',dict(room_code=code,password='test-only',role='player')),'RATE_LIMITED')
        await s.advance_ms(60000)
        self.ok(await c.command('room.join',dict(room_code=code,password='test-only',role='player')))
        # Capacity check uses the same registry; fill it with distinct synthetic room records.
        room=s.service.rooms[rid]
        for n in range(63): s.service.rooms['capacity-'+str(n)]=room
        outsider=await self.client(s)
        self.error(await outsider.command('room.create',dict(password=None,options=dict(turn_ms=12000,early_reveal=True,spectator_cap=6))),'SERVER_BUSY')
        for n in range(63): del s.service.rooms['capacity-'+str(n)]

    async def test_password_absent_from_cache_and_rng_streams_separate(self):
        s=await self.server(rng=Random(37))
        players,_,rid,_=await self.room(s,password='synthetic-private-password')
        session=next(v for v in s.service.sessions.values() if v.player_id==players[0].identity['player_id'])
        self.assertNotIn('synthetic-private-password',repr(session.cache))
        self.assertTrue(all(isinstance(fingerprint,bytes) for fingerprint,result in session.cache.values()))
        other=await self.server(rng=Random(37))
        for _ in range(100): s.service.rng.randrange(33)
        self.assertEqual([s.service.token_rng.randrange(2) for _ in range(20)],
                         [other.service.token_rng.randrange(2) for _ in range(20)])

    async def test_future_core_private_fields_never_projected(self):
        state=new_match(['a','b'],'synthetic')
        result=resolve_round(state,{'a':'Charge','b':'Charge'}, {})
        result['next_state']['private']='private-sentinel'
        result['next_state']['players']['a']['private']='private-sentinel'
        result['ledger']['actions']['a']['private']='private-sentinel'
        result['ledger']['actions']['a']['spend']['private']='private-sentinel'
        result['ledger']['post_turn_players']['a']['private']='private-sentinel'
        result['ledger']['events'][0]['private']='private-sentinel'
        self.assertNotIn('private-sentinel',json.dumps(public_resolution(result)))

    async def test_restart_preserves_absence_and_multiplayer_mode(self):
        s=await self.server()
        players,_,rid,_=await self.room(s,3)
        v=await self.start(players,rid)
        self.ok(await players[0].submit(rid,v,'Def'))
        self.ok(await players[2].submit(rid,v,'SelfBi'))
        await s.advance_ms(12000)
        end=await players[0].sync(rid)
        guest_id=players[1].identity['player_id']
        self.assertEqual(end['match']['last_turn']['effective_state']['game_index'],'2')
        self.assertEqual(next(m for m in end['members'] if m['player_id']==guest_id)['absence_count'],1)
        await s.advance_ms(1500)
        v=await players[0].sync(rid)
        self.assertEqual(v['match']['mode_at_start'],'multiplayer')
        self.assertEqual(next(m for m in v['members'] if m['player_id']==guest_id)['absence_count'],1)
        self.ok(await players[0].submit(rid,v,'Def'))
        await s.advance_ms(12000)
        end=await players[0].sync(rid)
        self.assertEqual(end['match']['last_turn']['core_resolution']['ledger']['actions'][guest_id]['entry_id'],'Charge')
        self.assertEqual(next(m for m in end['members'] if m['player_id']==guest_id)['absence_count'],2)

    async def test_disconnected_active_player_not_kicked_at_thirty_seconds(self):
        s=await self.server()
        players,_,rid,_=await self.room(s,3)
        await self.start(players,rid)
        await players[1].ws.close(); await s.drain()
        for _ in range(2):
            v=await players[0].sync(rid)
            for c in (players[0],players[2]): self.ok(await c.submit(rid,v,'Charge'))
            await s.advance_ms(13500)
        await s.advance_ms(3000)
        v=await players[0].sync(rid)
        guest_id=players[1].identity['player_id']
        self.assertEqual(next(m for m in v['members'] if m['player_id']==guest_id)['absence_count'],2)
        for c in (players[0],players[2]): self.ok(await c.submit(rid,v,'Charge'))
        await s.advance_ms(9000)
        end=await players[0].sync(rid)
        self.assertNotIn(guest_id,[m['player_id'] for m in end['members']])
        self.assertEqual(end['match']['last_turn']['room_forfeits'],[dict(player_id=guest_id,reason='three_absences')])
