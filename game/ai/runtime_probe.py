"""Source-only real-model/core integration and owned-process death diagnostics."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from random import Random
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "game/core"), str(ROOT / "game/runtime")]
from deidei_core.api import list_options, new_match
from deidei_core.rules import compile_rules, default_request
from deidei_runtime.ai_supervisor import AISupervisor
from deidei_runtime.legacy_model import LegacyModelProvider, MODEL_ID
from deidei_runtime.legacy_projection import observation, ACTION_MAP
from deidei_runtime.solo import SoloGame


def ready():
    supervisor = AISupervisor()
    while supervisor.poll() == "preparing":
        time.sleep(0.01)
    if supervisor.state != "ready":
        raise RuntimeError("Real model failed to prewarm")
    return supervisor


def call(process, op, payload=None):
    process.stdin.write((json.dumps({"v": 2, "id": "probe", "op": op, "payload": payload or {}}) + "\n").encode())
    process.stdin.flush()
    line = process.stdout.readline()
    if not line:
        raise RuntimeError("Runtime EOF")
    reply = json.loads(line)
    if not reply["ok"]:
        raise RuntimeError(reply)
    return reply["data"]


def runtime(owned=None):
    env = {k: v for k, v in os.environ.items() if not k.startswith("PYTHON")}
    env.update(PYTHONPATH=os.pathsep.join([str(ROOT / "game/core"), str(ROOT / "game/runtime")]),
               DEIDEI_AI_PYTHON=sys.executable)
    process = subprocess.Popen([sys.executable, "-m", "deidei_runtime.worker"], cwd=ROOT, env=env,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if owned is not None:
        owned.append(process)
    return process


def owned_ai(pid):
    rows = subprocess.check_output(["ps", "-axo", "pid=,ppid=,command="], text=True).splitlines()
    values = [int(parts[0]) for row in rows if len(parts := row.strip().split(None, 2)) == 3
              and parts[1] == str(pid) and "worker-entry.py" in parts[2]]
    if len(values) != 1:
        raise RuntimeError("Expected exactly one owned AI process")
    return values[0]


def alive(pid):
    result = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True, text=True)
    return result.returncode == 0 and bool(result.stdout.strip()) and not result.stdout.strip().startswith("Z")


def wait_dead(pid):
    deadline = time.monotonic() + 5
    while alive(pid) and time.monotonic() < deadline:
        time.sleep(0.02)
    if alive(pid):
        raise RuntimeError(f"Owned process {pid} remained alive")


def prewarm_runtime(process):
    status = call(process, "prepare_solo", {"opponent_id": MODEL_ID})
    while status["state"] == "preparing":
        time.sleep(0.01)
        status = call(process, "solo_status")
    if status["state"] != "ready":
        raise RuntimeError(status)
    return owned_ai(process.pid)


def lease_parent():
    process = runtime()
    ai_pid = prewarm_runtime(process)
    print(json.dumps({"runtime_pid": process.pid, "ai_pid": ai_pid}), flush=True)
    sys.stdin.buffer.read()
    process.stdin.close()
    process.wait(timeout=5)


def probe(output):
    os.environ["DEIDEI_AI_PYTHON"] = sys.executable
    result = {"status": "FAILED", "source": "original verified checkpoint; real CPU/current core",
              "cases": [], "lifecycle": [], "native_windows": "NOT_RUN", "electron_main_kill": "NOT_RUN"}
    supervisor = None
    owned = []
    started = time.monotonic()
    try:
        supervisor = ready()
        result["cold_spawn_to_ready_ms"] = (time.monotonic() - started) * 1000
        state = new_match(["A", "bot_local"], "hot-probe", compile_rules(default_request()))
        expected = {k: state[k] for k in ("match_id", "game_id", "turn_index", "rules_hash")}
        timings = []
        for index in range(200):
            request = default_request(); request["skill_flags"]["Cloud"] = index % 2 == 0
            current = new_match(["A", "bot_local"], "hot-probe", compile_rules(request))
            expected["rules_hash"] = current["rules_hash"]
            legal = {o["entry_id"] for o in list_options(current, "bot_local") if o["available"]}
            mask = [entry in legal for entry in ACTION_MAP]
            start = time.monotonic()
            values = supervisor.infer(expected, observation(current, "bot_local", {}), mask)
            timings.append((time.monotonic() - start) * 1000)
            assert len(values) == 31 and abs(sum(values) - 1) < 1e-6
            assert all(v == 0 for v, available in zip(values, mask) if not available)
            if not request["skill_flags"]["Cloud"]:
                assert all(values[i] == 0 for i in (8, 29, 30))
        rss = int(subprocess.check_output(["ps", "-o", "rss=", "-p", str(supervisor.process.pid)], text=True).strip()) * 1024
        timings.sort()
        result.update(requests=200, timeouts=0, p50_ms=timings[99], p95_ms=timings[189], max_ms=timings[-1], rss_bytes=rss)
        supervisor.close(); supervisor = None
        for case in ("default", "cloud_disabled", "human_zengyi"):
            request = default_request()
            if case == "cloud_disabled":
                request["skill_flags"]["Cloud"] = False
            supervisor = ready(); provider = LegacyModelProvider(supervisor)
            game = SoloGame({"profile_id": "A", "nickname": "真实模型验证", "avatar_id": "leaf"},
                            rules_snapshot=compile_rules(request), opponent_provider=provider,
                            rng=Random(4), submit_delay=0, reveal_delay=0)
            records = []
            assert provider.active_id == MODEL_ID
            for index in range(3):
                if game.phase == "selecting":
                    game.submit(game.view_id, "ZengYi" if case == "human_zengyi" and index == 0 else "Def")
                view = game.get_view()
                assert view["phase"] in ("revealed", "result")
                records.append({"turn": view["turn_index"], "source": view["decision_source"],
                                "actions": {p: a["entry_id"] for p, a in game.resolution["ledger"]["actions"].items()},
                                "compatibility": view["opponent_status"]["compatibility"]})
                assert view["decision_source"] == "legacy_model"
                if view["phase"] == "result":
                    break
                game.get_view()
            assert provider.model_turns >= 2
            if case == "human_zengyi":
                assert records[0]["actions"]["A"] == "ZengYi"
                assert records[1]["actions"]["A"] == "ZengYi"  # Core-owned forced recovery.
                assert "ZengYi" in records[1]["compatibility"]["missing_features"]
            result["cases"].append({"case": case, "status": "PASSED", "model_turns": provider.model_turns, "rounds": records})
            game.leave(); assert supervisor.process.poll() is not None
            supervisor = None
        supervisor = ready(); provider = LegacyModelProvider(supervisor)
        game = SoloGame({"profile_id": "A", "nickname": "受控失败验证", "avatar_id": "leaf"},
                        rules_snapshot=compile_rules(default_request()), opponent_provider=provider,
                        rng=Random(4), submit_delay=0, reveal_delay=0)
        game.submit(game.view_id, "Def"); game.get_view()
        assert provider.model_turns == 1
        supervisor.process.kill(); supervisor.process.wait(timeout=5)
        game.get_view()  # Next decision detects the real child death, falls back once.
        assert provider.state == "degraded" and provider.active_id == "random-legal-v1"
        game.submit(game.view_id, "Def")
        assert game.get_view()["decision_source"] == "legal_fallback"
        assert (provider.model_turns, provider.fallback_turns) == (1, 1)
        result["cases"].append({"case": "loaded_model_controlled_crash", "status": "PASSED", "model_turns": 1,
                                "fallback_turns": 1, "active_id": provider.active_id})
        game.leave(); supervisor = None
        # Cancel while cold and cancel after ready both reap only their own child.
        process = runtime(owned)
        status = call(process, "prepare_solo", {"opponent_id": MODEL_ID})
        ai_pid = owned_ai(process.pid)
        assert call(process, "cancel_solo_prepare")["state"] == "cancelled"
        wait_dead(ai_pid)
        process.stdin.close(); process.wait(timeout=5)
        result["lifecycle"].append({"case": "cancel_cold", "status": "PASSED", "ai_pid": ai_pid})
        process = runtime(owned)
        call(process, "prepare_solo", {"opponent_id": MODEL_ID})
        ai_pid, runtime_pid = owned_ai(process.pid), process.pid
        process.kill(); process.wait(timeout=5)
        wait_dead(ai_pid)
        result["lifecycle"].append({"case": "runtime_SIGKILL_during_cold_load", "status": "PASSED", "runtime_pid": runtime_pid, "ai_pid": ai_pid})
        process = runtime(owned); ai_pid = prewarm_runtime(process)
        runtime_pid = process.pid
        process.kill(); process.wait(timeout=5)
        wait_dead(ai_pid)
        result["lifecycle"].append({"case": "runtime_SIGKILL", "status": "PASSED", "runtime_pid": runtime_pid, "ai_pid": ai_pid})
        parent = subprocess.Popen([sys.executable, "-I", str(Path(__file__).resolve()), "--lease-parent"],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                  cwd=ROOT, env=dict(os.environ, DEIDEI_AI_PYTHON=sys.executable))
        owned.append(parent)
        pids = json.loads(parent.stdout.readline())
        parent.kill(); parent.wait(timeout=5)
        wait_dead(pids["runtime_pid"]); wait_dead(pids["ai_pid"])
        result["lifecycle"].append({"case": "controlled_parent_SIGKILL_EOF_lease", "status": "PASSED", **pids})
        # Original eight identities against the issue's fixed main baseline.
        paths = ["deidei_env.py", "deidei_gym_env.py", "rl_ai.py", "requirements_rl.txt", "rl_checkpoints/latest.zip",
                 "rl_checkpoints/opponent_pool.pkl", "tests/test_core.py", "tests/test_known_regressions.py"]
        identities = []
        for name in paths:
            path = "legacy/rl/" + name
            data = (ROOT / path).read_bytes()
            current = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            baseline = subprocess.check_output(["git", "rev-parse", "01f6bc0cfa4c371c81d042a8cdac614909453f4c:" + path], cwd=ROOT, text=True).strip()
            assert current == baseline
            identities.append({"path": path, "git_blob": current, "sha256": hashlib.sha256(data).hexdigest(), "status": "PASSED"})
        result.update(status="PASSED", original_eight=identities)
    except Exception as error:
        result["error"] = f"{type(error).__name__}: {error}"
        raise
    finally:
        if supervisor:
            supervisor.close()
        for process in owned:
            if process.stdin and not process.stdin.closed:
                process.stdin.close()
            if process.poll() is None:
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait(timeout=5)
            if process.stdout:
                process.stdout.close()
        Path(output).write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k not in ("original_eight",)}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--lease-parent", action="store_true")
    parser.add_argument("--output", default="runtime-ai-probe.json")
    args = parser.parse_args()
    lease_parent() if args.lease_parent else probe(args.output)
