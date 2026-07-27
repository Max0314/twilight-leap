import { WORLD_HEIGHT, WORLD_WIDTH } from "./level";
import {
  getRuntimePlatforms,
  type EnemyState,
  type GameEvent,
  type GameState,
} from "./simulation";
import {
  BEETLE_CLIPS,
  EMBERLING_CLIPS,
  HERO_CLIPS,
  SPRITE_CELL_SIZE,
  frameFromClip,
  isSpriteReady,
  type SpriteFrame,
  type SpriteImages,
} from "./sprites";
import type { LevelDefinition, Platform, Rect } from "./types";

export const GAME_ATLAS_SIZE = 1_254;

type AtlasFrame = { x: number; y: number; width: number; height: number };

export type HeroPose = {
  animation: GameState["player"]["animation"]["name"];
  frame: SpriteFrame;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  offsetY: number;
  rotation: number;
};

export type EnemyPose = {
  animation: EnemyState["animation"]["name"];
  frame: SpriteFrame;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  alpha: number;
};

export const ATLAS_FRAMES = {
  heroIdle: { x: 38, y: 34, width: 126, height: 154 },
  heroRunA: { x: 192, y: 38, width: 160, height: 145 },
  heroRunB: { x: 382, y: 42, width: 164, height: 142 },
  heroJump: { x: 574, y: 25, width: 164, height: 164 },
  heroApex: { x: 762, y: 24, width: 184, height: 164 },
  heroFall: { x: 995, y: 30, width: 170, height: 168 },
  emberIdle: { x: 38, y: 220, width: 142, height: 132 },
  emberWalk: { x: 188, y: 214, width: 158, height: 138 },
  beetleIdle: { x: 365, y: 210, width: 190, height: 143 },
  beetleCharge: { x: 570, y: 205, width: 194, height: 150 },
  beetleDash: { x: 755, y: 212, width: 235, height: 140 },
  beetleStunned: { x: 995, y: 205, width: 188, height: 151 },
  star: { x: 30, y: 405, width: 100, height: 145 },
  spikes: { x: 125, y: 414, width: 184, height: 137 },
  checkpoint: { x: 304, y: 374, width: 108, height: 180 },
  gate: { x: 404, y: 350, width: 176, height: 208 },
  stoneA: { x: 570, y: 462, width: 150, height: 98 },
  stoneB: { x: 716, y: 462, width: 146, height: 98 },
  stoneC: { x: 855, y: 462, width: 158, height: 98 },
  wood: { x: 1_006, y: 462, width: 150, height: 98 },
  crumble: { x: 1_145, y: 460, width: 104, height: 100 },
  awning: { x: 24, y: 580, width: 238, height: 196 },
  lamp: { x: 260, y: 578, width: 125, height: 197 },
  banner: { x: 382, y: 580, width: 118, height: 192 },
  fountain: { x: 500, y: 575, width: 188, height: 202 },
  rack: { x: 685, y: 576, width: 180, height: 200 },
  vines: { x: 861, y: 574, width: 116, height: 203 },
  flowers: { x: 970, y: 594, width: 102, height: 180 },
  arch: { x: 1_060, y: 574, width: 186, height: 203 },
  skyline: { x: 24, y: 792, width: 1_205, height: 174 },
  middleRuins: { x: 22, y: 972, width: 1_210, height: 154 },
  foreground: { x: 24, y: 1_126, width: 1_205, height: 102 },
} satisfies Record<string, AtlasFrame>;

export type VisualBurst = {
  id: number;
  type: GameEvent["type"];
  x: number;
  y: number;
  age: number;
};

export type RenderOptions = {
  width: number;
  height: number;
  dpr: number;
  reducedMotion: boolean;
  screenShake: boolean;
  lowQuality: boolean;
  time: number;
  atlas: HTMLImageElement | null;
  sprites: SpriteImages;
  bursts: VisualBurst[];
};

type AtlasLoadState = Pick<
  HTMLImageElement,
  "complete" | "naturalWidth" | "naturalHeight"
>;

export const isAtlasReady = (
  atlas: AtlasLoadState | null,
): atlas is AtlasLoadState =>
  Boolean(
    atlas?.complete &&
      atlas.naturalWidth > 0 &&
      atlas.naturalHeight > 0,
  );

const rectOverlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

const drawAtlas = (
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  frame: AtlasFrame,
  x: number,
  y: number,
  width: number,
  height: number,
  flip = false,
  alpha = 1,
) => {
  if (!isAtlasReady(atlas)) return false;
  ctx.save();
  try {
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(x + width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(
        atlas,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        0,
        width,
        height,
      );
    } else {
      ctx.drawImage(
        atlas,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        x,
        y,
        width,
        height,
      );
    }
    return true;
  } catch {
    return false;
  } finally {
    ctx.restore();
  }
};

