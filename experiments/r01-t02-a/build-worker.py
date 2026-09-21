"""Run on each target OS using the locked build environment."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent
source = root.parents[1] / 'deidei_env.py'
stage = root / 'build' / 'rules'
stage.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, stage / source.name)
(root / 'build' / 'source-manifest.json').write_text(json.dumps({
    'source': 'deidei_env.py', 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()
}, indent=2) + '\n')
subprocess.run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
                '--onedir', '--name', 'worker', '--paths', str(stage),
                '--distpath', str(root / 'dist'), '--workpath', str(root / 'build' / 'pyinstaller'),
                '--specpath', str(root / 'build'), str(root / 'worker.py')], check=True, cwd=root)
shutil.copy2(root / 'build' / 'source-manifest.json', root / 'dist' / 'worker' / 'source-manifest.json')
