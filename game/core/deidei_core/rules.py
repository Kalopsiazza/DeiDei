"""Pure declarative rules compiler; no files, clocks, randomness or executable packs."""
from copy import deepcopy
import hashlib
import json
import re

SCHEMA_VERSION = 1
RULES_VERSION = "configured-1.0.0"
BASE_VERSION = "classic-1.0.1"
SKILLS = ("ZengYi", "ZhangXinWei", "NieXiang", "JuYan", "LiQiang", "Bomb", "Cloud", "TianLiJun")
PRESETS = {"classic": "经典", "firepower": "火力", "loan": "贷款", "lucky": "幸运"}
PRESET_VERSION = "1.0.0"
LUCKY_CHAIN = ("Bi", "Pragon", "Three", "Volvo", "BigBi")
SKILL_ENTRIES = {
    "ZengYi": {"ZengYi", "ZengRewardBigBi"}, "ZhangXinWei": {"ZhangXinWei"},
    "NieXiang": {"NieXiang", "NieXiangDef"}, "JuYan": {"JuYan"},
    "LiQiang": {"LiQiang"}, "Bomb": {"Bomb", "BombPragon", "BombVolvo", "BombFlipVolvo"},
    "Cloud": {"Cloud", "FreeThree", "FreeRotateThree"}, "TianLiJun": {"TianLiJun"},
}
PARAMETER_FIELDS = {"charge_gain_dd6", "opening_dd6", "opening_scope", "lucky_probability_bps", "lucky_upgrade_table"}
REQUEST_FIELDS = {"schema_version", "preset_id", "skill_flags", "preset_params", "pack_refs"}
SNAPSHOT_FIELDS = {"schema_version", "rules_version", "base_rules_version", "preset_id", "preset_version", "skill_flags", "parameters", "packs", "rules_hash"}
PACK_FIELDS = {"api_version", "kind", "id", "version", "name", "author", "base_rules_version", "presets"}
PACK_PRESET_FIELDS = {"id", "name", "description", "skill_defaults", "parameters"}
MAX_PACK_BYTES = 8192
HOOKS = {"initial_resources": "opening-v1", "entry_availability": "skills-v1",
         "action_transform": "basic-attacks-v1", "resource_effects": "charge-v1"}


