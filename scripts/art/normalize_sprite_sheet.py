from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize a chroma-keyed sprite sheet to a fixed RGBA grid."
    )
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--align-actors", action="store_true")
    parser.add_argument("--extract-actors", action="store_true")
    parser.add_argument("--fit-cells", action="store_true")
    parser.add_argument("--cell-padding", type=int, default=8)
    parser.add_argument(
        "--fit-anchor",
        choices=("top", "center", "bottom"),
        default="center",
    )
    parser.add_argument(
        "--row-anchors",
        help="Comma-separated top/center/bottom anchors, one per grid row.",
    )
    parser.add_argument("--pivot-x", type=int, default=128)
    parser.add_argument("--pivot-y", type=int, default=224)
    return parser.parse_args()


def centered_grid_crop(
    image: Image.Image, columns: int, rows: int
) -> Image.Image:
    crop_width = image.width - (image.width % columns)
    crop_height = image.height - (image.height % rows)
    left = (image.width - crop_width) // 2
    top = (image.height - crop_height) // 2
    return image.crop((left, top, left + crop_width, top + crop_height))


def cell_report(
    image: Image.Image, columns: int, rows: int
) -> tuple[list[dict[str, object]], list[int]]:
    alpha = image.getchannel("A")
    cell_width = image.width // columns
    cell_height = image.height // rows
    cells: list[dict[str, object]] = []
    boundary_touches: list[int] = []

    for index in range(columns * rows):
        column = index % columns
        row = index // columns
        cell = alpha.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        bounds = cell.getbbox()
        touches = bool(
            bounds
            and (
                bounds[0] == 0
                or bounds[1] == 0
                or bounds[2] == cell_width
                or bounds[3] == cell_height
            )
        )
        if touches:
            boundary_touches.append(index)
        cells.append({"index": index, "bounds": bounds, "touchesBoundary": touches})

    return cells, boundary_touches


def align_actor_cells(
    image: Image.Image,
    columns: int,
    rows: int,
    pivot_x: int,
    pivot_y: int,
) -> Image.Image:
    cell_width = image.width // columns
    cell_height = image.height // rows
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))

    for index in range(columns * rows):
        column = index % columns
        row = index // columns
        cell = image.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        alpha = cell.getchannel("A")
        component_mask = largest_component_mask(alpha)
        bounds = component_mask.getbbox()
        if not bounds:
            continue
        sprite = cell.crop(bounds)
        sprite_alpha = sprite.getchannel("A")
        component_alpha = component_mask.crop(bounds)
        sprite.putalpha(ImageChops.multiply(sprite_alpha, component_alpha))
        target_x = column * cell_width + pivot_x - sprite.width // 2
        target_y = row * cell_height + pivot_y - sprite.height
        if (
            target_x < column * cell_width
            or target_y < row * cell_height
            or target_x + sprite.width > (column + 1) * cell_width
            or target_y + sprite.height > (row + 1) * cell_height
        ):
            raise ValueError(
                f"Frame {index} does not fit after pivot alignment: "
                f"{sprite.size} at {(target_x, target_y)}"
            )
        result.alpha_composite(sprite, (target_x, target_y))

    return result


def fit_cell_contents(
    image: Image.Image,
    columns: int,
    rows: int,
    padding: int,
    anchors: list[str],
) -> Image.Image:
    cell_width = image.width // columns
    cell_height = image.height // rows
    if padding < 0 or padding * 2 >= min(cell_width, cell_height):
        raise ValueError("Cell padding must leave a positive content area")

    available_width = cell_width - padding * 2
    available_height = cell_height - padding * 2
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))

    for index in range(columns * rows):
        column = index % columns
        row = index // columns
        anchor = anchors[row]
        cell = image.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        bounds = cell.getchannel("A").getbbox()
        if not bounds:
            continue
        sprite = cell.crop(bounds)
        scale = min(
            1.0,
            available_width / sprite.width,
            available_height / sprite.height,
        )
        if scale < 1.0:
            sprite = sprite.resize(
                (
                    max(1, round(sprite.width * scale)),
                    max(1, round(sprite.height * scale)),
                ),
                resample=Image.Resampling.NEAREST,
            )

        target_x = column * cell_width + (cell_width - sprite.width) // 2
        if anchor == "top":
            target_y = row * cell_height + padding
        elif anchor == "bottom":
            target_y = row * cell_height + cell_height - padding - sprite.height
        else:
            target_y = row * cell_height + (cell_height - sprite.height) // 2
        result.alpha_composite(sprite, (target_x, target_y))

    return result


def largest_component_mask(alpha: Image.Image) -> Image.Image:
    components = connected_components(alpha)
    largest = max(components, key=len, default=[])
    mask = bytearray(alpha.width * alpha.height)
    for index in largest:
        mask[index] = 255
    return Image.frombytes("L", alpha.size, bytes(mask))


