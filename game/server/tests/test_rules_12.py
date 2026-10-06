"""rooms-1.2 rules ownership, stale intents and real loopback configured rounds."""
from copy import deepcopy
import json
from pathlib import Path
from random import Random

from deidei_core.api import new_match, resolve_round
from deidei_core.rules import compile_rules, default_request, pack_ref, parse_pack
from deidei_server.room import public_resolution, public_pack
from test_rooms import SocketCase

ROOT = Path(__file__).resolve().parents[3]


def seen(view):
    return dict(expected_rules_revision=view['rules_revision'], expected_rules_hash=view['rules_snapshot']['rules_hash'])


def pack_configuration(name):
    manifest = parse_pack((ROOT / 'docs/rules/packs' / (name + '.deidei-pack.json')).read_bytes())
    preset = manifest['presets'][0]
    request = dict(schema_version=1, preset_id=f"pack:{manifest['id']}:{preset['id']}",
                   skill_flags=deepcopy(preset['skill_defaults']), preset_params={}, pack_refs=[pack_ref(manifest)])
    return request, manifest


class ConfiguredRooms(SocketCase):
    async def configure(self, host, rid, request, manifests=None):
        view = await host.sync(rid)
        payload = dict(room_id=rid, rules_request=request, rule_pack_manifests=manifests or [], **seen(view))
        self.ok(await host.command('room.set_rules', payload))
        return await host.sync(rid)

    async def prepared(self, players, rid):
        for player in players:
            view = await player.sync(rid)
            self.ok(await player.command('room.ready', dict(room_id=rid, ready=True, **seen(view))))
        return await players[0].sync(rid)

    async def begin(self, players, rid):
        view = await self.prepared(players, rid)
        self.ok(await players[0].command('room.start', dict(room_id=rid, **seen(view))))
        return await players[0].sync(rid)

    async def test_hello_legacy_command_rejection_and_create_pack_validation(self):
        server = await self.server()
        host = await self.client(server)
        self.assertEqual(host.hello['protocol'], 'rooms-1.2')
        self.assertEqual(host.hello['rules_version'], 'configured-1.0.0')
        self.assertEqual({k: host.hello['capabilities'][k] for k in ('rules_schema', 'core_state_schema', 'rules_pack_api', 'max_pack_bytes')},
                         dict(rules_schema=1, core_state_schema=2, rules_pack_api='deidei.rules-pack.v1', max_pack_bytes=8192))
        old = host.intent('room.create', dict(password=None, options=dict(turn_ms=12000, early_reveal=True, spectator_cap=6)))
        del old['payload']['rules_request']; del old['payload']['rule_pack_manifests']
        self.error(await host.send(old), 'INVALID_MESSAGE')
        self.assertEqual(server.service.rooms, {})
        request, manifest = pack_configuration('fast-opening')
        tampered = deepcopy(manifest); tampered['author'] = 'Changed author'
        payload = dict(password=None, options=dict(turn_ms=12000, early_reveal=True, spectator_cap=6),
                       rules_request=request, rule_pack_manifests=[tampered])
        self.error(await host.command('room.create', payload), 'INVALID_RULES')
        self.assertEqual(server.service.rooms, {})
        payload['rule_pack_manifests'] = [manifest]
        created = self.ok(await host.command('room.create', payload))
        view = await host.sync(created['room_id'])
        self.assertEqual(view['rule_pack_manifests'], [manifest])
        self.assertEqual(view['rules_snapshot'], compile_rules(request, [manifest]))

    async def test_set_rules_only_connected_lobby_host_validated_atomic_and_same_hash_noop(self):
        server = await self.server()
        players, viewers, rid, _ = await self.room(server, spectators=1)
        host, guest = players
        view = await self.prepared(players, rid)
        same = dict(room_id=rid, rules_request=default_request(), rule_pack_manifests=[], **seen(view))
        before = (server.service.rooms[rid].seq, deepcopy(view['members']))
        ack = self.ok(await host.command('room.set_rules', same))
        self.assertEqual(ack['rules_revision'], '1')
        self.assertEqual((server.service.rooms[rid].seq, (await host.sync(rid))['members']), before)
        for outsider in (guest, viewers[0]):
            self.error(await outsider.command('room.set_rules', same), 'NOT_HOST')
        bad = deepcopy(same); bad['rules_request']['skill_flags']['Cloud'] = True; bad['rules_request']['script'] = 'ignored-no'
        self.error(await host.command('room.set_rules', bad), 'INVALID_RULES')
        self.assertEqual((await host.sync(rid))['members'], before[1])
        changed = await self.configure(host, rid, default_request('loan'))
        self.assertEqual(changed['rules_revision'], '2')
        self.assertTrue(all(not m['ready'] and m['ready_rules_hash'] is None for m in changed['members']))
        state = await self.begin(players, rid)
        self.error(await host.command('room.set_rules', {**same, **seen(state)}), 'WRONG_PHASE')
        self.assertEqual(state['match']['public_state']['rules_snapshot'], changed['rules_snapshot'])

    async def test_stale_ready_start_and_replayed_ack_never_restore_prepared_state(self):
        server = await self.server()
        players, _, rid, _ = await self.room(server)
        host, guest = players
        old = await self.prepared(players, rid)
        ready = guest.intent('room.ready', dict(room_id=rid, ready=True, **seen(old)))
        ack = await guest.send(ready); self.ok(ack)
        changed = await self.configure(host, rid, default_request('firepower'))
        self.error(await guest.command('room.ready', dict(room_id=rid, ready=True, **seen(old))), 'RULES_STALE')
        self.error(await host.command('room.start', dict(room_id=rid, **seen(old))), 'RULES_STALE')
        self.assertEqual(await guest.send(ready), ack)  # cached ACK is deliberately old; following snapshot is authoritative.
        latest = await guest.sync(rid)
        self.assertEqual(latest['rules_revision'], changed['rules_revision'])
        self.assertTrue(all(not m['ready'] for m in latest['members']))
        for player in players:
            self.ok(await player.command('room.ready', dict(room_id=rid, ready=True, **seen(latest))))
        self.ok(await host.command('room.start', dict(room_id=rid, **seen(latest))))
        self.assertEqual((await host.sync(rid))['match']['public_state']['rules_hash'], latest['rules_snapshot']['rules_hash'])

    async def test_start_set_rules_both_arrival_orders_and_ready_hash_guard(self):
        for start_first in (False, True):
            server = await self.server()
            players, _, rid, _ = await self.room(server)
            host = players[0]
            old = await self.prepared(players, rid)
            change = dict(room_id=rid, rules_request=default_request('lucky'), rule_pack_manifests=[], **seen(old))
            start = dict(room_id=rid, **seen(old))
            if start_first:
                self.ok(await host.command('room.start', start))
                self.error(await host.command('room.set_rules', change), 'WRONG_PHASE')
                self.assertEqual((await host.sync(rid))['rules_snapshot']['preset_id'], 'classic')
            else:
                self.ok(await host.command('room.set_rules', change))
                self.error(await host.command('room.start', start), 'RULES_STALE')
                current = await self.prepared(players, rid)
                server.service.rooms[rid].members[players[1].identity['player_id']]['ready_rules_hash'] = old['rules_snapshot']['rules_hash']
                self.error(await host.command('room.start', dict(room_id=rid, **seen(current))), 'RULES_STALE')
                self.assertIsNone(server.service.rooms[rid].state)

    async def test_loan_core_and_forfeit_restarts_keep_rules_and_grant_exactly_once(self):
        for forfeit in (False, True):
            server = await self.server()
            players, _, rid, _ = await self.room(server, 3)
            await self.configure(players[0], rid, default_request('loan'))
            first = await self.begin(players, rid)
            self.assertTrue(all(p['dd6'] == '6' for p in first['match']['public_state']['players'].values()))
            end = await self.round(server, players, rid, ['Charge'] * 3)
            self.assertTrue(all(p['dd6'] == '12' for p in end['match']['last_turn']['core_resolution']['ledger']['post_turn_players'].values()))
            await server.advance_ms(1500)
            current = await players[0].sync(rid)
            if forfeit:
                for player in players[:2]: self.ok(await player.submit(rid, current, 'Charge'))
                self.ok(await players[2].command('room.leave', dict(room_id=rid)))
                await server.advance_ms(12000)
                end = await players[0].sync(rid)
            else:
                end = await self.round(server, players, rid, ['Def', 'Def', 'SelfBi'])
            turn = end['match']['last_turn']
            fresh = turn['effective_state']
            self.assertEqual(turn['effective_transition']['kind'], 'restart_survivors')
            self.assertEqual(fresh['game_index'], '2')
            self.assertEqual(fresh['rules_hash'], first['rules_snapshot']['rules_hash'])
            self.assertTrue(all(fresh['players'][pid]['dd6'] == '6' for pid in fresh['active_ids']))
            departed = players[2].identity['player_id']
            self.assertNotIn(departed, fresh['active_ids'])
            if forfeit:
                self.assertEqual(fresh['players'][departed]['dd6'], '18')
            await server.advance_ms(1500)
            next_view = await players[0].sync(rid)
            self.assertEqual(next_view['match']['public_state']['rules_snapshot'], first['rules_snapshot'])
            end = await self.round(server, players[:2], rid, ['Charge', 'Charge'])
            self.assertTrue(all(end['match']['last_turn']['effective_state']['players'][pid]['dd6'] == '12' for pid in fresh['active_ids']))

    async def test_loan_retry_resume_zeng_and_return_lobby_do_not_reissue_resources(self):
        server = await self.server()
        players, _, rid, _ = await self.room(server)
        await self.configure(players[0], rid, default_request('loan'))
        view = await self.begin(players, rid)
        host = players[0]
        msg = host.intent('room.submit', dict(room_id=rid, match_id=view['match']['match_id'], turn_id=view['match']['turn_id'], entry_id='ZengYi'))
        ack = await host.send(msg); self.ok(ack)
        self.assertEqual(await host.send(msg), ack)
        self.ok(await players[1].submit(rid, view, 'Def'))
        await server.advance_ms(300)
        end = await host.sync(rid)
        self.assertEqual(end['match']['last_turn']['effective_state']['players'][host.identity['player_id']]['dd6'], '0')
        await host.ws.close(); await server.drain()
        resumed = await self.client(server, host.identity)
        self.assertEqual((await resumed.sync(rid))['match']['last_turn'], end['match']['last_turn'])
        await server.advance_ms(1500)
        current = await resumed.sync(rid)
        self.assertEqual(current['match']['public_state']['players'][host.identity['player_id']]['dd6'], '0')
        self.ok(await players[1].submit(rid, current, 'SelfBi'))
        await server.advance_ms(300)
        recovery = await resumed.sync(rid)
        self.assertTrue(recovery['match']['last_turn']['core_resolution']['ledger']['actions'][host.identity['player_id']]['is_recovery'])
        await server.advance_ms(1500)
        result = await resumed.sync(rid)
        self.assertEqual(result['phase'], 'result')
        self.ok(await resumed.command('room.return_lobby', dict(room_id=rid)))
        lobby = await resumed.sync(rid)
        self.assertEqual(lobby['rules_snapshot'], view['rules_snapshot'])
        self.assertTrue(all(not m['ready'] and m['ready_rules_hash'] is None for m in lobby['members']))

    async def test_real_pack_resources_luck_observer_and_tokens_replay_privately(self):
        for pack in ('fast-opening', 'certain-luck'):
            server = await self.server()
            players, viewers, rid, _ = await self.room(server, spectators=1)
            request, manifest = pack_configuration(pack)
            await self.configure(players[0], rid, request, [manifest])
            view = await self.begin(players, rid)
            room = server.service.rooms[rid]
            original_tokens = deepcopy(room.tokens), deepcopy(room.lucky_tokens)
            for _ in range(2): await viewers[0].sync(rid)
            self.assertEqual((room.tokens, room.lucky_tokens), original_tokens)
            await players[1].ws.close(); await server.drain()
            players[1] = await self.client(server, players[1].identity)
            self.assertEqual((room.tokens, room.lucky_tokens), original_tokens)
            end = await self.round(server, players, rid, ['Charge', 'Charge'])
            if pack == 'fast-opening':
                self.assertTrue(all(p['dd6'] == '18' for p in end['match']['last_turn']['effective_state']['players'].values()))
            else:
                await server.advance_ms(1500)
                end = await self.round(server, players, rid, ['Bi', 'Def'])
                action = end['match']['last_turn']['core_resolution']['ledger']['actions'][players[0].identity['player_id']]
                self.assertEqual((action['entry_id'], action['base_move'], action['actual_move'], action['spend']['dd6']), ('Bi', 'Bi', 'Pragon', '6'))
                self.assertEqual(action['upgrade']['probability_bps'], 10000)
            observer = await viewers[0].sync(rid)
            self.assertEqual(observer['match']['last_turn'], end['match']['last_turn'])
            self.assertEqual(observer['rule_pack_manifests'], [manifest])
            raw = json.dumps(observer)
            for private in ('choice_tokens', 'lucky_tokens', 'replay_inputs', 'bot_entry', 'seed'):
                self.assertNotIn(private, raw)
            self.assertEqual(room.replay_inputs[-1]['rules_snapshot'], view['rules_snapshot'])
            if pack == 'certain-luck':
                self.assertEqual(set(room.replay_inputs[-1]['lucky_tokens']), {players[0].identity['player_id']})
                self.assertEqual(room.replay_inputs[-1]['choice_tokens'], {})

    async def test_two_rooms_do_not_mix_configuration_or_token_streams(self):
        server = await self.server(rng=Random(31))
        a, _, ra, _ = await self.room(server)
        b, _, rb, _ = await self.room(server)
        await self.configure(a[0], ra, default_request('firepower'))
        await self.configure(b[0], rb, default_request('loan'))
        va, vb = await self.begin(a, ra), await self.begin(b, rb)
        self.assertNotEqual(va['rules_snapshot']['rules_hash'], vb['rules_snapshot']['rules_hash'])
        self.assertTrue(all(p['dd6'] == '0' for p in va['match']['public_state']['players'].values()))
        self.assertTrue(all(p['dd6'] == '6' for p in vb['match']['public_state']['players'].values()))
        for group, rid in ((a, ra), (b, rb)):
            for player in group:
                view = await player.sync(rid)
                self.ok(await player.submit(rid, view, 'Charge'))
        await server.advance_ms(300)
        await server.advance_ms(1500)
        for group, rid in ((b, rb), (a, ra)):
            for player in group:
                view = await player.sync(rid)
                self.ok(await player.submit(rid, view, 'Charge'))
        await server.advance_ms(300)
        sa, sb = (await a[0].sync(ra))['match']['last_turn']['effective_state'], (await b[0].sync(rb))['match']['last_turn']['effective_state']
        self.assertTrue(all(p['dd6'] == '24' for p in sa['players'].values()))
        self.assertTrue(all(p['dd6'] == '18' for p in sb['players'].values()))
        independent = await self.server(rng=Random(31))
        # Room play consumes rngs; directly compare untouched streams in two fresh services after only bot-stream draws.
        fresh = await self.server(rng=Random(31))
        for _ in range(100): fresh.service.rng.randrange(33)
        self.assertEqual([fresh.service.lucky_rng.randrange(10000) for _ in range(10)],
                         [independent.service.lucky_rng.randrange(10000) for _ in range(10)])

    async def test_v2_projection_strips_future_private_fields_at_every_new_level(self):
        state = new_match(['A', 'B'], 'projection', compile_rules(default_request('lucky')))
        for p in state['players'].values(): p['dd6'] = '6'
        result = resolve_round(state, {'A': 'Bi', 'B': 'Def'}, {}, {'A': 0})
        sentinel = 'private-future-sentinel'
        for target in (result['next_state'], result['next_state']['rules_snapshot'],
                       result['next_state']['rules_snapshot']['parameters'], result['next_state']['rules_snapshot']['skill_flags'],
                       result['ledger']['actions']['A'], result['ledger']['actions']['A']['upgrade'],
                       result['ledger']['actions']['A']['spend'], result['ledger']['post_turn_players']['A']):
            target['private'] = sentinel
        public = public_resolution(result)
        self.assertNotIn(sentinel, json.dumps(public))
        self.assertEqual(public['ledger']['actions']['A']['base_move'], 'Bi')
        self.assertEqual(public['ledger']['actions']['A']['upgrade']['to'], 'Pragon')
        _, manifest = pack_configuration('fast-opening')
        for target in (manifest, manifest['presets'][0], manifest['presets'][0]['skill_defaults'], manifest['presets'][0]['parameters']):
            target['private'] = sentinel
        self.assertNotIn(sentinel, json.dumps(public_pack(manifest)))
