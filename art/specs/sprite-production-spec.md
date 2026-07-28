# Twilight Leap Sprite Production Specification

## Visual direction

- Original commercial pixel-art direction: twilight fantasy ruins, warm amber
  highlights, plum shadows, worn stone, restrained gold accents.
- Match the established silhouette language without copying third-party
  characters, brands, or game assets.
- Upper-right key light, readable silhouette, limited palette, crisp pixel
  clusters, no painterly blur, no antialiased vector edges.

## Technical contract

| Property | Value |
| --- | --- |
| Pixels per unit | 64 |
| Sheet size | 1024 x 1024 px |
| Grid | 4 columns x 4 rows |
| Cell size | 256 x 256 px |
| Actor pivot | bottom center at `(128, 224)` inside each cell |
| Actor safe area | x `24..232`, y `16..224` |
| Direction | all source sprites face right |
| Sampling | point / nearest-neighbor |
| Mipmaps | off |
| Source format | RGBA PNG |
| Color space | sRGB |
| Alpha | straight alpha, transparent corners |

All frames in a sheet must keep the same identity, costume, proportions,
lighting direction, ground line, and scale. Animation motion changes; the
camera and frame crop do not.

The parallax pack is the only layout exception: it uses a `1 x 4` stack of
`1024 x 256` layers. Its left and right edges intentionally touch so a renderer
can repeat the layer horizontally. Per-layer scroll factors are defined in the
manifest.

## Palette

Core palette anchors:

- ink `#110b1e`
- night plum `#2a1738`
- masonry `#3b2936`
- umber `#68412d`
- ember red `#b64045`
- sunset orange `#e66f4a`
- muted moss `#6e733e`
- warm gold `#ffca6a`
- starlight cream `#fff0cf`

Intermediate shades are allowed, but gradients must be expressed through
intentional pixel clusters or dithering.

## Animation timing

| Animation | Suggested rate | Loop |
| --- | ---: | --- |
| idle | 6 fps | yes |
| walk / patrol | 8 fps | yes |
| run | 16 fps | yes |
| dash | 12 fps | yes |
| jump / wall jump | 12 fps | no |
| apex / fall / wall slide | 8 fps | conditional |
| land / hurt / recover | 12 fps | no |
| death | 10 fps | no |
| environment loop | 6 fps | yes |
| VFX | 12-16 fps | no unless noted |

Looping locomotion is advanced by world distance rather than render frames.
`distancePerFrame` defines the stride sampling distance so movement speed changes
the cadence without allowing high-speed movement to over-crank the animation.

## QA gates

- Exact dimensions and RGBA format.
- Every sheet has transparent corners.
- No subject pixel may touch the cell boundary, except the intentional
  left/right seams of a parallax layer.
- No frame crosses into an adjacent cell.
- Feet or contact point remain on the shared pivot line.
- Character identity and equipment remain consistent across every frame.
- No text, numbers, grid labels, logos, signatures, or watermark.
- No duplicate frame presented as a different animation beat.
- Palette and apparent pixel density match the original game atlas.
