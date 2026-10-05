"""Test-only loopback relay: forwards actual frames, can drop one accepted ACK or delay old frames."""
import argparse
import asyncio
import json
from urllib.parse import urlparse
from websockets.asyncio.server import serve
from websockets.asyncio.client import connect


def retry_comparison(original: dict, retry: dict) -> dict:
    """Keep raw requests in memory; persist only comparison results."""
    return {'observed': True, **{
        name + '_same': retry.get(name) == original.get(name)
        for name in ('request_id', 'command_seq', 'payload')
    }}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--upstream', required=True)
    args = parser.parse_args()
    url = urlparse(args.upstream)
    assert url.scheme == 'ws' and url.hostname in ('127.0.0.1', '::1') and url.path == '/rooms-v1'
    drop_op, held_types, held, pairs = [None], set(), [], set()
    retry_expected, retry_result = [None], [{}]

    async def handler(client):
        async with connect(args.upstream, subprotocols=['deidei.rooms.v1'], proxy=None) as upstream:
            pair = (client, upstream)
            pairs.add(pair)
            requests = {}

            async def forward():
                async for raw in client:
                    message = json.loads(raw)
                    requests[message.get('request_id')] = message
                    if retry_expected[0] and message.get('op') == retry_expected[0]['op']:
                        retry_result[0] = retry_comparison(retry_expected[0], message)
                        retry_expected[0] = None
                    await upstream.send(raw)

            async def backward():
                async for raw in upstream:
                    message = json.loads(raw)
                    original = requests.get(message.get('request_id'), {})
                    if message.get('type') == 'ack' and message.get('ok') is True and drop_op[0] and original.get('op') == drop_op[0]:
                        retry_expected[0] = original
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
                retry_expected[0], retry_result[0] = None, {'observed': False}
            elif control['op'] == 'retry_check':
                print('Retry: ' + json.dumps(retry_result[0]), flush=True)
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
