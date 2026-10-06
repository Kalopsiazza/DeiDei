from pathlib import Path
import importlib.util
from PyInstaller.utils.hooks import copy_metadata

root = Path(SPECPATH).resolve().parent
game = root
a = Analysis(
    [str(game / 'ai/worker-entry.py')],
    pathex=[str(game / 'ai')],
    datas=[(str(game / 'ai/model-manifest.json'), '.'),
           (str(game.parent / 'legacy/rl/rl_checkpoints/latest.zip'), 'model'),
           *[(str(Path(importlib.util.find_spec(package).origin).parent / 'version.txt'), package)
             for package in ('stable_baselines3', 'sb3_contrib')],
           *copy_metadata('stable-baselines3'), *copy_metadata('sb3-contrib')],
    hiddenimports=[], hookspath=[],
    excludes=['matplotlib', 'tensorboard', 'pandas', 'tkinter', 'IPython', 'pytest'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='deidei-ai-worker',
          console=True, upx=False, contents_directory='_internal')
coll = COLLECT(exe, a.binaries, a.datas, name='ai-worker', upx=False)