const drawSpriteFrame = (
  ctx: CanvasRenderingContext2D,
  sprites: SpriteImages,
  frame: SpriteFrame,
  x: number,
  y: number,
  width: number,
  height: number,
  flip = false,
  alpha = 1,
) => {
  const image = sprites[frame.sheet];
  if (!isSpriteReady(image)) return false;
  const columns = frame.columns ?? 4;
  const rows = frame.rows ?? 4;
  const sourceWidth = image.naturalWidth / columns;
  const sourceHeight = image.naturalHeight / rows;
  const sourceX = (frame.index % columns) * sourceWidth;
  const sourceY = Math.floor(frame.index / columns) * sourceHeight;

  ctx.save();
  try {
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(x + width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height,
      );
    } else {
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x,
        y,
        width,
        height,
      );
    }
    return true;
  } catch {
    return false;
  } finally {
    ctx.restore();
  }
};

const repeatSpriteStrip = (
  ctx: CanvasRenderingContext2D,
  sprites: SpriteImages,
  frame: SpriteFrame,
  offset: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
  viewportWidth: number,
  alpha: number,
) => {
  const start = -(((offset % tileWidth) + tileWidth) % tileWidth) - tileWidth;
  for (let x = start; x < viewportWidth + tileWidth; x += tileWidth) {
    drawSpriteFrame(
      ctx,
      sprites,
      frame,
      x,
      y,
      tileWidth,
      tileHeight,
      false,
      alpha,
    );
  }
};

const repeatAtlasStrip = (
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  frame: AtlasFrame,
  offset: number,
  y: number,
  tileWidth: number,
  tileHeight: number,
  viewportWidth: number,
  alpha: number,
) => {
  const start = -(((offset % tileWidth) + tileWidth) % tileWidth) - tileWidth;
  for (let x = start; x < viewportWidth + tileWidth; x += tileWidth) {
    drawAtlas(ctx, atlas, frame, x, y, tileWidth, tileHeight, false, alpha);
  }
};

const drawSky = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) => {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#2a1738");
  sky.addColorStop(0.35, "#7d3850");
  sky.addColorStop(0.67, "#dc734f");
  sky.addColorStop(1, "#1b1830");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunX = width * 0.62;
  const sunY = height * 0.19;
  const pulse = 1 + Math.sin(time * 0.35) * 0.025;
  const halo = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, height * 0.38);
  halo.addColorStop(0, "rgba(255,244,190,.9)");
  halo.addColorStop(0.12, "rgba(255,184,102,.48)");
  halo.addColorStop(0.48, "rgba(232,93,78,.12)");
  halo.addColorStop(1, "rgba(232,93,78,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(sunX, sunY, height * 0.38 * pulse, 0, Math.PI * 2);
  ctx.fill();
}

