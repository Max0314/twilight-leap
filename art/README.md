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
Use `scripts/art/replace_sprite_sequence.py` to pack a separately generated
action board into a new sheet or replace consecutive frames without changing
the rest of an existing sheet. Use `--frame-y-offsets` when an action includes
airborne frames that must sit above the shared actor pivot.

The dedicated hero run sheet also has a deterministic lower-body correction:

```powershell
python scripts/art/redraw_run_cycle_limbs.py `
  --input art/raw/hero-run-16f-packed-base.png `
  --output art/characters/hero/hero-run.png `
  --audit-output art/previews/hero-run-limb-swap-audit.png
```

This pass guarantees that the brighter near limbs and darker far limbs exchange
front/back motion paths between frames `0` and `8`, with the arms
counter-swinging against their paired legs.
