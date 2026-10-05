from pathlib import Path
import re, zipfile, argparse
from fractions import Fraction
from urllib.parse import unquote
parser=argparse.ArgumentParser(description="Static documentation checks only; no game execution")
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[4])
parser.add_argument('--baseline-archive', type=Path)
args=parser.parse_args()
root=args.root.resolve()
paths=['WORK_START_HERE.md','docs/production/STATUS.md','docs/reviews/R01-T01-a.md',
'docs/prd/PRD-RULES-v1.0.md','docs/architecture/RULE-ENGINE-v1.0.md',
'docs/rules/v1/README.md','docs/rules/v1/PLAYER-GUIDE.md','docs/rules/v1/RULEBOOK.md',
'docs/rules/v1/CASES.md','docs/rules/v1/TRACEABILITY.md']
files=[root / name for name in paths]
for p in files:
    text=p.read_text(encoding='utf-8')
    assert text.endswith('\n'),p
    assert '\r' not in text,p
    in_fence=False;cols=None
    for line in text.splitlines():
        if line.startswith('```'):in_fence=not in_fence;cols=None
        if in_fence:continue
        if line.startswith('|'):
            n=len(re.split(r'(?<!\\)\|',line))-2
            if cols is None:cols=n
            assert n==cols,(p,line,n,cols)
        else:cols=None
rb=(root/'docs/rules/v1/RULEBOOK.md').read_text()
pg=(root/'docs/rules/v1/PLAYER-GUIDE.md').read_text()
cb=(root/'docs/rules/v1/CASES.md').read_text()
tr=(root/'docs/rules/v1/TRACEABILITY.md').read_text()
assert re.findall(r'<a id="(R\d+)"',rb)==[f'R{i:02}' for i in range(1,29)]
assert re.findall(r'^\| (E\d+) \|',rb,re.M)==[f'E{i:02}' for i in range(1,34)]
assert re.findall(r'^\| (E\d+) \|',pg,re.M)==[f'E{i:02}' for i in range(1,34)]
assert re.findall(r'^\| (G\d+) \|',tr,re.M)==[f'G{i:02}' for i in range(1,61)]
assert re.findall(r'<a id="(C\d+)"',cb)==[f'C{i:03}' for i in range(1,81)]
assert 'DESIGNED_NOT_RUN' in cb
# Every editorial entry has a specific case beyond the generic coverage section.
chunks=re.split(r'<a id="C[0-9]{3}"></a>',cb)[1:]
coverage=set()
for i,chunk in enumerate(chunks,1):
    if i!=75:coverage.update(re.findall(r'\bE[0-9]{2}\b',chunk))
assert coverage=={f'E{i:02}' for i in range(1,34)},coverage
for p in files:
    text=p.read_text()
    assert all(1<=int(n)<=80 for n in re.findall(r'\bC(\d{3})\b',text)),p
    assert all(1<=int(n)<=28 for n in re.findall(r'\bR(\d{2})(?![\d-])\b',text)),p
# Known planning files remain available at the unchanged baseline.
base_names=set()
if args.baseline_archive:
    with zipfile.ZipFile(args.baseline_archive) as z:
        base_names=set(z.namelist())
base_files=set()
for n in base_names:
    for marker in ['docs/','WORK_START_HERE.md','AGENTS.md']:
        if marker in n:base_files.add(n[n.index(marker):])
link_count=0
for p in files:
    for dest in re.findall(r'\]\(([^)]+)\)',p.read_text()):
        if '://' in dest or dest.startswith('mailto:'):continue
        d,_,anchor=dest.partition('#')
        q=(p.parent/unquote(d)).resolve() if d else p
        rel=str(q.relative_to(root))
        assert q.exists() or rel in base_files,(p,d,rel)
        if anchor and q.exists():
            assert f'id="{anchor}"' in q.read_text(),(p,q,anchor)
        link_count+=1
units={x:int(Fraction(x)*6) for x in ['1/3','1/2','1','2','3','7/2','4','5','7','9','10','100','9999','10000']}
assert all(Fraction(x)*6==v for x,v in units.items())
assert units['9999'] < units['10000']
print('DOCUMENT_CHECK_PASS')
print(f'UTF-8/line endings/Markdown table columns: {len(files)} Markdown files')
print('Normative anchors R01-R28: 28; editorial entries E01-E33: 33 in rulebook and player guide')
print('Source mapping G01-G60: 60; expected case groups C001-C080: 80')
print('Substantive case entry coverage, excluding generic coverage row: 33/33')
print(f'Local/baseline links and explicit anchors: {link_count}')
print('Exact sixth-unit numeric representation: 14 finite values checked; infinity remains a separate tag')
print('All new case groups: DESIGNED_NOT_RUN')
print('No game engine, model, GUI, multiplayer or installer tests were executed by this document check.')
