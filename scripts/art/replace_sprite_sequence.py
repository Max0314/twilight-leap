from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Pack a source action board into consecutive frames of an RGBA sprite "
            "sheet, optionally replacing frames in an existing sheet."
        )
    )
    parser.add_argument("--base", type=Path)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--source-columns", type=int, default=3)
    parser.add_argument("--source-rows", type=int, default=2)
    parser.add_argument("--target-columns", type=int, default=4)
    parser.add_argument("--target-rows", type=int, default=4)
    parser.add_argument("--target-cell-width", type=int, default=256)
    parser.add_argument("--target-cell-height", type=int, default=256)
    parser.add_argument("--target-start", type=int, default=10)
    parser.add_argument("--pivot-x", type=int, default=128)
    parser.add_argument("--pivot-y", type=int, default=224)
    parser.add_argument("--max-width", type=int, default=176)
    parser.add_argument("--max-height", type=int, default=154)
    parser.add_argument(
        "--frame-y-offsets",
        default="",
        help=(
            "Optional comma-separated per-frame vertical offsets in target pixels; "
            "negative values lift a frame above the shared pivot."
        ),
    )
    return parser.parse_args()


def trim_cell(cell: Image.Image) -> Image.Image:
    bounds = cell.getchannel("A").getbbox()
    if not bounds:
        raise ValueError("Source cell has no visible pixels")
    return cell.crop(bounds)


def main() -> None:
    args = parse_args()
    if args.base:
        base = Image.open(args.base).convert("RGBA")
    else:
        base = Image.new(
            "RGBA",
            (
                args.target_columns * args.target_cell_width,
                args.target_rows * args.target_cell_height,
            ),
            (0, 0, 0, 0),
        )
    source = Image.open(args.source).convert("RGBA")

    if base.width % args.target_columns or base.height % args.target_rows:
        raise ValueError("Target dimensions must divide evenly into its grid")

    source_x = [
        round(column * source.width / args.source_columns)
        for column in range(args.source_columns + 1)
    ]
    source_y = [
        round(row * source.height / args.source_rows)
        for row in range(args.source_rows + 1)
    ]
    target_cell_width = base.width // args.target_columns
    target_cell_height = base.height // args.target_rows
    frame_count = args.source_columns * args.source_rows
    frame_y_offsets = (
        [int(value.strip()) for value in args.frame_y_offsets.split(",")]
        if args.frame_y_offsets
        else [0] * frame_count
    )
    if len(frame_y_offsets) != frame_count:
        raise ValueError(
            f"Expected {frame_count} frame Y offsets, got {len(frame_y_offsets)}"
        )

    if args.target_start + frame_count > args.target_columns * args.target_rows:
        raise ValueError("Replacement sequence does not fit in the target grid")

    sprites: list[Image.Image] = []
    for index in range(frame_count):
        column = index % args.source_columns
        row = index // args.source_columns
        cell = source.crop(
            (
                source_x[column],
                source_y[row],
                source_x[column + 1],
                source_y[row + 1],
            )
        )
        sprites.append(trim_cell(cell))

    uniform_scale = min(
        args.max_width / max(sprite.width for sprite in sprites),
        args.max_height / max(sprite.height for sprite in sprites),
    )
    if uniform_scale <= 0:
        raise ValueError("Computed sprite scale must be positive")

    report: list[dict[str, object]] = []
    for offset, sprite in enumerate(sprites):
        target_index = args.target_start + offset
        target_column = target_index % args.target_columns
        target_row = target_index // args.target_columns
        cell_left = target_column * target_cell_width
        cell_top = target_row * target_cell_height
        cell_bounds = (
            cell_left,
            cell_top,
            cell_left + target_cell_width,
            cell_top + target_cell_height,
        )
        base.paste((0, 0, 0, 0), cell_bounds)

        width = max(1, round(sprite.width * uniform_scale))
        height = max(1, round(sprite.height * uniform_scale))
        resized = sprite.resize((width, height), Image.Resampling.NEAREST)
        target_x = cell_left + args.pivot_x - width // 2
        target_y = (
            cell_top
            + args.pivot_y
            - height
            + frame_y_offsets[offset]
        )
        if (
            target_x < cell_left
            or target_y < cell_top
            or target_x + width > cell_left + target_cell_width
            or target_y + height > cell_top + target_cell_height
        ):
            raise ValueError(
                f"Frame {target_index} does not fit at {(target_x, target_y)}"
            )
        base.alpha_composite(resized, (target_x, target_y))
        report.append(
            {
                "targetIndex": target_index,
                "sourceSize": sprite.size,
                "outputSize": resized.size,
                "pivot": (cell_left + args.pivot_x, cell_top + args.pivot_y),
                "position": (target_x, target_y),
                "yOffset": frame_y_offsets[offset],
            }
        )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    base.save(args.out, format="PNG", optimize=True)
    print(
        {
            "path": str(args.out),
            "size": base.size,
            "scale": round(uniform_scale, 4),
            "frames": report,
        }
    )


if __name__ == "__main__":
    main()
