"""Fixed entry for source and frozen deidei-ai-worker; no training imports."""
from pathlib import Path
import sys

if not getattr(sys, "frozen", False):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
from deidei_ai.worker import serve

if __name__ == "__main__":
    serve()
