"""Build fixed R03 source in scratch; source checkout and original R02 route stay read-only."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
import zipfile
from candidate import BASE, HERE, ROOT, blob, git, read_input
from verify import STAGE, inventory, paths, sha, verify, write_json


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(); source = args.source.resolve(); out = args.output.resolve()
    assert sys.platform in ('darwin', 'win32'), 'NATIVE_PLATFORM_REQUIRED'
    target = 'darwin-arm64' if sys.platform == 'darwin' else 'win32-x64'
    assert platform.machine().lower() == ('arm64' if sys.platform == 'darwin' else 'amd64'), 'WRONG_HOST_ARCH'
    assert platform.python_version() == '3.11.16' and sys.prefix != sys.base_prefix, 'DEDICATED_PINNED_PYTHON_REQUIRED'
    selected = read_input(source, HERE / 'candidate-input.json'); source_sha = selected['source_sha']
    assert git(source, 'rev-parse', 'HEAD') == source_sha, 'CHECKOUT_SHA_MISMATCH'
    assert not git(source, 'status', '--porcelain', '--untracked-files=no'), 'DIRTY_SOURCE'
    packaging_sha = git(ROOT, 'rev-parse', 'HEAD')
    assert not git(ROOT, 'status', '--porcelain', '--', 'game/packaging_r03', '.github/workflows/r03-native-diagnostic.yml'), 'COMMIT_PACKAGING_FIRST'
    assert blob(ROOT, packaging_sha, 'game/packaging_r03/candidate-input.json') == (HERE / 'candidate-input.json').read_bytes()
    assert not out.exists(), 'OUTPUT_MUST_BE_NEW'
    assert not out.is_relative_to(source), 'OUTPUT_INSIDE_SOURCE'
    out.mkdir(parents=True); evidence = out / 'evidence'; evidence.mkdir(); commands = []
    def clean(text: str) -> str:
        for value, label in [(str(out), '<OUTPUT>'), (str(source), '<SOURCE>'), (str(ROOT), '<PACKAGING>'), (str(Path.home()), '<USER_HOME>')]:
            text = text.replace(value, label).replace(value.replace('\\', '/'), label)
        return text
    def run(name: str, command: list, cwd: Path = out, env: dict | None = None, allowed: tuple = (0,)) -> str:
        started = time.monotonic()
        result = subprocess.run([str(a) for a in command], cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', timeout=900)
        commands.append(dict(name=name, command=clean(json.dumps([str(a) for a in command])), exit_code=result.returncode, seconds=round(time.monotonic()-started, 2)))
        write_json(evidence / 'commands.json', dict(source_sha=source_sha, packaging_sha=packaging_sha, commands=commands))
        (evidence / (name + '.txt')).write_text(clean(result.stdout)[-24000:], encoding='utf-8')
        print(name, 'exit', result.returncode, flush=True)
        assert result.returncode in allowed, name + '_FAILED'
        return result.stdout
    node = shutil.which('node'); npm = Path(shutil.which('npm')).resolve()
    npm_cli = npm.parent / 'node_modules/npm/bin/npm-cli.js' if sys.platform == 'win32' else npm
    npm_cmd = [node, npm_cli]
    assert run('node-version', [node, '--version']).strip() == 'v24.12.0'
    assert run('npm-version', npm_cmd + ['--version']).strip() == '11.6.2'
    expected = {'pyinstaller':'6.22.3','pyinstaller-hooks-contrib':'2026.7','altgraph':'0.17.5','packaging':'26.3','setuptools':'84.0.0','websockets':'17.0.1'}
    expected.update({'macholib':'1.16.4'} if sys.platform == 'darwin' else {'pefile':'2024.8.26','pywin32-ctypes':'0.2.3'})
    assert {d.metadata['Name'].lower():d.version for d in importlib.metadata.distributions()} == expected, 'PYTHON_DEPENDENCIES_MISMATCH'
    advisories = []
    for name, version in expected.items():
        with urllib.request.urlopen(f'https://pypi.org/pypi/{name}/{version}/json', timeout=30) as response:
            advisories.append(dict(name=name, version=version, advisories=json.load(response)['vulnerabilities']))
    write_json(evidence / 'python-audit.json', advisories)
    assert not any(v['advisories'] for v in advisories), 'PYTHON_ADVISORY_REQUIRES_REVIEW'
    code = out / 'source'; code.mkdir()
    archive = out / 'source.tar'
    subprocess.run(['git','archive','--format=tar','-o',str(archive),source_sha,'game/core','game/runtime','game/server','game/desktop','game/packaging'],cwd=source,check=True)
    with tarfile.open(archive) as t: t.extractall(code, filter='data')
    desktop = code / 'game/desktop'
    run('npm-ci', npm_cmd + ['ci'], desktop)
    for production in (False, True):
        audit = json.loads(run('npm-audit-runtime' if production else 'npm-audit', npm_cmd + ['audit','--json'] + (['--omit=dev'] if production else []), desktop, allowed=(0,1)))
        write_json(evidence / ('npm-audit-runtime.json' if production else 'npm-audit.json'), audit)
        assert audit['metadata']['vulnerabilities']['high'] == audit['metadata']['vulnerabilities']['critical'] == 0, 'HIGH_CRITICAL_AUDIT_BLOCK'
    run('desktop-build', npm_cmd + ['run','build'], desktop)
    env = {**os.environ, 'R03_SOURCE': str(code), 'PYINSTALLER_CONFIG_DIR':str(out / 'pyinstaller-cache')}
    for kind in ['worker','server']:
        run('freeze-'+kind,[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--distpath',out/'frozen','--workpath',out/('freeze-'+kind),HERE/'freeze.spec'],env={**env,'R03_FREEZE':kind})
    run('frozen-worker',[node, code/'game/packaging/check-worker.cjs',out/'frozen'])
    stage = out / 'stage'; stage.mkdir()
    for name in STAGE:
        dest = stage / name; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(desktop/name,dest)
    # Fail closed if a future CJS require introduces an unstaged local runtime file.
    import re
    for name in STAGE:
        if name.endswith('.cjs'):
            for dependency in re.findall(r"require\(['\"]([^'\"]+)['\"]\)", (stage/name).read_text()):
                if dependency.startswith('.'):
                    assert (stage/Path(name).parent/dependency).resolve().is_relative_to(stage.resolve())
                    assert (stage/Path(name).parent/dependency).is_file(), 'UNSTAGED_REQUIRE'
                else: assert dependency == 'electron' or dependency.startswith('node:'), 'NEW_RUNTIME_DEPENDENCY'
    package = json.loads((desktop/'package.json').read_text())
    write_json(stage/'package.json', {k:package[k] for k in ['name','productName','version','main','author']})
    info = dict(task_id='R03-T05-a',source_sha=source_sha,packaging_sha=packaging_sha,status=selected['status'],platform=target,
                plan_sha='a1e01ee259c65d9241ad1c4daee7852faca366bf',rules_version='classic-1.0.1',protocol='rooms-1.1',
                trees={p:git(source,'rev-parse',f'{source_sha}:{p}') for p in ['game/core','game/runtime','game/server','game/desktop']},
                python=platform.python_version(),python_tools=expected,electron='44.3.0',packager='20.3.0',node='24.12.0',npm='11.6.2',
                locks={'npm':sha(desktop/'package-lock.json'),'python':sha(HERE/f'requirements-{target}.lock')},
                stage_sha256={p:sha(stage/p) for p in STAGE},catalog_sha256=sha(desktop/'catalog.json'),entry_map_sha256=sha(code/'game/runtime/deidei_runtime/entry-map.json'))
    write_json(stage/'build-info.json',info)
    run('packager',[node,HERE/'pack.mjs',out],env=env)
    application = Path((out/'application-path.txt').read_text()); delivery = out/'delivery'; delivery.mkdir()
    if sys.platform == 'darwin': application = application/'DeiDei R03 Diagnostic.app'
    shutil.copytree(out/'frozen/room-server',delivery/'room-server',symlinks=True)
    if sys.platform == 'darwin': run('copy-app',['ditto',application,delivery/application.name])
    else: shutil.copytree(application,delivery/application.name)
    write_json(delivery/'build-info.json',info); write_json(delivery/'room-server/build-info.json',info)
    notices = delivery/'THIRD-PARTY'; notices.mkdir()
    for name in ['LICENSE','LICENSES.chromium.html']:
        shutil.copy2((application.parent if sys.platform == 'darwin' else application)/name,notices/('Electron-'+name))
    shutil.copy2(Path(sys.base_prefix)/('lib/python3.11/LICENSE.txt' if sys.platform == 'darwin' else 'LICENSE.txt'),notices/'Python-LICENSE.txt')
    license_sources = json.loads((code/'game/packaging/licenses/SOURCES.json').read_text())[target]
    for name, expected_hash in license_sources['license_sha256'].items():
        src = code/'game/packaging/licenses'/name; assert sha(src)==expected_hash; shutil.copy2(src,notices/('Python-runtime-'+name))
    write_json(notices/'Python-runtime-SOURCES.json',license_sources)
    for name in ['react','react-dom','scheduler']: shutil.copy2(desktop/'node_modules'/name/'LICENSE',notices/(name+'-LICENSE.txt'))
    for name in ['websockets','pyinstaller']:
        dist = importlib.metadata.distribution(name)
        for f in dist.files:
            if Path(str(f)).name.lower() in ['license','copying.txt','license.txt']:
                shutil.copy2(dist.locate_file(f),notices/(name+'-LICENSE.txt'))
    shutil.copy2(HERE/'PLAYER-README.txt',delivery/'使用说明.txt')
    resources, executable, server = paths(delivery,target)
    if sys.platform == 'darwin':
        for label, binary in [('app',delivery/application.name),('server',server)]:
            run(label+'-signature',['codesign','--verify','--deep','--strict','--verbose=2',binary])
            run(label+'-identity',['codesign','--display','--verbose=4',binary])
        run('gatekeeper',['spctl','--assess','--type','execute','--verbose=4',delivery/application.name],allowed=(0,1,3))
    else:
        run('windows-signatures',['powershell','-NoProfile','-Command',"Get-AuthenticodeSignature -LiteralPath $args[0],$args[1] | Select-Object Status,StatusMessage | ConvertTo-Json",str(executable),str(server)])
    write_json(delivery/'FILE-MANIFEST.json',inventory(delivery))
    verify(delivery,source_sha,packaging_sha,target)
    archive = out/f'DeiDei-R03-T05-a-{selected["status"]}-{target}-{source_sha[:7]}.zip'
    if sys.platform == 'darwin': run('archive',['ditto','-c','-k','--sequesterRsrc',delivery,archive])
    else:
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
            for p in sorted(delivery.rglob('*')): z.write(p,p.relative_to(delivery))
    unpacked = out/'中文 空格 解压'; unpacked.mkdir()
    if sys.platform == 'darwin': run('unpack-final',['ditto','-x','-k',archive,unpacked])
    else:
        with zipfile.ZipFile(archive) as z: assert z.testzip() is None; z.extractall(unpacked)
    verify(unpacked,source_sha,packaging_sha,target)
    run('unpacked-worker',[node,code/'game/packaging/check-worker.cjs',paths(unpacked,target)[0]])
    run('unpacked-server-cli',[paths(unpacked,target)[2],'--help'],env={**env,'PYTHONHOME':'/nonexistent','PYTHONPATH':'/nonexistent'})
    write_json(out/'delivery-manifest.json',dict(source_sha=source_sha,packaging_sha=packaging_sha,status=selected['status'],platform=target,filename=archive.name,sha256=sha(archive),bytes=archive.stat().st_size,inventory_sha256=sha(unpacked/'FILE-MANIFEST.json'),signature='ad-hoc; not notarized' if sys.platform=='darwin' else 'unsigned',packaged_automation='NOT_RUN',human='NOT_RUN'))
    print('BUILT',archive.name,flush=True)


if __name__ == '__main__':
    main()
