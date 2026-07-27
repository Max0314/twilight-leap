from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = PROJECT_ROOT / "art" / "specs" / "sprite-manifest.json"
OUTPUT_PATH = PROJECT_ROOT / "art" / "previews" / "asset-catalog.png"
THUMBNAIL_SIZE = 384
LABEL_HEIGHT = 44
GAP = 24
COLUMNS = 3


def checkerboard(size: tuple[int, int], unit: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, "#171020")
    draw = ImageDraw.Draw(image)
    colors = ("#21152b", "#2b1d34")
    for y in range(0, size[1], unit):
        for x in range(0, size[0], unit):
            draw.rectangle(
                (x, y, x + unit - 1, y + unit - 1),
                fill=colors[(x // unit + y // unit) % 2],
            )
    return image


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font_path = Path("C:/Windows/Fonts/arial.ttf")
    if font_path.is_file():
        return ImageFont.truetype(str(font_path), size)
    return ImageFont.load_default()


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sheets = manifest["sheets"]
    rows = math.ceil(len(sheets) / COLUMNS)
    width = GAP + COLUMNS * (THUMBNAIL_SIZE + GAP)
    height = 72 + rows * (THUMBNAIL_SIZE + LABEL_HEIGHT + GAP)
    catalog = Image.new("RGBA", (width, height), "#100b18")
    draw = ImageDraw.Draw(catalog)
    draw.text((GAP, 20), "TWILIGHT LEAP — PRODUCTION ART CATALOG", font=font(26), fill="#fff0cf")

    for index, sheet in enumerate(sheets):
        column = index % COLUMNS
        row = index // COLUMNS
        left = GAP + column * (THUMBNAIL_SIZE + GAP)
        top = 72 + row * (THUMBNAIL_SIZE + LABEL_HEIGHT + GAP)
        tile = checkerboard((THUMBNAIL_SIZE, THUMBNAIL_SIZE))
        source_path = (MANIFEST_PATH.parent / sheet["path"]).resolve()
        with Image.open(source_path) as opened:
            source = opened.convert("RGBA")
            source.thumbnail(
                (THUMBNAIL_SIZE, THUMBNAIL_SIZE),
                resample=Image.Resampling.NEAREST,
            )
            tile.alpha_composite(
                source,
                (
                    (THUMBNAIL_SIZE - source.width) // 2,
                    (THUMBNAIL_SIZE - source.height) // 2,
                ),
            )
        catalog.alpha_composite(tile, (left, top))
        draw.rectangle(
            (left, top, left + THUMBNAIL_SIZE - 1, top + THUMBNAIL_SIZE - 1),
            outline="#6f4e78",
            width=1,
        )
        draw.text(
            (left, top + THUMBNAIL_SIZE + 10),
            sheet["id"],
            font=font(18),
            fill="#ffca6a",
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    catalog.convert("RGB").save(OUTPUT_PATH, format="PNG", optimize=True)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
