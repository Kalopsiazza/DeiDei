"""Five bounded fault injections in disposable copies; controls must pass first."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[2]
RUNNER='''import asyncio,json,sys
from pathlib import Path
sys.path.insert(0,sys.argv[1])
from tests.rooms_endurance.run import load_module
p=Path(sys.argv[2]);load_module(p/'game/core','deidei_core.api','deidei_core/api.py')
s=load_module(p/'game/server','deidei_server.testing','deidei_server/testing.py')
from websockets.asyncio.client import connect
from tests.rooms_endurance.faults import faults
print('RESULT '+json.dumps(asyncio.run(faults(s,connect,p,[sys.argv[3]]))))
'''


def run(product: Path, selector: str) -> dict:
    p=subprocess.run([sys.executable,'-c',RUNNER,str(ROOT),str(product),selector],capture_output=True,text=True,timeout=75)
    if p.returncode: return dict(status='HARNESS_ERROR',exit=p.returncode)
    lines=[x[7:] for x in p.stdout.splitlines() if x.startswith('RESULT ')];assert len(lines)==1
    result=json.loads(lines[0]);return dict(status=result['status'],cases=result['cases'],exit=p.returncode)


def mutations(product: Path) -> list[dict]:
    rows=[]
    for name,selector in [('null_rate_id','Q01'),('recomputed_deadline','Q03'),('missing_membership','Q11/eliminated_grace'),
                          ('repeat_application','Q12'),('observer_secret','Q15')]:
        control=run(product,selector);row=dict(mutation=name,selector=selector,control=control);rows.append(row)
        if control['status']!='PASS':row['status']='BASELINE_FAIL';continue
        with tempfile.TemporaryDirectory(prefix='r03-c-mutant-') as td:
            copy=Path(td)
            for part in ('core','server','desktop'):
                shutil.copytree(product/'game'/part,copy/'game'/part,ignore=shutil.ignore_patterns('node_modules','build','__pycache__','.venv'))
            file=copy/'game/server/deidei_server'/('server.py' if name in ('null_rate_id','repeat_application') else 'room.py')
            source=file.read_text()
            if name=='missing_membership':old='            if reason:\n';new='            if False and reason:\n'
            elif name=='observer_secret':
                old="accepted_entry_id=self.pending.get(pid) if own and self.phase != 'closed' else None"
                new="accepted_entry_id=next(iter(self.pending.values()),None) if self.phase != 'closed' else None"
            elif name=='repeat_application':
                old="                require(original == fingerprint, 'REQUEST_CONFLICT')\n"
                new=old+"                if msg['op']=='room.submit' and msg['payload']['entry_id']=='Charge':\n                    room=self.rooms[s.room_id];p=room.state['players'][s.player_id]\n                    p['dd6']=str(int(p['dd6'])+6)  # deliberate duplicate application fault\n"
            elif name=='null_rate_id':
                # Candidate anchor resolved only within the dedicated RATE_LIMITED branch.
                import re
                matches=list(re.finditer(r'ack\(([^,\n]+), error=Rejected\(\x27RATE_LIMITED\x27',source))
                if len(matches)!=1:row['status']='MUTATION_TARGET_UNAVAILABLE';continue
                old=matches[0].group(0);new=old.replace(matches[0].group(1),'None',1)
            else:
                import re
                matches=list(re.finditer(r'deadline_at_ms=self\.service\.[a-z_]+\(self\.deadline\)',source))
                if len(matches)!=1:row['status']='MUTATION_TARGET_UNAVAILABLE';continue
                old=matches[0].group(0);new='deadline_at_ms=self.service.clock.wall_ms() + self.deadline - now'
            assert source.count(old)==1;file.write_text(source.replace(old,new));row['patch_sha256']=hashlib.sha256(file.read_bytes()).hexdigest()
            syntax=subprocess.run([sys.executable,'-m','compileall','-q',str(copy/'game/core'),str(copy/'game/server')],capture_output=True)
            env={'PYTHONPATH':str(copy/'game/core')+':'+str(copy/'game/server')}
            imported=subprocess.run([sys.executable,'-c','import deidei_server.testing'],env=env,capture_output=True)
            row['syntax_exit']=syntax.returncode;row['import_exit']=imported.returncode
            if syntax.returncode or imported.returncode:row['status']='INVALID_MUTANT';continue
            row['mutant']=run(copy,selector)
            row['status']='KILLED' if row['mutant']['status']=='FAIL' else 'SURVIVED' if row['mutant']['status']=='PASS' else 'HARNESS_ERROR'
        print(name,row['status'],flush=True)
    return rows

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--product',type=Path,required=True);p.add_argument('--sha',required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    from tests.rooms_v1.run_acceptance import evidence
    before=evidence(a.product/'game/server');assert before['sha']==a.sha and not before['dirty']
    rows=mutations(a.product);assert evidence(a.product/'game/server')==before
    a.output.write_text(json.dumps(dict(source_sha=a.sha,cases=rows),indent=2)+'\n')
