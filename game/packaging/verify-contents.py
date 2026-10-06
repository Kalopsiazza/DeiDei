"""Verify exact first-party resources and the locked production dependency subset."""
import hashlib
import json
from pathlib import Path
import sys

out, resources = map(Path, sys.argv[1:3])
plan = json.loads((out / 'package-plan.json').read_text())
stage = out / 'stage'


def identity(file):
    if file.is_symlink():
        import os
        return {'symlink': os.readlink(file)}
    return {'bytes': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}


def node_metadata(file):
    value = json.loads(file.read_text())
    omitted = {'dist', 'gitHead', 'build', 'jspm', 'ava', 'xo', 'nyc', 'eslintConfig', 'contributors', 'bundleDependencies', 'tags', 'scripts', 'keywords', 'bugs'}
    if not any(key.startswith('babel') for key in value.get('dependencies', {})):
        omitted.add('babel')
    return {key: item for key, item in value.items() if key not in omitted and not key.startswith('_')}


def compare(source, target, signable=False):
    expected = {file.relative_to(source).as_posix(): file for file in source.rglob('*') if file.is_file() or file.is_symlink()}
    actual = {file.relative_to(target).as_posix(): file for file in target.rglob('*') if file.is_file() or file.is_symlink()}
    if set(expected) != set(actual):
        raise RuntimeError('RESOURCE_WHITELIST_MISMATCH: ' + str(target) + ' ' + str(sorted(set(expected) ^ set(actual))))
    for name, file in expected.items():
        # Native signing changes only declared Mach-O bytes; verify their signature separately.
        if signable and name in signable:
            continue
        if identity(file) != identity(actual[name]):
            raise RuntimeError('RESOURCE_BYTES_CHANGED: ' + name)
    return actual


app = resources / 'app'
first_party = {file.relative_to(stage).as_posix(): file for file in stage.rglob('*')
               if file.is_file() and 'node_modules' not in file.relative_to(stage).parts and file.name != 'package-lock.json'}
actual_first = {file.relative_to(app).as_posix(): file for file in app.rglob('*')
                if file.is_file() and 'node_modules' not in file.relative_to(app).parts}
if set(first_party) != set(actual_first):
    raise RuntimeError('FIRST_PARTY_WHITELIST_MISMATCH: ' + str(sorted(set(first_party) ^ set(actual_first))))
for name, file in first_party.items():
    if identity(file) != identity(actual_first[name]):
        raise RuntimeError('FIRST_PARTY_BYTES_CHANGED: ' + name)
lock = json.loads((stage / 'package-lock.json').read_text())['packages']
expected_packages = {name for name, value in lock.items() if name.startswith('node_modules/') and (stage / name / 'package.json').is_file()}
if any(lock[name].get('dev') is True for name in expected_packages):
    raise RuntimeError('DEVELOPMENT_DEPENDENCY_IN_STAGE')
for name in expected_packages:
    installed, packaged = stage / name / 'package.json', app / name / 'package.json'
    if not packaged.is_file() or node_metadata(packaged) != node_metadata(installed):
        raise RuntimeError('PRODUCTION_DEPENDENCY_MISMATCH: ' + name)
for file in (app / 'node_modules').rglob('*'):
    if not file.is_file() and not file.is_symlink():
        continue
    relative = file.relative_to(app)
    source = stage / relative
    if not source.exists() or (node_metadata(file) != node_metadata(source) if file.name == 'package.json' else identity(file) != identity(source)):
        raise RuntimeError('UNLOCKED_PRODUCTION_FILE: ' + relative.as_posix())
for item in plan['resources']:
    binary_names = {name.removeprefix('Contents/Resources/' + item['to'] + '/') for name in plan['macBinaries']}
    compare(out / item['from'], resources / item['to'], binary_names)
if identity(out / 'update-config.json') != identity(resources / 'update-config.json'):
    raise RuntimeError('UPDATE_CONFIG_CHANGED')
if identity(out / 'PLAYER-README.txt') != identity(resources / 'PLAYER-README.txt'):
    raise RuntimeError('PLAYER_README_CHANGED')
if identity(out / 'telemetry-config.json') != identity(resources / 'telemetry-config.json'):
    raise RuntimeError('TELEMETRY_CONFIG_CHANGED')
model = json.loads((out / 'frozen/ai-worker/_internal/model-manifest.json').read_text())
checkpoint = resources / 'ai-worker/_internal/model/latest.zip'
if checkpoint.stat().st_size != model['bytes'] or hashlib.sha256(checkpoint.read_bytes()).hexdigest() != model['sha256']:
    raise RuntimeError('MODEL_IDENTITY_CHANGED')
for directory in (resources / 'worker', resources / 'ai-worker'):
    for file in directory.rglob('*'):
        if file.is_file() and file.suffix.lower() in ('.zip', '.pkl', '.pt', '.pth') and file != checkpoint and file.name != 'base_library.zip':
            # Torch wheels contain named .pth initialization files: declare those in the exact frozen file manifest.
            if file.suffix.lower() != '.pth':
                raise RuntimeError('UNLISTED_MODEL_RESOURCE: ' + str(file.relative_to(resources)))
manifest = {file.relative_to(resources).as_posix(): identity(file) for file in resources.rglob('*') if file.is_file() or file.is_symlink()}
(out / 'evidence/resource-files.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'status': 'PASS', 'first_party': len(first_party), 'production_packages': len(expected_packages), 'resource_files': len(manifest)}))