const drawLightBeams = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lowQuality: boolean,
) => {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  if (!lowQuality) ctx.filter = "blur(10px)";
  for (const beam of [
    { x: width * 0.16, lean: 0.12, alpha: 0.1 },
    { x: width * 0.58, lean: -0.08, alpha: 0.15 },
    { x: width * 0.82, lean: -0.16, alpha: 0.08 },
  ]) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.85);
    gradient.addColorStop(0, `rgba(255,238,175,${beam.alpha})`);
    gradient.addColorStop(1, "rgba(255,190,112,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(beam.x - width * 0.055, 0);
    ctx.lineTo(beam.x + width * 0.025, 0);
    ctx.lineTo(beam.x + width * beam.lean + width * 0.13, height * 0.86);
    ctx.lineTo(beam.x + width * beam.lean - width * 0.08, height * 0.86);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

const platformFrame = (platform: Platform) => {
  if (platform.kind === "wood") return ATLAS_FRAMES.wood;
  if (platform.kind === "crumble") return ATLAS_FRAMES.crumble;
  return platform.id.charCodeAt(0) % 2 === 0
    ? ATLAS_FRAMES.stoneA
    : ATLAS_FRAMES.stoneB;
};

const drawPlatform = (
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  sprites: SpriteImages,
  platform: Platform,
  cameraX: number,
  scale: number,
) => {
  const x = Math.round((platform.x - cameraX) * scale);
  const y = Math.round(platform.y * scale);
  const width = Math.ceil(platform.width * scale);
  const height = Math.ceil(platform.height * scale);
  const tileHeight = Math.min(Math.max(52 * scale, 34), Math.max(height, 34));

  const body = ctx.createLinearGradient(0, y, 0, y + height);
  body.addColorStop(0, platform.kind === "wood" ? "#68412d" : "#3b2936");
  body.addColorStop(1, "#17131f");
  ctx.fillStyle = body;
  ctx.fillRect(x, y + tileHeight * 0.42, width, Math.max(0, height - tileHeight * 0.42));

  if (isSpriteReady(sprites.environmentTiles)) {
    const stone = platform.kind !== "wood" && platform.kind !== "moving";
    const startFrame = platform.kind === "crumble" ? 7 : stone ? 0 : 4;
    const middleFrame = platform.kind === "crumble" ? 7 : stone ? 1 : 5;
    const endFrame = platform.kind === "crumble" ? 7 : stone ? 2 : 6;
    const cellSize = 140 * scale;
    const step = 120 * scale;
    const pieceCount = Math.max(1, Math.ceil(width / step));
    for (let index = 0; index < pieceCount; index += 1) {
      const frameIndex =
        index === 0 ? startFrame : index === pieceCount - 1 ? endFrame : middleFrame;
      const sourceTop =
        frameIndex === 0
          ? 59
          : frameIndex === 1 || frameIndex === 2
            ? 64
            : frameIndex === 4 || frameIndex === 6 || frameIndex === 7
              ? 61
              : 48;
      drawSpriteFrame(
        ctx,
        sprites,
        { sheet: "environmentTiles", index: frameIndex },
        x + index * step - 8 * scale,
        y - (sourceTop / SPRITE_CELL_SIZE) * cellSize,
        cellSize,
        cellSize,
      );
    }
  } else {
    const frame = platformFrame(platform);
    const chunkWidth = Math.max(70 * scale, 64);
    for (let offset = 0; offset < width; offset += chunkWidth) {
      const drawWidth = Math.min(chunkWidth + 2, width - offset + 2);
      drawAtlas(
        ctx,
        atlas,
        frame,
        x + offset,
        y - tileHeight * 0.28,
        drawWidth,
        tileHeight,
      );
    }
  }

  ctx.fillStyle = "rgba(255,211,132,.18)";
  ctx.fillRect(x, y, width, Math.max(2, scale * 2));
};

type SceneProp = {
  kind: "lantern" | "banner" | "fountain" | "vines";
  x: number;
  y: number;
  size: number;
};

const SCENE_PROPS: SceneProp[] = [
  { kind: "lantern", x: 980, y: 382, size: 178 },
  { kind: "banner", x: 1_390, y: 330, size: 184 },
  { kind: "fountain", x: 1_820, y: 704, size: 190 },
  { kind: "lantern", x: 2_360, y: 390, size: 176 },
  { kind: "vines", x: 2_760, y: 372, size: 176 },
  { kind: "banner", x: 3_310, y: 344, size: 180 },
  { kind: "fountain", x: 3_730, y: 704, size: 188 },
  { kind: "lantern", x: 4_420, y: 382, size: 176 },
  { kind: "vines", x: 4_860, y: 372, size: 180 },
  { kind: "banner", x: 5_720, y: 284, size: 180 },
  { kind: "fountain", x: 6_510, y: 704, size: 188 },
];

const PROP_FRAME_START = {
  lantern: 0,
  banner: 4,
  fountain: 8,
  vines: 12,
} as const;

const drawAnimatedSceneProps = (
  ctx: CanvasRenderingContext2D,
  sprites: SpriteImages,
  cameraX: number,
  viewWorldWidth: number,
  scale: number,
  time: number,
) => {
  if (!isSpriteReady(sprites.environmentProps)) return;
  for (const prop of SCENE_PROPS) {
    if (
      prop.x + prop.size < cameraX - 80 ||
      prop.x - prop.size > cameraX + viewWorldWidth + 80
    ) {
      continue;
    }
    const size = prop.size * scale;
    const index =
      PROP_FRAME_START[prop.kind] + Math.floor(time * (prop.kind === "fountain" ? 8 : 6)) % 4;
    const anchoredY =
      prop.kind === "fountain"
        ? prop.y * scale - size * (248 / SPRITE_CELL_SIZE)
        : prop.y * scale - size * (8 / SPRITE_CELL_SIZE);
    drawSpriteFrame(
      ctx,
      sprites,
      { sheet: "environmentProps", index },
      (prop.x - cameraX) * scale - size / 2,
      anchoredY,
      size,
      size,
      false,
      0.96,
    );
  }
};

const drawAmbientSpriteEffects = (
  ctx: CanvasRenderingContext2D,
  sprites: SpriteImages,
  cameraX: number,
  viewWorldWidth: number,
  scale: number,
  time: number,
  reducedMotion: boolean,
) => {
  if (!isSpriteReady(sprites.ambientVfx)) return;
  const emberPositions = [
    { x: 720, y: 430 },
    { x: 2_120, y: 380 },
    { x: 4_020, y: 430 },
    { x: 5_320, y: 350 },
    { x: 6_620, y: 430 },
  ];
  for (const [index, point] of emberPositions.entries()) {
    if (point.x < cameraX - 100 || point.x > cameraX + viewWorldWidth + 100) {
      continue;
    }
    const size = 88 * scale;
    const bob = reducedMotion ? 0 : Math.sin(time * 1.7 + index) * 12;
    drawSpriteFrame(
      ctx,
      sprites,
      {
        sheet: "ambientVfx",
        index: 8 + Math.floor(time * 8 + index) % 4,
      },
      (point.x - cameraX) * scale - size / 2,
      (point.y + bob) * scale - size / 2,
      size,
      size,
      false,
      0.72,
    );
  }

  if (reducedMotion) return;
  for (const [index, point] of [
    { x: 1_140, y: 330 },
    { x: 3_960, y: 300 },
    { x: 5_940, y: 270 },
  ].entries()) {
    if (point.x < cameraX - 160 || point.x > cameraX + viewWorldWidth + 160) {
      continue;
    }
    const size = 150 * scale;
    const drift = ((time * 18 + index * 41) % 90) - 45;
    drawSpriteFrame(
      ctx,
      sprites,
      {
        sheet: "ambientVfx",
        index: 12 + Math.floor(time * 8 + index) % 4,
      },
      (point.x + drift - cameraX) * scale - size / 2,
      point.y * scale - size / 2,
      size,
      size,
      false,
      0.46,
    );
  }
};

const drawSpikes = (
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  hazard: Rect,
  cameraX: number,
  scale: number,
) => {
  const drawn = drawAtlas(
    ctx,
    atlas,
    ATLAS_FRAMES.spikes,
    Math.round((hazard.x - cameraX) * scale - 7 * scale),
    Math.round((hazard.y - 25 - 8 * scale) * scale),
    Math.round((hazard.width + 18) * scale),
    Math.round(80 * scale),
  );
  if (drawn) return;

  const x = Math.round((hazard.x - cameraX) * scale);
  const y = Math.round(hazard.y * scale);
  const width = Math.max(8, hazard.width * scale);
  const spikeWidth = Math.max(8, 18 * scale);
  ctx.save();
  ctx.fillStyle = "#e9d8be";
  ctx.strokeStyle = "rgba(56,32,45,.9)";
  ctx.lineWidth = Math.max(1, scale * 2);
  for (let offset = 0; offset < width; offset += spikeWidth) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.lineTo(x + offset + spikeWidth / 2, y - Math.max(18, 40 * scale));
    ctx.lineTo(x + offset + spikeWidth, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
};

const drawFallbackDiamond = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.45;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  ctx.restore();
};

export const getHeroPose = (state: GameState): HeroPose => {
  const player = state.player;
  const { animation } = player;
  const clip = HERO_CLIPS[animation.name];
  const frame = frameFromClip(
    clip,
    animation.time,
    animation.name === "walk" || animation.name === "run"
      ? animation.cycle
      : undefined,
  );
  let scale = 1;
  let offsetY = 0;
  let rotation = 0;

  switch (animation.name) {
    case "idle":
      offsetY = Math.sin(animation.time * 2.8) * 0.45;
      break;
    case "walk":
      rotation = Math.sign(player.vx) * 0.008;
      break;
    case "run":
      rotation = Math.sign(player.vx) * 0.018;
      break;
    case "jump":
      scale = 1.015;
      rotation = player.facing * -0.012;
      break;
    case "doubleJump": {
      const progress = Math.min(1, animation.time / 0.14);
      scale = 1.035 - progress * 0.02;
      offsetY = -2 * (1 - progress);
      rotation = player.facing * (-0.065 + progress * 0.045);
      break;
    }
    case "wallJump": {
      const progress = Math.min(1, animation.time / 0.12);
      scale = 1.025 - progress * 0.015;
      offsetY = -1;
      rotation = player.facing * (-0.075 + progress * 0.035);
      break;
    }
    case "apex":
      offsetY = -1.5;
      rotation = player.facing * -0.006;
      break;
    case "fall":
      rotation = Math.sign(player.vx) * 0.012;
      break;
    case "wallSlide":
      offsetY = 1 + Math.sin(animation.time * 15) * 0.3;
      rotation = player.wallNormal * 0.035;
      break;
    case "land": {
      const progress = Math.min(1, animation.time / 0.13);
      scale = 0.97 + progress * 0.03;
      offsetY = 1.4 * (1 - progress);
      break;
    }
    case "hurt": {
      const progress = Math.min(1, animation.time / 0.18);
      offsetY = -Math.sin(progress * Math.PI) * 4;
      rotation = player.facing * progress * 0.08;
      break;
    }
    case "death":
      break;
    case "respawn":
      scale = 1 + Math.sin(Math.min(1, animation.time / 0.25) * Math.PI) * 0.025;
      break;
  }

  const height = 196 * scale;
  const width = height;
  return {
    animation: animation.name,
    frame,
    width,
    height,
    anchorX: player.x + player.width / 2,
    anchorY: player.y + player.height + 8,
    offsetY,
    rotation,
  };
};

export const getEnemyPose = (enemy: EnemyState): EnemyPose => {
  const { animation } = enemy;
  const isBeetle = enemy.kind === "beetle";
  const clip =
    enemy.kind === "beetle"
      ? BEETLE_CLIPS[animation.name as keyof typeof BEETLE_CLIPS]
      : EMBERLING_CLIPS[animation.name as keyof typeof EMBERLING_CLIPS];
  const fallbackClip = isBeetle ? BEETLE_CLIPS.idle : EMBERLING_CLIPS.idle;
  const resolvedClip = clip ?? fallbackClip;
  const frame = frameFromClip(
    resolvedClip,
    animation.time,
    animation.name === "patrol" || animation.name === "dash"
      ? animation.cycle
      : undefined,
  );
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  const rotation = 0;
  let alpha = 1;

  if (animation.name === "charge") {
    offsetX = Math.sin(animation.time * 48) * 0.8;
    scale = 1 + Math.min(0.02, animation.time * 0.05);
  } else if (animation.name === "dash") {
    offsetY = Math.sin(animation.cycle * 0.08) * 0.45;
  } else if (animation.name === "recover") {
    offsetY = Math.sin(animation.time * 16) * 0.65;
  } else if (animation.name === "death") {
    alpha = Math.max(0, 1 - Math.max(0, animation.time - 0.5) / 0.2);
  } else if (animation.name === "idle") {
    scale = 1 + Math.sin(animation.time * 2.6) * 0.006;
  }

  const baseHeight = isBeetle ? 188 : 132;
  const height = baseHeight * scale;
  const width = height;
  return {
    animation: animation.name,
    frame,
    width,
    height,
    anchorX: enemy.x + enemy.width / 2,
    anchorY: enemy.y + enemy.height,
    offsetX,
    offsetY,
    rotation,
    alpha,
  };
};

const drawWorldEntities = (
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  sprites: SpriteImages,
  state: GameState,
  level: LevelDefinition,
  cameraX: number,
  scale: number,
  time: number,
) => {
  for (const star of level.stars) {
    if (state.collected.includes(star.id)) continue;
    const bob = Math.sin(time * 3 + star.x * 0.01) * 5;
    const size = 96 * scale;
    const drawn = drawSpriteFrame(
      ctx,
      sprites,
      {
        sheet: "gameplayVfx",
        index: 8 + Math.floor(time * 8 + star.x * 0.01) % 4,
      },
      (star.x - cameraX) * scale - size / 2,
      (star.y + bob) * scale - size / 2,
      size,
      size,
    );
    if (!drawn) {
      drawAtlas(
        ctx,
        atlas,
        ATLAS_FRAMES.star,
        (star.x - cameraX) * scale - size / 2,
        (star.y + bob) * scale - size / 2,
        size,
        size,
      );
    }
  }

  for (const checkpoint of level.checkpoints) {
    const active = state.activeCheckpoint === checkpoint.id;
    const glow = active ? 1 : 0.76 + Math.sin(time * 3) * 0.08;
    const pedestalSize = 152 * scale;
    const centerX = (checkpoint.x - cameraX + checkpoint.width / 2) * scale;
    const groundY = (checkpoint.y + checkpoint.height) * scale;
    const drawn = drawSpriteFrame(
      ctx,
      sprites,
      { sheet: "environmentTiles", index: 15 },
      centerX - pedestalSize / 2,
      groundY - pedestalSize * (227 / SPRITE_CELL_SIZE),
      pedestalSize,
      pedestalSize,
      false,
      glow,
    );
    if (drawn) {
      const flameSize = 112 * scale;
      drawSpriteFrame(
        ctx,
        sprites,
        {
          sheet: "ambientVfx",
          index: 4 + Math.floor(time * 8) % 4,
        },
        centerX - flameSize / 2,
        groundY - 152 * scale,
        flameSize,
        flameSize,
        false,
        active ? 1 : 0.72,
      );
    } else {
      drawAtlas(
        ctx,
        atlas,
        ATLAS_FRAMES.checkpoint,
        (checkpoint.x - cameraX - 18) * scale,
        (checkpoint.y - 38) * scale,
        86 * scale,
        132 * scale,
        false,
        glow,
      );
    }
  }

  const gateSize = 260 * scale;
  const gateCenterX =
    (level.finish.x - cameraX + level.finish.width / 2) * scale;
  const gateGroundY = (level.finish.y + level.finish.height) * scale;
  const gateDrawn = drawSpriteFrame(
    ctx,
    sprites,
    { sheet: "environmentTiles", index: 9 },
    gateCenterX - gateSize / 2,
    gateGroundY - gateSize * (224 / SPRITE_CELL_SIZE),
    gateSize,
    gateSize,
  );
  if (gateDrawn) {
    const portalSize = 186 * scale;
    drawSpriteFrame(
      ctx,
      sprites,
      {
        sheet: "ambientVfx",
        index: Math.floor(time * 8) % 4,
      },
      gateCenterX - portalSize / 2,
      gateGroundY - 192 * scale,
      portalSize,
      portalSize,
      false,
      0.92,
    );
  } else {
    drawAtlas(
      ctx,
      atlas,
      ATLAS_FRAMES.gate,
      (level.finish.x - cameraX - 30) * scale,
      (level.finish.y - 36) * scale,
      184 * scale,
      218 * scale,
    );
  }

  for (const enemy of state.enemies) {
    if (
      !enemy.alive &&
      (enemy.animation.name !== "death" || enemy.animation.time >= 0.7)
    ) {
      continue;
    }
    const pose = getEnemyPose(enemy);
    ctx.save();
    ctx.translate(
      (pose.anchorX - cameraX + pose.offsetX) * scale,
      (pose.anchorY + pose.offsetY) * scale,
    );
    ctx.rotate(pose.rotation);
    drawSpriteFrame(
      ctx,
      sprites,
      pose.frame,
      (-pose.width * scale) / 2,
      -pose.height * (224 / SPRITE_CELL_SIZE) * scale,
      pose.width * scale,
      pose.height * scale,
      enemy.direction < 0,
      pose.alpha,
    );
    ctx.restore();

    if (
      enemy.alive &&
      enemy.kind === "beetle" &&
      (enemy.phase === "alert" || enemy.phase === "charge")
    ) {
      ctx.save();
      ctx.fillStyle = `rgba(255,205,104,${0.55 + Math.sin(time * 22) * 0.25})`;
      ctx.font = `${Math.max(18, 24 * scale)}px sans-serif`;
      ctx.textAlign = "center";
      const marker = enemy.phase === "alert" ? "!" : "!!";
      ctx.fillText(marker, (enemy.x - cameraX + enemy.width / 2) * scale, (enemy.y - 16) * scale);
      ctx.restore();
    }
  }

  const heroOpacity =
    state.player.invulnerable > 0 && Math.floor(time * 18) % 2 === 0 ? 0.42 : 1;
  const heroPose = getHeroPose(state);
  ctx.save();
  ctx.translate(
    (heroPose.anchorX - cameraX) * scale,
    heroPose.anchorY * scale,
  );
  ctx.rotate(heroPose.rotation);
  drawSpriteFrame(
    ctx,
    sprites,
    heroPose.frame,
    (-heroPose.width / 2) * scale,
    (-heroPose.height * (224 / SPRITE_CELL_SIZE) + heroPose.offsetY) * scale,
    heroPose.width * scale,
    heroPose.height * scale,
    state.player.facing < 0,
    heroOpacity,
  );
  ctx.restore();

  if (isSpriteReady(sprites[heroPose.frame.sheet])) return;

  for (const star of level.stars) {
    if (state.collected.includes(star.id)) continue;
    const bob = Math.sin(time * 3 + star.x * 0.01) * 5;
    drawFallbackDiamond(
      ctx,
      (star.x - cameraX) * scale,
      (star.y + bob) * scale,
      Math.max(8, 15 * scale),
      "#ffd978",
    );
  }

  ctx.save();
  ctx.lineWidth = Math.max(2, 4 * scale);
  for (const checkpoint of level.checkpoints) {
    const x = (checkpoint.x - cameraX + checkpoint.width / 2) * scale;
    const y = checkpoint.y * scale;
    ctx.strokeStyle = state.activeCheckpoint === checkpoint.id ? "#bdeaff" : "#e1bb72";
    ctx.beginPath();
    ctx.moveTo(x, y + checkpoint.height * scale);
    ctx.lineTo(x, y - 48 * scale);
    ctx.stroke();
    drawFallbackDiamond(ctx, x, y - 54 * scale, Math.max(7, 13 * scale), ctx.strokeStyle as string);
  }

  const gateX = (level.finish.x - cameraX) * scale;
  const gateY = level.finish.y * scale;
  ctx.strokeStyle = "#9f86ff";
  ctx.shadowColor = "#9f86ff";
  ctx.shadowBlur = 18;
  ctx.strokeRect(
    gateX,
    gateY,
    level.finish.width * scale,
    level.finish.height * scale,
  );

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const x = (enemy.x - cameraX) * scale;
    const y = enemy.y * scale;
    ctx.fillStyle = enemy.kind === "beetle" ? "#5a4146" : "#4a2630";
    ctx.fillRect(x, y, enemy.width * scale, enemy.height * scale);
    drawFallbackDiamond(
      ctx,
      x + enemy.width * scale * 0.5,
      y + enemy.height * scale * 0.42,
      Math.max(3, 6 * scale),
      "#ff9d57",
    );
  }

  const playerX = (state.player.x - cameraX) * scale;
  const playerY = state.player.y * scale;
  ctx.fillStyle = "#2b2337";
  ctx.fillRect(
    playerX,
    playerY,
    state.player.width * scale,
    state.player.height * scale,
  );
  drawFallbackDiamond(
    ctx,
    playerX + state.player.width * scale * 0.5,
    playerY + state.player.height * scale * 0.36,
    Math.max(4, 8 * scale),
    "#ffd67c",
  );
  ctx.restore();
};

