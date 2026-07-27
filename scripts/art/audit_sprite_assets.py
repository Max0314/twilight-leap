from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = PROJECT_ROOT / "art" / "specs" / "sprite-manifest.json"


def alpha_bounds_touch_boundary(
    image: Image.Image,
    columns: int,
    rows: int,
) -> list[int]:
    alpha = image.getchannel("A")
    cell_width = image.width // columns
    cell_height = image.height // rows
    touching: list[int] = []
    for index in range(columns * rows):
        column = index % columns
        row = index // columns
        bounds = alpha.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        ).getbbox()
        if bounds and (
            bounds[0] == 0
            or bounds[1] == 0
            or bounds[2] == cell_width
            or bounds[3] == cell_height
        ):
            touching.append(index)
    return touching


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    default_grid = manifest["sheet"]
    failures: list[str] = []
    report: list[dict[str, object]] = []

    for sheet in manifest["sheets"]:
        path = (MANIFEST_PATH.parent / sheet["path"]).resolve()
        if not path.is_file():
            failures.append(f"{sheet['id']}: missing {path}")
            continue

        grid = sheet.get("grid", default_grid)
        columns = grid["columns"]
        rows = grid["rows"]
        frame_count = columns * rows
        with Image.open(path) as opened:
            image = opened.convert("RGBA")
            expected_size = (
                grid.get("cellWidth", default_grid["cellWidth"]) * columns,
                grid.get("cellHeight", default_grid["cellHeight"]) * rows,
            )
            if image.size != expected_size:
                failures.append(
                    f"{sheet['id']}: expected {expected_size}, got {image.size}"
                )
            corners = (
                image.getpixel((0, 0))[3],
                image.getpixel((image.width - 1, 0))[3],
                image.getpixel((0, image.height - 1))[3],
                image.getpixel((image.width - 1, image.height - 1))[3],
            )
            if sheet.get("kind") != "parallax-stack" and any(corners):
                failures.append(f"{sheet['id']}: non-transparent sheet corner")

            touching = alpha_bounds_touch_boundary(image, columns, rows)
            if sheet.get("kind") != "parallax-stack" and touching:
                failures.append(
                    f"{sheet['id']}: cell-boundary pixels in {touching}"
                )

            for animation_id, animation in sheet.get("animations", {}).items():
                end = animation["start"] + animation["count"]
                if animation["start"] < 0 or end > frame_count:
                    failures.append(
                        f"{sheet['id']}/{animation_id}: range exceeds {frame_count}"
                    )

            report.append(
                {
                    "id": sheet["id"],
                    "path": str(path.relative_to(PROJECT_ROOT)),
                    "size": image.size,
                    "grid": f"{columns}x{rows}",
                    "boundaryTouches": touching,
                }
            )

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit("\n".join(failures))
    print(f"PASS: {len(report)} sheets validated")


if __name__ == "__main__":
    main()
