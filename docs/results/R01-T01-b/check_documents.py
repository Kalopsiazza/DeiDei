"""R01-T01-b: document structure/provenance and hand-calculation checks only."""
from __future__ import annotations

from fractions import Fraction
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[3]
RESULT = Path(__file__).resolve().parent
BASE = "3a81daf0f42416ccb73a5a69748655145e6f2f0c"
SOURCE = "d3a1e5842781fed433799c940619ab38da0230be"
FORMAL = [
    "docs/rules/v1/README.md", "docs/rules/v1/RULEBOOK.md",
    "docs/rules/v1/PLAYER-GUIDE.md", "docs/rules/v1/CASES.md",
    "docs/rules/v1/TRACEABILITY.md", "docs/prd/PRD-RULES-v1.0.md",
    "docs/architecture/RULE-ENGINE-v1.0.md",
]


def blob(sha: str, path: str) -> bytes:
    """Read pinned evidence without checking out or executing its contents."""
    return subprocess.check_output(["git", "show", f"{sha}:{path}"], cwd=ROOT)


def check(condition: bool, message: str) -> None:
    """Keep checks active even when Python is invoked with -O."""
    if not condition:
        raise ValueError(message)


def check_ids(actual: list[str], prefix: str, count: int, width: int) -> None:
    expected = [f"{prefix}{i:0{width}}" for i in range(1, count + 1)]
    check(actual == expected, f"{prefix}: missing, duplicate or reordered IDs")


