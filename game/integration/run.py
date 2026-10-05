"""One-command regression entry: fixed source, recorded exits, owned GUI/soak subprocesses only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import signal
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
BASE = '8a6f8b29f517ab4c5a16466f0894e86995f8a852'


def git(*args: str) -> str:
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', choices=['all', 'checks', 'gui', 'sequences', 'soak'], default='all')
    parser.add_argument('--output', type=Path, default=None)
    parser.add_argument('--independent-runs', type=int, choices=[1, 2, 3], default=3)
    parser.add_argument('--seeds', type=int, default=100)
    parser.add_argument('--soak-seconds', type=int, default=900)
    args = parser.parse_args()
    output = (args.output or Path(tempfile.mkdtemp(prefix='deidei-integration-'))).resolve()
    output.mkdir(parents=True, exist_ok=True)
    sha = git('rev-parse', 'HEAD')
    assert not git('status', '--porcelain', '--', 'game/server', 'game/desktop', 'game/integration'), 'Commit product/test inputs first'
    subprocess.run(['git', 'merge-base', '--is-ancestor', BASE, sha], cwd=ROOT, check=True)
    jobs = []
    if args.stage in ('all', 'checks'):
        for label, params, pp in [
            ('core', ['-m', 'unittest', 'discover', '-s', 'game/core/tests', '-v'], 'game/core'),
            ('runtime', ['-m', 'unittest', 'discover', '-s', 'game/runtime/tests', '-v'], 'game/core:game/runtime'),
            ('independent-core', ['tests/rules_v1_001/run_acceptance.py', '--core', 'game/core'], ''),
            ('independent-tools', ['-m', 'unittest', 'discover', '-s', 'tests/rules_v1_001', '-p', 'test_*.py', '-v'], ''),
            ('rooms-tools', ['-m', 'unittest', 'tests.rooms_v1.test_harness', '-v'], ''),
            ('root', ['scripts/check.py'], ''),
            ('service', ['-m', 'unittest', 'discover', '-s', 'game/server/tests', '-v'], 'game/core:game/server'),
        ]:
            jobs.append((label, [sys.executable, *params], ROOT, pp, 240))
        jobs.append(('desktop', ['npm', 'test'], ROOT/'game/desktop', '', 240))
        for i in range(args.independent_runs):
            jobs.append((f'independent-socket-{i+1}', [sys.executable, 'tests/rooms_v1/run_acceptance.py', '--server-path', 'game/server', '--core-path', 'game/core', '--tested-code-sha', sha, '--desktop-path', 'game/desktop', '--desktop-sha', sha, '--output', str(output/f'independent-{i+1}.json')], ROOT, '', 600))
    if args.stage in ('all', 'gui'):
        jobs.append(('gui', ['node', 'game/integration/gui.cjs'], ROOT, '', 600))
    if args.stage in ('all', 'sequences'):
        jobs.append(('sequences', [sys.executable, 'game/integration/sequences.py', '--seeds', str(args.seeds), '--output', str(output/'sequences.json')], ROOT, '', 600))
    if args.stage in ('all', 'soak'):
        jobs.append(('soak', ['node', 'game/integration/soak.cjs'], ROOT, '', args.soak_seconds+120))
    report = dict(base_sha=BASE, code_sha=sha, stage=args.stage, platform=platform.platform(), python=sys.version, commands=[])
    for name, command, cwd, pp, timeout in jobs:
        env = dict(os.environ, PYTHONPATH=pp.replace(':', os.pathsep), DEIDEI_PYTHON=sys.executable,
                   DEIDEI_INTEGRATION_OUTPUT=str(output), DEIDEI_SOAK_SECONDS=str(args.soak_seconds))
        began = time.monotonic()
        try:
            child = subprocess.Popen(command, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=os.name != 'nt')
            try:
                text, _ = child.communicate(timeout=timeout)
                code = child.returncode
            except subprocess.TimeoutExpired:
                # Only the process group created by this runner, including its GUI/server children.
                if os.name != 'nt':
                    os.killpg(child.pid, signal.SIGTERM)
                else:
                    child.terminate()
                try:
                    text, _ = child.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    if os.name != 'nt':
                        os.killpg(child.pid, signal.SIGKILL)
                    else:
                        child.kill()
                    text, _ = child.communicate()
                code, text = 124, 'TIMEOUT (owned process cleanup requested):\n' + text
        except OSError as error:
            code, text = 127, type(error).__name__
        # Keep finite diagnostics. Scripts never print credentials or unrevealed opponent choices.
        text = text.replace(str(ROOT), '<checkout>').replace(str(Path.home()), '<home>').replace(str(output), '<output>')
        (output/f'{name}.txt').write_text(text[-100000:])
        report['commands'].append(dict(name=name, command=[x.replace(str(ROOT), '<checkout>').replace(str(Path.home()), '<home>').replace(str(output), '<output>') for x in command], cwd=str(cwd.relative_to(ROOT)) or '.', pythonpath=pp, exit_code=code, elapsed_seconds=round(time.monotonic()-began,3), log=f'{name}.txt'))
        report['status'] = 'FAIL' if any(r['exit_code'] for r in report['commands']) else 'PASS'
        (output/'run.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
        print(name, 'exit', code, flush=True)
    report['source_hashes'] = {p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in git('ls-files', '--', 'game/server', 'game/desktop', 'game/integration').splitlines()}
    (output/'run.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    return int(report['status'] != 'PASS')


if __name__ == '__main__':
    raise SystemExit(main())
