"""Import-only testing hooks. Uses the same real loopback transport and room code."""
import asyncio
from .server import RoomServer


class TestServer:
    def __init__(self, policy=None, *, clock=None, new_match_factory=None, timeout_chooser=None, rng=None):
        self.clock = clock
        self.service = RoomServer(policy, clock=clock, new_match_factory=new_match_factory,
                                  timeout_chooser=timeout_chooser, rng=rng)

    async def __aenter__(self):
        await self.service.start(port=0)
        self.url = self.service.url
        return self

    async def __aexit__(self, *args):
        await self.close()

    async def advance_ms(self, ms: int) -> None:
        if self.clock is None or type(ms) is not int or ms < 0:
            raise ValueError('advance_ms requires a manual clock and nonnegative integer')
        self.clock.advance_ms(ms)
        await self.drain()

    async def drain(self) -> None:
        self.service.tick()
        self.service.flush()
        # Yield runnable socket/writer callbacks without advancing wall-clock time.
        for _ in range(8):
            await asyncio.sleep(0)
        self.service.tick()
        self.service.flush()

    async def close(self) -> None:
        await self.service.close()


def create_test_server(policy=None, *, clock=None, new_match_factory=None, timeout_chooser=None, rng=None):
    return TestServer(policy, clock=clock, new_match_factory=new_match_factory,
                      timeout_chooser=timeout_chooser, rng=rng)
