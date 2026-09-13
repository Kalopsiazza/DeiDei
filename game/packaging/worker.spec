from pathlib import Path
import sys

root = Path(SPECPATH).resolve().parent
a = Analysis(
    [str(Path(SPECPATH) / 'worker_entry.py')],
    pathex=[str(root / 'core'), str(root / 'runtime')],
    datas=[(str(root / 'desktop/catalog.json'), 'deidei_runtime/data'),
           (str(root / 'runtime/deidei_runtime/entry-map.json'), 'deidei_runtime')],
    hiddenimports=[], hookspath=[], excludes=[], noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='deidei-worker',
          console=True, upx=False, contents_directory='_internal',
          codesign_identity='-' if sys.platform == 'darwin' else None)
coll = COLLECT(exe, a.binaries, a.datas, name='worker', upx=False)
