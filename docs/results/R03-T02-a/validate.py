"""Reproduce T02 desktop checks without a real room service or credentials."""
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
env = dict(os.environ)
env.pop('DEIDEI_ROOM_URL', None)
env.pop('ELECTRON_RUN_AS_NODE', None)
env['DEIDEI_SMOKE_OUTPUT'] = str(OUT / 'offline-regression')
env['DEIDEI_ONLINE_SMOKE_OUTPUT'] = str(OUT)
checks = [
    ('root', ['python3', 'scripts/check.py'], ROOT),
    ('desktop-baseline', ['npm', 'test'], ROOT / 'game/desktop'),
    ('online-unit', ['npm', 'run', 'test:online'], ROOT / 'game/desktop'),
    ('websocket-probe', ['./node_modules/.bin/electron', 'tests-online/probe.cjs'], ROOT / 'game/desktop'),
    ('online-window', ['npm', 'run', 'smoke:online'], ROOT / 'game/desktop'),
    ('offline-window', ['node', 'game/desktop/smoke-live.cjs'], ROOT),
]
results = []
for name, command, cwd in checks:
    started = time.monotonic()
    result = subprocess.run(command, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
    (OUT / f'{name}.txt').write_text(result.stdout.replace(str(ROOT), '<worktree>'), encoding='utf-8')
    results.append({'name': name, 'command': command, 'cwd': str(cwd.relative_to(ROOT)), 'exit_code': result.returncode, 'seconds': round(time.monotonic() - started, 2)})
    print(name, 'PASS' if result.returncode == 0 else 'FAIL', flush=True)
    if result.returncode:
        print(result.stdout[-3000:], flush=True)
record = {'tested_sha': sha, 'platform': os.uname().sysname, 'arch': os.uname().machine, 'checks': results, 'real_room_service': 'NOT_RUN', 'windows': 'NOT_RUN', 'status': 'PASS' if all(r['exit_code'] == 0 for r in results) else 'FAIL'}
(OUT / 'validation.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
raise SystemExit(0 if record['status'] == 'PASS' else 1)
