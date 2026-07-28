from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = PROJECT_ROOT / "art" / "specs" / "sprite-manifest.json"
HERO_RUN_NEAR_HIGHLIGHT = (255, 187, 45, 255)
HERO_RUN_FAR_HIGHLIGHT = (151, 56, 23, 255)
HERO_RUN_NEAR_HAND = (232, 97, 52, 255)
HERO_RUN_FAR_HAND = (111, 38, 34, 255)


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


def highlight_center_x(
    frame: Image.Image,
    color: tuple[int, int, int, int],
    *,
    min_y: int,
    max_y: int | None = None,
) -> float | None:
    points = [
        x
        for y in range(min_y, max_y or frame.height)
        for x in range(frame.width)
        if frame.getpixel((x, y)) == color
    ]
    return sum(points) / len(points) if points else None


def validate_hero_run_limb_exchange(image: Image.Image) -> list[str]:
    """Confirm anatomical arms and legs exchange their screen-space sides."""
    failures: list[str] = []
    frames = []
    for index in (0, 8):
        column = index % 4
        row = index // 4
        frames.append(
            image.crop(
                (
                    column * 256,
                    row * 256,
                    (column + 1) * 256,
                    (row + 1) * 256,
                )
            )
        )

    near_0 = highlight_center_x(frames[0], HERO_RUN_NEAR_HIGHLIGHT, min_y=172)
    far_0 = highlight_center_x(frames[0], HERO_RUN_FAR_HIGHLIGHT, min_y=172)
    near_8 = highlight_center_x(frames[1], HERO_RUN_NEAR_HIGHLIGHT, min_y=172)
    far_8 = highlight_center_x(frames[1], HERO_RUN_FAR_HIGHLIGHT, min_y=172)
    centers = (near_0, far_0, near_8, far_8)
    if any(center is None for center in centers):
        failures.append("hero-run: missing near/far leg identity highlights")
        return failures

    assert near_0 is not None
    assert far_0 is not None
    assert near_8 is not None
    assert far_8 is not None
    if not near_0 > far_0:
        failures.append("hero-run: frame 0 near leg is not the forward contact")
    if not near_8 < far_8:
        failures.append("hero-run: frame 8 legs did not exchange contact sides")
    if near_0 - far_0 < 24 or far_8 - near_8 < 24:
        failures.append("hero-run: opposite contacts are not visually separated")

    near_hand_0 = highlight_center_x(
        frames[0],
        HERO_RUN_NEAR_HAND,
        min_y=135,
        max_y=205,
    )
    far_hand_0 = highlight_center_x(
        frames[0],
        HERO_RUN_FAR_HAND,
        min_y=135,
        max_y=205,
    )
    near_hand_8 = highlight_center_x(
        frames[1],
        HERO_RUN_NEAR_HAND,
        min_y=135,
        max_y=205,
    )
    far_hand_8 = highlight_center_x(
        frames[1],
        HERO_RUN_FAR_HAND,
        min_y=135,
        max_y=205,
    )
    hand_centers = (near_hand_0, far_hand_0, near_hand_8, far_hand_8)
    if any(center is None for center in hand_centers):
        failures.append("hero-run: missing near/far hand identity colors")
        return failures

    assert near_hand_0 is not None
    assert far_hand_0 is not None
    assert near_hand_8 is not None
    assert far_hand_8 is not None
    if not near_hand_0 < far_hand_0:
        failures.append("hero-run: frame 0 arms do not counter-swing")
    if not near_hand_8 > far_hand_8:
        failures.append("hero-run: frame 8 arms did not exchange swing sides")
    if far_hand_0 - near_hand_0 < 30 or near_hand_8 - far_hand_8 < 30:
        failures.append("hero-run: opposite arm swings are not visually separated")
    return failures


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
            if sheet["id"] == "hero-run":
                failures.extend(validate_hero_run_limb_exchange(image))

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
