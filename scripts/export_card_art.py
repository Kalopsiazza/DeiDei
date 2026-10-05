"""Compose generated art with exact catalog text; Pillow is a build-time tool only."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = ROOT / "game/desktop"
SIZE = (1080, 1440)
GROUPS = {"attack": "攻击", "defense": "防御", "skill": "技能"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(exports: Path) -> None:
    entries = json.loads((DESKTOP / "catalog.json").read_text())["entries"]
    manifest = json.loads((exports / "manifest.json").read_text())
    assert {e["entry_id"] for e in entries} == set(manifest["cards"]), "Incomplete deck"
    for entry in entries:
        eid = entry["entry_id"]
        info = manifest["cards"][eid]
        assert info["name"] == entry["name"]
        assert "".join(info["title_lines"]) == entry["name"], "Title changed"
        assert info["category"] == entry["ui_group"] and info["doc_id"] == entry["doc_id"]
        for path, size in [(exports / "png" / f"{eid}.png", SIZE),
                           (DESKTOP / "assets/cards" / f"{eid}.webp", SIZE),
                           (DESKTOP / "assets/moves" / f"{eid}.png", (512, 512))]:
            with Image.open(path) as image:
                image.load()
                assert image.size == size and image.mode == "RGBA", str(path)
                assert image.getchannel("A").getextrema() == (0, 255), str(path)
                assert image.getpixel((0, 0))[3] == 0, "Opaque exterior"
            assert digest(path) == info["sha256"][path.suffix[1:] if size == SIZE else "icon"]
    print(f"PASS: {len(entries)} catalog titles, PNG/WebP faces, transparent icons and hashes")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--art-root", type=Path)
    parser.add_argument("--exports", required=True, type=Path)
    parser.add_argument("--font", type=Path)
    parser.add_argument("--font-index", type=int, default=1)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check(args.exports)
        return
    assert args.art_root and args.font and args.font.is_file(), "Art root and font required"
    entries = json.loads((DESKTOP / "catalog.json").read_text())["entries"]
    generated = json.loads((args.art_root / "generation.json").read_text())
    font = lambda size: ImageFont.truetype(str(args.font), size, index=args.font_index)
    probe = font(72)
    missing = probe.getmask(chr(0xFFFF))
    for char in set("".join(e["name"] + e["doc_id"] + GROUPS[e["ui_group"]] for e in entries)):
        if char.isspace():
            continue
        mask = probe.getmask(char)
        assert (mask.size, bytes(mask)) != (missing.size, bytes(missing)), f"Missing glyph: {char}"
    for directory in [args.exports / "png", DESKTOP / "assets/cards", DESKTOP / "assets/card-templates"]:
        directory.mkdir(parents=True, exist_ok=True)
    templates = {}
    for group in GROUPS:
        image = Image.open(args.art_root / generated[f"frame-{group}"]["path"]).convert("RGBA").resize(SIZE, Image.Resampling.LANCZOS)
        # ponytail: one fixed mask trims generated edge flecks; no image-specific segmentation.
        mask = Image.new("L", SIZE)
        ImageDraw.Draw(mask).polygon([(50, 16), (1030, 16), (1060, 46), (1060, 1394),
                                     (1030, 1424), (50, 1424), (20, 1394), (20, 46)], fill=255)
        image.putalpha(ImageChops.multiply(image.getchannel("A"), mask))
        image.save(DESKTOP / "assets/card-templates" / f"{group}.png")
        templates[group] = image
    manifest = {"font": {"name": probe.getname(), "source": "macOS supplied Songti; font file not distributed"}, "cards": {}}
    sheet = Image.new("RGB", (7 * 216, ((len(entries) + 6) // 7) * 288), "#0e1218")
    for index, entry in enumerate(entries):
        eid = entry["entry_id"]
        assert re.fullmatch(r"[A-Za-z0-9]+", eid), "Unsafe entry ID"
        original = Image.open(args.art_root / generated[eid]["path"]).convert("RGBA")
        assert original.getchannel("A").getextrema() == (0, 255), f"Icon needs alpha: {eid}"
        art = original.crop(original.getchannel("A").getbbox())
        art.thumbnail((468, 468), Image.Resampling.LANCZOS)
        icon = Image.new("RGBA", (512, 512))
        icon.alpha_composite(art, ((512 - art.width) // 2, (512 - art.height) // 2))
        icon_path = DESKTOP / "assets/moves" / f"{eid}.png"
        icon.save(icon_path, optimize=True)
        card = templates[entry["ui_group"]].copy()
        card.alpha_composite(icon.resize((840, 840), Image.Resampling.LANCZOS), (120, 270))
        draw = ImageDraw.Draw(card)
        draw.text((92, 144), GROUPS[entry["ui_group"]], font=font(72), anchor="lm", fill="#e6bb80")
        draw.text((988, 140), entry["doc_id"], font=font(44), anchor="rm", fill="#d5b78e")
        name = entry["name"]
        lines = name.replace("曾义赠送·", "曾义赠送·\n").split("\n")
        size = 100 if len(lines) > 1 else 144
        while max(draw.textlength(line, font=font(size)) for line in lines) > 900:
            size -= 2
            assert size >= 82, f"Title overflow: {name}"
        for row, line in enumerate(lines):
            y = 1274 if len(lines) == 1 else 1240 + row * 104
            bbox = draw.textbbox((540, y), line, font=font(size), anchor="mm")
            assert 60 <= bbox[0] and bbox[2] <= 1020 and 1180 <= bbox[1] and bbox[3] <= 1400, name
            draw.text((540, y), line, font=font(size), anchor="mm", fill="#f3e2c7", stroke_width=0)
        png = args.exports / "png" / f"{eid}.png"
        webp = DESKTOP / "assets/cards" / f"{eid}.webp"
        card.save(png, optimize=True)
        card.save(webp, quality=92, method=6)
        manifest["cards"][eid] = {"name": name, "doc_id": entry["doc_id"], "category": entry["ui_group"],
                                   "title_lines": lines, "font_size": size,
                                   "sha256": {"png": digest(png), "webp": digest(webp), "icon": digest(icon_path)}}
        thumb = card.resize((216, 288), Image.Resampling.LANCZOS)
        sheet.paste(thumb, ((index % 7) * 216, (index // 7) * 288), thumb)
    args.exports.mkdir(parents=True, exist_ok=True)
    (args.exports / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    sheet.save(args.exports / "deck-overview.jpg", quality=94)
    print(f"Exported {len(entries)} complete faces and icons with exact catalog text")
    check(args.exports)


if __name__ == "__main__":
    main()
