"""NET1.1/P19–P24 regressions; real loopback sockets and hand-written expectations."""
import asyncio
from copy import deepcopy
import json
from unittest.mock import patch
from uuid import uuid4

from deidei_core.api import new_match, resolve_round
from deidei_server.protocol import DEFAULT_POLICY, Rejected, ack
from test_rooms import SocketCase, Client, funded


class Rooms11(SocketCase):
    async def server(self, **kwargs):
        kwargs['policy'] = {'turn_ms': 10000} | kwargs.get('policy', {})
        return await super().server(**kwargs)

    async def change(self, client, rid, ms, revision):
        return await client.command('room.set_turn_limit', dict(room_id=rid,turn_ms=ms,expected_policy_revision=revision))

    async def event(self, client):
        while True:
            value=json.loads(await asyncio.wait_for(client.ws.recv(),3))
            client.messages.append(value)
            if value['type']=='membership.ended':
                return value

    async def test_N37_default_and_protocol(self):
        s=await self.server()
        players,_,rid,_=await self.room(s)
        hello=players[0].hello
        self.assertEqual(hello['protocol'],'rooms-1.1')
        self.assertEqual(hello['policy_defaults']['turn_ms'],10000)
        self.assertEqual(hello['capabilities']['allowed_turn_ms'],[5000,8000,10000,12000,20000,30000])
        v=await self.start(players,rid)
        self.assertEqual(v['policy_revision'],'1')
        self.assertEqual(v['current_turn_ms'],10000)
        self.assertEqual(v['timer']['remaining_ms'],10000)
        self.assertIsNone(v['host_recovery'])
        self.assertIsNone(v['pending_close'])
        self.assertEqual(set(v['policy']),set(DEFAULT_POLICY))

    async def test_N38_N39_change_only_next_select_revision_and_noop(self):
        s=await self.server()
        players,viewers,rid,_=await self.room(s,spectators=1)
        v=await self.start(players,rid)
        room=s.service.rooms[rid]
        before=(room.deadline,deepcopy(room.tokens))
        self.ok(await players[1].submit(rid,v,'Charge'))
        payload=dict(room_id=rid,turn_ms=5000,expected_policy_revision='1')
        msg=players[0].intent('room.set_turn_limit',payload)
        response=await players[0].send(msg)
        self.assertEqual(self.ok(response),dict(room_id=rid,turn_ms=5000,policy_revision='2',effective_from='next_select'))
        self.assertEqual((room.deadline,room.tokens),before)
        for c in players+viewers:
            v=await c.sync(rid)
            self.assertEqual((v['current_turn_ms'],v['policy']['turn_ms'],v['policy_revision']),(10000,5000,'2'))
        self.assertEqual(await players[0].send(msg),response)
        self.assertEqual(room.policy_revision,2)
        self.error(await self.change(players[1],rid,30000,'2'),'NOT_HOST')
        self.error(await self.change(players[0],rid,30000,'1'),'POLICY_STALE')
        seq=room.seq
        wire=next(c for c in s.service.connections if c.session.player_id==players[0].identity['player_id'])
        with patch.object(wire,'put',wraps=wire.put) as put:
            self.ok(await self.change(players[0],rid,5000,'2'))
            self.assertFalse(any(call.args[0]['type']=='snapshot' for call in put.call_args_list))
        self.assertEqual(room.seq,seq)
        self.ok(await players[0].submit(rid,v,'Charge'))
        await s.advance_ms(1800)
        v=await players[0].sync(rid)
        self.assertEqual((v['current_turn_ms'],v['timer']['remaining_ms']),(5000,5000))
        old_deadline=room.deadline
        self.ok(await self.change(players[0],rid,30000,'2'))
        self.assertEqual(room.deadline,old_deadline)
        await s.advance_ms(6500)
        v=await players[0].sync(rid)
        self.assertEqual((v['current_turn_ms'],v['policy_revision']),(30000,'3'))

    async def test_N39_deadline_wins_and_all_phases(self):
        s=await self.server()
        players,_,rid,_=await self.room(s,options={'early_reveal':False})
        self.ok(await self.change(players[0],rid,5000,'1'))
        v=await self.start(players,rid)
        self.assertEqual(v['current_turn_ms'],5000)
        s.clock.advance_ms(5000)
        with patch('deidei_server.room.resolve_round',wraps=resolve_round) as resolver:
            self.ok(await self.change(players[0],rid,30000,'2'))
            self.assertEqual(resolver.call_count,1)
        v=await players[0].sync(rid)
        self.assertEqual((v['phase'],v['current_turn_ms'],v['policy']['turn_ms']),('revealing',5000,30000))
        self.ok(await self.change(players[0],rid,8000,'3'))
        await s.advance_ms(1500)
        v=await players[0].sync(rid)
        self.assertEqual(v['current_turn_ms'],8000)
        for c in players:self.ok(await c.submit(rid,v,'SelfBi'))
        await s.advance_ms(9500)
        self.assertEqual((await players[0].sync(rid))['phase'],'result')
        self.ok(await self.change(players[0],rid,12000,'4'))
        self.ok(await players[0].command('room.return_lobby',dict(room_id=rid)))
        self.assertEqual((await self.start(players,rid))['current_turn_ms'],12000)

    async def test_N40_fourth_host_absence_never_calls_core(self):
        for disconnected in (False,True):
            s=await self.server(timeout_chooser=lambda state,options:'Def')
            players,_,rid,_=await self.room(s)
            await self.start(players,rid)
            host_id=players[0].identity['player_id']
            if disconnected:
                await players[0].ws.close(); await s.drain()
            with patch('deidei_server.room.resolve_round',wraps=resolve_round) as resolver:
                previous=None
                for n in range(1,5):
                    v=await players[1].sync(rid)
                    self.ok(await players[1].submit(rid,v,'Def'))
                    await s.advance_ms(10000)
                    end=await players[1].sync(rid)
                    if n<4:
                        self.assertEqual(resolver.call_count,n)
                        self.assertEqual(end['match']['last_turn']['core_resolution']['ledger']['actions'][host_id]['entry_id'],'Charge')
                        self.assertEqual(end['host_recovery']['missing_count'],n)
                        previous=deepcopy(end['match']['last_turn'])
                        await s.advance_ms(1500)
                    else:
                        self.assertEqual(resolver.call_count,3)
                        self.assertEqual(end['close_reason'],'HOST_ABSENT')
                        self.assertEqual(end['match']['last_turn'],previous)
                        self.assertIsNone(end['match']['effective_outcome'])
                        self.assertEqual(next(m for m in end['members'] if m['player_id']==host_id)['absence_count'],4)

    async def test_N41_host_accepted_resume_and_manual_reset(self):
        s=await self.server()
        players,_,rid,_=await self.room(s)
        v=await self.start(players,rid)
        self.ok(await players[0].submit(rid,v,'Def'))
        await players[0].ws.close(); await s.drain()
        self.ok(await players[1].submit(rid,v,'Def'))
        await s.advance_ms(1800)
        v=await players[1].sync(rid)
        self.ok(await players[1].submit(rid,v,'Def'))
        await s.advance_ms(10000)
        await s.advance_ms(1500)
        host=await self.client(s,players[0].identity)
        v=await host.sync(rid)
        self.assertEqual(v['host_recovery']['missing_count'],1)
        self.ok(await host.submit(rid,v,'Charge'))
        self.assertIsNone((await host.sync(rid))['host_recovery'])

    async def test_N41_forced_host_online_offline_and_fourth(self):
        for offline in (False,True):
            s=await self.server()
            players,_,rid,_=await self.room(s)
            v=await self.start(players,rid)
            for c,e in zip(players,('ZengYi','Def')): self.ok(await c.submit(rid,v,e))
            await s.advance_ms(1800)
            v=await players[1].sync(rid)
            if offline:
                await players[0].ws.close(); await s.drain()
            self.ok(await players[1].submit(rid,v,'Def'))
            await s.advance_ms(300)
            end=await players[1].sync(rid)
            host_id=players[0].identity['player_id']
            self.assertTrue(end['match']['last_turn']['core_resolution']['ledger']['actions'][host_id]['is_recovery'])
            self.assertEqual(next(m for m in end['members'] if m['player_id']==host_id)['absence_count'],int(offline))
        # Inject only via the documented test new_match factory; no network state command exists.
        def recovery(ids,mid):
            state=new_match(ids,mid); state['turn_index']='2'
            for p in state['players'].values():p.update(zeng_state='recovery',last_actual_move='ZengYi')
            return state
        s=await self.server(new_match_factory=recovery)
        players,_,rid,_=await self.room(s)
        await self.start(players,rid)
        room=s.service.rooms[rid]
        room.members[players[0].identity['player_id']]['absence_count']=3
        await players[0].ws.close(); await s.drain()
        with patch('deidei_server.room.resolve_round',wraps=resolve_round) as resolver:
            await s.advance_ms(300)
            self.assertEqual(resolver.call_count,0)
        self.assertEqual((await players[1].sync(rid))['close_reason'],'HOST_ABSENT')

    async def test_N42_eliminated_host_grace_and_other_game_continues(self):
        s=await self.server(new_match_factory=funded)
        players,_,rid,_=await self.room(s,3)
        v=await self.start(players,rid)
        await players[0].ws.close(); await s.drain()
        for c in players[1:]:self.ok(await c.submit(rid,v,'Bi'))
        await s.advance_ms(10000)
        end=await players[1].sync(rid)
        self.assertEqual(end['host_recovery']['kind'],'grace')
        self.assertEqual(end['host_recovery']['remaining_ms'],30000)
        host=next(m for m in end['members'] if m['player_id']==players[0].identity['player_id'])
        self.assertEqual(host['participation'],'eliminated')
        deadline=end['host_recovery']['deadline_at_ms']
        await s.advance_ms(1500)
        for _ in range(2):
            v=await players[1].sync(rid)
            for c in players[1:]:self.ok(await c.submit(rid,v,'Def'))
            await s.advance_ms(1800)
        end=await players[1].sync(rid)
        self.assertEqual(end['host_recovery']['deadline_at_ms'],deadline)
        self.assertEqual(end['host_recovery']['remaining_ms'],24900)
        host=await self.client(s,players[0].identity)
        self.assertIsNone((await host.sync(rid))['host_recovery'])
        self.ok(await self.change(host,rid,5000,'1'))
        await host.ws.close(); await s.drain()
        deadline=(await players[1].sync(rid))['host_recovery']['deadline_at_ms']
        # Keep other players active until the host's administrative deadline.
        for _ in range(16):
            v=await players[1].sync(rid)
            if v['phase']=='closed':break
            for c in players[1:]:self.ok(await c.submit(rid,v,'Def'))
            await s.advance_ms(1800)
        await s.advance_ms(max(0,deadline-s.clock.wall_ms()))
        self.assertEqual((await players[1].sync(rid))['close_reason'],'HOST_TIMEOUT')

    async def test_N42_result_host_grace_starts_at_result_transition(self):
        s=await self.server(new_match_factory=funded)
        players,_,rid,_=await self.room(s)
        v=await self.start(players,rid)
        self.ok(await players[0].submit(rid,v,'Bi'))
        self.ok(await players[1].submit(rid,v,'Charge'))
        await players[0].ws.close(); await s.drain()
        await s.advance_ms(1800)
        v=await players[1].sync(rid)
        self.assertEqual(v['phase'],'result')
        self.assertEqual(v['host_recovery']['remaining_ms'],30000)
        await s.advance_ms(30000)
        self.assertEqual((await players[1].sync(rid))['close_reason'],'HOST_TIMEOUT')

    async def test_N43_host_leave_both_policies_select_reveal_and_lobby(self):
        for timing in ('after_turn','immediate'):
            for phase in ('selecting','revealing','lobby','result'):
                s=await self.server(host_leave_timing=timing)
                players,_,rid,code=await self.room(s)
                if phase!='lobby':
                    v=await self.start(players,rid)
                    if phase in ('revealing','result'):
                        for c in players:self.ok(await c.submit(rid,v,'SelfBi' if phase=='result' else 'Charge'))
                        await s.advance_ms(1800 if phase=='result' else 300)
                before=deepcopy((await players[1].sync(rid))['match'])
                with patch('deidei_server.room.resolve_round',wraps=resolve_round) as resolver:
                    self.ok(await players[0].command('room.leave',dict(room_id=rid)))
                    v=await players[1].sync(rid)
                    deferred=timing=='after_turn' and phase in ('selecting','revealing')
                    if deferred:
                        self.assertEqual(v['pending_close']['after'],'current_turn' if phase=='selecting' else 'current_reveal')
                        newcomer=await self.client(s)
                        self.error(await newcomer.command('room.join',dict(room_code=code,password=None,role='spectator')),'ROOM_CLOSING')
                        if phase=='selecting':self.ok(await players[1].submit(rid,v,'Charge'))
                        await s.advance_ms(10000 if phase=='selecting' else 1500)
                        v=await players[1].sync(rid)
                    self.assertEqual(v['close_reason'],'HOST_LEFT')
                    self.assertEqual(resolver.call_count,int(deferred and phase=='selecting'))
                    if phase=='result':
                        self.assertEqual(v['match']['effective_outcome'],before['effective_outcome'])
                    elif v['match']:
                        self.assertIsNone(v['match']['effective_outcome'])
                    if phase=='revealing':self.assertEqual(v['match']['last_turn'],before['last_turn'])
                    if deferred and phase=='selecting':
                        self.assertEqual(v['match']['last_turn']['core_resolution']['ledger']['actions'][players[0].identity['player_id']]['entry_id'],'Charge')

    async def test_N44_forfeit_result_to_game_id(self):
        for count in (2,3,4):
            s=await self.server()
            players,_,rid,_=await self.room(s,count)
            v=await self.start(players,rid)
            for c in players:self.ok(await c.submit(rid,v,'Charge'))
            for c in players[2:] or players[1:]:self.ok(await c.command('room.leave',dict(room_id=rid)))
            await s.advance_ms(300)
            result=(await players[0].sync(rid))['match']['last_turn']
            self.assertEqual(result['effective_transition']['to_game_id'],result['effective_state']['game_id'])
            self.assertEqual(result['core_resolution']['ledger']['kills'],{c.identity['player_id']:[] for c in players})

    async def test_N45_online_event_no_command_then_resume_same_receipt(self):
        s=await self.server()
        players,_,rid,_=await self.room(s,3)
        await self.start(players,rid)
        for n in range(3):
            v=await players[0].sync(rid)
            for c in (players[0],players[2]):self.ok(await c.submit(rid,v,'Def'))
            await s.advance_ms(10000)
            if n<2:await s.advance_ms(1500)
        notice=await self.event(players[1])
        self.assertEqual(set(notice),{'v','type','event_id','room_id','player_id','seq','server_time_ms','reason'})
        self.assertEqual((notice['room_id'],notice['player_id'],notice['reason']),(rid,players[1].identity['player_id'],'three_absences'))
        await players[1].ws.close();await s.drain()
        resumed=await self.client(s,players[1].identity)
        self.assertEqual(await self.event(resumed),notice)
        self.error(await resumed.command('room.sync',dict(room_id=rid)),'ROOM_NOT_MEMBER')

    async def test_N45_offline_grace_notice_for_all_nonactive_roles(self):
        for role in ('lobby','spectating','eliminated','result'):
            s=await self.server(new_match_factory=funded)
            players,viewers,rid,_=await self.room(s,3,1)
            target=viewers[0] if role=='spectating' else players[1]
            if role in ('eliminated','result'):
                v=await self.start(players,rid)
                for c,e in zip(players,('Bi','Charge','Bi' if role=='eliminated' else 'Charge')):
                    self.ok(await c.submit(rid,v,e))
                await s.advance_ms(1800)
            await target.ws.close();await s.drain()
            # Room remains usable; isolated public state is enough for this membership-grace check.
            if role=='eliminated':
                for _ in range(17):
                    v=await players[0].sync(rid)
                    for c in (players[0],players[2]):self.ok(await c.submit(rid,v,'Def'))
                    await s.advance_ms(1800)
            else:await s.advance_ms(30000)
            resumed=await self.client(s,target.identity)
            notice=await self.event(resumed)
            self.assertEqual(notice['reason'],'disconnect_grace_expired')
            self.assertNotIn(target.identity['player_id'],[m['player_id'] for m in (await players[0].sync(rid))['members']])

    async def test_N46_receipt_and_old_ack_do_not_restore_old_room(self):
        s=await self.server()
        players,_,rid,_=await self.room(s,3)
        v=await self.start(players,rid)
        old=players[1].intent('room.submit',dict(room_id=rid,match_id=v['match']['match_id'],turn_id=v['match']['turn_id'],entry_id='Charge'))
        original=await players[1].send(old);self.ok(original)
        for c in (players[0],players[2]):self.ok(await c.submit(rid,v,'Def'))
        await s.advance_ms(1800)
        for n in range(3):
            v=await players[0].sync(rid)
            for c in (players[0],players[2]):self.ok(await c.submit(rid,v,'Def'))
            await s.advance_ms(10000)
            if n<2:await s.advance_ms(1500)
        self.assertEqual((await self.event(players[1]))['reason'],'three_absences')
        created=self.ok(await players[1].command('room.create',dict(password=None,options=dict(turn_ms=10000,early_reveal=True,spectator_cap=6))))
        new_id=created['room_id']
        self.assertEqual(await players[1].send(old),original)
        self.assertEqual((await players[1].sync(new_id))['self']['options'],[])
        session=s.service.by_player[players[1].identity['player_id']]
        self.assertIsNone(session.last_membership_end)
        self.assertEqual(session.room_id,new_id)
        self.error(await players[1].command('room.sync',dict(room_id=rid)),'ROOM_NOT_MEMBER')

    async def test_N47_invalid_uuid_and_role_errors(self):
        s=await self.server()
        players,viewers,rid,_=await self.room(s,spectators=1)
        for role in ('player','spectator'):
            self.error(await players[0].command('room.role',dict(room_id=rid,role=role)),'HOST_ROLE_FIXED')
        self.error(await viewers[0].command('room.ready',dict(room_id=rid,ready=True)),'NOT_ACTIVE')
        for raw in ('{','{"request_id":"not-uuid"}','{"v":1,"v":2}'):
            c=await self.client(s);await c.ws.send(raw)
            result=json.loads(await c.ws.recv())
            self.assertEqual(result,ack(None,error=Rejected('INVALID_MESSAGE')))
        self.ok(await players[0].command('room.sync',dict(room_id=rid)))

    async def test_N48_six_players_two_spectators_three_matches_dynamic_timeout(self):
        s=await self.server()
        players,viewers,rid,_=await self.room(s,6,2)
        host_id=players[0].identity['player_id']
        revision=1
        for n in range(3):
            v=await self.start(players,rid)
            ms=(5000,30000,8000)[n]
            self.ok(await self.change(players[0],rid,ms,str(revision)));revision+=1
            await players[0].ws.close();await s.drain()
            for c in players[1:]:self.ok(await c.submit(rid,v,'Def'))
            await s.advance_ms(v['current_turn_ms'])
            end=await players[1].sync(rid)
            self.assertEqual(end['match']['last_turn']['core_resolution']['ledger']['actions'][host_id]['entry_id'],'Charge')
            players[0]=await self.client(s,players[0].identity)
            await s.advance_ms(1500)
            v=await players[0].sync(rid)
            self.assertEqual(v['current_turn_ms'],ms)
            for c in players:self.ok(await c.submit(rid,v,'SelfBi'))
            await s.advance_ms(300)
            snapshots=[await c.sync(rid) for c in players+viewers]
            self.assertTrue(all(x['match']==snapshots[0]['match'] for x in snapshots))
            self.assertEqual(snapshots[0]['match']['last_turn']['effective_transition']['kind'],'nobody_survives')
            self.assertEqual(len({c.view['seq'] for c in players+viewers}),1)
            await s.advance_ms(1500)
            self.ok(await players[0].command('room.return_lobby',dict(room_id=rid)))
            print(f'LOOPBACK1.1 N48 match={n+1} players=6 spectators=2 dynamic_limit={ms} host_proxy=Charge consistent=true')

    async def test_N49_profile_and_password_unicode_boundary(self):
        from websockets.asyncio.client import connect
        s=await self.server()
        players,_,rid,code=await self.room(s)
        for nickname in ('   ','\u200b','a\n','a'*21,'\ud800'):
            c=Client(await connect(s.url,subprotocols=['deidei.rooms.v1'],proxy=None));self.clients.append(c)
            await c.ws.recv()
            response=await c.command('session.open',dict(profile=dict(nickname=nickname,avatar_id='leaf')))
            self.error(response,'INVALID_MESSAGE');self.assertEqual(response['error']['field'],'nickname')
        for nickname in ('正常中文','🌿','🌿'*20,' 合法空格 '):
            c=Client(await connect(s.url,subprotocols=['deidei.rooms.v1'],proxy=None));self.clients.append(c)
            await c.ws.recv()
            self.ok(await c.command('session.open',dict(profile=dict(nickname=nickname,avatar_id='leaf'))))
            self.ok(await c.command('room.join',dict(room_code=code,password=None,role='spectator')))
            self.assertIn(nickname,[m['nickname'] for m in (await players[0].sync(rid))['members']])
        for password in ('\u200b','x\n','x'*33):
            c=await self.client(s)
            response=await c.command('room.create',dict(password=password,options=dict(turn_ms=10000,early_reveal=True,spectator_cap=6)))
            self.error(response,'INVALID_MESSAGE');self.assertEqual(response['error']['field'],'password')
        c=await self.client(s)
        self.ok(await c.command('room.create',dict(password=' '*32,options=dict(turn_ms=10000,early_reveal=True,spectator_cap=6))))

    async def test_N46_queued_receipt_rechecks_generation_and_new_room(self):
        s=await self.server()
        players,_,rid,_=await self.room(s)
        guest=players[1]
        wire=next(c for c in s.service.connections if c.session.player_id==guest.identity['player_id'])
        await s.drain()
        gate=asyncio.Event()
        sending=asyncio.Event()
        original_send=wire.ws.send
        async def blocked(message):
            sending.set()
            await gate.wait()
            await original_send(message)
        wire.ws.send=blocked
        wire.put(ack(str(uuid4()),{}))
        await asyncio.wait_for(sending.wait(),2)
        # Queue a genuine automatic removal behind the blocked transport.
        s.service.rooms[rid].remove(guest.identity['player_id'],'disconnect_grace_expired')
        self.assertTrue(any(isinstance(item[2],tuple) for item in wire.queue))
        create=guest.intent('room.create',dict(password=None,options=dict(turn_ms=10000,early_reveal=True,spectator_cap=6)))
        await guest.ws.send(json.dumps(create))
        for _ in range(100):
            await s.drain()
            if wire.session.room_id:break
        self.assertIsNotNone(wire.session.room_id)
        self.assertNotEqual(wire.session.room_id,rid)
        gate.set()
        seen=[]
        while True:
            msg=json.loads(await asyncio.wait_for(guest.ws.recv(),3));seen.append(msg)
            if msg['type']=='ack' and msg['request_id']==create['request_id']:
                self.ok(msg);break
        self.assertFalse(any(m['type']=='membership.ended' for m in seen))
        # Replacement connection obtains only the current room; old queued receipt remains obsolete.
        resumed=await self.client(s,guest.identity)
        v=await resumed.sync(wire.session.room_id)
        self.assertEqual(v['self']['player_id'],guest.identity['player_id'])
        self.assertFalse(any(m['type']=='membership.ended' for m in resumed.messages))

    async def test_N42_grace_beats_later_game_deadlines_in_large_clock_jump(self):
        s=await self.server(new_match_factory=funded)
        players,_,rid,_=await self.room(s,3)
        v=await self.start(players,rid)
        await players[0].ws.close();await s.drain()
        for c in players[1:]:self.ok(await c.submit(rid,v,'Bi'))
        await s.advance_ms(10000)
        with patch('deidei_server.room.resolve_round',wraps=resolve_round) as resolver:
            await s.advance_ms(40000)
            self.assertEqual(resolver.call_count,2)
        self.assertEqual((await players[1].sync(rid))['close_reason'],'HOST_TIMEOUT')

    async def test_N43_eliminated_host_leaves_after_current_turn(self):
        s=await self.server(new_match_factory=funded)
        players,_,rid,_=await self.room(s,3)
        v=await self.start(players,rid)
        for c,e in zip(players,('Charge','Bi','Bi')):self.ok(await c.submit(rid,v,e))
        await s.advance_ms(1800)
        v=await players[0].sync(rid)
        host_id=players[0].identity['player_id']
        self.assertEqual(next(m for m in v['members'] if m['player_id']==host_id)['participation'],'eliminated')
        self.ok(await players[0].command('room.leave',dict(room_id=rid)))
        for c in players[1:]:self.ok(await c.submit(rid,v,'Charge'))
        with patch('deidei_server.room.resolve_round',wraps=resolve_round) as resolver:
            await s.advance_ms(300)
            self.assertEqual(resolver.call_count,1)
        end=await players[1].sync(rid)
        self.assertEqual(end['close_reason'],'HOST_LEFT')
        self.assertNotIn(host_id,end['match']['last_turn']['core_resolution']['ledger']['actions'])
