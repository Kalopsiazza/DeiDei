"""Collect the locked runtime licenses before signing; no network or private input."""
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import shutil
import sys

here = Path(__file__).resolve().parent
desktop = here.parent / 'desktop'
out, stage = map(Path, sys.argv[1:3])
out.mkdir(parents=True, exist_ok=False)
records = []


def copy(source, relative, origin):
    target = out / relative
    if not target.resolve().is_relative_to(out.resolve()):
        raise RuntimeError('LICENSE_PATH_INVALID')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    records.append({'file': relative, 'source': origin,
                    'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})


licenses = re.compile(r'^(?:licen[sc]e|notice|copying|authors|copyright)(?:[._-]|$)', re.I)
fallbacks = json.loads((here / 'licenses/AI-SOURCES.json').read_text())
for distribution in importlib.metadata.distributions():
    name = distribution.metadata['Name']
    found = False
    for file in distribution.files or []:
        source = Path(distribution.locate_file(file))
        if source.is_file() and (licenses.match(source.name) or '.dist-info/licenses/' in str(file).replace('\\', '/')):
            copy(source, f'python/{name}/{str(file).replace(chr(92), "/")}', f'{name}=={distribution.version}')
            found = True
    fallback = fallbacks.get(name.lower())
    if not found and fallback and fallback['version'] == distribution.version:
        source = here / 'licenses' / fallback['file']
        if hashlib.sha256(source.read_bytes()).hexdigest() != fallback['sha256']:
            raise RuntimeError('AI_LICENSE_CHANGED: ' + name)
        copy(source, f'python/{name}/{source.name}', fallback['source'])
        found = True
    if not found:
        raise RuntimeError(f'PYTHON_LICENSE_REQUIRED: {name}=={distribution.version}')
python_sources = json.loads((here / 'licenses/SOURCES.json').read_text())['darwin-arm64' if sys.platform == 'darwin' else 'win32-x64']
for name, expected in python_sources['license_sha256'].items():
    source = here / 'licenses' / name
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
        raise RuntimeError('PYTHON_RUNTIME_LICENSE_CHANGED: ' + name)
    copy(source, 'python-runtime/' + name, python_sources['archive'])
lock = json.loads((stage / 'package-lock.json').read_text())
npm_fallbacks = json.loads((here / 'licenses/NPM-SOURCES.json').read_text())
for relative, metadata in lock['packages'].items():
    directory = stage / relative
    if not relative.startswith('node_modules/') or not (directory / 'package.json').is_file():
        continue
    info = json.loads((directory / 'package.json').read_text())
    found = False
    for source in directory.iterdir():
        if source.is_file() and licenses.match(source.name):
            copy(source, f'npm/{relative}/{source.name}', f'{info["name"]}@{info["version"]}')
            found = True
    if not found:
        fallback = npm_fallbacks.get(info['name'])
        if not fallback or fallback['version'] != info['version'] or fallback['license'] != info.get('license'):
            raise RuntimeError(f'NPM_LICENSE_REQUIRED: {info["name"]}@{info["version"]}')
        source = here / 'licenses' / fallback['file']
        if hashlib.sha256(source.read_bytes()).hexdigest() != fallback['sha256']:
            raise RuntimeError('NPM_LICENSE_CHANGED: ' + info['name'])
        copy(source, f'npm/{relative}/{source.name}', fallback['source'])
        copy(directory / 'package.json', f'npm/{relative}/published-package.json', f'{info["name"]}@{info["version"]}')
electron = desktop / 'node_modules/electron/dist'
for name in ('LICENSE', 'LICENSES.chromium.html'):
    copy(electron / name, 'electron/' + name, 'electron@44.3.0')
(out / 'SOURCES.json').write_text(json.dumps({'python_runtime': python_sources, 'licenses': records}, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'license_files': len(records)}))
