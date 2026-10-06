"""Controlled process failures for the supervisor boundary, never production."""
import json
import sys
import time

mode, generation = sys.argv[1:]
if mode == "cold_hang":
    time.sleep(60)
print(json.dumps({"v": 1, "generation": generation, "type": "ready"}), flush=True)
for line in sys.stdin:
    request = json.loads(line)
    if mode == "hang":
        time.sleep(60)
    if mode == "crash":
        sys.exit(7)
    reply = {key: request[key] for key in ("v", "generation", "decision_id", "expected")}
    reply["probabilities"] = [float(value) for value in request["mask"]]
    if mode == "stale":
        for field in ("generation", "decision_id", "expected"):
            print(json.dumps({**reply, field: "stale"}), flush=True)
    if mode == "bad_shape":
        reply["private"] = "must reject"
    if mode == "invalid_json":
        print('{"duplicate":1,"duplicate":2}', flush=True)
    else:
        print(json.dumps(reply), flush=True)
