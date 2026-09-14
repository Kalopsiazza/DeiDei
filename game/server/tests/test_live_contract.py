"""Q01-Q04: exact rate-limit correlation and one monotonic public timeline."""
import json
from unittest.mock import patch
from uuid import uuid4
from test_rooms import SocketCase, ManualClock


class JumpingClock(ManualClock):
    wall_offset = 0

    def wall_ms(self):
        self.wall_offset += 1
        return super().wall_ms() + self.wall_offset


class LiveContract(SocketCase):
    async def test_Q01_limited_uuid_has_no_business_effect_then_recovers(self):
        server = await self.server()
        players, _, rid, _ = await self.room(server)
        client = players[0]
        connection = next(c for c in server.service.connections if c.session.player_id == client.identity['player_id'])
        session, room = connection.session, server.service.rooms[rid]
        before = (session.last_seq, list(session.cache), room.seq, room.policy_revision)
        message = client.intent('room.sync', {'room_id': rid})
        with patch.object(connection, 'limited', return_value=True), patch.object(server.service, 'command', wraps=server.service.command) as command:
            response = await client.send(message)
            self.assertEqual(response, {'v': 1, 'type': 'ack', 'request_id': message['request_id'], 'ok': False,
                                       'error': {'code': 'RATE_LIMITED', 'field': None, 'retryable': True}})
            command.assert_not_called()
        self.assertEqual((session.last_seq, list(session.cache), room.seq, room.policy_revision), before)
        self.ok(await client.send(message))
        self.assertEqual(session.last_seq, int(message['command_seq']))

    async def test_Q02_bad_messages_stay_unidentified_when_limited(self):
        server = await self.server()
        client = await self.client(server)
        connection = next(c for c in server.service.connections if c.session.player_id == client.identity['player_id'])
        with patch.object(connection, 'limited', return_value=True), patch.object(server.service, 'command') as command:
            for raw in ('{', json.dumps({'request_id': 'not-uuid'}), json.dumps({'request_id': str(uuid4()), 'request_id_duplicate': 1}) .replace('request_id_duplicate', 'request_id')):
                await client.ws.send(raw)
                response = json.loads(await client.ws.recv())
                self.assertEqual(response, {'v': 1, 'type': 'ack', 'request_id': None, 'ok': False,
                                           'error': {'code': 'INVALID_MESSAGE', 'field': None, 'retryable': False}})
            command.assert_not_called()

    async def test_Q03_Q04_wall_jumps_do_not_change_any_public_deadline(self):
        clock = JumpingClock()
        server = await self.server(clock=clock)
        players, viewers, rid, _ = await self.room(server, spectators=1)
        v = await self.start(players, rid)
        expected = v['timer']['deadline_at_ms']
        anchor = players[0].hello['server_time_ms']
        for offset in (1000000, -2000000, 5000000):
            clock.wall_offset = offset
            await server.advance_ms(1)
            for c in players + viewers:
                current = await c.sync(rid)
                self.assertEqual(current['timer']['deadline_at_ms'], expected)
                self.assertEqual(c.view['server_time_ms'], anchor + clock.now_ms())
        for c in players:
            self.ok(await c.submit(rid, v, 'Charge'))
        await server.advance_ms(300)
        v = await viewers[0].sync(rid)
        self.assertEqual(v['phase'], 'revealing')
        reveal_deadline = v['timer']['deadline_at_ms']
        clock.wall_offset = -8000000
        self.assertEqual((await players[0].sync(rid))['timer']['deadline_at_ms'], reveal_deadline)
        self.assertEqual(reveal_deadline, anchor + server.service.rooms[rid].deadline)
        await server.advance_ms(1500)
        self.assertEqual((await players[0].sync(rid))['phase'], 'selecting')

    async def test_Q04_grace_and_membership_use_same_anchor(self):
        clock = JumpingClock()
        server = await self.server(clock=clock)
        players, viewers, rid, _ = await self.room(server, spectators=1)
        anchor = players[0].hello['server_time_ms']
        await players[0].ws.close()
        v = await players[1].sync(rid)
        deadline = v['host_recovery']['deadline_at_ms']
        clock.wall_offset = 999999
        await server.advance_ms(100)
        self.assertEqual((await viewers[0].sync(rid))['host_recovery']['deadline_at_ms'], deadline)
        self.assertEqual(deadline, anchor + 30000)
        await server.advance_ms(29900)
        self.assertEqual((await players[1].sync(rid))['close_reason'], 'HOST_TIMEOUT')
        # An ordinary lobby member expires without closing the host's room.
        players, _, rid, _ = await self.room(server)
        await players[1].ws.close()
        await players[0].sync(rid)  # Observe server-side disconnect before advancing the manual clock.
        await server.advance_ms(30000)
        session = server.service.by_player[players[1].identity['player_id']]
        self.assertEqual(session.last_membership_end['server_time_ms'], anchor + clock.now_ms())
