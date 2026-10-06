"""Small filesystem probe: release inventory excludes builder diagnostics and requires native artifacts."""
import importlib.util
import json
from pathlib import Path
import tempfile


def main():
    spec = importlib.util.spec_from_file_location('native_build', Path(__file__).with_name('build.py'))
    build = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(build)
    result = {}
    with tempfile.TemporaryDirectory(prefix='deidei-artifact-whitelist-') as temporary:
        directory = Path(temporary)
        for target, arch, extensions, feed in [('darwin', 'arm64', ('.dmg', '.zip'), 'latest-mac.yml'), ('win32', 'x64', ('.exe',), 'latest.yml')]:
            os_name = 'mac' if target == 'darwin' else 'win'
            assets = [f'DeiDei-0.5.0-{os_name}-{arch}{extension}' for extension in extensions]
            for name in assets + [feed, 'builder-debug.yml', 'unrelated.zip']:
                (directory / name).write_text('diagnostic stagingPercentage: 50\n' if name == 'builder-debug.yml' else name)
            records = build.release_artifacts(directory, '0.5.0', target, arch)
            assert {record['filename'] for record in records} == set(assets + [feed])
            for record in records:
                assert record['bytes'] == len((directory / record['filename']).read_bytes())
                assert record['sha256'] == build.sha(directory / record['filename'])
            result[target + '_real_files_and_hashes'] = 'PASS'
            (directory / assets[0]).unlink()
            try:
                build.release_artifacts(directory, '0.5.0', target, arch)
            except RuntimeError as error:
                assert str(error) == 'UPDATE_ARTIFACT_SET_INCOMPLETE'
            else:
                raise AssertionError('missing native artifact accepted')
            result[target + '_missing_native_rejected'] = 'PASS'
            for file in directory.iterdir():
                file.unlink()
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
