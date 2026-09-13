"""Reproduce the local acceptance and retain exit codes without changing input fixtures."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(__file__).resolve().parent


def run(args: list[str], log: str, pythonpath: str | None = None) -> dict:
    env = os.environ.copy()
    if pythonpath:
        env['PYTHONPATH'] = pythonpath
    with (OUTPUT / log).open('w') as stream:
        result = subprocess.run(args, cwd=ROOT, env=env, stdout=stream, stderr=subprocess.STDOUT)
    print(f'{log}: exit {result.returncode}', flush=True)
    return {'args': args, 'PYTHONPATH': pythonpath, 'log': log, 'exit_code': result.returncode}


def main() -> None:
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    results = []
    for args, log, pythonpath in [
        (['python3', 'tests/rules_v1_001/validate_fixtures.py'], 'fixture-validation.txt', None),
        (['python3', 'tests/rules_v1_001/run_acceptance.py', '--core', 'game/core'], 'independent-acceptance.txt', None),
        (['python3', '-m', 'unittest', 'discover', '-s', 'game/core/tests', '-v'], 'core-self-tests.txt', 'game/core'),
        (['python3', '-m', 'unittest', 'discover', '-s', 'tests/rules_v1_001', '-p', 'test_*.py', '-v'], 'harness-self-tests.txt', None),
        (['python3', '-m', 'unittest', 'discover', '-s', 'game/runtime/tests', '-v'], 'runtime-tests.txt', 'game/core:game/runtime'),
        (['python3', 'scripts/check.py'], 'root-check.txt', None),
        (['npm', '--prefix', 'game/desktop', 'test'], 'desktop-original-tests.txt', None),
        (['node', '--test', 'game/desktop/test-live.cjs'], 'desktop-live-tests.txt', None),
        (['npm', '--prefix', 'game/desktop', 'run', 'smoke'], 'live-smoke.txt', None),
    ]:
        results.append(run(args, log, pythonpath))
        if results[-1]['exit_code']:
            break
    report = {'tested_code_sha': sha, 'platform': platform.platform(), 'machine': platform.machine(),
              'python': sys.version, 'node': subprocess.check_output(['node', '--version'], text=True).strip(),
              'npm': subprocess.check_output(['npm', '--version'], text=True).strip(), 'checks': results}
    (OUTPUT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if any(r['exit_code'] for r in results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
