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
