"""Create a separate, hash-locked AI freeze environment without changing the runtime venv."""
from pathlib import Path
import subprocess
import sys

here = Path(__file__).resolve().parent
target = 'darwin-arm64' if sys.platform == 'darwin' else 'win32-x64'
if sys.platform not in ('darwin', 'win32'):
    raise SystemExit('native macOS arm64 or Windows x64 required')
environment = here / 'ai-build/.venv'
python = environment / ('Scripts/python.exe' if sys.platform == 'win32' else 'bin/python')
if not python.is_file():
    subprocess.run(['uv', 'venv', '--python', '3.11.16', str(environment)], check=True)
subprocess.run(['uv', 'pip', 'sync', '--python', str(python), '--require-hashes', '--only-binary=:all:',
                str(here / f'requirements-{target}.lock'),
                str(here.parent / f'ai/requirements-{target}.lock')], check=True)
subprocess.run(['uv', 'pip', 'check', '--python', str(python)], check=True)
print(python)
