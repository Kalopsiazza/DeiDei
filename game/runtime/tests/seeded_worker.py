"""Window-test launcher only: actual random-legal-v1 with reproducible seed and ledger evidence."""
import json
from pathlib import Path
from random import Random
import sys

from deidei_runtime.solo import SoloGame
from deidei_runtime.worker import Worker, serve


class RecordedWorker(Worker):
    def __init__(self, log_file: Path):
        super().__init__(lambda profile: SoloGame(profile, rng=Random(2), token_rng=Random(999)))
        self.log_file, self.seen = log_file, set()

    def handle(self, request: object) -> dict:
        response = super().handle(request)
        if self.solo:
            for result in self.solo.resolutions:
                ledger = result['ledger']
                key = (ledger['match_id'], ledger['game_id'], ledger['turn_index'])
                if key not in self.seen:
                    self.seen.add(key)
                    with self.log_file.open('a', encoding='utf-8') as stream:
                        stream.write(json.dumps(result, ensure_ascii=False) + '\n')
        return response


if __name__ == '__main__':
    serve(sys.stdin.buffer, sys.stdout.buffer, RecordedWorker(Path(sys.argv[1])))
