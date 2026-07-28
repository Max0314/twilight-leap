#!/usr/bin/env python3
"""Replace the limbs in a 4x4 hero run sheet with a deterministic run cycle.

The generated character art is useful for the upper body, but image models can
silently keep the same anatomical limb in front or jitter joint positions.
This pass keeps the original hood, cape, and torso while redrawing explicitly
tracked, fully clothed arms and legs:

* the near leg uses the brighter armor palette;
* the far leg uses the darker burgundy palette;
* frames 8-15 swap which motion path each anatomical leg follows.
* arms counter-swing against their corresponding legs.

The production sheet contains continuous sleeves, trousers, gloves, and boots.
Joint lines only appear in the optional audit output and must never be shipped
as a runtime sprite.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw


CELL = 256
COLS = 4
ROWS = 4
PROJECT_ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_RUN_PATHS = {
    (PROJECT_ROOT / "art" / "characters" / "hero" / "hero-run.png").resolve(),
    (
        PROJECT_ROOT
        / "public"
        / "assets"
        / "sprites"
        / "characters"
        / "hero"
        / "hero-run.png"
    ).resolve(),
}
PUBLIC_ROOT = (PROJECT_ROOT / "public").resolve()

# Two screen-space paths, relative to the hip.  Path A begins in front and
# travels behind.  Path B begins behind and travels to the next front contact.
# Every tuple is (knee, ankle, toe).
PATH_A = (
    ((15, 8), (29, 28), (45, 30)),
    ((12, 13), (24, 31), (40, 32)),
    ((4, 16), (5, 34), (20, 35)),
    ((-7, 14), (-16, 29), (-29, 30)),
    ((-14, 10), (-29, 22), (-43, 23)),
    ((-15, 7), (-10, 19), (-23, 22)),
    ((-13, 9), (-20, 21), (-33, 23)),
    ((-14, 9), (-26, 25), (-40, 27)),
)

PATH_B = (
    ((-14, 8), (-23, 27), (-36, 29)),
    ((-16, 12), (-25, 27), (-37, 28)),
    ((-8, 9), (-18, 22), (-31, 23)),
    ((8, 8), (2, 19), (-9, 22)),
    ((17, 6), (7, 18), (-7, 21)),
    ((20, 3), (15, 17), (3, 20)),
    ((18, 5), (28, 20), (43, 22)),
    ((16, 7), (31, 27), (46, 30)),
)

# Arm path A starts behind while leg path A starts in front. Arm path B starts
# in front while leg path B starts behind, creating a readable counter-swing.
# Every tuple is (elbow, wrist), relative to the shoulder.
ARM_PATH_A = (
    ((-14, 10), (-27, 24)),
    ((-16, 8), (-29, 20)),
    ((-12, 3), (-23, 12)),
    ((-6, -1), (-12, 5)),
    ((7, -2), (17, 5)),
    ((13, 2), (26, 11)),
    ((15, 7), (30, 17)),
    ((14, 10), (28, 21)),
)

ARM_PATH_B = (
    ((13, 8), (28, 18)),
    ((15, 4), (29, 12)),
    ((11, -1), (22, 5)),
    ((5, -2), (11, 4)),
    ((-7, 1), (-16, 9)),
    ((-14, 5), (-27, 15)),
    ((-16, 9), (-31, 21)),
    ((-15, 11), (-29, 24)),
)

# The original generated frames have intentional vertical body motion.  These
# hip anchors were measured from the packed 256 px cells so the redraw keeps
# the compact proportions and does not lengthen the character.
HIP_Y = (183, 185, 188, 182, 178, 175, 172, 178, 181, 188, 188, 182, 179, 172, 172, 177)
HIP_X = 142
SHOULDER_X = 150

OUTLINE = (7, 6, 10, 255)
NEAR_FILL = (55, 25, 34, 255)
NEAR_LIGHT = (111, 45, 35, 255)
NEAR_GOLD = (224, 132, 36, 255)
FAR_FILL = (25, 13, 24, 255)
FAR_LIGHT = (66, 27, 31, 255)
FAR_GOLD = (126, 57, 26, 255)
HAND_NEAR = (120, 47, 36, 255)
HAND_FAR = (62, 24, 29, 255)


def absolute(point: tuple[int, int], hip: tuple[int, int]) -> tuple[int, int]:
    return hip[0] + point[0], hip[1] + point[1]


def circle(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    radius: int,
    color: tuple[int, int, int, int],
) -> None:
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)


def segment(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    *,
    outline_width: int,
    fill_width: int,
    fill: tuple[int, int, int, int],
) -> None:
    draw.line((start, end), fill=OUTLINE, width=outline_width)
    draw.line((start, end), fill=fill, width=fill_width)


def tapered_polygon(
    start: tuple[int, int],
    end: tuple[int, int],
    start_width: float,
    end_width: float,
) -> list[tuple[int, int]]:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = max(1.0, math.hypot(dx, dy))
    nx = -dy / length
    ny = dx / length
    return [
        (
            round(start[0] + nx * start_width / 2),
            round(start[1] + ny * start_width / 2),
        ),
        (
            round(end[0] + nx * end_width / 2),
            round(end[1] + ny * end_width / 2),
        ),
        (
            round(end[0] - nx * end_width / 2),
            round(end[1] - ny * end_width / 2),
        ),
        (
            round(start[0] - nx * start_width / 2),
            round(start[1] - ny * start_width / 2),
        ),
    ]


def chain_polygon(
    points: tuple[tuple[int, int], ...],
    widths: tuple[int, ...],
) -> list[tuple[int, int]]:
    """Build one continuous clothing silhouette around an articulated chain."""
    if len(points) != len(widths):
        raise ValueError("points and widths must have matching lengths")

    left: list[tuple[int, int]] = []
    right: list[tuple[int, int]] = []
    for index, point in enumerate(points):
        previous = points[max(0, index - 1)]
        following = points[min(len(points) - 1, index + 1)]
        dx = following[0] - previous[0]
        dy = following[1] - previous[1]
        length = max(1.0, math.hypot(dx, dy))
        nx = -dy / length
        ny = dx / length
        half_width = widths[index] / 2
        left.append(
            (
                round(point[0] + nx * half_width),
                round(point[1] + ny * half_width),
            )
        )
        right.append(
            (
                round(point[0] - nx * half_width),
                round(point[1] - ny * half_width),
            )
        )
    return left + list(reversed(right))


def draw_clothing_chain(
    draw: ImageDraw.ImageDraw,
    points: tuple[tuple[int, int], ...],
    widths: tuple[int, ...],
    *,
    fill: tuple[int, int, int, int],
) -> None:
    outline_widths = tuple(width + 6 for width in widths)
    draw.polygon(chain_polygon(points, outline_widths), fill=OUTLINE)
    draw.polygon(chain_polygon(points, widths), fill=fill)


def oriented_box(
    center: tuple[int, int],
    direction: tuple[int, int],
    *,
    length: int,
    width: int,
) -> list[tuple[int, int]]:
    dx, dy = direction
    magnitude = max(1.0, math.hypot(dx, dy))
    ux = dx / magnitude
    uy = dy / magnitude
    nx = -uy
    ny = ux
    half_length = length / 2
    half_width = width / 2
    return [
        (
            round(center[0] - ux * half_length + nx * half_width),
            round(center[1] - uy * half_length + ny * half_width),
        ),
        (
            round(center[0] + ux * half_length + nx * half_width),
            round(center[1] + uy * half_length + ny * half_width),
        ),
        (
            round(center[0] + ux * half_length - nx * half_width),
            round(center[1] + uy * half_length - ny * half_width),
        ),
        (
            round(center[0] - ux * half_length - nx * half_width),
            round(center[1] - uy * half_length - ny * half_width),
        ),
    ]


def draw_armored_patch(
    draw: ImageDraw.ImageDraw,
    center: tuple[int, int],
    direction: tuple[int, int],
    *,
    length: int,
    width: int,
    fill: tuple[int, int, int, int],
    trim: tuple[int, int, int, int],
) -> None:
    draw.polygon(
        oriented_box(
            center,
            direction,
            length=length + 5,
            width=width + 5,
        ),
        fill=OUTLINE,
    )
    draw.polygon(
        oriented_box(center, direction, length=length, width=width),
        fill=fill,
    )
    dx, dy = direction
    magnitude = max(1.0, math.hypot(dx, dy))
    nx = -dy / magnitude
    ny = dx / magnitude
    trim_start = (
        round(center[0] - nx * (width / 2 - 2)),
        round(center[1] - ny * (width / 2 - 2)),
    )
    trim_end = (
        round(center[0] + nx * (width / 2 - 2)),
        round(center[1] + ny * (width / 2 - 2)),
    )
    draw.line((trim_start, trim_end), fill=trim, width=2)


def boot_polygon(
    ankle: tuple[int, int],
    toe: tuple[int, int],
    width: int,
) -> list[tuple[int, int]]:
    dx = toe[0] - ankle[0]
    dy = toe[1] - ankle[1]
    length = max(1.0, math.hypot(dx, dy))
    nx = -dy / length
    ny = dx / length
    heel_x = ankle[0] - dx * 0.25
    heel_y = ankle[1] - dy * 0.25
    half = width / 2
    return [
        (round(heel_x + nx * half), round(heel_y + ny * half)),
        (round(ankle[0] + nx * half), round(ankle[1] + ny * half)),
        (
            round(toe[0] + nx * (half - 2)),
            round(toe[1] + ny * (half - 2)),
        ),
        (
            round(toe[0] - nx * (half + 1)),
            round(toe[1] - ny * (half + 1)),
        ),
        (round(heel_x - nx * half), round(heel_y - ny * half)),
    ]


def mitten_polygon(
    elbow: tuple[int, int],
    wrist: tuple[int, int],
    *,
    length: int,
    width: int,
) -> list[tuple[int, int]]:
    dx = wrist[0] - elbow[0]
    dy = wrist[1] - elbow[1]
    magnitude = max(1.0, math.hypot(dx, dy))
    ux = dx / magnitude
    uy = dy / magnitude
    nx = -uy
    ny = ux
    back = (wrist[0] - ux * length * 0.35, wrist[1] - uy * length * 0.35)
    front = (wrist[0] + ux * length * 0.65, wrist[1] + uy * length * 0.65)
    half = width / 2
    return [
        (round(back[0] + nx * half), round(back[1] + ny * half)),
        (round(front[0] + nx * half * 0.75), round(front[1] + ny * half * 0.75)),
        (
            round(front[0] + ux * 2 + nx),
            round(front[1] + uy * 2 + ny),
        ),
        (
            round(front[0] + ux - nx * half * 0.7),
            round(front[1] + uy - ny * half * 0.7),
        ),
        (
            round(wrist[0] - ux * 1 - nx * (half + 3)),
            round(wrist[1] - uy * 1 - ny * (half + 3)),
        ),
        (round(back[0] - nx * half), round(back[1] - ny * half)),
    ]


def draw_leg(
    layer: Image.Image,
    hip: tuple[int, int],
    pose: tuple[tuple[int, int], tuple[int, int], tuple[int, int]],
    *,
    near: bool,
    audit_color: tuple[int, int, int, int] | None = None,
) -> None:
    draw = ImageDraw.Draw(layer)
    knee, ankle, toe = (absolute(point, hip) for point in pose)
    fill = NEAR_FILL if near else FAR_FILL
    light = NEAR_LIGHT if near else FAR_LIGHT
    gold = NEAR_GOLD if near else FAR_GOLD
    draw_clothing_chain(
        draw,
        (hip, knee, ankle),
        (25, 20, 14) if near else (20, 16, 11),
        fill=fill,
    )

    thigh_mid = (
        round(hip[0] * 0.45 + knee[0] * 0.55),
        round(hip[1] * 0.45 + knee[1] * 0.55),
    )
    draw_armored_patch(
        draw,
        thigh_mid,
        (knee[0] - hip[0], knee[1] - hip[1]),
        length=7 if near else 6,
        width=10 if near else 8,
        fill=light,
        trim=gold,
    )
    draw_armored_patch(
        draw,
        knee,
        (ankle[0] - hip[0], ankle[1] - hip[1]),
        length=7 if near else 6,
        width=11 if near else 9,
        fill=light,
        trim=gold,
    )

    boot = boot_polygon(ankle, toe, 20 if near else 16)
    draw.polygon(boot, fill=OUTLINE)
    inner_boot = boot_polygon(ankle, toe, 14 if near else 11)
    draw.polygon(inner_boot, fill=fill)

    boot_direction = (toe[0] - ankle[0], toe[1] - ankle[1])
    cuff_center = (
        round(ankle[0] + boot_direction[0] * 0.12),
        round(ankle[1] + boot_direction[1] * 0.12),
    )
    draw.polygon(
        oriented_box(
            cuff_center,
            boot_direction,
            length=3,
            width=13 if near else 10,
        ),
        fill=gold,
    )
    toe_highlight_start = (
        round(ankle[0] * 0.35 + toe[0] * 0.65),
        round(ankle[1] * 0.35 + toe[1] * 0.65) - 1,
    )
    draw.line((toe_highlight_start, toe), fill=gold, width=2)

    if audit_color is not None:
        draw.line((hip, knee, ankle, toe), fill=audit_color, width=2)
        circle(draw, toe, 3, audit_color)


def draw_arm(
    layer: Image.Image,
    shoulder: tuple[int, int],
    pose: tuple[tuple[int, int], tuple[int, int]],
    *,
    near: bool,
    audit_color: tuple[int, int, int, int] | None = None,
) -> None:
    draw = ImageDraw.Draw(layer)
    elbow, wrist = (absolute(point, shoulder) for point in pose)
    fill = NEAR_FILL if near else FAR_FILL
    light = NEAR_LIGHT if near else FAR_LIGHT
    gold = NEAR_GOLD if near else FAR_GOLD

    draw_clothing_chain(
        draw,
        (shoulder, elbow, wrist),
        (20, 16, 11) if near else (16, 13, 9),
        fill=fill,
    )
    draw_armored_patch(
        draw,
        elbow,
        (wrist[0] - shoulder[0], wrist[1] - shoulder[1]),
        length=6 if near else 5,
        width=9 if near else 7,
        fill=light,
        trim=gold,
    )

    glove_outline = mitten_polygon(
        elbow,
        wrist,
        length=15 if near else 12,
        width=14 if near else 11,
    )
    glove_inner = mitten_polygon(
        elbow,
        wrist,
        length=11 if near else 9,
        width=9 if near else 7,
    )
    draw.polygon(glove_outline, fill=OUTLINE)
    draw.polygon(glove_inner, fill=HAND_NEAR if near else HAND_FAR)
    cuff_direction = (wrist[0] - elbow[0], wrist[1] - elbow[1])
    cuff_center = (
        round(wrist[0] - cuff_direction[0] * 0.18),
        round(wrist[1] - cuff_direction[1] * 0.18),
    )
    draw.polygon(
        oriented_box(
            cuff_center,
            cuff_direction,
            length=3,
            width=9 if near else 7,
        ),
        fill=gold,
    )

    if audit_color is not None:
        draw.line((shoulder, elbow, wrist), fill=audit_color, width=2)
        circle(draw, wrist, 3, audit_color)


def remove_generated_legs(frame: Image.Image, hip_y: int) -> Image.Image:
    body = frame.copy()
    alpha = body.getchannel("A")
    mask = Image.new("L", body.size, 255)
    draw = ImageDraw.Draw(mask)

    # Clear the lower-body wedge that contains both generated legs.  The left
    # edge slopes inward so most of the trailing cloak remains untouched.
    draw.polygon(
        (
            (98, hip_y - 7),
            (224, hip_y - 7),
            (224, 244),
            (78, 244),
            (94, hip_y + 12),
        ),
        fill=0,
    )
    alpha = Image.composite(alpha, Image.new("L", body.size, 0), mask)
    body.putalpha(alpha)
    return body


def remove_generated_front_arm(
    frame: Image.Image,
    shoulder: tuple[int, int],
    hip_y: int,
) -> Image.Image:
    body = frame.copy()
    alpha = body.getchannel("A")
    mask = Image.new("L", body.size, 255)
    draw = ImageDraw.Draw(mask)
    x, y = shoulder
    draw.polygon(
        (
            (x - 1, y - 9),
            (222, y - 9),
            (222, hip_y + 1),
            (x + 2, hip_y + 1),
            (x - 6, y + 7),
        ),
        fill=0,
    )
    alpha = Image.composite(alpha, Image.new("L", body.size, 0), mask)
    body.putalpha(alpha)
    return body


def draw_pelvis(layer: Image.Image, hip: tuple[int, int]) -> None:
    draw = ImageDraw.Draw(layer)
    x, y = hip
    outer = (
        (x - 20, y - 11),
        (x + 17, y - 10),
        (x + 22, y + 2),
        (x + 8, y + 11),
        (x - 16, y + 8),
        (x - 23, y - 1),
    )
    inner = (
        (x - 16, y - 7),
        (x + 14, y - 6),
        (x + 16, y + 1),
        (x + 6, y + 7),
        (x - 13, y + 5),
        (x - 18, y),
    )
    draw.polygon(outer, fill=OUTLINE)
    draw.polygon(inner, fill=FAR_FILL)
    draw.line(((x - 15, y - 6), (x + 13, y - 5)), fill=NEAR_GOLD, width=3)
    draw.line(((x + 13, y - 4), (x + 16, y + 1)), fill=NEAR_LIGHT, width=2)


def render_frame(
    frame: Image.Image,
    index: int,
    *,
    audit: bool = False,
    arms_only: bool = False,
) -> Image.Image:
    phase = index % 8
    hip = (HIP_X, HIP_Y[index])
    shoulder = (SHOULDER_X, hip[1] - 22)
    near_pose = PATH_A[phase] if index < 8 else PATH_B[phase]
    far_pose = PATH_B[phase] if index < 8 else PATH_A[phase]
    near_arm_pose = ARM_PATH_A[phase] if index < 8 else ARM_PATH_B[phase]
    far_arm_pose = ARM_PATH_B[phase] if index < 8 else ARM_PATH_A[phase]
    body = remove_generated_front_arm(frame, shoulder, hip[1])
    result = Image.new("RGBA", frame.size, (0, 0, 0, 0))

    far_arm_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw_arm(
        far_arm_layer,
        shoulder,
        far_arm_pose,
        near=False,
        audit_color=(68, 205, 255, 255) if audit else None,
    )
    result.alpha_composite(far_arm_layer)
    result.alpha_composite(body)

    if arms_only:
        near_arm_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        draw_arm(
            near_arm_layer,
            shoulder,
            near_arm_pose,
            near=True,
            audit_color=(255, 83, 205, 255) if audit else None,
        )
        result.alpha_composite(near_arm_layer)
        return result

    # Frames 0-7: the bright near leg follows A and the dark far leg follows B.
    # Frames 8-15: the anatomical identities swap paths.  The near leg remains
    # the front rendering layer even when its foot is behind in screen space.
    body = remove_generated_legs(frame, hip[1])
    body = remove_generated_front_arm(body, shoulder, hip[1])
    result = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    far_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw_leg(
        far_layer,
        hip,
        far_pose,
        near=False,
        audit_color=(68, 205, 255, 255) if audit else None,
    )
    result.alpha_composite(far_layer)
    result.alpha_composite(far_arm_layer)
    result.alpha_composite(body)
    pelvis_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw_pelvis(pelvis_layer, hip)
    result.alpha_composite(pelvis_layer)

    near_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw_leg(
        near_layer,
        hip,
        near_pose,
        near=True,
        audit_color=(255, 83, 205, 255) if audit else None,
    )
    result.alpha_composite(near_layer)

    near_arm_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw_arm(
        near_arm_layer,
        shoulder,
        near_arm_pose,
        near=True,
        audit_color=(255, 83, 205, 255) if audit else None,
    )
    result.alpha_composite(near_arm_layer)
    return result


def render_sheet(
    source: Image.Image,
    *,
    audit: bool = False,
    arms_only: bool = False,
) -> Image.Image:
    result = Image.new("RGBA", source.size, (0, 0, 0, 0))
    for index in range(COLS * ROWS):
        col = index % COLS
        row = index // COLS
        box = (col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL)
        frame = source.crop(box)
        result.alpha_composite(
            render_frame(frame, index, audit=audit, arms_only=arms_only),
            (col * CELL, row * CELL),
        )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit-output", type=Path)
    parser.add_argument(
        "--arms-only",
        action="store_true",
        help="Keep generated legs and replace only the arm swing.",
    )
    args = parser.parse_args()

    if args.output.resolve() in PRODUCTION_RUN_PATHS:
        raise SystemExit(
            "refusing to write a construction-driven limb render directly "
            "to the production hero-run sheet"
        )
    if (
        args.audit_output is not None
        and args.audit_output.resolve().is_relative_to(PUBLIC_ROOT)
    ):
        raise SystemExit("audit overlays must never be written under public/")

    source = Image.open(args.input).convert("RGBA")
    if source.size != (CELL * COLS, CELL * ROWS):
        raise SystemExit(
            f"expected a {CELL * COLS}x{CELL * ROWS} 4x4 sheet, got {source.size}"
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    render_sheet(source, arms_only=args.arms_only).save(args.output)
    if args.audit_output is not None:
        args.audit_output.parent.mkdir(parents=True, exist_ok=True)
        render_sheet(
            source,
            audit=True,
            arms_only=args.arms_only,
        ).save(args.audit_output)


if __name__ == "__main__":
    main()
