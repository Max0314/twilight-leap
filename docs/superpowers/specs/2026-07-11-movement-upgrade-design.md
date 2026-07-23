# Twilight Leap Movement Upgrade Design

## Goal

Repair vertical moving-platform traversal, complete the hero's run presentation, and add a mobile-friendly double jump plus wall slide/wall jump without changing the level's visual direction.

## Selected approach

Use the existing deterministic 60 Hz simulation and add explicit contact state. This is more reliable than increasing collision tolerances and substantially smaller than replacing the collision system with a general-purpose physics engine.

## Physics behavior

- Runtime platforms are sampled at the previous and current simulation times. A player standing on a moving platform inherits its full frame delta before ordinary movement is resolved.
- Landing tests use relative motion between the player and platform, so a fast rising platform cannot skip through the player and a descending platform cannot outrun a rider.
- The player records the platform currently supporting them. Ground contact resets one air jump.
- A fresh jump press in the air consumes the one air jump and applies a slightly smaller upward impulse than the ground jump.
- Airborne side contact records a wall normal. While falling against a wall, vertical speed is capped for an automatic wall slide.
- A fresh jump press during wall contact launches the player upward and away from the wall. A short horizontal input lock preserves the rebound while still returning control quickly.
- Respawn clears all temporary movement/contact state.

## Animation behavior

- Hero animation uses simulation time instead of wall-clock time, so pausing freezes the pose.
- The run cycle speed follows horizontal speed and uses a four-beat pose sequence built from the existing complete run artwork.
- Every hero frame is rendered with preserved aspect ratio, a bottom-center anchor, velocity-based lean, and restrained squash/bob. This removes frame-to-frame distortion and foot sliding.
- Double jump and wall jump use the existing airborne frames plus a brief directional pose accent; no new art direction is introduced.

## Controls and accessibility

- Keyboard: arrows/A-D move; Space/W/Up jumps, double-jumps, and wall-jumps.
- Touch: the existing left/right/jump controls gain the same abilities with no extra button.
- Visible control guidance is updated so both desktop and mobile players can discover the new moves.

## Verification

- Unit tests reproduce moving-platform skip/carry behavior, exactly one double jump, wall slide, and wall rebound.
- Renderer tests cover paused animation stability and aspect-preserving hero pose layout.
- Existing game, input, audio, storage, and rendered-page tests remain green.
- Desktop and mobile-size browser checks verify load, controls, console health, and playable interaction.

