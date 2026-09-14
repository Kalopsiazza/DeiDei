"""Bounded JSONL on stdin/stdout; only the local parent can start a session."""
import json
import re
import sys
import unicodedata

from .solo import SoloGame
from .opponent import ENTRY_MAP, OPPONENT_ID

LIMIT = 1024 * 1024
FIELDS = {"health": set(), "start_solo": {"profile_id", "nickname", "avatar_id"},
          "submit": {"view_id", "entry_id"}, "get_view": set(), "leave": set(), "shutdown": set()}


def valid_text(value: object, maximum: int) -> bool:
    return (isinstance(value, str) and 1 <= len(value) <= maximum
            and not any(unicodedata.category(c) in ("Cc", "Cf", "Cs") for c in value))


class Worker:
    def __init__(self, solo_factory=SoloGame):
        self.solo_factory, self.solo, self.stopping = solo_factory, None, False

    def handle(self, request: object) -> dict:
        request_id = request.get("id") if isinstance(request, dict) else None
        if not valid_text(request_id, 128):
            request_id = None
        try:
            if (not isinstance(request, dict) or set(request) != {"v", "id", "op", "payload"}
                    or type(request["v"]) is not int or request["v"] != 1 or request_id is None
                    or not isinstance(request["op"], str) or request["op"] not in FIELDS):
                raise ValueError("INVALID_REQUEST")
            op, payload = request["op"], request["payload"]
            if not isinstance(payload, dict) or set(payload) != FIELDS[op]:
                raise ValueError("INVALID_REQUEST")
            if self.stopping:
                raise ValueError("SESSION_CLOSED")
            if op == "health":
                data = {"runtime": "r02-t04-a", "rules_version": "classic-1.0.1", "opponent": OPPONENT_ID}
            elif op == "start_solo":
                if (not isinstance(payload["profile_id"], str)
                        or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", payload["profile_id"])
                        or payload["profile_id"] == "bot_local" or not valid_text(payload["nickname"], 20)
                        or not payload["nickname"].strip() or payload["avatar_id"] not in ("leaf", "sun", "moon", "star")):
                    raise ValueError("INVALID_PROFILE")
                new = self.solo_factory(payload)
                if self.solo:
                    self.solo.leave()
                self.solo = new
                data = new.get_view()
            elif op == "shutdown":
                if self.solo:
                    self.solo.leave()
                self.solo, self.stopping, data = None, True, None
            else:
                if self.solo is None:
                    raise ValueError("SESSION_CLOSED")
                if op == "submit":
                    if (not valid_text(payload["view_id"], 128) or not isinstance(payload["entry_id"], str)
                            or payload["entry_id"] not in ENTRY_MAP):
                        raise ValueError("INVALID_REQUEST")
                    data = self.solo.submit(payload["view_id"], payload["entry_id"])
                elif op == "get_view":
                    data = self.solo.get_view()
                else:
                    data, self.solo = self.solo.leave(), None
            return {"v": 1, "id": request_id, "ok": True, "data": data}
        except ValueError as error:
            code = str(error) if re.fullmatch(r"[A-Z_]+", str(error)) else "INVALID_REQUEST"
            return {"v": 1, "id": request_id, "ok": False, "error": {"code": code}}


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
