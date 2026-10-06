"""Load only the preserved repository checkpoint, never a request-supplied path."""

import hashlib
import json
import math
from pathlib import Path
import sys


def load_model():
    root = Path(__file__).resolve().parents[3]
    bundle = Path(sys._MEIPASS) if getattr(sys, "frozen", False) else None
    manifest = json.loads(((bundle / "model-manifest.json") if bundle else
                           (root / "game/ai/model-manifest.json")).read_text())
    checkpoint = bundle / "model/latest.zip" if bundle else root / "legacy/rl/rl_checkpoints/latest.zip"
    data = checkpoint.read_bytes()
    if len(data) != manifest["bytes"] or hashlib.sha256(data).hexdigest() != manifest["sha256"]:
        raise ValueError("Preserved model identity mismatch")

    import torch
    from sb3_contrib import MaskablePPO

    torch.set_num_threads(1)
    if torch.get_num_interop_threads() != 1:
        torch.set_num_interop_threads(1)
    model = MaskablePPO.load(checkpoint, env=None, device="cpu")
    if model.observation_space.shape != (156,) or model.action_space.n != 31:
        raise ValueError("Expected preserved 156-observation/31-action model")
    model.policy.set_training_mode(False)
    return model


def probabilities(model, observation, legal_mask):
    if (not isinstance(observation, list) or len(observation) != 156
            or any(type(value) not in (int, float) or not 0 <= value <= 1
                   or not math.isfinite(value) for value in observation)):
        raise ValueError("Expected 156 finite observation values in [0, 1]")
    if (not isinstance(legal_mask, list) or len(legal_mask) != 31
            or any(type(value) is not bool for value in legal_mask) or not any(legal_mask)):
        raise ValueError("Expected 31 boolean slots with at least one legal action")

    import numpy as np
    import torch

    with torch.inference_mode():
        tensor = model.policy.obs_to_tensor(np.asarray(observation, dtype=np.float32))[0]
        result = model.policy.get_distribution(tensor, action_masks=np.asarray(legal_mask)).distribution.probs
        values = result.cpu().numpy()[0].astype(float).tolist()
    if len(values) != 31 or any(not math.isfinite(value) or value < 0 for value in values):
        raise ValueError("Invalid model probability distribution")
    values = [value if legal else 0.0 for value, legal in zip(values, legal_mask)]
    total = sum(values)
    if total <= 0:
        raise ValueError("Model has no legal probability mass")
    return [value / total for value in values]
