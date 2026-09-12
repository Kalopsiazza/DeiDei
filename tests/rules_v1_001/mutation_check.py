"""Apply reviewed exact-text mutations only to temporary core copies.

No source-bound mutation is claimed until an accepted core SHA and an explicit
binding exist. Session replay is a separate future integration mutation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
PLAN = [
    {'id':'skip_dead_actor','scope':'core','cases':['C004','C026','C043','C050','C060'],
     'change':'Skip later effects once the actor has a lethal record; dead reflectors/clearers/attackers must still act.'},
    {'id':'restore_collision_in_p3','scope':'core','cases':['C024','C026','C053','C075'],
     'change':'Use primary collision defense for returns instead of the defined P3 defense.'},
    {'id':'copy_charged_twice','scope':'core','cases':['C037','C038','C039','C065','C075'],
     'change':'Add the copied move ordinary DD/charge/resource fee to the Zhang source spend plan.'},
    {'id':'recovery_is_repeat','scope':'core','cases':['C066','C067'],
     'change':'Remove the recovery exemption while comparing complete previous and current moves.'},
    {'id':'reward_replay_reapplies','scope':'session','cases':['C081/session_request_replay'],
     'change':'Reapply an old due-turn result after the reward was spent; live state must remain spent.'},
    {'id':'drop_joint_killer','scope':'core','cases':['C004','C031','C032','C047','C074/core_full_reset'],
     'change':'Record only the first killer of a target; every effective killer needs the same target.'},
]


def apply_patch_copy(root: Path, binding: dict) -> None:
    """One reviewed replacement; refuse path escape, stale context and no-op patches."""
    if set(binding)!={'path','find','replace'}:
        raise ValueError('Binding requires exactly path/find/replace')
    relative = Path(binding['path'])
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Mutation path must stay relative to copied core')
    path = root/relative
    if not path.resolve().is_relative_to(root.resolve()) or path.is_symlink() or path.suffix!='.py':
        raise ValueError('Mutation must target a Python file inside copied core')
    find,replace = binding['find'],binding['replace']
    if not isinstance(find,str) or not find or not isinstance(replace,str) or find==replace:
        raise ValueError('Mutation must be a nonempty, non-no-op exact replacement')
    text = path.read_text(encoding='utf-8')
    if text.count(find)!=1:
        raise ValueError('Mutation context must match exactly once; rebind against accepted SHA')
    path.write_text(text.replace(find,replace,1),encoding='utf-8')


def source_hashes(core: Path) -> dict:
    return {str(p.relative_to(core)):hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(core.rglob('*.py')) if '__pycache__' not in p.parts}


def acceptance(core: Path, cases: list[str]) -> tuple[int,dict]:
    command = [sys.executable,str(HERE/'run_acceptance.py'),'--core',str(core)]
    for case in cases:
        command += ['--case',case]
    result = subprocess.run(command,capture_output=True,text=True,timeout=60)
    try:
        report = json.loads(result.stdout)
    except ValueError:
        report = {'status':'HARNESS_PROCESS_ERROR','stdout':result.stdout[-4000:],'stderr':result.stderr[-4000:]}
    return result.returncode,report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--core',type=Path,help='Accepted core directory; omit to print pending plan')
    parser.add_argument('--bindings',type=Path,help='JSON {accepted_sha, mutations: {id: {path,find,replace}}}')
    args = parser.parse_args()
    pending = [dict(item,status='NOT_RUN',binding=None) for item in PLAN]
    if args.core is None or not (args.core/'deidei_core'/'api.py').is_file():
        print(json.dumps({'status':'ENGINE_NOT_AVAILABLE','mutations_killed':0,'mutations':pending},ensure_ascii=False))
        return 2
    if args.bindings is None:
        print(json.dumps({'status':'MUTATIONS_NOT_BOUND','mutations_killed':0,'mutations':pending},ensure_ascii=False))
        return 3
    core = args.core.resolve()
    before = source_hashes(core)
    reports = []
    try:
        binding = json.loads(args.bindings.read_text(encoding='utf-8'))
        if set(binding)!={'accepted_sha','mutations'}:
            raise ValueError('Bindings require accepted_sha and mutations')
        head = subprocess.run(['git','-C',str(core),'rev-parse','HEAD'],capture_output=True,text=True,check=True).stdout.strip()
        if binding['accepted_sha']!=head:
            raise ValueError('Bindings do not match the accepted core SHA')
        status = subprocess.run(['git','-C',str(core),'status','--porcelain','--','.'],capture_output=True,text=True,check=True).stdout
        if status.strip():
            raise ValueError('Core source has uncommitted changes; bind a clean accepted SHA')
        allowed = {m['id'] for m in PLAN if m['scope']=='core'}
        if set(binding['mutations'])!=allowed:
            raise ValueError('Bindings must cover the five core mutation IDs; session needs its future adapter')
        if any(p.is_symlink() for p in core.rglob('*')):
            raise ValueError('Refusing symlinks in a mutation source tree')
        baseline_code,baseline = acceptance(core,[])
        if baseline_code!=0 or baseline.get('engine_failed')!=0:
            print(json.dumps({'status':'BASELINE_NOT_PASS','mutations_killed':0,'baseline':baseline},ensure_ascii=False))
            return 1
        for item in PLAN:
            if item['scope']=='session':
                reports.append(dict(item,status='SESSION_NOT_AVAILABLE'))
                continue
            with tempfile.TemporaryDirectory(prefix='deidei-r02-mutant-') as folder:
                copied = Path(folder)/'core'
                shutil.copytree(core,copied,ignore=shutil.ignore_patterns('.git','__pycache__','.venv'))
                apply_patch_copy(copied,binding['mutations'][item['id']])
                code,result = acceptance(copied,item['cases'])
                # An import/syntax error is invalid injection, never a killed gameplay mutation.
                outcome = 'KILLED' if code==1 and result.get('status')=='FAIL' and result.get('engine_failed',0)>0 else ('SURVIVED' if code==0 else 'INVALID_MUTATION')
                reports.append(dict(item,status=outcome,report=result))
        killed = sum(r['status']=='KILLED' for r in reports)
        print(json.dumps({'status':'CORE_MUTATIONS_CHECKED_SESSION_NOT_RUN','accepted_sha':head,
                          'mutations_killed':killed,'mutations':reports},ensure_ascii=False))
        return 0 if killed==5 else 1
    except (ValueError,OSError,subprocess.SubprocessError) as exc:
        print(json.dumps({'status':'MUTATION_SETUP_ERROR','error':str(exc),'mutations_killed':0},ensure_ascii=False))
        return 1
    finally:
        if source_hashes(core)!=before:
            raise RuntimeError('Original source changed during mutation check; result is invalid')


if __name__=='__main__':
    raise SystemExit(main())
