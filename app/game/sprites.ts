export const SPRITE_CELL_SIZE = 256;
export const SPRITE_SHEET_SIZE = 1_024;

export const SPRITE_SHEET_PATHS = {
  heroLocomotion:
    "/assets/sprites/characters/hero/hero-locomotion.png",
  heroRun:
    "/assets/sprites/characters/hero/hero-run-6fc4f264.png",
  heroAirborne:
    "/assets/sprites/characters/hero/hero-airborne.png",
  heroReactions:
    "/assets/sprites/characters/hero/hero-reactions.png",
  emberlingLocomotion:
    "/assets/sprites/characters/enemies/emberling/emberling-locomotion.png",
  emberlingActions:
    "/assets/sprites/characters/enemies/emberling/emberling-actions.png",
  beetleLocomotion:
    "/assets/sprites/characters/enemies/beetle/beetle-locomotion.png",
  beetleActions:
    "/assets/sprites/characters/enemies/beetle/beetle-actions.png",
  environmentTiles:
    "/assets/sprites/environment/tiles/environment-modular.png",
  environmentProps:
    "/assets/sprites/environment/props/environment-animated-props.png",
  parallax:
    "/assets/sprites/scenes/parallax/twilight-ruins-parallax.png",
  gameplayVfx:
    "/assets/sprites/vfx/gameplay/vfx-gameplay.png",
  ambientVfx:
    "/assets/sprites/vfx/ambient/vfx-ambient.png",
} as const;

export type SpriteSheetKey = keyof typeof SPRITE_SHEET_PATHS;

export type SpriteImages = Partial<
  Record<SpriteSheetKey, HTMLImageElement>
>;

export type SpriteFrame = {
  sheet: SpriteSheetKey;
  index: number;
  columns?: number;
  rows?: number;
};

export type AnimationClip = {
  sheet: SpriteSheetKey;
  start: number;
  count: number;
  fps: number;
  loop: boolean;
  distancePerFrame?: number;
};

export const HERO_CLIPS = {
  idle: {
    sheet: "heroLocomotion",
    start: 0,
    count: 4,
    fps: 6,
    loop: true,
  },
  walk: {
    sheet: "heroLocomotion",
    start: 4,
    count: 6,
    fps: 8,
    loop: true,
    distancePerFrame: 28,
  },
  run: {
    sheet: "heroRun",
    start: 0,
    count: 16,
    fps: 16,
    loop: true,
    distancePerFrame: 21.875,
  },
  jump: {
    sheet: "heroAirborne",
    start: 0,
    count: 3,
    fps: 12,
    loop: false,
  },
  apex: {
    sheet: "heroAirborne",
    start: 3,
    count: 2,
    fps: 8,
    loop: true,
  },
  fall: {
    sheet: "heroAirborne",
    start: 5,
    count: 3,
    fps: 8,
    loop: true,
  },
  doubleJump: {
    sheet: "heroAirborne",
    start: 8,
    count: 4,
    fps: 12,
    loop: false,
  },
  wallSlide: {
    sheet: "heroAirborne",
    start: 12,
    count: 2,
    fps: 8,
    loop: true,
  },
  wallJump: {
    sheet: "heroAirborne",
    start: 14,
    count: 2,
    fps: 12,
    loop: false,
  },
  land: {
    sheet: "heroReactions",
    start: 0,
    count: 3,
    fps: 12,
    loop: false,
  },
  hurt: {
    sheet: "heroReactions",
    start: 3,
    count: 3,
    fps: 12,
    loop: false,
  },
  death: {
    sheet: "heroReactions",
    start: 6,
    count: 8,
    fps: 10,
    loop: false,
  },
  respawn: {
    sheet: "heroReactions",
    start: 14,
    count: 2,
    fps: 8,
    loop: false,
  },
} as const satisfies Record<string, AnimationClip>;

export const EMBERLING_CLIPS = {
  idle: {
    sheet: "emberlingLocomotion",
    start: 0,
    count: 4,
    fps: 6,
    loop: true,
  },
  patrol: {
    sheet: "emberlingLocomotion",
    start: 4,
    count: 6,
    fps: 8,
    loop: true,
    distancePerFrame: 10,
  },
  turn: {
    sheet: "emberlingLocomotion",
    start: 10,
    count: 2,
    fps: 12,
    loop: false,
  },
  alert: {
    sheet: "emberlingLocomotion",
    start: 12,
    count: 4,
    fps: 10,
    loop: false,
  },
  attack: {
    sheet: "emberlingActions",
    start: 0,
    count: 5,
    fps: 12,
    loop: false,
  },
  hurt: {
    sheet: "emberlingActions",
    start: 5,
    count: 3,
    fps: 12,
    loop: false,
  },
  stunned: {
    sheet: "emberlingActions",
    start: 8,
    count: 2,
    fps: 6,
    loop: true,
  },
  death: {
    sheet: "emberlingActions",
    start: 10,
    count: 6,
    fps: 10,
    loop: false,
  },
} as const satisfies Record<string, AnimationClip>;

export const BEETLE_CLIPS = {
  idle: {
    sheet: "beetleLocomotion",
    start: 0,
    count: 4,
    fps: 6,
    loop: true,
  },
  patrol: {
    sheet: "beetleLocomotion",
    start: 4,
    count: 6,
    fps: 8,
    loop: true,
    distancePerFrame: 7,
  },
  turn: {
    sheet: "beetleLocomotion",
    start: 10,
    count: 2,
    fps: 10,
    loop: false,
  },
  alert: {
    sheet: "beetleLocomotion",
    start: 12,
    count: 4,
    fps: 10,
    loop: false,
  },
  charge: {
    sheet: "beetleActions",
    start: 0,
    count: 4,
    fps: 10,
    loop: false,
  },
  dash: {
    sheet: "beetleActions",
    start: 4,
    count: 4,
    fps: 12,
    loop: true,
    distancePerFrame: 28,
  },
  recover: {
    sheet: "beetleActions",
    start: 8,
    count: 3,
    fps: 10,
    loop: false,
  },
  death: {
    sheet: "beetleActions",
    start: 11,
    count: 5,
    fps: 10,
    loop: false,
  },
} as const satisfies Record<string, AnimationClip>;

export const frameFromClip = (
  clip: AnimationClip,
  time: number,
  distance?: number,
): SpriteFrame => {
  const progress =
    distance === undefined
      ? Math.floor(Math.max(0, time) * clip.fps)
      : Math.floor(
          Math.max(0, distance) /
            Math.max(1, clip.distancePerFrame ?? 96 / clip.fps),
        );
  const offset = clip.loop
    ? progress % clip.count
    : Math.min(clip.count - 1, progress);
  return { sheet: clip.sheet, index: clip.start + offset };
};

export const isSpriteReady = (
  image: HTMLImageElement | null | undefined,
): image is HTMLImageElement =>
  Boolean(
    image?.complete &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0,
  );