const drawAmbientParticles = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  reducedMotion: boolean,
  lowQuality: boolean,
) => {
  const count = reducedMotion ? 8 : lowQuality ? 18 : 34;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < count; index += 1) {
    const seed = index * 73.137;
    const x = ((seed * 19 + time * (5 + (index % 5))) % (width + 80)) - 40;
    const y = ((seed * 11 + time * (2 + (index % 3))) % (height * 0.74)) + height * 0.08;
    const radius = 0.8 + (index % 3) * 0.55;
    ctx.fillStyle = index % 4 === 0 ? "rgba(255,151,91,.55)" : "rgba(255,229,160,.33)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

const drawBursts = (
  ctx: CanvasRenderingContext2D,
  sprites: SpriteImages,
  bursts: VisualBurst[],
  cameraX: number,
  scale: number,
) => {
  for (const burst of bursts) {
    const progress = Math.min(1, burst.age / 0.65);
    const alpha = 1 - progress;
    const isGroundedEffect =
      burst.type === "jump" ||
      burst.type === "land" ||
      burst.type === "stomp";
    const startFrame =
      burst.type === "jump"
        ? 0
        : burst.type === "land" || burst.type === "stomp"
          ? 4
          : burst.type === "hurt"
            ? 12
            : 8;
    const frameOffset = Math.min(3, Math.floor(burst.age * 14));
    const worldSize =
      burst.type === "land" || burst.type === "stomp"
        ? 168
        : burst.type === "hurt"
          ? 132
          : 116;
    const size = worldSize * scale;
    const effectX = (burst.x - cameraX) * scale - size / 2;
    const effectY = isGroundedEffect
      ? burst.y * scale - size * (244 / SPRITE_CELL_SIZE)
      : burst.y * scale - size / 2;
    const drawn = drawSpriteFrame(
      ctx,
      sprites,
      { sheet: "gameplayVfx", index: startFrame + frameOffset },
      effectX,
      effectY,
      size,
      size,
      false,
      alpha,
    );
    if (drawn) continue;

    const count = burst.type === "star" || burst.type === "finish" ? 12 : 7;
    const baseColor =
      burst.type === "hurt"
        ? "255,100,92"
        : burst.type === "checkpoint"
          ? "157,225,255"
          : "255,220,122";
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + burst.id * 0.17;
      const distance = progress * (42 + (index % 3) * 13) * scale;
      const x = (burst.x - cameraX) * scale + Math.cos(angle) * distance;
      const y = burst.y * scale + Math.sin(angle) * distance - progress * 18;
      ctx.fillStyle = `rgba(${baseColor},${alpha})`;
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(2, 4 * scale), Math.max(2, 4 * scale));
    }
  }
};

