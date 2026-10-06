import argparse
import asyncio
import json
import logging
from pathlib import Path
from aiohttp import web
from .server import make_app


async def serve(args):
    app = await make_app(args.database, Path(args.admin_token_file).read_text().strip())
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    site = web.TCPSite(runner, args.host, args.port)
    await site.start()
    print(json.dumps({'ready': True, 'port': site._server.sockets[0].getsockname()[1]}), flush=True)
    try:
        await asyncio.Future()
    finally:
        await runner.cleanup()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--database', required=True)
    parser.add_argument('--admin-token-file', required=True)
    args = parser.parse_args()
    if args.host not in ('127.0.0.1', '::1'):
        parser.error('bind only to loopback; use the supplied TLS proxy')
    logging.getLogger('aiohttp').disabled = True
    try:
        asyncio.run(serve(args))
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
