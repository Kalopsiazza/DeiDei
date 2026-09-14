"""Re-run this package's required checks from the repository root."""
import json
import os
from pathlib import Path
import platform
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(__file__).resolve().parent
checks = [
    ('fixture-validation', ['python3', 'tests/rules_v1_001/validate_fixtures.py'], {}),
    ('independent-acceptance', ['python3', 'tests/rules_v1_001/run_acceptance.py', '--core', 'game/core'], {}),
    ('core-self-tests', ['python3', '-m', 'unittest', 'discover', '-s', 'game/core/tests', '-v'], {'PYTHONPATH': 'game/core'}),
    ('harness-self-tests', ['python3', '-m', 'unittest', 'discover', '-s', 'tests/rules_v1_001', '-p', 'test_*.py', '-v'], {}),
    ('runtime-tests', ['python3', '-m', 'unittest', 'discover', '-s', 'game/runtime/tests', '-v'], {'PYTHONPATH': 'game/core:game/runtime'}),
    ('root-check', ['python3', 'scripts/check.py'], {}),
    ('desktop-tests', ['npm', '--prefix', 'game/desktop', 'test'], {}),
    ('window-after', ['node', 'game/desktop/smoke-live-b.cjs'], {}),
    ('live-regression', ['node', 'game/desktop/smoke-live.cjs'], {'DEIDEI_SMOKE_OUTPUT': 'docs/results/R02-T04-b/regression'}),
]
report = {
    'tested_code_sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'platform': platform.platform(), 'python': platform.python_version(),
    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
    'npm': subprocess.check_output(['npm', '--version'], text=True).strip(), 'checks': [],
}
for name, args, environment in checks:
    started = time.time()
    with (OUTPUT / f'{name}.txt').open('w') as log:
        result = subprocess.run(args, cwd=ROOT, env={**os.environ, **environment}, stdout=log, stderr=subprocess.STDOUT)
    report['checks'].append({'args': args, 'environment': environment, 'log': f'{name}.txt',
                             'exit_code': result.returncode, 'seconds': round(time.time() - started, 3)})
    (OUTPUT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'{name}: exit {result.returncode}', flush=True)
    if result.returncode:
        raise SystemExit(result.returncode)
