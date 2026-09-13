"""Frozen entry: preserve the existing bounded JSONL worker protocol."""
import sys

from deidei_runtime.worker import serve

if __name__ == '__main__':
    serve(sys.stdin.buffer, sys.stdout.buffer)
