"""Exercise protocol boundaries against source or the packaged executable."""
import json
from pathlib import Path
import subprocess
import sys

command = sys.argv[1:] or [sys.executable, str(Path(__file__).with_name('worker.py'))]
frames = []
for case in ['charge_charge', 'bi_charge', 'bi_def', 'reflect_bi']:
    frames.append({'v': 1, 'id': case, 'op': 'run_case', 'payload': {'case_id': case}})
frames += [{'v': 1, 'id': f'easy-{n}', 'op': 'choose_easy', 'payload': {'seed': 42}} for n in range(2)]
frames += [{'v': 1, 'id': 'bad', 'op': 'choose_easy', 'payload': {'seed': True}},
           {'v': 1, 'id': 'inject', 'op': 'run_case', 'payload': {'case_id': '__import__("os")'}},
           {'v': 1, 'id': 'health', 'op': 'health', 'payload': {}}]
raw = b'{invalid}\n' + b'x' * 65537 + b'\n' + b'\n'.join(json.dumps(f).encode() for f in frames) + b'\n'
raw += b'{"v":1,"id":"stop","op":"shutdown","payload":{}}\n'
p = subprocess.run(command, input=raw, capture_output=True, timeout=15, check=True)
rows = [json.loads(line) for line in p.stdout.splitlines()]
assert len(rows) == 12, rows
assert all(not r['ok'] for r in rows[:2])
assert [r['data']['result']['outcome'] for r in rows[2:6]] == ['Continue', 'PlayerWin', 'Continue', 'PlayerWin']
assert rows[2]['data']['result']['nextP']['dd'] == 6
assert rows[6]['data'] == rows[7]['data']
assert not rows[8]['ok'] and not rows[9]['ok']
assert rows[10]['id'] == 'health' and rows[10]['ok'] and rows[11]['ok']
p = subprocess.run(command, input=b'{"v":1', capture_output=True, timeout=15, check=True)
assert not json.loads(p.stdout)['ok']
print(json.dumps({'checks': ['four fixed cases', 'seed repeatability', 'invalid JSON', 'oversized frame recovery', 'incomplete EOF', 'bad types', 'injection rejection', 'health', 'shutdown'], 'responses': rows}, indent=2))