def main() -> None:
    texts = {}
    for path in FORMAL:
        raw = blob(BASE, path)
        check((ROOT / path).read_bytes() == raw, f"Modified formal input: {path}")
        check(b"\r" not in raw and not raw.startswith(b"\xef\xbb\xbf"), f"Encoding: {path}")
        texts[path] = raw.decode("utf-8")
    book = texts["docs/rules/v1/RULEBOOK.md"]
    guide = texts["docs/rules/v1/PLAYER-GUIDE.md"]
    cases = texts["docs/rules/v1/CASES.md"]
    trace = texts["docs/rules/v1/TRACEABILITY.md"]
    check_ids(re.findall(r'<a id="(R\d{2})"></a>', book), "R", 28, 2)
    check_ids(re.findall(r"^\| (E\d{2}) \|", book, re.M), "E", 33, 2)
    check_ids(re.findall(r"^\| (E\d{2}) \|", guide, re.M), "E", 33, 2)
    check_ids(re.findall(r"^\| (G\d{2}) \|", trace, re.M), "G", 60, 2)
    check_ids(re.findall(r'<a id="(C\d{3})"></a>', cases), "C", 80, 3)
    check_ids(re.findall(r"^### (C\d{3})｜", cases, re.M), "C", 80, 3)
    check("DESIGNED_NOT_RUN" in cases, "Case execution boundary missing")
    substantive = re.sub(r'<a id="C075"></a>.*?(?=<a id="C076")', "", cases, flags=re.S)
    check(set(re.findall(r"E\d{2}", substantive)) >= {f"E{i:02}" for i in range(1, 34)},
          "An entry is mentioned only by the generic coverage case")

    original = "docs/results/R01-T01-a/"
    framework = blob(SOURCE, original + "RULE-FRAMEWORK.md").decode("utf-8")
    check_ids(re.findall(r"^\| (G\d{2}) \|", framework, re.M), "G", 60, 2)
    catalog = json.loads(blob(SOURCE, original + "MOVE-CATALOG.json"))
    moves = catalog["moves"] + catalog["new_entries"]
    check(len(moves) == 33, "Original catalog entry count")
    actual = {m["resolution"]["actual_move"] for m in moves
              if m["resolution"]["kind"] != "substitute"}
    check(len(actual) == 26, "Complete actual move count")
    for move in moves:
        for key in ("availability", "cost"):
            fact = move[key]["rule"]
            check(bool(fact["evidence"]) and fact["status"] in {"CONFIRMED", "DERIVED"},
                  f"Unconfirmed {key}: {move['id']}")

    coverage = (RESULT / "COVERAGE.md").read_text()
    for prefix, count, width in (("G", 60, 2), ("E", 33, 2), ("C", 80, 3)):
        ids = re.findall(rf"^\| \[({prefix}\d{{{width}}})\]", coverage, re.M)
        check_ids(ids, prefix, count, width)
    findings = (RESULT / "FINDINGS.md").read_text()
    known = set(re.findall(r"^## (F\d{2}) ·", findings, re.M))
    check(known == {f"F{i:02}" for i in range(1, 6)}, "Finding IDs")
    check(set(re.findall(r"F\d{2}", coverage)) <= known, "Unknown coverage finding")

    # ponytail: fixed document checks only; no simulated actions or rule engine.
    sums = {
        "C017": ([3, 2, -1], 4), "C018": ([3, -1], 2),
        "C019": ([1, 1, -1], 1), "C021": ([4, -1], 3),
        "C022": ([0, -1], -1), "C023": ([3, -1], 2),
        "C039": ([2, -1], 1), "C043/C050": ([1, -1], 0),
        "C058": ([0, 1, 1, -1], 1), "C060": ([3, 4, 1, 1, -1], 8),
        "C063 Three": ([3, 1, -1], 3),
    }
    for name, (terms, expected) in sums.items():
        check(sum(map(Fraction, terms)) == expected, f"Hand arithmetic: {name}")
    finite = ("0", "1/3", "1/2", "1", "2", "3", "7/2", "4", "5", "6", "7", "8", "9", "10", "100", "9999", "10000")
    check(all((Fraction(x) * 6).denominator == 1 for x in finite), "Sixth units")

    # Check local targets and pinned GitHub evidence, without network access.
    docs = {**texts, **{p.relative_to(ROOT).as_posix(): p.read_text()
                       for p in RESULT.glob("*.md")}}
    link_count = 0
    for path, text in docs.items():
        columns = None
        for line in text.splitlines():
            if line.startswith("|"):
                count = len(line.split("|"))
                check(columns is None or columns == count, f"Table columns: {path}")
                columns = count
            else:
                columns = None
        definitions = dict(re.findall(r"^\[([^\]]+)\]: (\S+)$", text, re.M))
        for ref in re.findall(r"\[[^\]]+\]\[([^\]]+)\]", text):
            check(ref in definitions, f"Undefined reference {ref}: {path}")
        urls = re.findall(r"\[[^\]]*\]\(([^)]+)\)", text) + list(definitions.values())
        for url in urls:
            pinned = re.fullmatch(r"https://github\.com/Kalopsiazza/DeiDei/blob/([0-9a-f]{40})/([^#]+)(?:#(.*))?", url)
            if pinned:
                sha, target, anchor = pinned.groups()
                body = blob(sha, unquote(target)).decode("utf-8")
            elif not re.match(r"[a-zA-Z]+:", url):
                target, _, anchor = unquote(url).partition("#")
                file = (ROOT / path).parent / target if target else ROOT / path
                check(file.is_file(), f"Missing link {url}: {path}")
                body = file.read_text()
            else:
                continue
            if anchor and re.fullmatch(r"L\d+(?:-L\d+)?", anchor):
                check(all(1 <= int(n) <= len(body.splitlines()) for n in re.findall(r"\d+", anchor)),
                      f"Out-of-range line: {url}")
            elif anchor and re.fullmatch(r"[RC]\d{2,3}", anchor):
                check(f'id="{anchor}"' in body, f"Missing anchor: {url}")
            link_count += 1

    manifest_path = RESULT / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        for item in manifest["inputs"]:
            data = blob(item["sha"], item["path"])
            check(hashlib.sha256(data).hexdigest() == item["sha256"], f"Input hash: {item['path']}")
        for item in manifest["artifacts"]:
            check(hashlib.sha256((ROOT / item["path"]).read_bytes()).hexdigest() == item["sha256"],
                  f"Artifact hash: {item['path']}")
        print("Manifest input/artifact SHA-256: PASS")
    print("DOCUMENT_CHECK_PASS")
    print("Pinned formal files unchanged: 7; R: 28; E: 33 x 2; G: 60; C: 80")
    print("Original catalog: 33 entries / 26 actual moves; costs and eligibility have provenance")
    print("Review coverage: 60 G / 33 E / 80 C; finding references valid")
    print(f"Hand arithmetic: {len(sums)} sums; exact sixth units: {len(finite)} values")
    print(f"Local/pinned links checked: {link_count}")
    print("No engine, model, GUI, network gameplay, or installer was tested.")


if __name__ == "__main__":
    main()
