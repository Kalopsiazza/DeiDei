"""Production CLI: explicit TLS/remote startup; no state injection or random seeds."""
import argparse
import asyncio
import logging
from pathlib import Path
from .protocol import parse
from .server import RoomServer
from .transport_tls import load_tls_context, validate_bind


def main() -> None:
    parser = argparse.ArgumentParser(description='DeiDei rooms (loopback by default)')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--policy', type=Path)
    parser.add_argument('--host-leave-timing', choices=['after_turn', 'immediate'], default='after_turn')
    parser.add_argument('--tls-cert-file', type=Path)
    parser.add_argument('--tls-key-file', type=Path)
    parser.add_argument('--allow-remote', action='store_true')
    args = parser.parse_args()
    try:
        tls_context = load_tls_context(args.tls_cert_file, args.tls_key_file)
        validate_bind(args.host, args.port, tls_context=tls_context, allow_remote=args.allow_remote)
    except ValueError as exc:
        parser.error(str(exc))
    overrides = parse(args.policy.read_text()) if args.policy else None
    async def run():
        service = RoomServer(overrides, host_leave_timing=args.host_leave_timing)
        try:
            await service.start(args.host, args.port, tls_context=tls_context, allow_remote=args.allow_remote)
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
