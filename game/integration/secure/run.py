"""S02/S08/S09/S13--S18: ephemeral CA, actual sockets, Node and optional Electron."""
import argparse
import asyncio
from contextlib import AsyncExitStack
import json
import os
from pathlib import Path
import platform
import signal
import subprocess
import socket
import ssl
import sys
import tempfile

from websockets.asyncio.client import connect
from websockets.exceptions import InvalidHandshake, ConnectionClosed
from deidei_server.server import RoomServer
from deidei_server.transport_tls import load_tls_context
from game.server.tests.test_rooms import Client
from game.integration.secure.certificates import certificates

ROOT = Path(__file__).resolve().parents[3]


class CountedServer(RoomServer):
    """Test observation only; authentication and all decisions stay in the product."""
    opens = 0

    def authenticate(self, connection, message: dict) -> dict:
        if message['op'] == 'session.open':
            self.opens += 1
        return super().authenticate(connection, message)


async def python_checks(service: RoomServer, bad: dict, directory: Path) -> list:
    context = ssl.create_default_context(cafile=directory/'ca.pem')
    results = []
    for name, server in bad.items():
        try:
            async with connect(server.url, ssl=context, proxy=None, subprotocols=['deidei.rooms.v1'], open_timeout=3):
                raise AssertionError('invalid certificate accepted')
        except ssl.SSLCertVerificationError as exc:
            results.append({'id': 'S08', 'layer': 'L2', 'scenario': name, 'verify_code': exc.verify_code, 'session_open': server.opens, 'status': 'PASS'})
        assert server.opens == 0
    for url, kwargs in [(service.url.replace('wss:', 'ws:'), {}),
                        (service.url.replace('/rooms-v1', '/wrong'), {'ssl': context}),
                        (service.url, {'ssl': context, 'origin': 'https://example.invalid'})]:
        before = service.opens
        try:
            async with connect(url, proxy=None, subprotocols=['deidei.rooms.v1'], open_timeout=3, **kwargs):
                raise AssertionError('invalid transport accepted')
        except (InvalidHandshake, ConnectionClosed, OSError):
            pass
        assert service.opens == before
    results.append({'id': 'S09', 'layer': 'L2', 'status': 'PASS', 'scenarios': ['plaintext-to-TLS', 'wrong-path', 'browser-origin'], 'session_open': 0})
    async with AsyncExitStack() as stack:
        clients = []
        for n in range(2):
            ws = await stack.enter_async_context(connect(service.url, ssl=context, proxy=None, subprotocols=['deidei.rooms.v1']))
            hello = json.loads(await ws.recv())
            assert hello['protocol'] == 'rooms-1.1' and hello['rules_version'] == 'classic-1.0.1'
            client = Client(ws)
            assert (await client.command('session.open', {'profile': {'nickname': f'TLS Python {n}', 'avatar_id': 'leaf'}}))['ok']
            clients.append(client)
        host, guest = clients
        response = await host.command('room.create', {'password': None, 'options': {'turn_ms': 10000, 'early_reveal': True, 'spectator_cap': 6}})
        assert response['ok']
        rid, code = response['data']['room_id'], response['data']['room_code']
        assert (await guest.command('room.join', {'room_code': code, 'password': None, 'role': 'player'}))['ok']
        for client in clients:
            assert (await client.command('room.ready', {'room_id': rid, 'ready': True}))['ok']
        assert (await host.command('room.start', {'room_id': rid}))['ok']
        view = await host.sync(rid)
        deadline = view['timer']['deadline_at_ms']
        change = host.intent('room.set_turn_limit', {'room_id': rid, 'turn_ms': 5000, 'expected_policy_revision': '1'})
        first = await host.send(change)
        assert first['ok'] and await host.send(change) == first
        updated = await host.sync(rid)
        assert updated['policy_revision'] == '2' and updated['timer']['deadline_at_ms'] == deadline
        results.append({'id': 'S14', 'layer': 'L2', 'status': 'PASS', 'detail': 'same UUID/command sequence replay returns original ACK, revision increments once, current deadline unchanged'})
        for client in clients:
            assert (await client.submit(rid, view, 'SelfBi'))['ok']
        for _ in range(80):
            view = await guest.sync(rid)
            if view['phase'] == 'result':
                break
            await asyncio.sleep(.05)
        assert view['phase'] == 'result' and view['match']['effective_outcome']['kind'] == 'nobody_survives'
        assert (await host.command('room.leave', {'room_id': rid}))['ok']
    results.append({'id': 'S02', 'layer': 'L2', 'status': 'PASS', 'detail': 'verified TLS, rooms-1.1, real-core complete duel'})
    return results


