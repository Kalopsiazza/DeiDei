"""Uniform legal-entry selection; this function never receives user input."""
import json
from pathlib import Path
from random import Random, SystemRandom

ENTRY_MAP = {e["entry_id"]: e for e in json.loads(
    Path(__file__).with_name("entry-map.json").read_text(encoding="utf-8"))["entries"]}
OPPONENT_NAME = "临时随机对手"
OPPONENT_ID = "random-legal-v1"


def choose_entry(options: list[dict], rng: Random | None = None) -> str | None:
    legal = [o["entry_id"] for o in options if o["available"]]
    return (rng if rng is not None else SystemRandom()).choice(legal) if legal else None


def needs_token(entry_id: str, player: dict) -> bool:
    entry = ENTRY_MAP[entry_id]
    move = player["latest_copyable_move"] if entry["origin"] == "zhang" else entry["actual_move"]
    return move in ("RotateThree", "FlipVolvo")
