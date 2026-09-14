"""Test-only loopback relay: forwards actual frames, can drop one accepted ACK or delay old frames."""
import argparse
import asyncio
import json
from urllib.parse import urlparse
from websockets.asyncio.server import serve
from websockets.asyncio.client import connect


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--upstream', required=True)
    args = parser.parse_args()
    url = urlparse(args.upstream)
    assert url.scheme == 'ws' and url.hostname in ('127.0.0.1', '::1') and url.path == '/rooms-v1'
    drop_op, held_types, held, pairs = [None], set(), [], set()

    async def handler(client):
        async with connect(args.upstream, subprotocols=['deidei.rooms.v1'], proxy=None) as upstream:
            pair = (client, upstream)
            pairs.add(pair)
            requests = {}

            async def forward():
                async for raw in client:
                    message = json.loads(raw)
                    requests[message.get('request_id')] = message.get('op')
                    await upstream.send(raw)

            async def backward():
                async for raw in upstream:
                    message = json.loads(raw)
                    if message.get('type') == 'ack' and drop_op[0] and requests.get(message.get('request_id')) == drop_op[0]:
                        drop_op[0] = None
                        await client.close(1011, 'TEST_ACK_LOSS')
                        return
                    if message.get('type') in held_types and len(held) < 32:
                        held.append((client, raw))
                        held_types.discard(message.get('type'))
                    else:
                        await client.send(raw)
            tasks = [asyncio.create_task(forward()), asyncio.create_task(backward())]
            try:
                await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            finally:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                pairs.discard(pair)

    async with serve(handler, '127.0.0.1', 0, subprotocols=['deidei.rooms.v1'], origins=[None], max_size=16384, compression=None) as server:
        print('Listening: ws://127.0.0.1:%d/rooms-v1' % server.sockets[0].getsockname()[1], flush=True)
        reader = asyncio.StreamReader()
        await asyncio.get_running_loop().connect_read_pipe(lambda: asyncio.StreamReaderProtocol(reader), __import__('sys').stdin)
        while raw := await reader.readline():
            control = json.loads(raw)
            if control['op'] == 'drop_ack':
                drop_op[0] = control['command']
            elif control['op'] == 'hold':
                held_types.update(control['types'])
            elif control['op'] == 'release':
                held_types.clear()
                for client, frame in held:
                    try:
                        await client.send(frame)
                    except Exception:
                        pass
                held.clear()
            elif control['op'] == 'disconnect':
                for client, _ in tuple(pairs):
                    await client.close(1011, 'TEST_DISCONNECT')
            else:
                raise ValueError('unknown test control')
            print('Control: ' + control['op'], flush=True)


if __name__ == '__main__':
    asyncio.run(main())
