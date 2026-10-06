"""R05 native builder candidate; production requires identity, notarization and trusted feed."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import stat
import struct
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'game/packaging'
DESKTOP = ROOT / 'game/desktop'
COMPILATION_INPUTS = ['docs/results/R04-T01-b/manual-content/content.json']
BASELINE = '01f6bc0cfa4c371c81d042a8cdac614909453f4c'


def sha(file):
    with Path(file).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(file, value):
    Path(file).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def check_clean_inputs(root):
    dirty = subprocess.check_output(['git', 'status', '--porcelain', '--', 'game', '.github', *COMPILATION_INPUTS], cwd=root, text=True).strip()
    if dirty:
        raise RuntimeError('commit build inputs before building:\n' + dirty)


def input_snapshot(root):
    paths = subprocess.check_output(['git', 'ls-files', '-z', 'game', '.github', *COMPILATION_INPUTS], cwd=root).decode().split('\0')
    return {name: sha(Path(root) / name) for name in paths if name and (Path(root) / name).is_file()}


def verify_build_inputs(root, head, snapshot):
    actual_head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    if actual_head != head or input_snapshot(root) != snapshot:
        raise RuntimeError('BUILD_INPUTS_CHANGED_DURING_BUILD')
    check_clean_inputs(root)


def signing_ready(mode):
    if mode != 'production':
        return
    if sys.platform == 'darwin':
        identities = subprocess.check_output(['security', 'find-identity', '-v', '-p', 'codesigning'], text=True)
        if 'Developer ID Application' not in identities:
            raise RuntimeError('PRODUCTION_SIGNING_IDENTITY_REQUIRED')
        if not any(os.environ.get(key) for key in ['APPLE_KEYCHAIN_PROFILE', 'APPLE_API_KEY', 'APPLE_ID']):
            raise RuntimeError('PRODUCTION_NOTARIZATION_REQUIRED')
    elif not any(os.environ.get(key) for key in ['WIN_CSC_LINK', 'CSC_LINK']):
        raise RuntimeError('PRODUCTION_SIGNING_IDENTITY_REQUIRED')


def macho_files(directory):
    magic = {bytes.fromhex(value) for value in ['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca']}
    files = []
    for file in Path(directory).rglob('*'):
        if file.is_file() and not file.is_symlink():
            with file.open('rb') as stream:
                if stream.read(4) in magic:
                    files.append(file)
    return files


def locked_versions(*files):
    return {re.sub(r'[-_.]+', '-', name).lower(): version for file in files
            for name, version in re.findall(r'^([A-Za-z0-9_.-]+)==([^\s\\]+)', Path(file).read_text(), re.M)}


def release_artifacts(directory, version, target_platform, arch):
    directory = Path(directory)
    stem = f'DeiDei-{version}-{"mac" if target_platform == "darwin" else "win"}-{arch}'
    required = {stem + extension for extension in (('.dmg', '.zip') if target_platform == 'darwin' else ('.exe',))}
    feeds = {'latest-mac.yml', 'beta-mac.yml'} if target_platform == 'darwin' else {'latest.yml', 'beta.yml'}
    allowed = required | {name + '.blockmap' for name in required} | feeds
    files = {file.name: file for file in directory.iterdir() if file.is_file() and file.name in allowed}
    if not required.issubset(files) or not feeds.intersection(files):
        raise RuntimeError('UPDATE_ARTIFACT_SET_INCOMPLETE')
    return [{'filename': name, 'bytes': file.stat().st_size, 'sha256': sha(file), 'version': version} for name, file in sorted(files.items())]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['production', 'local-test', 'fixture'], default='production')
    parser.add_argument('--update-config', type=Path, default=HERE / 'update-config.example.json')
    parser.add_argument('--telemetry-config', type=Path, default=HERE / 'telemetry-config.example.json')
    parser.add_argument('--ai-python', type=Path, default=HERE / ('ai-build/.venv/Scripts/python.exe' if sys.platform == 'win32' else 'ai-build/.venv/bin/python'))
    parser.add_argument('--fixture-url')
    parser.add_argument('--fixture-name', default='DeiDei Update Fixture R05')
    parser.add_argument('--fixture-version')
    parser.add_argument('--fixture-signing-identity', help='explicit macOS test identity; requires fixture mode')
    parser.add_argument('--publisher-name', help='actual Windows certificate publisher; required for production')
    args = parser.parse_args()
    if sys.platform not in ('darwin', 'win32') or platform.machine().lower() != ('arm64' if sys.platform == 'darwin' else 'amd64'):
        raise RuntimeError('NATIVE_PLATFORM_REQUIRED')
    signing_ready(args.mode)
    if args.fixture_signing_identity and (args.mode != 'fixture' or sys.platform != 'darwin'):
        raise RuntimeError('FIXTURE_SIGNING_MODE_REQUIRED')
    if args.mode == 'production' and sys.platform == 'win32' and not args.publisher_name:
        raise RuntimeError('PRODUCTION_PUBLISHER_REQUIRED')
    if sys.prefix == sys.base_prefix or platform.python_version() != '3.11.16':
        raise RuntimeError('DEDICATED_PYTHON_3_11_16_REQUIRED')
    if not args.ai_python.is_file() or not (HERE / 'ai-worker.spec').is_file():
        raise RuntimeError('FROZEN_AI_INPUT_REQUIRED')
    check_clean_inputs(ROOT)
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    initial_inputs = input_snapshot(ROOT)
    subprocess.run(['git', 'merge-base', '--is-ancestor', BASELINE, head], cwd=ROOT, check=True)
    node, npm = shutil.which('node'), shutil.which('npm')
    if not node or not npm:
        raise RuntimeError('NODE_NPM_REQUIRED')
    npm_cli = Path(npm).resolve().parent / 'node_modules/npm/bin/npm-cli.js' if sys.platform == 'win32' else Path(npm).resolve()
    npm_command = [node, str(npm_cli)]
    package = json.loads((DESKTOP / 'package.json').read_text())
    if args.telemetry_config.stat().st_size > 4096:
        raise RuntimeError('TELEMETRY_BUILD_CONFIG_INVALID')
    telemetry_config = json.loads(args.telemetry_config.read_text())
    if not isinstance(telemetry_config, dict) or set(telemetry_config) != {'schema_version', 'origin'} or telemetry_config['schema_version'] != 1 or not (telemetry_config['origin'] is None or isinstance(telemetry_config['origin'], str)):
        raise RuntimeError('TELEMETRY_BUILD_CONFIG_INVALID')
    if telemetry_config['origin'] is not None:
        from urllib.parse import urlsplit
        origin = urlsplit(telemetry_config['origin'])
        if origin.scheme != 'https' or not origin.hostname or origin.username or origin.password or origin.query or origin.fragment or origin.path not in ('', '/'):
            raise RuntimeError('TELEMETRY_BUILD_CONFIG_INVALID')
    if args.mode == 'fixture':
        if not args.fixture_url or not args.fixture_name.startswith('DeiDei Update Fixture') or not args.fixture_version:
            raise RuntimeError('FIXTURE_BUILD_INPUT_REQUIRED')
        subprocess.run([node, '-e', 'require(process.argv[1]).fixtureConfig(process.argv[2]); if(!require(process.argv[3]).valid(process.argv[4]))throw Error("FIXTURE_VERSION_INVALID")', str(DESKTOP / 'updates/config.cjs'), args.fixture_url, str(DESKTOP / 'node_modules/semver'), args.fixture_version], check=True)
        package.update(name='deidei-update-fixture-' + hashlib.sha256(args.fixture_name.encode()).hexdigest()[:16], productName=args.fixture_name, version=args.fixture_version)
        update_config = {'schema_version': 1, 'configured': True, 'mode': 'fixture', 'provider': 'generic', 'url': args.fixture_url}
    else:
        if args.update_config.stat().st_size > 4096:
            raise RuntimeError('UPDATE_BUILD_CONFIG_INVALID')
        update_config = json.loads(args.update_config.read_text())
        if (not isinstance(update_config, dict) or set(update_config) != {'schema_version', 'configured', 'mode', 'provider', 'owner', 'repo', 'platform', 'arch'}
                or update_config['schema_version'] != 1 or type(update_config['configured']) is not bool
                or not isinstance(update_config['owner'], str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}', update_config['owner'])
                or not isinstance(update_config['repo'], str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,99}', update_config['repo'])
                or update_config.get('provider') != 'github' or update_config.get('mode') != 'production'):
            raise RuntimeError('UPDATE_BUILD_CONFIG_INVALID')
        update_config.update(platform=sys.platform, arch='arm64' if sys.platform == 'darwin' else 'x64')
        if args.mode == 'production' and update_config.get('configured') is not True:
            raise RuntimeError('PRODUCTION_UPDATE_CONFIG_REQUIRED')
    build = HERE / 'build'
    build.mkdir(exist_ok=True)
    out = Path(tempfile.mkdtemp(prefix=f'{sys.platform}-{platform.machine().lower()}-', dir=build))
    target_arch = 'arm64' if sys.platform == 'darwin' else 'x64'
    packaging_lock = HERE / f'requirements-{sys.platform}-{target_arch}.lock'
    ai_lock = ROOT / f'game/ai/requirements-{sys.platform}-{target_arch}.lock'
    evidence = out / 'evidence'
    evidence.mkdir()
    commands = []

    def run(name, command, cwd=ROOT, env=None, allowed=(0,)):
        started = time.monotonic()
        result = subprocess.run([str(item) for item in command], cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
        output = result.stdout.replace(str(ROOT), '<WORKTREE>').replace(str(Path.home()), '<USER_HOME>')
        (evidence / f'{name}.txt').write_text(output, encoding='utf-8')
        commands.append({'name': name, 'command': [str(item).replace(str(ROOT), '<WORKTREE>') for item in command], 'exit_code': result.returncode, 'seconds': round(time.monotonic() - started, 3)})
        write_json(evidence / 'commands.json', {'code_sha': head, 'commands': commands})
        print(f'{name}: exit {result.returncode}', flush=True)
        if result.returncode not in allowed:
            raise RuntimeError(name + ' failed; evidence retained')
        return output

    if run('node-version', [node, '--version']).strip() != 'v24.12.0' or run('npm-version', npm_command + ['--version']).strip() != '11.6.2' or run('uv-version', ['uv', '--version']).split()[1] != '0.11.13':
        raise RuntimeError('PINNED_BUILD_TOOL_REQUIRED')
    run('python-dependencies', ['uv', 'pip', 'check', '--python', sys.executable])
    run('ai-dependencies', ['uv', 'pip', 'check', '--python', args.ai_python])
    environment_probe = 'import importlib.metadata,json,platform,sys; print(json.dumps({"python":platform.python_version(),"dedicated":sys.prefix!=sys.base_prefix,"packages":{d.metadata["Name"].lower().replace("_","-").replace(".","-"):d.version for d in importlib.metadata.distributions()}}))'
    for name, python, expected in [('packaging-environment', sys.executable, locked_versions(packaging_lock)), ('ai-freeze-environment', args.ai_python, locked_versions(packaging_lock, ai_lock))]:
        observed = json.loads(run(name, [python, '-c', environment_probe]))
        if observed['python'] != '3.11.16' or not observed['dedicated'] or observed['packages'] != expected:
            raise RuntimeError('LOCKED_ENVIRONMENT_REQUIRED: ' + name)
    for production in (False, True):
        audit = json.loads(run('npm-audit-runtime' if production else 'npm-audit', npm_command + ['audit', '--json'] + (['--omit=dev'] if production else []), DESKTOP, allowed=(0, 1)))
        if audit['metadata']['vulnerabilities']['high'] or audit['metadata']['vulnerabilities']['critical']:
            raise RuntimeError('DEPENDENCY_HIGH_CRITICAL_REVIEW_REQUIRED')
    run('source-checks', [sys.executable, ROOT / 'scripts/check.py'], env={**os.environ, 'DEIDEI_AI_PYTHON': str(args.ai_python)})
    run('desktop-tests-and-build', npm_command + ['test'], DESKTOP, env={**os.environ, 'DEIDEI_PYTHON': sys.executable, 'DEIDEI_AI_PYTHON': str(args.ai_python)})
    run('freeze-core', [sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean', '--distpath', out / 'frozen', '--workpath', out / 'pyinstaller-core', HERE / 'worker.spec'])
    run('freeze-ai', [args.ai_python, '-m', 'PyInstaller', '--noconfirm', '--clean', '--distpath', out / 'frozen', '--workpath', out / 'pyinstaller-ai', HERE / 'ai-worker.spec'])
    run('frozen-core', [node, HERE / 'check-worker.cjs', out / 'frozen'], out)
    ai_worker = out / 'frozen/ai-worker'
    if not ai_worker.is_dir():
        raise RuntimeError('AI_WORKER_OUTPUT_MISSING')
    run('frozen-ai', [node, HERE / 'check-ai.cjs', out / 'frozen'], out)
    verify_build_inputs(ROOT, head, initial_inputs)
    stage_files = json.loads(run('stage-list', [node, HERE / 'stage.cjs', '--list']))
    run('stage-source', [node, HERE / 'stage.cjs', DESKTOP])
    stage = out / 'stage'
    stage.mkdir()
    for name in stage_files:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DESKTOP / name, target)
    # The same lock closes every production transitive dependency; builder alone is never shipped.
    write_json(stage / 'package.json', {key: package[key] for key in ['name', 'productName', 'version', 'main', 'author', 'description', 'dependencies']})
    lock = json.loads((DESKTOP / 'package-lock.json').read_text())
    lock['name'] = package['name']
    lock['packages']['']['name'] = package['name']
    lock['version'] = package['version']
    lock['packages']['']['version'] = package['version']
    write_json(stage / 'package-lock.json', lock)
    run('production-install', npm_command + ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], stage)
    run('production-tree', npm_command + ['ls', '--omit=dev', '--all', '--json'], stage)
    run('stage-installed', [node, HERE / 'stage.cjs', stage])
    run('runtime-licenses', [args.ai_python, HERE / 'notices.py', out / 'THIRD-PARTY', stage])
    shutil.copy2(HERE / 'PLAYER-README.txt', out / 'PLAYER-README.txt')
    build_info = {'task_id': 'R05-T01-a', 'baseline_sha': BASELINE, 'code_sha': head, 'version': package['version'], 'distribution': args.mode, 'package_name': package['name'],
                  'rules_version': 'configured-1.0.0', 'rules_schema': 1, 'ai_schema': 1, 'platform': sys.platform, 'arch': target_arch,
                  'python': platform.python_version(), 'electron': package['devDependencies']['electron'], 'compilation_inputs': COMPILATION_INPUTS,
                  'input_files_sha256': initial_inputs,
                  'lock_sha256': {'npm': sha(DESKTOP / 'package-lock.json'), 'packaging': sha(packaging_lock), 'ai': sha(ai_lock)}}
    write_json(stage / 'build-info.json', build_info)
    write_json(out / 'update-config.json', update_config)
    write_json(out / 'telemetry-config.json', telemetry_config)
    resources = [{'from': 'frozen/worker', 'to': 'worker'}, {'from': 'frozen/ai-worker', 'to': 'ai-worker'}, {'from': 'THIRD-PARTY', 'to': 'THIRD-PARTY'}]
    mac_binaries = ['Contents/Resources/' + file.relative_to(out / 'frozen').as_posix() for file in macho_files(out / 'frozen')] if sys.platform == 'darwin' else []
    write_json(out / 'package-plan.json', {'mode': args.mode, 'appId': 'cn.kalopsia.deidei.update-fixture' if args.mode == 'fixture' else 'cn.kalopsia.deidei.r02', 'executableName': 'DeiDeiR02', 'resources': resources, 'macBinaries': mac_binaries, 'fixtureSigningIdentity': args.fixture_signing_identity, 'publisherName': args.publisher_name})
    run('builder-publish-never', [node, HERE / 'pack.mjs', out])
    application = Path((out / 'application-path.txt').read_text())
    resources_path = application / ('Contents/Resources' if sys.platform == 'darwin' else 'resources')
    run('packaged-stage', [node, HERE / 'stage.cjs', resources_path / 'app'])
    run('updater-cache-identity', [node, '-e', "const fs=require('node:fs');const yaml=require(process.argv[1]);const config=yaml.load(fs.readFileSync(process.argv[2],'utf8'));if(config.updaterCacheDirName!==process.argv[3])throw Error('UPDATER_CACHE_IDENTITY_MISMATCH');console.log(JSON.stringify({updaterCacheDirName:config.updaterCacheDirName}));", DESKTOP / 'node_modules/js-yaml', resources_path / 'app-update.yml', package['name'].lower() + '-updater'])
    run('packaged-core', [node, HERE / 'check-worker.cjs', resources_path], out)
    run('packaged-ai', [node, HERE / 'check-ai.cjs', resources_path], out)
    run('packaged-resource-closure', [sys.executable, HERE / 'verify-contents.py', out, resources_path])
    for name, binary in [('desktop', application / ('Contents/MacOS/DeiDeiR02' if sys.platform == 'darwin' else 'DeiDeiR02.exe')), ('core', resources_path / 'worker' / ('deidei-worker' if sys.platform == 'darwin' else 'deidei-worker.exe')), ('ai', resources_path / 'ai-worker' / ('deidei-ai-worker' if sys.platform == 'darwin' else 'deidei-ai-worker.exe'))]:
        if sys.platform == 'darwin':
            if run(name + '-architecture', ['lipo', '-archs', binary]).strip() != 'arm64':
                raise RuntimeError('NATIVE_ARCHITECTURE_MISMATCH')
        else:
            data = binary.read_bytes()
            offset = struct.unpack_from('<I', data, 0x3c)[0]
            if data[:2] != b'MZ' or data[offset:offset+4] != b'PE\0\0' or struct.unpack_from('<H', data, offset+4)[0] != 0x8664:
                raise RuntimeError('NATIVE_ARCHITECTURE_MISMATCH')
    if sys.platform == 'darwin':
        run('signature-integrity', ['codesign', '--verify', '--deep', '--strict', '--verbose=2', application])
        run('signature-level', ['codesign', '--display', '--verbose=4', application])
        if args.mode == 'production':
            run('stapled-ticket', ['xcrun', 'stapler', 'validate', application])
            run('gatekeeper', ['spctl', '--assess', '--type', 'execute', '--verbose=4', application])
        for index, binary in enumerate(macho_files(resources_path / 'worker') + macho_files(resources_path / 'ai-worker')):
            run(f'nested-signature-{index}', ['codesign', '--verify', '--strict', '--verbose=2', binary])
    records = release_artifacts(out / 'packaged', package['version'], sys.platform, target_arch)
    for record in records:
        if not record['filename'].endswith('.yml'):
            continue
        feed = out / 'packaged' / record['filename']
        if 'stagingPercentage:' in feed.read_text():
            raise RuntimeError('STAGED_ROLLOUT_FORBIDDEN')
    unpacked_application = application
    if sys.platform == 'darwin':
        archive = out / 'packaged' / next(record['filename'] for record in records if record['filename'].endswith('.zip'))
        unpacked = out / '中文 空格 解压'
        unpacked.mkdir()
        run('unpack-update-zip', ['ditto', '-x', '-k', archive, unpacked])
        unpacked_application = unpacked / application.name
        for source in application.rglob('*'):
            target = unpacked_application / source.relative_to(application)
            if source.is_symlink():
                if not target.is_symlink() or os.readlink(source) != os.readlink(target):
                    raise RuntimeError('ZIP_SYMLINK_CHANGED')
            elif source.is_file() and (not target.is_file() or sha(source) != sha(target) or stat.S_IMODE(source.stat().st_mode) != stat.S_IMODE(target.stat().st_mode)):
                raise RuntimeError('ZIP_BYTES_OR_MODE_CHANGED')
        run('unpacked-signature', ['codesign', '--verify', '--deep', '--strict', '--verbose=2', unpacked_application])
        run('unpacked-core', [node, HERE / 'check-worker.cjs', unpacked_application / 'Contents/Resources'], out)
        run('unpacked-ai', [node, HERE / 'check-ai.cjs', unpacked_application / 'Contents/Resources'], out)
    if args.mode == 'production' and sys.platform == 'win32':
        for record in records:
            if record['filename'].endswith('.exe'):
                run('installer-signature', [Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe', '-NoProfile', '-Command', "$s=Get-AuthenticodeSignature -LiteralPath $args[0]; if($s.Status -ne 'Valid' -or $s.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -ne $args[1]){exit 1}", out / 'packaged' / record['filename'], args.publisher_name])
    verify_build_inputs(ROOT, head, initial_inputs)
    manifest = {'task_id': 'R05-T01-a', 'code_sha': head, 'version': package['version'], 'platform': sys.platform, 'arch': target_arch, 'distribution': args.mode,
                'appId': 'cn.kalopsia.deidei.update-fixture' if args.mode == 'fixture' else 'cn.kalopsia.deidei.r02', 'appName': package['productName'], 'package_name': package['name'], 'artifacts': records,
                'build_info_sha256': sha(stage / 'build-info.json'), 'lock_sha256': build_info['lock_sha256'], 'rules_schema': 1, 'ai_schema': 1,
                'signature': 'Developer ID, notarized and stapled' if args.mode == 'production' and sys.platform == 'darwin' else 'production signed installer' if args.mode == 'production' else 'test identity, not notarized' if args.fixture_signing_identity else 'ad-hoc, not notarized' if sys.platform == 'darwin' else 'unsigned local-test',
                'levels': {'source': 'PASS', 'package_contents': 'PASS', 'frozen_core': 'PASS', 'frozen_ai': 'PASS', 'native_install': 'NOT_RUN', 'production_trust': 'PASS' if args.mode == 'production' else 'NOT_RUN', 'human_cross_device': 'NOT_RUN'}}
    write_json(out / 'release-manifest.json', manifest)
    zip_record = next((record for record in records if record['filename'].endswith('.zip')), records[0])
    # Keep the established latest pointer shape for package inspection; the manifest names every new artifact.
    write_json(out / 'delivery-manifest.json', {**manifest, 'sha256': zip_record['sha256'], 'filename': zip_record['filename']})
    write_json(build / 'latest.json', {'out': str(out), 'archive': str(out / 'packaged' / zip_record['filename']), 'unpacked_application': str(unpacked_application)})
    print('BUILT ' + str(out) + '; no release published')


if __name__ == '__main__':
    main()
