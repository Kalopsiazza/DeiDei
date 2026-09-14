import os
from pathlib import Path
root = Path(os.environ['R03_SOURCE'])
server = os.environ['R03_FREEZE'] == 'server'
entry = Path(SPECPATH) / 'server_entry.py' if server else root / 'game/packaging/worker_entry.py'
a = Analysis([str(entry)], pathex=[str(root / 'game/core'), str(root / ('game/server' if server else 'game/runtime'))],
    datas=[] if server else [(str(root / 'game/desktop/catalog.json'), 'deidei_runtime/data'),
      (str(root / 'game/runtime/deidei_runtime/entry-map.json'), 'deidei_runtime')],
    hiddenimports=[], hookspath=[], excludes=['tkinter'], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='deidei-room-server' if server else 'deidei-worker',
          console=True, upx=False, contents_directory='_internal')
coll = COLLECT(exe, a.binaries, a.datas, name='room-server' if server else 'worker', upx=False)
