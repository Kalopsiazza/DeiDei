"""Repeatable isolated Git probe for the native build source snapshot guard."""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('native_build', Path(__file__).with_name('build.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result = {'unchanged': 'NOT_RUN', 'tracked_bytes_changed': 'NOT_RUN', 'head_changed': 'NOT_RUN'}
    with tempfile.TemporaryDirectory(prefix='deidei-input-guard-') as temporary:
        repo = Path(temporary)
        (repo / 'game').mkdir()
        source = repo / 'game/input.txt'
        source.write_text('committed input\n')
        def git(*arguments):
            return subprocess.check_output(['git', *arguments], cwd=repo, text=True).strip()
        def commit(message):
            git('-c', 'user.name=R05 local guard probe', '-c', 'user.email=probe@example.invalid', 'commit', '-qm', message)
        git('init', '-q')
        git('add', 'game/input.txt')
        commit('probe input')
        head, snapshot = git('rev-parse', 'HEAD'), module.input_snapshot(repo)
        module.verify_build_inputs(repo, head, snapshot)
        result['unchanged'] = 'PASS'
        def reject(label):
            try:
                module.verify_build_inputs(repo, head, snapshot)
            except RuntimeError as error:
                if str(error) != 'BUILD_INPUTS_CHANGED_DURING_BUILD':
                    raise
                result[label] = 'PASS: actual mutation rejected'
            else:
                raise AssertionError(label + ' incorrectly accepted')
        source.write_text('changed during build\n')
        reject('tracked_bytes_changed')
        source.write_text('committed input\n')
        (repo / 'outside-inputs.txt').write_text('new HEAD, same compilation input bytes\n')
        git('add', 'outside-inputs.txt')
        commit('probe new HEAD')
        reject('head_changed')
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
