"""CPU model process with an independent stdin EOF lease during load/forward."""
import json
import os
import queue
import sys
import threading

from .model_loader import load_model, probabilities

LIMIT = 65536


def strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate field")
        result[key] = value
    return result


def serve():
    if len(sys.argv) != 2 or not sys.argv[1].isalnum() or len(sys.argv[1]) > 64:
        raise ValueError("Expected controlled generation")
    generation = sys.argv[1]
    incoming = queue.Queue(maxsize=8)

    def lease():
        # Independent of Torch: parent death closes stdin even during a stuck forward.
        while True:
            line = sys.stdin.buffer.readline(LIMIT + 1)
            if not line or len(line) > LIMIT or not line.endswith(b"\n"):
                os._exit(0)
            try:
                incoming.put_nowait(line)
            except queue.Full:
                os._exit(2)

    threading.Thread(target=lease, daemon=True, name="parent-eof-lease").start()
    model = load_model()

    def reply(data):
        print(json.dumps(data, allow_nan=False, separators=(",", ":")), flush=True)

    reply({"v": 1, "generation": generation, "type": "ready"})
    while True:
        request = json.loads(incoming.get().decode("utf-8"), object_pairs_hook=strict_object,
                             parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        if (not isinstance(request, dict) or set(request) != {"v", "generation", "decision_id", "expected", "observation", "mask"}
                or type(request["v"]) is not int or request["v"] != 1 or request["generation"] != generation
                or not isinstance(request["decision_id"], str) or not 1 <= len(request["decision_id"]) <= 128
                or not isinstance(request["expected"], dict)
                or set(request["expected"]) != {"match_id", "game_id", "turn_index", "rules_hash"}
                or any(not isinstance(v, str) or not 1 <= len(v) <= 128 for v in request["expected"].values())):
            raise ValueError("Invalid AI request")
        reply({"v": 1, "generation": generation, "decision_id": request["decision_id"],
               "expected": request["expected"], "probabilities": probabilities(model, request["observation"], request["mask"])})
