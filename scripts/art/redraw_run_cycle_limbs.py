#!/usr/bin/env python3
"""Replace the limbs in a 4x4 hero run sheet with a deterministic run cycle.

The generated character art is useful for the upper body, but image models can
silently keep the same anatomical limb in front or jitter joint positions.
This pass keeps the original hood, cape, and torso while redrawing explicitly
tracked arms and legs:

* the near leg uses the brighter armor palette;
* the far leg uses the darker burgundy palette;
* frames 8-15 swap which motion path each anatomical leg follows.
* arms counter-swing against their corresponding legs.

That makes the contact, passing, flight, and opposite-contact poses auditable
instead of depending on a model's interpretation of "alternating legs".
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw


CELL = 256
COLS = 4
ROWS = 4

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
NEAR_FILL = (112, 45, 34, 255)
NEAR_LIGHT = (218, 91, 27, 255)
NEAR_GOLD = (255, 187, 45, 255)
FAR_FILL = (42, 17, 27, 255)
FAR_LIGHT = (103, 34, 31, 255)
FAR_GOLD = (151, 56, 23, 255)
HAND_NEAR = (232, 97, 52, 255)
HAND_FAR = (111, 38, 34, 255)


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


def tapered_segment(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    *,
    start_width: int,
    end_width: int,
    fill: tuple[int, int, int, int],
) -> None:
    draw.polygon(
        tapered_polygon(start, end, start_width + 6, end_width + 6),
        fill=OUTLINE,
    )
    draw.polygon(
        tapered_polygon(start, end, start_width, end_width),
        fill=fill,
    )


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
    heel_x = ankle[0] - dx * 0.18
    heel_y = ankle[1] - dy * 0.18
    half = width / 2
    return [
        (round(heel_x + nx * half), round(heel_y + ny * half)),
        (round(ankle[0] + nx * half), round(ankle[1] + ny * half)),
        (round(toe[0] + nx * (half - 1)), round(toe[1] + ny * (half - 1))),
        (round(toe[0] - nx * half), round(toe[1] - ny * half)),
        (round(heel_x - nx * half), round(heel_y - ny * half)),
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
    thigh_start = 19 if near else 15
    thigh_end = 14 if near else 11
    shin_start = 14 if near else 11
    shin_end = 10 if near else 8

    tapered_segment(
        draw,
        hip,
        knee,
        start_width=thigh_start,
        end_width=thigh_end,
        fill=fill,
    )
    tapered_segment(
        draw,
        knee,
        ankle,
        start_width=shin_start,
        end_width=shin_end,
        fill=fill,
    )
    circle(draw, knee, 9 if near else 7, OUTLINE)
    circle(draw, knee, 6 if near else 4, light)
    draw.line(
        ((knee[0] - (5 if near else 3), knee[1] - 2), (knee[0] + (5 if near else 3), knee[1] + 1)),
        fill=gold,
        width=2,
    )

    boot = boot_polygon(ankle, toe, 19 if near else 15)
    draw.polygon(boot, fill=OUTLINE)
    inner_boot = boot_polygon(ankle, toe, 13 if near else 10)
    draw.polygon(inner_boot, fill=light)

    # Armor highlights follow the outer plates as short, discrete pixel runs.
    highlight_knee = (
        round((hip[0] + knee[0]) / 2),
        round((hip[1] + knee[1]) / 2) - 2,
    )
    draw.line((hip, highlight_knee), fill=gold, width=3 if near else 2)
    draw.line((ankle, toe), fill=gold, width=3 if near else 2)
    circle(draw, ankle, 5 if near else 4, OUTLINE)
    circle(draw, ankle, 3 if near else 2, gold)

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

    tapered_segment(
        draw,
        shoulder,
        elbow,
        start_width=15 if near else 12,
        end_width=11 if near else 9,
        fill=fill,
    )
    tapered_segment(
        draw,
        elbow,
        wrist,
        start_width=12 if near else 9,
        end_width=9 if near else 7,
        fill=fill,
    )
    circle(draw, elbow, 7 if near else 6, OUTLINE)
    circle(draw, elbow, 4 if near else 3, light)
    draw.line((shoulder, elbow), fill=gold, width=2 if near else 1)

    # Compact mitten-like glove.  Its fixed radius prevents the generated
    # fist from changing size between frames.
    circle(draw, wrist, 9 if near else 7, OUTLINE)
    circle(draw, wrist, 6 if near else 4, HAND_NEAR if near else HAND_FAR)
    draw.line(
        ((wrist[0] - 2, wrist[1] - 3), (wrist[0] + 3, wrist[1] - 1)),
        fill=gold,
        width=2 if near else 1,
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


def render_frame(frame: Image.Image, index: int, *, audit: bool = False) -> Image.Image:
    phase = index % 8
    hip = (HIP_X, HIP_Y[index])
    shoulder = (SHOULDER_X, hip[1] - 22)
    body = remove_generated_legs(frame, hip[1])
    body = remove_generated_front_arm(body, shoulder, hip[1])
    result = Image.new("RGBA", frame.size, (0, 0, 0, 0))

    # Frames 0-7: the bright near leg follows A and the dark far leg follows B.
    # Frames 8-15: the anatomical identities swap paths.  The near leg remains
    # the front rendering layer even when its foot is behind in screen space.
    near_pose = PATH_A[phase] if index < 8 else PATH_B[phase]
    far_pose = PATH_B[phase] if index < 8 else PATH_A[phase]
    near_arm_pose = ARM_PATH_A[phase] if index < 8 else ARM_PATH_B[phase]
    far_arm_pose = ARM_PATH_B[phase] if index < 8 else ARM_PATH_A[phase]

    far_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw_leg(
        far_layer,
        hip,
        far_pose,
        near=False,
        audit_color=(68, 205, 255, 255) if audit else None,
    )
    result.alpha_composite(far_layer)

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


def render_sheet(source: Image.Image, *, audit: bool = False) -> Image.Image:
    result = Image.new("RGBA", source.size, (0, 0, 0, 0))
    for index in range(COLS * ROWS):
        col = index % COLS
        row = index // COLS
        box = (col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL)
        frame = source.crop(box)
        result.alpha_composite(
            render_frame(frame, index, audit=audit),
            (col * CELL, row * CELL),
        )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit-output", type=Path)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGBA")
    if source.size != (CELL * COLS, CELL * ROWS):
        raise SystemExit(
            f"expected a {CELL * COLS}x{CELL * ROWS} 4x4 sheet, got {source.size}"
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    render_sheet(source).save(args.output)
    if args.audit_output is not None:
        args.audit_output.parent.mkdir(parents=True, exist_ok=True)
        render_sheet(source, audit=True).save(args.audit_output)


if __name__ == "__main__":
    main()
