"""Real checkpoint check: spawn-to-ready cold load and 200 bounded IPC forwards."""

import argparse
import json
import math
import os
from pathlib import Path
import selectors
import subprocess
import sys
import time


def child():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from deidei_ai.model_loader import load_model, probabilities

    started = time.perf_counter()
    model = load_model()
    observation = [0.0] * 156
    for index in (14, 77, 92, 155):
        observation[index] = 1.0
    mask = [True] * 31
    for invalid_observation, invalid_mask in ((observation[:-1], mask),
                                             (observation, [False] * 31),
                                             (observation, [1] * 31),
                                             ([float("nan")] * 156, mask)):
        try:
            probabilities(model, invalid_observation, invalid_mask)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid inference input accepted")
    print(json.dumps({"ready": True, "load_ms": (time.perf_counter() - started) * 1000,
                      "pid": os.getpid()}), flush=True)
    for line in sys.stdin:
        request = json.loads(line)
        if request == {"quit": True}:
            return
        values = probabilities(model, request["observation"], request["mask"])
        print(json.dumps({"probabilities": values}), flush=True)


def read_reply(process, selector, timeout):
    if not selector.select(timeout):
        raise TimeoutError("AI reply deadline exceeded")
    line = process.stdout.readline()
    if not line:
        raise RuntimeError("AI exited before replying")
    return json.loads(line)


def probe(output):
    env = {key: value for key, value in os.environ.items() if not key.startswith("PYTHON")}
    started = time.perf_counter()
    process = subprocess.Popen([sys.executable, "-I", str(Path(__file__).resolve()), "--child"],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
                               cwd=Path(__file__).resolve().parent, env=env)
    result = {"source": "preserved repository checkpoint, real CPU inference",
              "python": sys.version, "status": "FAILED", "requests": 0, "timeouts": 0}
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    try:
        ready = read_reply(process, selector, 30)
        assert ready["ready"] is True
        result.update(cold_spawn_to_ready_ms=(time.perf_counter() - started) * 1000,
                      child_load_ms=ready["load_ms"], child_pid=ready["pid"])
        observation = [0.0] * 156
        for index in (14, 77, 92, 155):
            observation[index] = 1.0
        timings = []
        distributions = {}
        masks = {"all_slots": [True] * 31,
                 "classic_initial": [index in (0, 2) for index in range(31)],
                 "cloud_disabled": [index not in (8, 29, 30) for index in range(31)]}
        for index in range(200):
            name = list(masks)[index % len(masks)]
            mask = masks[name]
            request = json.dumps({"observation": observation, "mask": mask}) + "\n"
            request_start = time.perf_counter()
            process.stdin.write(request)
            process.stdin.flush()
            try:
                reply = read_reply(process, selector, 0.75)
            except TimeoutError:
                result["timeouts"] += 1
                raise
            timings.append((time.perf_counter() - request_start) * 1000)
            values = reply["probabilities"]
            assert len(values) == 31 and all(math.isfinite(value) and value >= 0 for value in values)
            assert abs(sum(values) - 1) < 1e-6
            assert all(value == 0 for value, legal in zip(values, mask) if not legal)
            distributions.setdefault(name, values)
            result["requests"] += 1
        rss = subprocess.check_output(["ps", "-o", "rss=", "-p", str(process.pid)], text=True).strip()
        timings.sort()
        result.update(status="PASSED", p50_ms=timings[99], p95_ms=timings[189],
                      max_ms=timings[-1], rss_bytes=int(rss) * 1024,
                      distributions=distributions, hot_request_ms=timings)
        process.stdin.write('{"quit":true}\n')
        process.stdin.flush()
        assert process.wait(timeout=5) == 0
    except Exception as error:
        result["error"] = f"{type(error).__name__}: {error}"
        raise
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        selector.close()
        result["child_exit_code"] = process.returncode
        result["child_reaped"] = process.poll() is not None
        Path(output).write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: value for key, value in result.items()
                      if key not in ("distributions", "hot_request_ms")}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--child", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--output", default="model-probe.json")
    arguments = parser.parse_args()
    if arguments.child:
        child()
    else:
        probe(arguments.output)
