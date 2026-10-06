# Preserved checkpoint CPU inference

This environment is separate from core/runtime and loads only the verified
repository `legacy/rl/rl_checkpoints/latest.zip`. It does not import legacy
training code or load `opponent_pool.pkl`. `model_loader.load_model()` uses
`MaskablePPO.load(env=None, device='cpu')`, strict original parameters, no
`custom_objects`, eval/inference mode, and one CPU thread. `probabilities()`
accepts a bounded 156-value observation and 31 boolean legal slots.

From the repository root on macOS arm64:

```sh
uv venv --python 3.11.16 game/ai/.venv
uv pip sync --python game/ai/.venv/bin/python --require-hashes --only-binary :all: game/ai/requirements-darwin-arm64.lock
game/ai/.venv/bin/python -I game/ai/probe.py --output .local-outputs/R05-T01-a/model-probe/benchmark.json
```

The probe is a macOS/POSIX diagnostic, using `ps` for RSS. It sends 200 real
parent-to-child requests with a 750 ms reply limit, checks output shape,
finite/nonnegative normalized probability mass, initial and disabled-cloud
masks, invalid input rejection, and reaps its own child. Fixed probe observations
and masks are harness inputs; this is not a core settlement or desktop match.

For Windows x64, create a fresh Python 3.11.16 venv and sync
`requirements-win32-x64.lock` with its `Scripts/python.exe`. That lock pins the
official `torch==2.9.1+cpu` wheel; no CUDA dependencies are included. Native
Windows loading/execution remains **NOT_RUN** in the macOS feasibility probe.

Both locks contain all 15 transitive packages and only target/pure Python wheel
hashes. Inference requires Torch, SB3/Contrib, Gymnasium, NumPy and cloudpickle;
the remaining packages come from their declared CPU dependency closure. No
training extras, GUI, telemetry, TensorBoard, or model download are required.

Initial Python 3.11.16 / Torch 2.9.1 / SB3+Contrib 2.9.0 / Gymnasium 0.29.1 /
NumPy 1.26.4 / cloudpickle 3.1.1 loading **FAILED** with
`ModuleNotFoundError: numpy._core.numeric`. Replacing only NumPy with 2.3.5
**PASSED**, without model edits or deserialization replacements. Saved NumPy
2.5.2 requires Python >=3.12 and has no cp311 wheel, so it cannot be used with
the existing packaged Python. The original checkpoint records SB3 2.9.0,
Windows/Python 3.14.7, Torch 2.13.0 CPU, Gymnasium 1.3.0 and cloudpickle 3.1.2.

Local feasibility evidence is in `.local-outputs/R05-T01-a/model-probe/`:
eight-item `preserve.json`, finite ZIP metadata, original failure, direct loading,
dependency metadata/wheel identities, lock checks, and IPC measurements. First
direct loading took 5264 ms; a subsequent fresh process with warm filesystem
cache took 1427 ms to ready. The 200 requests measured p50 0.153 ms, p95 0.194 ms,
max 9.898 ms, no timeouts, 279265280-byte RSS, and normal child exit 0. These
figures establish execution feasibility, not model strength or installed app
acceptance. Projection, current-core legality/settlement, supervisor lifecycle,
desktop matches and native packaging are separate integration checks.

The production entry is `worker-entry.py` (frozen name `deidei-ai-worker`). It
loads the same verified manifest and original checkpoint; frozen loading uses
`sys._MEIPASS/model-manifest.json` and `model/latest.zip`. An independent stdin
reader treats EOF as the parent lease ending, including during model loading or
a blocked forward. Only correlated, bounded 156/31 inference data cross this
boundary. No legacy training source or opponent pool is imported.

Run the source integration diagnostic with the verified AI Python:

```sh
game/ai/.venv/bin/python -I game/ai/runtime_probe.py --output .local-outputs/R05-T01-a/runtime-ai-probe.json
```

It checks original-model default/cloud-off/human-ZengYi current-core rounds,
200 correlated requests, a loaded-child crash with a successful legal fallback,
cancel during cold loading, direct runtime death, and a controlled parent EOF
lease death. Eight preserved Git blob identities are compared with the issue's
fixed main baseline. Native Windows and killing the actual Electron main are
explicitly NOT_RUN in this source diagnostic; the parent harness is not an
Electron acceptance claim.

Primary dependency references checked during the probe:

- [MaskablePPO loading and policy distribution](https://sb3-contrib.readthedocs.io/en/master/modules/ppo_mask.html)
- [SB3 checkpoint format](https://stable-baselines3.readthedocs.io/en/master/guide/save_format.html)
- [Official Torch 2.9.1 CPU installation](https://pytorch.org/get-started/previous-versions/)
- [NumPy 2.3.5 release wheel metadata](https://pypi.org/project/numpy/2.3.5/)
