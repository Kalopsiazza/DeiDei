"""Locate bundled data without consulting cwd or developer environment variables."""
from pathlib import Path
import sys


def catalog_path() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(__file__).with_name('data') / 'catalog.json'
    return Path(__file__).resolve().parents[2] / 'desktop/catalog.json'
