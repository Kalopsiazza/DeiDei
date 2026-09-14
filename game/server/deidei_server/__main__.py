"""Production CLI: no state injection, random seeds, or public endpoints."""
import argparse
import asyncio
import logging
from pathlib import Path
from .protocol import parse
from .server import RoomServer


def main() -> None:
    parser = argparse.ArgumentParser(description='DeiDei loopback rooms')
    parser.add_argument('--host', choices=['127.0.0.1', '::1'], default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--policy', type=Path)
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('port must be 0..65535')
    overrides = parse(args.policy.read_text()) if args.policy else None
    async def run():
        service = RoomServer(overrides)
        try:
            await service.start(args.host, args.port)
            print('Listening: ' + service.url, flush=True)
            await asyncio.Future()
        finally:
            await service.close()
    # Transport debug logging can contain frames. Only room diagnostic codes are logged.
    logging.getLogger('deidei.transport').disabled = True
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