export const getScreenShakeStrength = (
  bursts: VisualBurst[],
  reducedMotion: boolean,
  screenShake: boolean,
) => {
  if (reducedMotion || !screenShake) return 0;
  let strength = 0;
  for (const burst of bursts) {
    if (
      burst.age >= 0.65 ||
      (burst.type !== "hurt" &&
        burst.type !== "stomp" &&
        burst.type !== "land")
    ) {
      continue;
    }
    strength = Math.max(strength, (1 - burst.age / 0.65) * 4);
  }
  return strength;
};

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  level: LevelDefinition,
  options: RenderOptions,
): void {
  const {
    width,
    height,
    atlas,
    sprites,
    time,
    lowQuality,
    reducedMotion,
    screenShake,
    bursts,
  } = options;
  const scale = height / WORLD_HEIGHT;
  const viewWorldWidth = width / scale;
  const targetCamera = state.player.x + state.player.width / 2 - viewWorldWidth * 0.42;
  const cameraX = Math.max(0, Math.min(WORLD_WIDTH - viewWorldWidth, targetCamera));
  const activeBursts = bursts.filter((burst) => burst.age < 0.65);
  const shake = getScreenShakeStrength(
    activeBursts,
    reducedMotion,
    screenShake,
  );

  ctx.save();
  ctx.translate(
    shake ? Math.sin(time * 88) * shake : 0,
    shake ? Math.cos(time * 73) * shake * 0.55 : 0,
  );
  drawSky(ctx, width, height, time);

  if (isSpriteReady(sprites.parallax)) {
    repeatSpriteStrip(
      ctx,
      sprites,
      { sheet: "parallax", index: 0, columns: 1, rows: 4 },
      cameraX * 0.12 * scale,
      height * 0.06,
      Math.max(width * 1.05, 1_100),
      height * 0.5,
      width,
      0.68,
    );
  } else {
    repeatAtlasStrip(
      ctx,
      atlas,
      ATLAS_FRAMES.skyline,
      cameraX * 0.12 * scale,
      height * 0.3,
      Math.max(width * 0.92, 980),
      height * 0.38,
      width,
      0.64,
    );
  }

  const distanceMist = ctx.createLinearGradient(0, height * 0.42, 0, height * 0.78);
  distanceMist.addColorStop(0, "rgba(68,58,91,0)");
  distanceMist.addColorStop(0.55, "rgba(68,67,98,.22)");
  distanceMist.addColorStop(1, "rgba(31,29,54,.5)");
  ctx.fillStyle = distanceMist;
  ctx.fillRect(0, height * 0.32, width, height * 0.5);

  if (isSpriteReady(sprites.parallax)) {
    repeatSpriteStrip(
      ctx,
      sprites,
      { sheet: "parallax", index: 1, columns: 1, rows: 4 },
      cameraX * 0.28 * scale,
      height * 0.24,
      Math.max(width * 1.08, 1_180),
      height * 0.54,
      width,
      0.78,
    );
    repeatSpriteStrip(
      ctx,
      sprites,
      { sheet: "parallax", index: 2, columns: 1, rows: 4 },
      cameraX * 0.52 * scale,
      height * 0.39,
      Math.max(width * 1.08, 1_180),
      height * 0.5,
      width,
      0.76,
    );
  } else {
    repeatAtlasStrip(
      ctx,
      atlas,
      ATLAS_FRAMES.middleRuins,
      cameraX * 0.28 * scale,
      height * 0.52,
      Math.max(width * 0.95, 1_040),
      height * 0.28,
      width,
      0.76,
    );
  }
  drawLightBeams(ctx, width, height, lowQuality);

  const platforms = getRuntimePlatforms(state, level);
  for (const platform of platforms) {
    if (
      platform.x + platform.width < cameraX - 150 ||
      platform.x > cameraX + viewWorldWidth + 150
    ) {
      continue;
    }
    drawPlatform(ctx, atlas, sprites, platform, cameraX, scale);
  }

  drawAnimatedSceneProps(
    ctx,
    sprites,
    cameraX,
    viewWorldWidth,
    scale,
    time,
  );
  drawAmbientSpriteEffects(
    ctx,
    sprites,
    cameraX,
    viewWorldWidth,
    scale,
    time,
    reducedMotion,
  );

  for (const hazard of level.hazards) {
    if (hazard.x + hazard.width < cameraX || hazard.x > cameraX + viewWorldWidth) continue;
    drawSpikes(ctx, atlas, hazard, cameraX, scale);
  }

  drawWorldEntities(ctx, atlas, sprites, state, level, cameraX, scale, time);
  drawBursts(ctx, sprites, activeBursts, cameraX, scale);

  if (isSpriteReady(sprites.parallax)) {
    repeatSpriteStrip(
      ctx,
      sprites,
      { sheet: "parallax", index: 3, columns: 1, rows: 4 },
      cameraX * 0.82 * scale,
      height * 0.62,
      Math.max(width * 1.05, 1_120),
      height * 0.44,
      width,
      0.9,
    );
  } else {
    repeatAtlasStrip(
      ctx,
      atlas,
      ATLAS_FRAMES.foreground,
      cameraX * 1.18 * scale,
      height * 0.87,
      Math.max(width * 0.92, 960),
      height * 0.16,
      width,
      0.94,
    );
  }

  if (!lowQuality) {
    const fog = ctx.createLinearGradient(0, height * 0.68, 0, height);
    fog.addColorStop(0, "rgba(91,74,111,0)");
    fog.addColorStop(0.64, "rgba(96,77,109,.11)");
    fog.addColorStop(1, "rgba(17,14,30,.32)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, height * 0.64, width, height * 0.36);
  }

  drawAmbientParticles(ctx, width, height, time, reducedMotion, lowQuality);

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.46,
    Math.min(width, height) * 0.24,
    width * 0.5,
    height * 0.48,
    Math.max(width, height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(16,10,27,0)");
  vignette.addColorStop(1, "rgba(10,7,19,.58)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export function getVisibleWorldRect(
  state: GameState,
  width: number,
  height: number,
): Rect {
  const scale = height / WORLD_HEIGHT;
  const viewWorldWidth = width / scale;
  const cameraX = Math.max(
    0,
    Math.min(
      WORLD_WIDTH - viewWorldWidth,
      state.player.x + state.player.width / 2 - viewWorldWidth * 0.42,
    ),
  );
  return { x: cameraX, y: 0, width: viewWorldWidth, height: WORLD_HEIGHT };
}

export const isWorldObjectVisible = (object: Rect, view: Rect) =>
  rectOverlaps(object, view);
