"""Create an intentionally invalid signed artifact only from a separate fixture build."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--from', dest='source', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
source, out = args.source.resolve(), args.out.resolve()
manifest = json.loads((source / 'release-manifest.json').read_text())
if manifest['distribution'] != 'fixture' or manifest['appId'] != 'cn.kalopsia.deidei.update-fixture' or not manifest['appName'].startswith('DeiDei Update Fixture'):
    raise SystemExit('FIXTURE_ARTIFACT_REQUIRED')
out.mkdir(parents=True, exist_ok=False)
artifacts = out / 'packaged'; artifacts.mkdir()
for record in manifest['artifacts']:
    if Path(record['filename']).name != record['filename']:
        raise SystemExit('FIXTURE_ARTIFACT_PATH_INVALID')
    shutil.copy2(source / 'packaged' / record['filename'], artifacts / record['filename'])
application = Path((source / 'application-path.txt').read_text())
bad_application = out / application.name
if sys.platform == 'darwin':
    subprocess.run(['ditto', str(application), str(bad_application)], check=True)
    info = bad_application / 'Contents/Resources/app/build-info.json'
    with info.open('ab') as file:
        file.write(b'\n ')  # Changes signed resources while preserving app/version JSON.
    package = next(artifacts.glob('*.zip'))
    package.unlink()
    subprocess.run(['ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', str(bad_application), str(package)], check=True)
else:
    shutil.copytree(application, bad_application)
    package = next(artifacts.glob('*.exe'))
    with package.open('r+b') as file:
        file.seek(0x100); byte = file.read(1); file.seek(0x100); file.write(bytes([byte[0] ^ 1]))
feed = {'version': manifest['version'], 'files': [{'url': package.name, 'size': package.stat().st_size, 'sha512': base64.b64encode(hashlib.sha512(package.read_bytes()).digest()).decode()}]}
for file in artifacts.glob('*.yml'):
    file.write_text(json.dumps(feed) + '\n')  # JSON is a strict YAML subset understood by the actual updater.
for record in manifest['artifacts']:
    file = artifacts / record['filename']; record.update(bytes=file.stat().st_size, sha256=hashlib.sha256(file.read_bytes()).hexdigest())
manifest['signature'] = 'intentionally invalid fixture; never publish'
manifest['levels']['package_contents'] = 'NOT_RUN'
manifest['levels']['native_install'] = 'NOT_RUN'
(out / 'release-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(out / 'application-path.txt').write_text(str(bad_application))
print(out)
