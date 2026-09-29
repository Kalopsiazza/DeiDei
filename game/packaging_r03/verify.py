"""Verify the delivery inventory, stage allowlist, source identity and native binaries."""
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import subprocess

STAGE = ['main.cjs', 'preload.cjs', 'profile.cjs', 'worker-port.cjs', 'worker-bridge.cjs',
         'worker-launch.cjs', 'build/fixture.cjs', 'build/ui/index.html', 'build/ui/renderer.js',
         'build/ui/style.css', 'online/network-room-port.cjs', 'online/wire.cjs', 'catalog.json']


def sha(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def inventory(root: Path) -> dict:
    result = {}
    for p in sorted(root.rglob('*')):
        name = p.relative_to(root).as_posix()
        if name == 'FILE-MANIFEST.json': continue
        assert p.resolve().is_relative_to(root.resolve()), 'ESCAPING_SYMLINK'
        if p.is_symlink():
            assert p.exists(), 'DANGLING_SYMLINK'
            result[name] = {'symlink': os.readlink(p)}
        elif p.is_file():
            result[name] = {'sha256': sha(p), 'bytes': p.stat().st_size,
                            'mode': stat.S_IMODE(p.stat().st_mode) if os.name != 'nt' else None}
    return result


def architecture(binary: Path, target: str) -> None:
    assert binary.is_file(), 'MISSING_EXECUTABLE'
    if target == 'darwin-arm64':
        assert os.access(binary, os.X_OK), 'MISSING_EXECUTABLE_MODE'
        assert subprocess.check_output(['lipo', '-archs', str(binary)], text=True).strip() == 'arm64', 'WRONG_ARCHITECTURE'
    else:
        assert target == 'win32-x64', 'UNSUPPORTED_PLATFORM'
        with binary.open('rb') as f: data = f.read(4096)
        assert data[:2] == b'MZ' and len(data) >= 64, 'INVALID_PE'
        offset = struct.unpack_from('<I', data, 0x3c)[0]
        assert data[offset:offset+4] == b'PE\0\0' and struct.unpack_from('<H', data, offset+4)[0] == 0x8664, 'WRONG_ARCHITECTURE'


def paths(root: Path, target: str) -> tuple[Path, Path, Path]:
    mac = target == 'darwin-arm64'
    app = root / ('DeiDei R03 Diagnostic.app' if mac else 'DeiDei R03 Diagnostic-win32-x64')
    resources = app / ('Contents/Resources' if mac else 'resources')
    executable = app / ('Contents/MacOS/DeiDeiR03' if mac else 'DeiDeiR03.exe')
    server = root / 'room-server' / ('deidei-room-server' if mac else 'deidei-room-server.exe')
    return resources, executable, server


def verify(root: Path, expected_source: str, expected_packaging: str, target: str, native: bool = True) -> dict:
    assert root.is_dir() and (root / 'FILE-MANIFEST.json').is_file(), 'INVALID_ARTIFACT_PATH'
    listed = json.loads((root / 'FILE-MANIFEST.json').read_text())
    assert inventory(root) == listed, 'INVENTORY_MISMATCH'
    info = json.loads((root / 'build-info.json').read_text())
    assert info['source_sha'] == expected_source and info['packaging_sha'] == expected_packaging, 'SHA_MISMATCH'
    assert info['platform'] == target, 'PLATFORM_MISMATCH'
    resources, executable, server = paths(root, target)
    app = resources / 'app'
    assert {p.relative_to(app).as_posix() for p in app.rglob('*') if p.is_file()} == set(STAGE + ['package.json', 'build-info.json']), 'STAGE_MISMATCH'
    assert sha(app / 'build-info.json') == sha(root / 'build-info.json') == sha(root / 'room-server/build-info.json'), 'BUILD_INFO_MISMATCH'
    for relative, expected in info['stage_sha256'].items():
        assert sha(app / relative) == expected, 'STAGE_BYTES_CHANGED'
    assert sha(resources / 'worker/_internal/deidei_runtime/data/catalog.json') == info['catalog_sha256']
    assert sha(resources / 'worker/_internal/deidei_runtime/entry-map.json') == info['entry_map_sha256']
    for p in root.rglob('*'):
        assert p.name not in {'tests-online', 'node_modules', '.venv', 'testing.py', 'game/integration'}, 'TEST_OR_ENV_LEAK'
        assert p.suffix.lower() not in {'.ttf', '.otf', '.pkl', '.pt', '.pth'}, 'UNAPPROVED_ASSET'
    for name in ['Electron-LICENSE', 'Electron-LICENSES.chromium.html', 'Python-LICENSE.txt', 'websockets-LICENSE.txt']:
        assert (root / 'THIRD-PARTY' / name).is_file(), 'MISSING_LICENSE'
    if native:
        for binary in [executable, server, resources / 'worker' / ('deidei-worker' if target == 'darwin-arm64' else 'deidei-worker.exe')]:
            architecture(binary, target)
    return info
