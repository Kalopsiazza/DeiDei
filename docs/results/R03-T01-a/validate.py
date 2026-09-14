"""Run the local task checks and record exact commands, exits, hashes and platform."""
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
INPUT_SHA = '23520350393ba43384c20b60bef7d6dbd89fc142'


def git(*args: str) -> str:
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def main() -> int:
    sha = git('rev-parse', 'HEAD')
    if git('status', '--porcelain', '--', 'game/server'):
        raise SystemExit('Commit the tested server source first; results may be regenerated separately.')
    jobs = [
        ('server', ['-m', 'unittest', 'discover', '-s', 'game/server/tests', '-v'], 'game/core:game/server'),
        ('core', ['-m', 'unittest', 'discover', '-s', 'game/core/tests', '-v'], 'game/core'),
        ('independent-core', ['tests/rules_v1_001/run_acceptance.py', '--core', 'game/core'], ''),
        ('independent-tools', ['-m', 'unittest', 'discover', '-s', 'tests/rules_v1_001', '-p', 'test_*.py', '-v'], ''),
        ('root', ['scripts/check.py'], ''),
        ('pip-check', ['-m', 'pip', 'check'], ''),
        ('cli-help', ['-m', 'deidei_server', '--help'], 'game/core:game/server'),
    ]
    records = []
    (OUT / 'evidence').mkdir(exist_ok=True)
    for name, args, path in jobs:
        env = dict(os.environ, PYTHONPATH=path.replace(':', os.pathsep))
        command = [sys.executable, *args]
        started = time.time()
        result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, timeout=180)
        output = (result.stdout + result.stderr).replace(str(ROOT), '<checkout>').replace(str(Path(sys.executable).parent.parent), '<venv>')
        (OUT / 'evidence' / (name + '.txt')).write_text(output)
        records.append(dict(name=name, command=['<venv>/bin/python', *args], pythonpath=path,
                            exit_code=result.returncode, elapsed_seconds=round(time.time()-started, 3),
                            log='evidence/'+name+'.txt', tested_code_sha=sha))
        print(name, 'exit', result.returncode, flush=True)
    files = git('ls-files', '--', 'game/server').splitlines()
    source_hashes = {name: hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in files}
    manifest = dict(task_id='R03-T01-a', input_sha=INPUT_SHA, product_source_sha=INPUT_SHA,
        plan_sha=None, context_plan_sha=git('rev-parse', 'origin/integration/r03'),
        plan_manifest_sha256='4442d966b87b477c111f9b99ae9e3444ccfe94dd8338ab5a1910b4e3acd88684',
        planning_files_verified=18, tested_code_sha=sha, branch=git('branch','--show-current'),
        platform=platform.platform(), python_version=sys.version, run_at_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
        commands=records, server_source_sha256=source_hashes,
        out_of_scope_diff=git('diff','--name-only',INPUT_SHA,'--','game/core','game/runtime','game/desktop','tests','scripts','packaging','.github'),
        dependency_security='dependency-security.json', decisions_status='PROVISIONAL',
        independent_rooms='NOT_RUN: T03 is a separate task', gui='NOT_RUN: T01 is server-only',
        windows='NOT_RUN', cross_machine='NOT_RUN', human_play='NOT_RUN',
        push='NOT_RUN: no separate user authorization', pr_url=None, result_pr_base='integration/r03')
    (OUT/'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    return int(any(r['exit_code'] for r in records) or bool(manifest['out_of_scope_diff']))


if __name__ == '__main__':
    raise SystemExit(main())