def canonical_json(value: object) -> str:
    """All accepted numeric values are integers; object keys are ASCII schema keys."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def content_hash(value: object) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def _exact(value: object, fields: set, label: str) -> None:
    if not isinstance(value, dict) or set(value) != fields:
        raise ValueError(f"{label}: missing or unknown fields")


def _flags(value: object) -> dict:
    _exact(value, set(SKILLS), "skill_flags")
    if any(type(flag) is not bool for flag in value.values()):
        raise ValueError("skill_flags: each flag must be boolean")
    return {skill: value[skill] for skill in SKILLS}


def _parameters(value: object) -> dict:
    _exact(value, PARAMETER_FIELDS, "parameters")
    if (value["charge_gain_dd6"] not in ("6", "12", "30")
            or value["opening_dd6"] not in ("0", "6")
            or value["opening_scope"] != "each_game"
            or value["lucky_upgrade_table"] != "basic-attacks-v1"
            or type(value["lucky_probability_bps"]) is not int
            or not 0 <= value["lucky_probability_bps"] <= 10000):
        raise ValueError("parameters: unsupported capability or value")
    return deepcopy(value)


def _id(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[a-z][a-z0-9.-]{0,63}", value) is not None


def _version(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", value) is not None and len(value) <= 32


def _text(value: object, limit: int) -> str:
    if (not isinstance(value, str) or not 1 <= len(value) <= limit
            or any(ord(c) < 32 or 127 <= ord(c) <= 159 or 0xD800 <= ord(c) <= 0xDFFF for c in value)
            or re.search(r"(?:https?|file|javascript|data):|[/\\]{2}|(?:^|[/\\])\.\.(?:[/\\]|$)", value, re.I)):
        raise ValueError("pack text: invalid length, control character, URL or path")
    return value


def validate_pack(manifest: object) -> dict:
    _exact(manifest, PACK_FIELDS, "pack")
    if (manifest["api_version"] != "deidei.rules-pack.v1" or manifest["kind"] != "declarative"
            or manifest["base_rules_version"] != BASE_VERSION
            or not _id(manifest["id"]) or not _version(manifest["version"])):
        raise ValueError("pack: unsupported version, kind or identity")
    _text(manifest["name"], 40)
    _text(manifest["author"], 60)
    presets = manifest["presets"]
    if not isinstance(presets, list) or not 1 <= len(presets) <= 4:
        raise ValueError("pack: expected one to four presets")
    seen = set()
    for preset in presets:
        _exact(preset, PACK_PRESET_FIELDS, "pack preset")
        if not _id(preset["id"]) or preset["id"] in seen:
            raise ValueError("pack: invalid or duplicate preset id")
        seen.add(preset["id"])
        _text(preset["name"], 40)
        _text(preset["description"], 120)
        _flags(preset["skill_defaults"])
        _parameters(preset["parameters"])
    normalized = deepcopy(manifest)
    if len(canonical_json(normalized).encode("utf-8")) > MAX_PACK_BYTES:
        raise ValueError("pack: exceeds 8 KiB")
    return normalized


def parse_pack(data: bytes | str) -> dict:
    """Raw import rejects duplicate keys and bounds depth before schema traversal."""
    if isinstance(data, bytes):
        if len(data) > MAX_PACK_BYTES:
            raise ValueError("pack: exceeds 8 KiB")
        data = data.decode("utf-8", errors="strict")
    if not isinstance(data, str) or len(data.encode("utf-8")) > MAX_PACK_BYTES:
        raise ValueError("pack: expected bounded UTF-8 JSON")
    depth, quoted, escaped = 0, False, False
    for character in data:
        if quoted:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                quoted = False
        elif character == '"':
            quoted = True
        elif character in "[{":
            depth += 1
            if depth > 8:
                raise ValueError("pack: excessive nesting")
        elif character in "]}":
            depth -= 1
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("pack: duplicate JSON key")
            result[key] = value
        return result
    def invalid_number(_value):
        raise ValueError("pack: noninteger number")
    return validate_pack(json.loads(data, object_pairs_hook=pairs, parse_float=invalid_number, parse_constant=invalid_number))


def pack_ref(manifest: dict) -> dict:
    normalized = validate_pack(manifest)
    return {"id": normalized["id"], "version": normalized["version"], "content_hash": content_hash(normalized)}


def default_request(preset_id: str = "classic") -> dict:
    if preset_id not in PRESETS:
        raise ValueError("unknown builtin preset")
    return {"schema_version": 1, "preset_id": preset_id, "skill_flags": dict.fromkeys(SKILLS, True), "preset_params": {}, "pack_refs": []}


def _builtin_parameters(preset: str, params: dict) -> dict:
    if not isinstance(params, dict) or set(params) - ({"firepower_charge_dd6"} if preset == "firepower" else set()):
        raise ValueError("preset_params: unsupported parameter")
    charge = params.get("firepower_charge_dd6", "12") if preset == "firepower" else "6"
    if preset == "firepower" and charge not in ("12", "30"):
        raise ValueError("firepower: charge must be 12 or 30 sixths")
    return {"charge_gain_dd6": charge, "opening_dd6": "6" if preset == "loan" else "0",
            "opening_scope": "each_game", "lucky_probability_bps": 2500 if preset == "lucky" else 0,
            "lucky_upgrade_table": "basic-attacks-v1"}


def compile_rules(request: object, pack_manifests: list | None = None) -> dict:
    _exact(request, REQUEST_FIELDS, "rules request")
    if type(request["schema_version"]) is not int or request["schema_version"] != 1:
        raise ValueError("unsupported rules schema")
    flags = _flags(request["skill_flags"])
    preset, refs = request["preset_id"], request["pack_refs"]
    if not isinstance(preset, str) or not isinstance(refs, list):
        raise ValueError("invalid preset or pack references")
    manifests = [] if pack_manifests is None else pack_manifests
    if not isinstance(manifests, list) or len(manifests) > 1:
        raise ValueError("one pack at most")
    if preset in PRESETS:
        if refs or manifests:
            raise ValueError("builtin preset cannot reference packs")
        version, parameters = PRESET_VERSION, _builtin_parameters(preset, request["preset_params"])
    else:
        parts = preset.split(":")
        if len(parts) != 3 or parts[0] != "pack" or len(refs) != 1 or len(manifests) != 1 or request["preset_params"] != {}:
            raise ValueError("unknown preset or missing pack")
        manifest = validate_pack(manifests[0])
        ref = pack_ref(manifest)
        if parts[1] != ref["id"] or refs[0] != ref:
            raise ValueError("pack reference mismatch")
        selected = next((p for p in manifest["presets"] if p["id"] == parts[2]), None)
        if selected is None:
            raise ValueError("unknown pack preset")
        version, parameters = manifest["version"], deepcopy(selected["parameters"])
    snapshot = {"schema_version": 1, "rules_version": RULES_VERSION, "base_rules_version": BASE_VERSION,
                "preset_id": preset, "preset_version": version, "skill_flags": flags,
                "parameters": parameters, "packs": deepcopy(refs)}
    return {**snapshot, "rules_hash": content_hash(snapshot)}


def validate_snapshot(snapshot: object) -> dict:
    _exact(snapshot, SNAPSHOT_FIELDS, "rules snapshot")
    if (type(snapshot["schema_version"]) is not int or snapshot["schema_version"] != 1
            or snapshot["rules_version"] != RULES_VERSION or snapshot["base_rules_version"] != BASE_VERSION):
        raise ValueError("unsupported rules snapshot version")
    _flags(snapshot["skill_flags"])
    _parameters(snapshot["parameters"])
    preset, refs = snapshot["preset_id"], snapshot["packs"]
    if not isinstance(preset, str) or not isinstance(refs, list):
        raise ValueError("invalid snapshot identity")
    if preset in PRESETS:
        params = {"firepower_charge_dd6": snapshot["parameters"]["charge_gain_dd6"]} if preset == "firepower" else {}
        expected = _builtin_parameters(preset, params)
        if refs or snapshot["preset_version"] != PRESET_VERSION or snapshot["parameters"] != expected:
            raise ValueError("builtin snapshot mismatch")
    else:
        parts = preset.split(":")
        if len(parts) != 3 or parts[0] != "pack" or not _id(parts[1]) or not _id(parts[2]) or len(refs) != 1:
            raise ValueError("invalid pack snapshot identity")
        _exact(refs[0], {"id", "version", "content_hash"}, "pack reference")
        ref = refs[0]
        if (ref["id"] != parts[1] or not _version(ref["version"]) or ref["version"] != snapshot["preset_version"]
                or not isinstance(ref["content_hash"], str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", ref["content_hash"])):
            raise ValueError("invalid pack snapshot reference")
    unsigned = {key: value for key, value in snapshot.items() if key != "rules_hash"}
    if snapshot["rules_hash"] != content_hash(unsigned):
        raise ValueError("rules hash mismatch")
    return deepcopy(snapshot)


def skill_allowed(snapshot: dict | None, entry_id: str, actual_move: str | None = None) -> bool:
    return snapshot is None or all(snapshot["skill_flags"][skill] or
           (entry_id not in entries and actual_move not in entries) for skill, entries in SKILL_ENTRIES.items())


def initial_resources(snapshot: dict | None) -> int:
    return 0 if snapshot is None else int(snapshot["parameters"]["opening_dd6"])


def charge_gain(snapshot: dict | None) -> int:
    return 6 if snapshot is None else int(snapshot["parameters"]["charge_gain_dd6"])


def action_transform(snapshot: dict, base_move: str, token: int) -> dict:
    """P1 native hook: one fixed attack upgrade after the original spend plan."""
    if type(token) is not int or not 0 <= token < 10000 or base_move not in LUCKY_CHAIN[:-1]:
        raise ValueError("invalid lucky transform input")
    probability = snapshot["parameters"]["lucky_probability_bps"]
    if token >= probability:
        return {"actual_move": base_move, "upgrade": None}
    upgraded = LUCKY_CHAIN[LUCKY_CHAIN.index(base_move) + 1]
    return {"actual_move": upgraded, "upgrade": {"kind": "lucky_upgrade", "from": base_move,
                                                "to": upgraded, "probability_bps": probability}}


def descriptors() -> dict:
    return {"schema_version": 1, "rules_version": RULES_VERSION, "base_rules_version": BASE_VERSION,
            "presets": [{"id": key, "name": name, "request": default_request(key), "snapshot": compile_rules(default_request(key))} for key, name in PRESETS.items()],
            "skills": list(SKILLS), "native_hooks": HOOKS.copy(), "max_pack_bytes": MAX_PACK_BYTES}
