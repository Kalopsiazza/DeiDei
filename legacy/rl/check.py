"""Check preserved bytes and old rules without importing ML or loading models."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parent


def main() -> int:
    try:
        files = json.loads((ROOT / "PRESERVE.json").read_text(encoding="utf-8"))["files"]
        if len(files) != 8:
            raise ValueError("preservation manifest must contain eight files")
        for entry in files:
            path = ROOT / Path(entry["original_path"])
            data = path.read_bytes()
            blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            if (len(data), blob, hashlib.sha256(data).hexdigest()) != (
                entry["bytes"], entry["git_blob"], entry["sha256"]
            ):
                raise ValueError(f"preserved bytes differ: {entry['path']}")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"ERROR: preservation: {exc}", file=sys.stderr)
        return 1
    print("Preservation: 8 files match size, Git blob and SHA-256.", flush=True)
    sys.path.insert(0, str(ROOT))
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"))
    count = suite.countTestCases()
    if not count:
        print("ERROR: no legacy rule tests discovered.", file=sys.stderr)
        return 1
    print(f"Legacy rules: discovered {count} tests.", flush=True)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(f"Legacy rules: ran {result.testsRun}; known expected failures: {len(result.expectedFailures)}.")
    print("Model inference NOT tested; no ML imports or model deserialization.")
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
