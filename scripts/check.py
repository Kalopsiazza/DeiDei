"""Dependency-free checks shared by local development and GitHub Actions."""
from __future__ import annotations

import ast
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def source_files() -> list[Path]:
    """Check tracked and untracked Python sources, excluding ignored local files."""
    try:
        proc = subprocess.run(
            ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
            cwd=ROOT, capture_output=True, check=True,
        )
        paths = {ROOT / p.decode("utf-8") for p in proc.stdout.split(b"\0") if p}
        return sorted(p for p in paths if p.suffix == ".py" and p.is_file())
    except (OSError, subprocess.CalledProcessError):
        excluded = {".git", ".venv", "venv", "node_modules", "build", "dist", "__pycache__"}
        return sorted(p for p in ROOT.rglob("*.py") if not excluded.intersection(p.relative_to(ROOT).parts))


def main() -> int:
    files = source_files()
    if not files:
        print("ERROR: no Python files found.", file=sys.stderr)
        return 1
    for path in files:
        try:
            ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
        except (SyntaxError, UnicodeError) as exc:
            print(f"ERROR: {path.relative_to(ROOT)}: {exc}", file=sys.stderr)
            return 1
    print(f"Syntax checked: {len(files)} Python files.", flush=True)

    sys.path.insert(0, str(ROOT))
    import unittest
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"))
    if suite.countTestCases() == 0:
        print("ERROR: no tests discovered.", file=sys.stderr)
        return 1
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(f"Tests run: {result.testsRun}; known expected failures: {len(result.expectedFailures)}.")
    print("GUI, model inference and online play are NOT covered by this check.")
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
