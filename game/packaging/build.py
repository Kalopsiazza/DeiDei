"""Native T05 build. Run with the hash-locked, dedicated Python 3.11.16 venv."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'game/packaging'
DESKTOP = ROOT / 'game/desktop'
INPUT = '3ce99f1cdd5f2f52c757ef61b696ecaade4877d0'
PLAN_HASH = '84f621cc6a20739c6836a83bb5133659c8fbbcdebaef585a69033aa86fd498fc'
PLATFORM = 'darwin-arm64' if sys.platform == 'darwin' else 'win32-x64'
STAGE_FILES = ['main.cjs', 'preload.cjs', 'profile.cjs', 'worker-port.cjs',
               'worker-bridge.cjs', 'worker-launch.cjs', 'build/fixture.cjs',
               'build/ui/index.html', 'build/ui/renderer.js', 'build/ui/style.css']


def sha(file: Path) -> str:
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(file: Path, data: object) -> None:
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sanitize(text: str) -> str:
    for value, label in [(str(ROOT), '<WORKTREE>'), (str(Path.home()), '<USER_HOME>'),
                         (tempfile.gettempdir(), '<TEMP>')]:
        text = text.replace(value, label).replace(value.replace('\\', '/'), label)
    return text


def main() -> None:
    assert sys.platform in ('darwin', 'win32'), 'native macOS or Windows required'
    assert platform.machine().lower() == ('arm64' if sys.platform == 'darwin' else 'amd64')
    assert platform.python_version() == '3.11.16'
    assert sys.prefix != sys.base_prefix, 'dedicated clean venv required'
    node, npm = shutil.which('node'), shutil.which('npm')
    assert node and npm
    # Node's CLI avoids shell interpolation and Windows .cmd launch differences.
    npm_cli = Path(npm).resolve().parent / 'node_modules/npm/bin/npm-cli.js' if sys.platform == 'win32' else Path(npm).resolve()
    npm_command = [node, str(npm_cli)]
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    subprocess.run(['git', 'merge-base', '--is-ancestor', INPUT, head], cwd=ROOT, check=True)
    assert not subprocess.check_output(['git', 'status', '--porcelain', '--', 'game', '.github'], cwd=ROOT, text=True).strip(), 'commit product and CI before building'
    if os.environ.get('DEIDEI_EXPECTED_SHA'):
        assert head == os.environ['DEIDEI_EXPECTED_SHA']
    build = HERE / 'build'
    build.mkdir(exist_ok=True)
    out = Path(tempfile.mkdtemp(prefix=PLATFORM + '-', dir=build))
    evidence = out / 'evidence'
    evidence.mkdir()
    commands = []

    def run(name: str, args: list[str], cwd: Path = ROOT, env: dict | None = None,
            allowed: tuple = (0,)) -> str:
        started = time.time()
        result = subprocess.run([str(a) for a in args], cwd=cwd, env=env, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
        output = sanitize(result.stdout)
        (evidence / f'{name}.txt').write_text(output, encoding='utf-8')
        commands.append({'name': name, 'command': sanitize(json.dumps([str(a) for a in args])),
                         'cwd': sanitize(str(cwd)), 'exit_code': result.returncode,
                         'environment': {key: sanitize(env[key]) for key in ['PYTHONPATH', 'DEIDEI_PYTHON', 'PYINSTALLER_CONFIG_DIR'] if env and key in env},
                         'seconds': round(time.time() - started, 3)})
        write_json(evidence / 'commands.json', {'tested_code_sha': head, 'commands': commands})
        print(f'{name}: exit {result.returncode}', flush=True)
        if result.returncode not in allowed:
            raise RuntimeError(f'{name} failed; see {sanitize(str(evidence))}')
        return output

    assert run('node-version', [node, '--version']).strip() == 'v24.12.0'
    assert run('npm-version', npm_command + ['--version']).strip() == '11.6.2'
    assert run('uv-version', ['uv', '--version']).strip().split()[1] == '0.11.13'
    run('python-check', ['uv', 'pip', 'check', '--python', sys.executable])
    python_tree = [{'name': d.metadata['Name'].lower(), 'version': d.version}
                   for d in importlib.metadata.distributions()]
    expected = {'pyinstaller': '6.22.3', 'pyinstaller-hooks-contrib': '2026.7', 'altgraph': '0.17.5',
                'packaging': '26.3', 'setuptools': '84.0.0'}
    expected.update({'macholib': '1.16.4'} if sys.platform == 'darwin' else {'pefile': '2024.8.26', 'pywin32-ctypes': '0.2.3'})
    assert {d['name']: d['version'] for d in python_tree} == expected
    write_json(evidence / 'python-tree.json', python_tree)
    python_advisories = []
    for name, version in expected.items():
        url = f'https://pypi.org/pypi/{name}/{version}/json'
        with urllib.request.urlopen(url, timeout=30) as response:
            public = json.load(response)['vulnerabilities']
        python_advisories.append({'name': name, 'version': version, 'source': url, 'public_advisories': public})
    write_json(evidence / 'python-public-advisories.json', python_advisories)
    assert not any(a['public_advisories'] for a in python_advisories), 'new Python advisory requires review'
    for production in (False, True):
        audit = json.loads(run('npm-audit-runtime' if production else 'npm-audit',
                              npm_command + ['audit', '--json'] + (['--omit=dev'] if production else []), DESKTOP, allowed=(0, 1)))
        counts = audit['metadata']['vulnerabilities']
        assert counts['high'] == counts['critical'] == 0, 'unresolved high/critical dependency risk'
    run('npm-tree', npm_command + ['ls', '--all', '--json'], DESKTOP)
    for name, args, pythonpath in [
        ('core', ['-m', 'unittest', 'discover', '-s', 'game/core/tests', '-v'], ['game/core']),
        ('runtime', ['-m', 'unittest', 'discover', '-s', 'game/runtime/tests', '-v'], ['game/core', 'game/runtime']),
        ('independent', ['tests/rules_v1_001/run_acceptance.py', '--core', 'game/core'], []),
        ('tools', ['-m', 'unittest', 'discover', '-s', 'tests/rules_v1_001', '-p', 'test_*.py', '-v'], []),
        ('root', ['scripts/check.py'], []),
    ]:
        env = {**os.environ, 'PYTHONPATH': os.pathsep.join(str(ROOT / p) for p in pythonpath)}
        run(name, [sys.executable, *args], env=env)
    run('desktop', npm_command + ['test'], DESKTOP, env={**os.environ, 'DEIDEI_PYTHON': sys.executable})
    run('freeze', [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
                   '--distpath', str(out / 'frozen'), '--workpath', str(out / 'pyinstaller'), str(HERE / 'worker.spec')],
        env={**os.environ, 'PYINSTALLER_CONFIG_DIR': str(out / 'pyinstaller-cache')})
    worker = out / 'frozen/worker'
    assert sha(worker / '_internal/deidei_runtime/data/catalog.json') == sha(DESKTOP / 'catalog.json')
    assert sha(worker / '_internal/deidei_runtime/entry-map.json') == sha(ROOT / 'game/runtime/deidei_runtime/entry-map.json')
    run('frozen-worker', [node, str(HERE / 'check-worker.cjs'), str(out / 'frozen')], cwd=out)
    if sys.platform == 'darwin':
        run('worker-signature-before', ['codesign', '--verify', '--deep', '--strict', '--verbose=2', str(worker / 'deidei-worker')])
        run('worker-identity-before', ['codesign', '--display', '--verbose=4', str(worker / 'deidei-worker')])

    stage = out / 'stage'
    stage.mkdir()
    for name in STAGE_FILES:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DESKTOP / name, target)
    package = json.loads((DESKTOP / 'package.json').read_text(encoding='utf-8'))
    write_json(stage / 'package.json', {key: package[key] for key in ['name', 'productName', 'version', 'main', 'author']})
    inputs = subprocess.check_output(['git', 'ls-files', 'game/core', 'game/runtime', 'game/desktop', 'game/packaging'], cwd=ROOT, text=True).splitlines()
    build_info = {'task_id': 'R02-T05-a', 'input_sha': INPUT, 'code_sha': head, 'plan_sha': None,
                  'plan_manifest_sha256': PLAN_HASH, 'plan_version': '1.0', 'rules_version': 'classic-1.0.1',
                  'opponent_id': 'random-legal-v1', 'platform': sys.platform, 'arch': platform.machine(),
                  'os': platform.platform(), 'python': platform.python_version(), 'python_source': 'Astral python-build-standalone 20260901; pinned python-downloads.json',
                  'electron': '44.3.0', 'node_build': '24.12.0', 'npm': '11.6.2', 'uv': '0.11.13',
                  'python_tools': python_tree, 'lock_sha256': {'npm': sha(DESKTOP / 'package-lock.json'),
                  'python': sha(HERE / f'requirements-{PLATFORM}.lock')},
                  'input_files_sha256': {p: sha(ROOT / p) for p in inputs}}
    write_json(stage / 'build-info.json', build_info)
    run('packager', [node, str(HERE / 'pack.mjs'), str(out)])
    application = Path((out / 'application-path.txt').read_text())
    if sys.platform == 'darwin':
        application = application / 'DeiDei R02.app'
    delivery = out / 'delivery'
    delivery.mkdir()
    target = delivery / application.name
    if sys.platform == 'darwin':
        run('copy-app', ['ditto', str(application), str(target)])
        run('signature-verify', ['codesign', '--verify', '--deep', '--strict', '--verbose=2', str(target)])
        run('signature-display', ['codesign', '--display', '--verbose=4', str(target)])
        run('gatekeeper', ['spctl', '--assess', '--type', 'execute', '--verbose=4', str(target)], allowed=(0, 1, 3))
    else:
        shutil.copytree(application, target)
    resources = target / ('Contents/Resources' if sys.platform == 'darwin' else 'resources')
    executable = target / ('Contents/MacOS/DeiDeiR02' if sys.platform == 'darwin' else 'DeiDeiR02.exe')
    worker_exe = resources / 'worker' / ('deidei-worker' if sys.platform == 'darwin' else 'deidei-worker.exe')
    if sys.platform == 'darwin':
        for name, binary in [('desktop', executable), ('worker', worker_exe)]:
            assert run(f'{name}-architecture', ['lipo', '-archs', str(binary)]).strip() == 'arm64'
    else:
        for binary in (executable, worker_exe):
            data = binary.read_bytes()
            pe = struct.unpack_from('<I', data, 0x3c)[0]
            assert data[:2] == b'MZ' and data[pe:pe+4] == b'PE\0\0' and struct.unpack_from('<H', data, pe+4)[0] == 0x8664
    assert {p.relative_to(resources / 'app').as_posix() for p in (resources / 'app').rglob('*') if p.is_file()} == set(STAGE_FILES + ['package.json', 'build-info.json'])
    assert sha(resources / 'worker/_internal/deidei_runtime/data/catalog.json') == sha(DESKTOP / 'catalog.json')
    assert sha(resources / 'worker/_internal/deidei_runtime/entry-map.json') == sha(ROOT / 'game/runtime/deidei_runtime/entry-map.json')
    assert not any(p.name.lower().endswith(('.pkl', '.pt', '.pth', '.ttf', '.otf')) or p.name == 'node_modules' for p in target.rglob('*'))
    shutil.copy2(HERE / 'PLAYER-README.txt', delivery / '使用说明.txt')
    notices = delivery / 'THIRD-PARTY'
    notices.mkdir()
    for name in ['LICENSE', 'LICENSES.chromium.html']:
        shutil.copy2((application.parent if sys.platform == 'darwin' else application) / name,
                     notices / ('Electron-' + name))
    python_license = Path(sys.base_prefix) / ('lib/python3.11/LICENSE.txt' if sys.platform == 'darwin' else 'LICENSE.txt')
    shutil.copy2(python_license, notices / 'Python-LICENSE.txt')
    license_sources = json.loads((HERE / 'licenses/SOURCES.json').read_text())
    for name, expected_hash in license_sources[PLATFORM]['license_sha256'].items():
        source = HERE / 'licenses' / name
        assert sha(source) == expected_hash
        shutil.copy2(source, notices / ('Python-runtime-' + name))
    write_json(notices / 'Python-runtime-SOURCES.json', license_sources[PLATFORM])
    for name in ['react', 'react-dom', 'scheduler']:
        shutil.copy2(DESKTOP / f'node_modules/{name}/LICENSE', notices / f'{name}-LICENSE.txt')
    distribution = importlib.metadata.distribution('pyinstaller')
    for file in distribution.files:
        if 'copying' in str(file).lower() or 'license' in str(file).lower():
            source = Path(distribution.locate_file(file))
            if source.is_file():
                shutil.copy2(source, notices / ('PyInstaller-' + source.name))
    assert (notices / 'Electron-LICENSE').is_file() and (notices / 'Electron-LICENSES.chromium.html').is_file()
    filename = f'DeiDei-R02-T05-a-{"macOS-arm64" if sys.platform == "darwin" else "Windows-x64"}-{head[:7]}.zip'
    archive = out / filename
    if sys.platform == 'darwin':
        run('archive', ['ditto', '-c', '-k', '--sequesterRsrc', str(delivery), str(archive)])
    else:
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
            for file in sorted(delivery.rglob('*')):
                z.write(file, file.relative_to(delivery))
    unpacked = out / '中文 空格 解压'
    unpacked.mkdir()
    if sys.platform == 'darwin':
        run('unpack-final', ['ditto', '-x', '-k', str(archive), str(unpacked)])
        run('unpacked-signature', ['codesign', '--verify', '--deep', '--strict', '--verbose=2', str(unpacked / target.name)])
    else:
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            z.extractall(unpacked)
    files = {}
    for file in sorted(delivery.rglob('*')):
        relative = file.relative_to(delivery)
        other = unpacked / relative
        if file.is_symlink():
            assert other.is_symlink() and os.readlink(file) == os.readlink(other)
            files[relative.as_posix()] = {'symlink': os.readlink(file)}
        elif file.is_file():
            assert sha(file) == sha(other)
            if sys.platform == 'darwin':
                assert stat.S_IMODE(file.stat().st_mode) == stat.S_IMODE(other.stat().st_mode)
            files[relative.as_posix()] = {'sha256': sha(file), 'bytes': file.stat().st_size,
                                        'mode': oct(stat.S_IMODE(file.stat().st_mode))}
    write_json(evidence / 'file-manifest.json', files)
    run('unpacked-worker', [node, str(HERE / 'check-worker.cjs'), str(unpacked / resources.relative_to(delivery))], cwd=out)
    manifest = {'task_id': 'R02-T05-a', 'code_sha': head, 'platform': PLATFORM,
                'filename': filename, 'bytes': archive.stat().st_size, 'sha256': sha(archive),
                'build_info': (resources / 'app/build-info.json').relative_to(delivery).as_posix(),
                'build_info_sha256': sha(stage / 'build-info.json'),
                'signature': 'ad-hoc; not notarized' if sys.platform == 'darwin' else 'unsigned',
                'levels': {'source': 'PASS', 'built': 'PASS', 'frozen_worker': 'PASS',
                           'packaged_automation': 'NOT_RUN', 'human': 'NOT_RUN', 'physical_offline': 'NOT_RUN'}}
    write_json(out / 'delivery-manifest.json', manifest)
    write_json(build / 'latest.json', {'out': str(out), 'archive': str(archive),
                                     'unpacked_application': str(unpacked / target.name)})
    print(f'BUILT {filename}; sha256 {manifest["sha256"]}', flush=True)


if __name__ == '__main__':
    main()
