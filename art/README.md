# Twilight Leap Art Source

This directory contains engine-agnostic production art. Files under `art/` are
authoring assets and are not shipped by the current web build until they are
selected, packed, and copied into `public/assets/`.

## Layout

- `specs/`: palette, dimensions, pivots, animation ranges, and QA rules.
- `characters/hero/`: hero animation sheets.
- `characters/enemies/emberling/`: Emberling animation sheets.
- `characters/enemies/beetle/`: Beetle animation sheets.
- `environment/tiles/`: modular platform and architecture sprites.
- `environment/props/`: static and animated environment props.
- `scenes/parallax/`: stacked parallax scene layers.
- `vfx/gameplay/`: action-feedback effect sheets.
- `vfx/ambient/`: looping atmosphere effect sheets.
- `raw/`: original chroma-key generation outputs retained for traceability.
- `previews/`: non-runtime contact sheets for review.

Use `specs/sprite-manifest.json` as the slicing source of truth.
Use `python scripts/art/audit_sprite_assets.py` before packing assets for a
runtime build.
