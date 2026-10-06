"""Bounded JSONL on stdin/stdout; only the local parent can start a session."""
import json
import re
import sys
import unicodedata
from copy import deepcopy

from .solo import SoloGame
from .tutorial import TutorialGame
from .opponent import ENTRY_MAP, OPPONENT_ID
from deidei_core.rules import (compile_rules, descriptors, default_request, parse_pack, pack_ref,
                               validate_pack, RULES_VERSION, MAX_PACK_BYTES)

LIMIT = 1024 * 1024
FIELDS = {"health": set(), "start_solo": {"profile_id", "nickname", "avatar_id"},
          "start_tutorial": {"profile_id", "nickname", "avatar_id"}, "tutorial_next": {"view_id"},
          "submit": {"view_id", "entry_id"}, "get_view": set(), "leave": set(), "shutdown": set()}
V2_FIELDS = {**FIELDS, "start_solo": FIELDS["start_solo"] | {"rules_request", "rule_pack_manifests"},
             "rules.describe": set(), "rules.compile": {"rules_request", "rule_pack_manifests"},
             "rules.validate_pack": {"pack_json"}}
CAPABILITIES = {"wire_versions": [1, 2], "rules_schema": 1, "core_state_schema": 2,
                "rules_pack_api": "deidei.rules-pack.v1", "max_pack_bytes": MAX_PACK_BYTES}


def valid_text(value: object, maximum: int) -> bool:
    return (isinstance(value, str) and 1 <= len(value) <= maximum
            and not any(unicodedata.category(c) in ("Cc", "Cf", "Cs") for c in value))


class Worker:
    def __init__(self, solo_factory=SoloGame):
        self.solo_factory, self.solo, self.stopping = solo_factory, None, False
        self.session_version = None

    def handle(self, request: object) -> dict:
        request_id = request.get("id") if isinstance(request, dict) else None
        if not valid_text(request_id, 128):
            request_id = None
        version = request.get("v") if isinstance(request, dict) else None
        reply_version = version if type(version) is int and version in (1, 2) else 1
        try:
            if (not isinstance(request, dict) or set(request) != {"v", "id", "op", "payload"}
                    or type(version) is not int or version not in (1, 2) or request_id is None
                    or not isinstance(request["op"], str)):
                raise ValueError("INVALID_REQUEST")
            op, payload = request["op"], request["payload"]
            fields = FIELDS if version == 1 else V2_FIELDS
            if op not in fields or not isinstance(payload, dict) or set(payload) != fields[op]:
                raise ValueError("INVALID_REQUEST")
            if self.stopping:
                raise ValueError("SESSION_CLOSED")
            if op == "health":
                data = {"runtime": "r02-t04-a", "rules_version": "classic-1.0.1", "opponent": OPPONENT_ID}
                if version == 2:
                    data.update(runtime="r05-t01-a", rules_version=RULES_VERSION, capabilities=deepcopy(CAPABILITIES))
            elif op == "rules.describe":
                data = descriptors()
            elif op == "rules.validate_pack":
                try:
                    manifest = parse_pack(payload["pack_json"])
                    data = {"manifest": manifest, "pack_ref": pack_ref(manifest)}
                except (ValueError, TypeError, UnicodeError, RecursionError):
                    raise ValueError("INVALID_RULE_PACK") from None
            elif op == "rules.compile":
                data = configured_rules(payload)
            elif op in ("start_solo", "start_tutorial"):
                if (not isinstance(payload["profile_id"], str)
                        or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", payload["profile_id"])
                        or payload["profile_id"] == "bot_local" or not valid_text(payload["nickname"], 20)
                        or not payload["nickname"].strip() or payload["avatar_id"] not in ("leaf", "sun", "moon", "star")):
                    raise ValueError("INVALID_PROFILE")
                profile = {key: payload[key] for key in FIELDS["start_solo"]}
                configuration = (configured_rules(payload) if op == "start_solo" else
                                 {"rules_snapshot": compile_rules(default_request()), "rule_pack_manifests": []}) if version == 2 else {}
                new = TutorialGame(profile, **configuration) if op == "start_tutorial" else self.solo_factory(profile, **configuration)
                if self.solo:
                    self.solo.leave()
                self.solo = new
                self.session_version = version
                data = new.get_view()
            elif op == "shutdown":
                if self.solo:
                    self.solo.leave()
                self.solo, self.stopping, data = None, True, None
            else:
                if self.solo is None:
                    raise ValueError("SESSION_CLOSED")
                if version != self.session_version:
                    raise ValueError("UNSUPPORTED_PROTOCOL")
                if op == "submit":
                    if (not valid_text(payload["view_id"], 128) or not isinstance(payload["entry_id"], str)
                            or payload["entry_id"] not in ENTRY_MAP):
                        raise ValueError("INVALID_REQUEST")
                    data = self.solo.submit(payload["view_id"], payload["entry_id"])
                elif op == "tutorial_next":
                    if not isinstance(self.solo, TutorialGame) or not valid_text(payload["view_id"], 128):
                        raise ValueError("INVALID_REQUEST")
                    data = self.solo.advance(payload["view_id"])
                elif op == "get_view":
                    data = self.solo.get_view()
                else:
                    data, self.solo = self.solo.leave(), None
                    self.session_version = None
            return {"v": reply_version, "id": request_id, "ok": True, "data": data}
        except ValueError as error:
            code = str(error) if re.fullmatch(r"[A-Z_]+", str(error)) else "INVALID_REQUEST"
            return {"v": reply_version, "id": request_id, "ok": False, "error": {"code": code}}


def configured_rules(payload: dict) -> dict:
    try:
        snapshot = compile_rules(payload["rules_request"], payload["rule_pack_manifests"])
        return {"rules_snapshot": snapshot,
                "rule_pack_manifests": [validate_pack(m) for m in payload["rule_pack_manifests"]]}
    except (ValueError, TypeError, UnicodeError, RecursionError):
        raise ValueError("INVALID_RULES") from None


def strict_object(pairs: list) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("INVALID_REQUEST")
        result[key] = value
    return result


def serve(reader, writer, worker: Worker | None = None) -> None:
    worker = worker if worker is not None else Worker()
    while not worker.stopping:
        line = reader.readline(LIMIT + 1)
        if not line:
            break
        if len(line) > LIMIT or not line.endswith(b"\n"):
            response = {"v": 1, "id": None, "ok": False, "error": {"code": "FRAME_TOO_LARGE" if len(line) > LIMIT else "INVALID_REQUEST"}}
            writer.write(json.dumps(response).encode() + b"\n")
            writer.flush()
            break
        try:
            request = json.loads(line.decode("utf-8"), object_pairs_hook=strict_object,
                                 parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            response = worker.handle(request)
        except (ValueError, UnicodeError, RecursionError):
            response = {"v": 1, "id": None, "ok": False, "error": {"code": "INVALID_REQUEST"}}
        encoded = (json.dumps(response, ensure_ascii=True, separators=(",", ":")) + "\n").encode()
        if len(encoded) > LIMIT:
            encoded = (json.dumps({"v": 1, "id": response["id"], "ok": False,
                                   "error": {"code": "FRAME_TOO_LARGE"}}) + "\n").encode()
            worker.stopping = True
        writer.write(encoded)
        writer.flush()
    if worker.solo and not worker.solo.closed:
        worker.solo.leave()


if __name__ == "__main__":
    serve(sys.stdin.buffer, sys.stdout.buffer)