def connected_components(alpha: Image.Image) -> list[list[int]]:
    width, height = alpha.size
    pixels = alpha.tobytes()
    visited = bytearray(width * height)
    components: list[list[int]] = []

    for start, value in enumerate(pixels):
        if value == 0 or visited[start]:
            continue
        visited[start] = 1
        queue: deque[int] = deque([start])
        component: list[int] = []

        while queue:
            current = queue.popleft()
            component.append(current)
            x = current % width
            y = current // width
            if x > 0:
                neighbor = current - 1
                if pixels[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if x + 1 < width:
                neighbor = current + 1
                if pixels[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y > 0:
                neighbor = current - width
                if pixels[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y + 1 < height:
                neighbor = current + width
                if pixels[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)

        components.append(component)

    return components


def extract_actor_components(
    image: Image.Image,
    columns: int,
    rows: int,
    pivot_x: int,
    pivot_y: int,
) -> Image.Image:
    expected_count = columns * rows
    components = sorted(
        connected_components(image.getchannel("A")),
        key=len,
        reverse=True,
    )[:expected_count]
    if len(components) != expected_count:
        raise ValueError(
            f"Expected {expected_count} actor components, found {len(components)}"
        )

    width = image.width
    component_assets: list[tuple[float, float, Image.Image]] = []
    for component in components:
        xs = [index % width for index in component]
        ys = [index // width for index in component]
        bounds = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        mask = Image.new("L", image.size, 0)
        mask_pixels = bytearray(image.width * image.height)
        for index in component:
            mask_pixels[index] = 255
        mask = Image.frombytes("L", image.size, bytes(mask_pixels))
        sprite = image.crop(bounds)
        sprite.putalpha(
            ImageChops.multiply(
                sprite.getchannel("A"),
                mask.crop(bounds),
            )
        )
        center_x = (bounds[0] + bounds[2]) / 2
        center_y = (bounds[1] + bounds[3]) / 2
        component_assets.append((center_x, center_y, sprite))

    component_assets.sort(key=lambda asset: asset[1])
    ordered: list[Image.Image] = []
    for row in range(rows):
        row_assets = component_assets[row * columns : (row + 1) * columns]
        row_assets.sort(key=lambda asset: asset[0])
        ordered.extend(asset[2] for asset in row_assets)

    cell_width = image.width // columns
    cell_height = image.height // rows
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    for index, sprite in enumerate(ordered):
        column = index % columns
        row = index // columns
        target_x = column * cell_width + pivot_x - sprite.width // 2
        target_y = row * cell_height + pivot_y - sprite.height
        if (
            target_x < column * cell_width
            or target_y < row * cell_height
            or target_x + sprite.width > (column + 1) * cell_width
            or target_y + sprite.height > (row + 1) * cell_height
        ):
            raise ValueError(
                f"Frame {index} does not fit after component extraction: "
                f"{sprite.size} at {(target_x, target_y)}"
            )
        result.alpha_composite(sprite, (target_x, target_y))
    return result


def main() -> None:
    args = parse_args()
    if args.size % args.columns or args.size % args.rows:
        raise ValueError("Target size must divide evenly into the requested grid")

    source = Image.open(args.input).convert("RGBA")
    normalized = centered_grid_crop(source, args.columns, args.rows)
    if normalized.size != (args.size, args.size):
        normalized = normalized.resize(
            (args.size, args.size),
            resample=Image.Resampling.NEAREST,
        )
    if args.extract_actors:
        normalized = extract_actor_components(
            normalized,
            args.columns,
            args.rows,
            args.pivot_x,
            args.pivot_y,
        )
    elif args.align_actors:
        normalized = align_actor_cells(
            normalized,
            args.columns,
            args.rows,
            args.pivot_x,
            args.pivot_y,
        )
    elif args.fit_cells or args.row_anchors:
        if args.row_anchors:
            anchors = [value.strip() for value in args.row_anchors.split(",")]
            if len(anchors) != args.rows or any(
                value not in {"top", "center", "bottom"} for value in anchors
            ):
                raise ValueError(
                    "--row-anchors must contain one top/center/bottom value per row"
                )
        else:
            anchors = [args.fit_anchor] * args.rows
        normalized = fit_cell_contents(
            normalized,
            args.columns,
            args.rows,
            args.cell_padding,
            anchors,
        )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(args.out, format="PNG", optimize=True)

    alpha = normalized.getchannel("A")
    histogram = alpha.histogram()
    cells, boundary_touches = cell_report(
        normalized,
        args.columns,
        args.rows,
    )
    print(
        {
            "path": str(args.out),
            "size": normalized.size,
            "transparentPixels": histogram[0],
            "opaquePixels": histogram[255],
            "partialAlphaPixels": sum(histogram[1:255]),
            "boundaryTouches": boundary_touches,
            "cells": cells,
        }
    )


if __name__ == "__main__":
    main()
