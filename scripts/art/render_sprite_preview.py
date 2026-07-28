from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a sprite sheet as a nearest-neighbor animated GIF."
    )
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--fps", type=float, default=16)
    parser.add_argument("--scale", type=int, default=2)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sheet = Image.open(args.input).convert("RGBA")
    if sheet.width % args.columns or sheet.height % args.rows:
        raise SystemExit("sheet dimensions must divide evenly into the grid")
    if args.fps <= 0 or args.scale <= 0:
        raise SystemExit("fps and scale must be positive")

    cell_width = sheet.width // args.columns
    cell_height = sheet.height // args.rows
    frames: list[Image.Image] = []
    for index in range(args.columns * args.rows):
        column = index % args.columns
        row = index // args.columns
        frame = sheet.crop(
            (
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
        )
        frames.append(
            frame.resize(
                (cell_width * args.scale, cell_height * args.scale),
                Image.Resampling.NEAREST,
            )
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        args.output,
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / args.fps),
        loop=0,
        disposal=2,
        optimize=False,
    )
    print(
        {
            "path": str(args.output),
            "frames": len(frames),
            "fps": args.fps,
            "frameSize": frames[0].size,
        }
    )


if __name__ == "__main__":
    main()
