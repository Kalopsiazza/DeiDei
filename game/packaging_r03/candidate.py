"""Fixed-repository candidate receipt validation; never execute receipt commands."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

BASE = '8a6f8b29f517ab4c5a16466f0894e86995f8a852'
BRANCH = 'codex/r03-t04-a-live-integration'
RECEIPT = 'docs/results/R03-T04-a/CANDIDATE.json'
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PROTECTED = {'game/core': '628afbee9bd9d2c512c2b6d424a385f597025ebc',
             'game/runtime': 'e37caf42f81f004345fc4917a61874167c18fb21'}
LOCK_HASH = '11eb5d1c6d1f6d3da7bf50d99f8fdc1303c05fe3591b360441b2e6a2ee9981b8'


def git(root: Path, *args: str) -> str:
    return subprocess.check_output(['git', *args], cwd=root, text=True).strip()


def blob(root: Path, sha: str, path: str) -> bytes:
    return subprocess.check_output(['git', 'show', f'{sha}:{path}'], cwd=root)


def verify_source(root: Path, sha: str) -> None:
    assert re.fullmatch('[0-9a-f]{40}', sha), 'INVALID_SOURCE_SHA'
    subprocess.run(['git', 'merge-base', '--is-ancestor', BASE, sha], cwd=root, check=True)
    changed = git(root, 'diff', '--name-only', BASE, sha).splitlines()
    assert all(p.startswith(('game/server/', 'game/desktop/', 'game/integration/', 'docs/results/R03-T04-a/')) for p in changed), 'SOURCE_SCOPE_CHANGED'
    for path, tree in PROTECTED.items():
        assert git(root, 'rev-parse', f'{sha}:{path}') == tree, 'PROTECTED_TREE_CHANGED'
    assert hashlib.sha256(blob(root, sha, 'game/desktop/package-lock.json')).hexdigest() == LOCK_HASH, 'DESKTOP_LOCK_CHANGED'
    for path in ['game/server/requirements.in', 'game/server/requirements.lock']:
        assert blob(root, sha, path) == blob(root, BASE, path), 'SERVER_LOCK_CHANGED'
    base = json.loads(blob(root, BASE, 'game/desktop/package.json'))
    current = json.loads(blob(root, sha, 'game/desktop/package.json'))
    assert {k: v for k, v in base.items() if k != 'scripts'} == {k: v for k, v in current.items() if k != 'scripts'}, 'DESKTOP_PACKAGE_CHANGED'


def validate_receipt(value: dict) -> None:
    assert set(value) == {'schema_version', 'task_id', 'base_sha', 'code_sha', 'core_tree', 'runtime_tree', 'desktop_lock_sha256', 'stage', 'checks'}, 'RECEIPT_FIELDS'
    assert type(value['schema_version']) is int and value['schema_version'] == 1
    assert value['task_id'] == 'R03-T04-a' and value['base_sha'] == BASE
    assert isinstance(value['code_sha'], str) and re.fullmatch('[0-9a-f]{40}', value['code_sha'])
    assert value['core_tree'] == PROTECTED['game/core'] and value['runtime_tree'] == PROTECTED['game/runtime']
    assert value['desktop_lock_sha256'] == LOCK_HASH
    assert value['stage'] in ('source_checked_pending_gui', 'integrated_local_pass')
    checks = value['checks']
    assert set(checks) == {'service', 'core', 'runtime', 'desktop', 'independent_socket', 'real_gui'}
    assert all(checks[k] == 'PASS' for k in checks if k != 'real_gui')
    assert checks['real_gui'] in ('PASS', 'NOT_RUN')
    assert value['stage'] != 'integrated_local_pass' or checks['real_gui'] == 'PASS'


def read_input(root: Path, file: Path) -> dict:
    value = json.loads(file.read_text())
    assert set(value) == {'source_sha', 'status', 'candidate_receipt_sha'}
    verify_source(root, value['source_sha'])
    if value['status'] == 'DIAGNOSTIC_BASELINE':
        assert value['source_sha'] == BASE and value['candidate_receipt_sha'] is None
    else:
        assert value['status'] == 'CANDIDATE'
        receipt_sha = value['candidate_receipt_sha']
        assert isinstance(receipt_sha, str) and re.fullmatch('[0-9a-f]{40}', receipt_sha)
        receipt = json.loads(blob(root, receipt_sha, RECEIPT)); validate_receipt(receipt)
        assert receipt['code_sha'] == value['source_sha'] and receipt_sha != value['source_sha']
        subprocess.run(['git', 'merge-base', '--is-ancestor', value['source_sha'], receipt_sha], cwd=root, check=True)
        # Receipt must be reachable from the one permitted same-repository branch.
        subprocess.run(['git', 'merge-base', '--is-ancestor', receipt_sha, f'refs/remotes/origin/{BRANCH}'], cwd=root, check=True)
    return value


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument('--refresh', action='store_true'); parser.add_argument('--output', type=Path); parser.add_argument('--source', type=Path, default=ROOT)
    args = parser.parse_args()
    if args.refresh:
        assert git(ROOT, 'remote', 'get-url', 'origin') == 'https://github.com/Kalopsiazza/DeiDei.git', 'REPOSITORY_MISMATCH'
        found = git(ROOT, 'ls-remote', 'origin', f'refs/heads/{BRANCH}')
        if not found:
            print('NO_CANDIDATE'); return
        subprocess.run(['git', 'fetch', 'origin', f'{BRANCH}:refs/remotes/origin/{BRANCH}'], cwd=ROOT, check=True)
        receipt_sha = git(ROOT, 'rev-parse', f'refs/remotes/origin/{BRANCH}')
        exists = subprocess.run(['git', 'cat-file', '-e', f'{receipt_sha}:{RECEIPT}'], cwd=ROOT, capture_output=True)
        if exists.returncode:
            print('NO_CANDIDATE_RECEIPT'); return
        receipt = json.loads(blob(ROOT, receipt_sha, RECEIPT)); validate_receipt(receipt)
        value = dict(source_sha=receipt['code_sha'], status='CANDIDATE', candidate_receipt_sha=receipt_sha)
        verify_source(ROOT, value['source_sha'])
        subprocess.run(['git', 'merge-base', '--is-ancestor', value['source_sha'], receipt_sha], cwd=ROOT, check=True)
        assert value['source_sha'] != receipt_sha
        if args.output: args.output.write_text(json.dumps(value, indent=2) + '\n')
        print(json.dumps(value)); return
    value = read_input(args.source, HERE / 'candidate-input.json')
    assert git(args.source, 'rev-parse', 'HEAD') == value['source_sha'], 'CHECKOUT_SHA_MISMATCH'
    print(json.dumps(value))


if __name__ == '__main__':
    main()
