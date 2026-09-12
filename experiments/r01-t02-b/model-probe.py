"""Inspect trusted repository checkpoint on CPU; reject every fallback."""
import hashlib
import json
from pathlib import Path
import resource
import sys
import time

repo = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(repo))
checkpoint = repo / 'rl_checkpoints' / 'latest.zip'
report = {'checkpoint_sha256': hashlib.sha256(checkpoint.read_bytes()).hexdigest(), 'device': 'cpu', 'fallback': False}
start = time.perf_counter()
try:
    import rl_ai
    from deidei_env import PlayerState, list_legal_moves
    from deidei_gym_env import ALL_MOVES
    rl_ai.set_rl_inference_threads(1)
    model, masked = rl_ai._load_model(str(checkpoint), device='cpu')
    report['load_ms'] = (time.perf_counter() - start) * 1000
    if model is None:
        raise RuntimeError('Existing loader returned no model; fallback is not a pass')
    report['model_class'] = type(model).__module__ + '.' + type(model).__name__
    report['actual_device'] = str(model.device)
    samples = []
    for dd in [0, 6, 18, 60]:
        cpu, player = PlayerState(dd=dd), PlayerState(dd=6)
        obs, mask = rl_ai._obs_and_mask(cpu, player)
        t = time.perf_counter()
        # Call the loaded model directly so swallowed errors/random fallbacks cannot pass.
        action, _ = model.predict(obs, deterministic=True, **({'action_masks': mask} if masked else {}))
        elapsed = (time.perf_counter() - t) * 1000
        move = ALL_MOVES[int(action)]
        assert move in list_legal_moves(cpu, player)
        samples.append({'cpu_dd':dd, 'move':move.name, 'predict_ms':elapsed})
    report.update(status='PASS_CPU_LOAD_AND_RAW_PREDICT_ONLY',samples=samples,
                  gui_imported='gui_deidei' in sys.modules,tkinter_imported='tkinter' in sys.modules)
except Exception as exc:
    report.update(status='FAIL', error=type(exc).__name__ + ': ' + str(exc).replace(str(repo), '<repo>'))
report['peak_rss_bytes'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(1 if report['status']=='FAIL' else 0)
