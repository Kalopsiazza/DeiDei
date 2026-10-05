"""The shared check must reject an empty or failing discovery group."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

CHECK = Path(__file__).resolve().parents[1] / "scripts/check.py"


class CheckRunnerTests(unittest.TestCase):
    def test_empty_and_failing_groups_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            empty = subprocess.run([sys.executable, str(CHECK), "--discover", tmp], capture_output=True, text=True)
            self.assertNotEqual(empty.returncode, 0)
            self.assertIn("no tests discovered", empty.stderr)
            (Path(tmp) / "test_failure.py").write_text(
                "import unittest\nclass Failure(unittest.TestCase):\n    def test_failure(self):\n        self.fail('intentional probe')\n",
                encoding="utf-8",
            )
            failed = subprocess.run([sys.executable, str(CHECK), "--discover", tmp], capture_output=True, text=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertIn("intentional probe", failed.stderr)
            self.assertIn("Discovered 1 tests", failed.stdout)
