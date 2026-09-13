"""F01 window test: real core and a fixed legal random seed choosing Cloud first."""
from pathlib import Path
from random import Random
import sys
from seeded_worker import RecordedWorker
from deidei_runtime.solo import SoloGame
from deidei_runtime.worker import serve

if __name__ == '__main__':
    worker = RecordedWorker(Path(sys.argv[1]))
    worker.solo_factory = lambda profile: SoloGame(profile, rng=Random(13), token_rng=Random(999), reveal_delay=3)
    serve(sys.stdin.buffer, sys.stdout.buffer, worker)
