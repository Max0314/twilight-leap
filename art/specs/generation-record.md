# Sprite Generation Record

Generated on 2026-07-27 for the original Twilight Leap project. The existing
project atlas was used only as the character, palette, and art-direction
reference. No third-party franchise, artist, studio, or living-artist style was
requested.

## Shared prompt contract

- Production-grade, original twilight-fantasy pixel art.
- Fixed `4 x 4` grid with exactly 16 row-major frames unless noted.
- Crisp deliberate pixel clusters, no painterly blur or vector antialiasing.
- Stable camera, scale, silhouette, lighting, and attachment point.
- No text, logos, signatures, borders, grid lines, UI, or unrelated objects.
- Uniform `#00FF00` chroma key for actors and enemies.
- Uniform `#FF00FF` chroma key for foliage, scenery, and effects.
- Chroma-key outputs converted to straight-alpha RGBA, nearest-neighbor
  normalized to `1024 x 1024`, and checked for cell-boundary bleed.

## Generated set

| Sheet | Prompted content |
| --- | --- |
| `hero-locomotion` | idle 4, walk 6, run 6 |
| `hero-run` | dedicated 16-frame run cycle |
| `hero-airborne` | jump 3, apex 2, fall 3, double jump 4, wall slide 2, wall jump 2 |
| `hero-reactions` | land 3, hurt 3, magical death 8, respawn 2 |
| `emberling-locomotion` | idle 4, patrol 6, turn 2, alert 4 |
| `emberling-actions` | attack 5, hurt 3, stunned 2, non-graphic death 6 |
| `beetle-locomotion` | idle 4, patrol 6, turn 2, alert 4 |
| `beetle-actions` | charge 4, dash 4, recover 3, non-graphic death 5 |
| `environment-modular` | 16 stone, wood, architecture, and dressing modules |
| `environment-animated-props` | lantern, banner, fountain, vines; 4 frames each |
| `twilight-ruins-parallax` | far skyline, mid ruins, near ruins, foreground |
| `vfx-gameplay` | jump dust, land impact, star pickup, hurt burst; 4 frames each |
| `vfx-ambient` | portal, checkpoint flame, embers, wind wisp; 4 frames each |

## Production note

These files are technically prepared for commercial production, but final
commercial release still requires the project owner to complete its normal
legal, trademark, store-policy, and visual-identity review. Keep this record
and the `raw/` chroma-key outputs with the project for provenance.

## Hero 16-frame run-cycle redraw

Redrawn on 2026-07-28 after visual QA rejected a six-frame draft for long-looking
legs, proportion drift, and insufficient temporal resolution.

- References: the original `hero-locomotion` and `hero-airborne` sheets,
  preserving the oversized hood, compact torso, short fixed-length legs,
  costume, palette, outline weight, and pixel-cluster treatment.
- Chroma source: `raw/hero-run-16f-chroma.png`.
- Runtime sheet: `characters/hero/hero-run.png`.
- Layout: four separately reviewed four-frame phase strips, assembled into one
  dedicated `4 x 4` sheet. Generating the full cycle as one freeform board was
  rejected because it duplicated poses and broke the contact order.
- Motion coverage: alternating contact, compression, push-off, flight, recovery,
  passing, lead, and pre-contact phases for both legs.
- Invariants: leg length and boot size remain fixed; stride comes from joint
  rotation, near/far legs use different values, the torso and hood remain
  stable, and every frame uses bottom-center pivot `(128, 224)`.
- Runtime cadence: distance-driven, targeting 16 frames per second at maximum
  run speed with `distancePerFrame: 21.875`.
- Processing: a strict 16-frame skeleton/center-of-mass guide, chroma removal,
  one uniform nearest-neighbor scale across all frames, deterministic packing
  with `scripts/art/replace_sprite_sequence.py`, and explicit negative Y offsets
  for the two flight arcs so airborne frames are not forced onto the baseline.

### Leg-topology correction (rejected production render)

The first assembled 16-frame sheet was rejected during user review because its
silhouette changed but the same anatomical leg remained in front throughout
the loop. It therefore did not contain a valid run-cycle leg exchange.

The corrected runtime sheet keeps the generated upper-body motion, then uses
`scripts/art/redraw_run_cycle_limbs.py` to redraw the limbs with independently
tracked near/far motion paths:

- frames `0-7`: the brighter near leg travels from forward contact to the rear,
  while the darker far leg travels from rear recovery to forward contact;
- frames `8-15`: the anatomical legs exchange those paths;
- frames `0` and `8` are opposite contacts;
- frames `3-4` and `11-12` contain the two passing/crossing transitions;
- near/far identity is encoded by both value and occlusion, not inferred from
  pose order.

The same correction is applied to the upper body: fixed shoulder, elbow, and
wrist lengths replace the generated hand positions. Arms counter-swing against
their paired legs, fists keep a constant authored size, and frames `0`/`8`
exchange the near/far arm positions.

`previews/hero-run-limb-swap-proof.png` is the explicit topology review artifact.
Magenta marks the near arm and leg; cyan marks the far arm and leg. It is not
used at runtime.

The deterministic limb render itself was later rejected for production because
its line segments, joint circles, and identity colors remained visually legible
as a skeletal rig during gameplay. The motion topology was valid, but the
presentation layer was not. That sheet must not be restored as a runtime asset.

### Full-art production replacement

Replaced on 2026-07-28 with a newly generated, fully rendered 16-frame sheet.

- Built-in image generation was used in edit/reference mode.
- `hero-run` and `hero-locomotion` supplied character identity, costume,
  compact proportions, palette, and pixel density.
- The first no-rig candidate was rejected because it contained standing poses
  at the loop boundary and did not express the two contacts clearly enough.
- The accepted second candidate explicitly requested contact A, passing A,
  flight A, contact B, passing B, flight B, and a pre-contact loop closure.
- All frames use complete sleeves, gloves, trousers, armor wraps, and boots.
  There are no exposed rig lines, joint dots, topology colors, labels, or
  construction overlays in the runtime image.
- Final chroma source:
  `raw/hero-run-production-chroma.png`.
- Chroma removal used a border-sampled green matte with despill and one-pixel
  edge contraction.
- `scripts/art/normalize_sprite_sheet.py --align-actors` retained the largest
  connected actor in every cell, removed residual chroma components, aligned
  all frames to bottom-center pivot `(128, 224)`, and produced the exact
  `1024 x 1024` RGBA sheet.
- Runtime source and public copies are byte-identical.
- `previews/hero-run-production-preview.gif` is the normal 16 fps review
  animation. Audit overlays remain separate and are never copied to `public/`.

The asset audit now rejects the previous construction palette in the runtime
sheet and checks that frames `0` and `8` place their grounded contacts on
opposite screen sides.