async def run(args: argparse.Namespace) -> int:
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    assert not any(os.environ.get(k) for k in ('SSLKEYLOGFILE', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_OPTIONS'))
    report = {'tested_code_sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'plan_sha': '3cf98c40c9ec3c607b702a12875ce4ec830da27d', 'platform': platform.platform(), 'python': sys.version, 'checks': [], 'children': [], 'status': 'FAIL'}
    services, ports = [], []
    with tempfile.TemporaryDirectory(prefix='deidei-secure-') as temp:
        directory = Path(temp)
        try:
            report['certificates'] = certificates(directory)
            for name in ('valid', 'wrong-san', 'expired', 'unknown'):
                server = CountedServer()
                services.append(server)
                await server.start('127.0.0.1', 0, tls_context=load_tls_context(directory/f'{name}.pem', directory/f'{name}.key'))
                ports.append(server.ws_server.sockets[0].getsockname()[1])
            service = services[0]
            bad = dict(zip(('wrong-san', 'expired', 'unknown'), services[1:]))
            report['checks'] += await python_checks(service, bad, directory)
            for layer in (['L3', 'L4'] if args.electron else ['L3']):
                env = dict(os.environ, NODE_EXTRA_CA_CERTS=str(directory/'ca.pem'), DEIDEI_PYTHON=sys.executable,
                           DEIDEI_TLS_URL=service.url, DEIDEI_TLS_BAD_URLS=json.dumps({k: s.url for k, s in bad.items()}),
                           DEIDEI_SECURE_OUTPUT=str(output), DEIDEI_TLS_LAYER=layer)
                env.pop('ELECTRON_RUN_AS_NODE', None)
                child = await asyncio.create_subprocess_exec('node', 'game/integration/secure/clients.cjs', cwd=ROOT, env=env,
                    start_new_session=os.name != 'nt', stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                child_info = {'layer': layer, 'pid': child.pid, 'exit_code': None}
                report['children'].append(child_info)
                async def stderr_drain() -> bytes:
                    return await child.stderr.read()
                stderr_task = asyncio.create_task(stderr_drain())
                try:
                    async with asyncio.timeout(180):
                        while line := await child.stdout.readline():
                            message = json.loads(line)
                            if message.get('control') == 'restart':
                                port = service.ws_server.sockets[0].getsockname()[1]
                                await service.close()
                                service = CountedServer()
                                services.append(service)
                                await service.start('127.0.0.1', port, tls_context=load_tls_context(directory/'valid.pem', directory/'valid.key'))
                            elif message.get('control') == 'stop':
                                await service.close()
                            elif message.get('control') == 'drop':
                                matches = [s for s in service.sessions.values() if s.profile['nickname'] == message['name']]
                                assert len(matches) == 1
                                await matches[0].connection.ws.close(1012, 'TEST_DISCONNECT')
                            elif message.get('control') == 'bad-counts':
                                assert all(s.opens == 0 for s in bad.values())
                            else:
                                raise AssertionError('unknown harness control')
                            child.stdin.write(b'OK\n')
                            await child.stdin.drain()
                        child_info['exit_code'] = await child.wait()
                finally:
                    if child.returncode is None:
                        child.terminate()
                        try:
                            await asyncio.wait_for(child.wait(), 5)
                        except asyncio.TimeoutError:
                            if os.name != 'nt':
                                os.killpg(child.pid, signal.SIGKILL)
                            else:
                                child.kill()
                            await child.wait()
                    child_info['exit_code'] = child.returncode
                    child_info['exited'] = child.returncode is not None
                    stderr = (await stderr_task).decode(errors='replace')
                    (output/f'{layer}-stderr.txt').write_text(stderr.replace(str(ROOT), '<checkout>').replace(temp, '<tls-temp>'))
                layer_report = json.loads((output/f'{layer}.json').read_text())
                report['checks'] += layer_report['checks']
                if child.returncode:
                    raise AssertionError(f'{layer} failed; see {layer}.json')
                # Each layer proves persistent service stop. Start a fresh instance for the next layer.
                if layer == 'L3' and args.electron:
                    service = CountedServer()
                    services.append(service)
                    await service.start('127.0.0.1', ports[0], tls_context=load_tls_context(directory/'valid.pem', directory/'valid.key'))
            report['negative_session_opens'] = {name: s.opens for name, s in bad.items()}
            assert not any(report['negative_session_opens'].values())
            report['status'] = 'PASS'
        except Exception as exc:
            report['error'] = type(exc).__name__ + ': ' + str(exc)
        finally:
            for server in services:
                await server.close()
            report['server_cleanup'] = [{'closed': s.closed, 'connections': len(s.connections), 'tasks': len(s.tasks)} for s in services]
            assert all(s.closed and not s.connections and not s.tasks for s in services)
            report['ports_closed'] = True
            for port in ports:
                with socket.socket() as sock:
                    sock.settimeout(.2)
                    report['ports_closed'] &= sock.connect_ex(('127.0.0.1', port)) != 0
    report['temporary_certificates_removed'] = not directory.exists()
    assert report['ports_closed'] and report['temporary_certificates_removed']
    (output/'secure.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(report['status'], report.get('error', ''), flush=True)
    return int(report['status'] != 'PASS')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--electron', action='store_true')
    raise SystemExit(asyncio.run(run(parser.parse_args())))
