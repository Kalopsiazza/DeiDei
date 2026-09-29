"""Strict, read-only consumption of the one named T04 branch. No receipt commands execute."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

BASE = '8a6f8b29f517ab4c5a16466f0894e86995f8a852'
BRANCH = 'codex/r03-t04-a-live-integration'
FIXED = dict(schema_version=1, task_id='R03-T04-a', base_sha=BASE,
    core_tree='628afbee9bd9d2c512c2b6d424a385f597025ebc',
    runtime_tree='e37caf42f81f004345fc4917a61874167c18fb21',
    desktop_lock_sha256='11eb5d1c6d1f6d3da7bf50d99f8fdc1303c05fe3591b360441b2e6a2ee9981b8')


def schema(receipt: dict) -> None:
    assert type(receipt) is dict and set(receipt)==set(FIXED)|{'code_sha','stage','checks'}
    for key,value in FIXED.items(): assert type(receipt[key]) is type(value) and receipt[key]==value
    assert type(receipt['code_sha']) is str and re.fullmatch('[0-9a-f]{40}',receipt['code_sha'])
    assert receipt['stage'] in ('source_checked_pending_gui','integrated_local_pass')
    checks=receipt['checks'];assert type(checks) is dict
    assert set(checks)=={'service','core','runtime','desktop','independent_socket','real_gui'}
    assert all(v=='PASS' for k,v in checks.items() if k!='real_gui')
    assert checks['real_gui'] in ('PASS','NOT_RUN')
    if receipt['stage']=='integrated_local_pass': assert checks['real_gui']=='PASS'


def git(root: Path, *args: str) -> bytes:
    return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True,timeout=60).stdout


def check(root: Path, record: Path, stage: str) -> dict:
    history=json.loads(record.read_text());assert len(history)<3,'three-check budget exhausted'
    row=dict(check=len(history)+1,stage=stage,branch=BRANCH)
    # Record attempted checks, including failures, to prevent accidental unbounded polling.
    history.append(row)
    try:
        tip=git(root,'ls-remote','--heads','origin','refs/heads/'+BRANCH).decode().strip()
        if not tip:row['result']='BRANCH_ABSENT';return row
        git(root,'fetch','origin','refs/heads/'+BRANCH+':refs/remotes/origin/'+BRANCH)
        head=git(root,'rev-parse','refs/remotes/origin/'+BRANCH).decode().strip()
        row['receipt_commit']=head
        receipt=json.loads(git(root,'show',head+':docs/results/R03-T04-a/CANDIDATE.json'))
        schema(receipt);sha=receipt['code_sha']
        git(root,'merge-base','--is-ancestor',BASE,sha);git(root,'merge-base','--is-ancestor',sha,head)
        assert sha!=head,'code_sha must precede receipt commit'
        for directory,field in [('game/core','core_tree'),('game/runtime','runtime_tree')]:
            assert git(root,'rev-parse',sha+':'+directory).decode().strip()==FIXED[field]
        lock=git(root,'show',sha+':game/desktop/package-lock.json')
        assert hashlib.sha256(lock).hexdigest()==FIXED['desktop_lock_sha256']
        paths=git(root,'diff','--name-only',BASE,sha).decode().splitlines()
        assert all(p.startswith(('game/server/','game/desktop/','game/integration/','docs/results/R03-T04-a/')) for p in paths)
        assert not any(p.endswith(('.lock','package-lock.json')) for p in paths),'dependency lock changed'
        row.update(result='VALID',receipt=receipt,changed_paths=paths)
    except Exception as e:row.update(result='INVALID_OR_UNAVAILABLE',error=type(e).__name__)
    finally:record.write_text(json.dumps(history,indent=2)+'\n')
    return row

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--record',type=Path,required=True)
    p.add_argument('--stage',choices=['independent_complete','final_delivery'],required=True);a=p.parse_args()
    print(json.dumps(check(a.root,a.record,a.stage),indent=2))
