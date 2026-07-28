from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = PROJECT_ROOT / "art" / "specs" / "sprite-manifest.json"
HERO_RUN_FORBIDDEN_CONSTRUCTION_COLORS = {
    # Previous production mistake: deterministic rig colors were baked into
    # the runtime sheet instead of remaining in an audit-only preview.
    (255, 187, 45, 255),
    (151, 56, 23, 255),
    (232, 97, 52, 255),
    (111, 38, 34, 255),
    # Near/far topology overlay colors are always preview-only.
    (255, 83, 205, 255),
    (68, 205, 255, 255),
}


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


def alpha_components(
    frame: Image.Image,
    *,
    min_y: int = 0,
) -> list[list[tuple[int, int]]]:
    alpha = frame.getchannel("A")
    width = frame.width
    height = frame.height
    pixels = alpha.tobytes()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for y in range(min_y, height):
        for x in range(width):
            start = y * width + x
            if not pixels[start] or visited[start]:
                continue
            visited[start] = 1
            queue: deque[int] = deque([start])
            component: list[tuple[int, int]] = []
            while queue:
                current = queue.popleft()
                current_x = current % width
                current_y = current // width
                component.append((current_x, current_y))
                for neighbor_x, neighbor_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if (
                        neighbor_x < 0
                        or neighbor_x >= width
                        or neighbor_y < min_y
                        or neighbor_y >= height
                    ):
                        continue
                    neighbor = neighbor_y * width + neighbor_x
                    if pixels[neighbor] and not visited[neighbor]:
                        visited[neighbor] = 1
                        queue.append(neighbor)
            components.append(component)
    return components


def grounded_foot_center_x(frame: Image.Image) -> float | None:
    components = [
        component
        for component in alpha_components(frame, min_y=202)
        if len(component) >= 100
        and max(point[1] for point in component) >= 222
    ]
    if not components:
        return None
    contact = max(components, key=len)
    return sum(point[0] for point in contact) / len(contact)


def validate_hero_run_limb_exchange(image: Image.Image) -> list[str]:
    """Reject construction art and confirm the two grounded contacts reverse."""
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

    construction_pixels = sum(
        1
        for pixel in image.get_flattened_data()
        if pixel in HERO_RUN_FORBIDDEN_CONSTRUCTION_COLORS
    )
    if construction_pixels:
        failures.append(
            "hero-run: runtime sheet contains construction/audit palette "
            f"pixels ({construction_pixels})"
        )

    contact_0 = grounded_foot_center_x(frames[0])
    contact_8 = grounded_foot_center_x(frames[1])
    if contact_0 is None or contact_8 is None:
        failures.append("hero-run: unable to find both grounded contact poses")
        return failures
    if contact_0 <= 155:
        failures.append("hero-run: frame 0 contact is not visibly forward")
    if contact_8 >= 135:
        failures.append("hero-run: frame 8 contact did not reverse screen side")
    if contact_0 - contact_8 < 45:
        failures.append("hero-run: opposite grounded contacts are too similar")
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
