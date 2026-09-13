"""Archive the native package, preserving macOS symlinks; record actual SHA."""
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent
output = root / 'build' / 'delivery'
output.mkdir(parents=True, exist_ok=True)
if sys.platform == 'darwin':
    package = root / 'out' / 'DeiDei R01 Tech B-darwin-arm64' / 'DeiDei R01 Tech B.app'
    archive = output / 'DeiDei-R01-T02-b-macOS-arm64.zip'
    subprocess.run(['ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', str(package), str(archive)], check=True)
elif sys.platform == 'win32':
    package = root / 'out' / 'DeiDei R01 Tech B-win32-x64'
    if not (package / 'DeiDei R01 Tech B.exe').is_file():
        raise FileNotFoundError('Expected native Windows x64 package')
    archive = output / 'DeiDei-R01-T02-b-Windows-x64.zip'
    shutil.make_archive(str(archive.with_suffix('')), 'zip', package.parent, package.name)
else:
    raise RuntimeError('Only native macOS ARM64 / Windows x64 builds are in scope')
(output / 'package-manifest.json').write_text(json.dumps({
    'task_id': 'R01-T02-b',
    'code_sha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'platform': platform.platform(), 'machine': platform.machine(), 'python': platform.python_version(),
    'file': archive.name, 'bytes': archive.stat().st_size,
    'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'build_only': True, 'physical_offline': 'NOT_RUN', 'human_acceptance': 'NOT_RUN',
}, indent=2) + '\n')
print((output / 'package-manifest.json').read_text())
