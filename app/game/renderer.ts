import { WORLD_HEIGHT, WORLD_WIDTH } from "./level";
import {
  getRuntimePlatforms,
  type EnemyState,
  type GameEvent,
  type GameState,
} from "./simulation";
import type { LevelDefinition, Platform, Rect } from "./types";

export const GAME_ATLAS_SIZE = 1_254;

type AtlasFrame = { x: number; y: number; width: number; height: number };

export type HeroPose = {
  animation: GameState["player"]["animation"]["name"];
  frame: AtlasFrame;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  offsetY: number;
  rotation: number;
};

export type EnemyPose = {
  animation: EnemyState["animation"]["name"];
  frame: AtlasFrame;
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

  const frame = platformFrame(platform);
  const chunkWidth = Math.max(70 * scale, 64);
  for (let offset = 0; offset < width; offset += chunkWidth) {
    const drawWidth = Math.min(chunkWidth + 2, width - offset + 2);
    drawAtlas(ctx, atlas, frame, x + offset, y - tileHeight * 0.28, drawWidth, tileHeight);
  }

  ctx.fillStyle = "rgba(255,211,132,.18)";
  ctx.fillRect(x, y, width, Math.max(2, scale * 2));
}

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

const cycleBeat = (distance: number, beatDistance: number, beats = 4) =>
  Math.floor(distance / beatDistance) % beats;

export const getHeroPose = (state: GameState): HeroPose => {
  const player = state.player;
  const { animation } = player;
  let frame: AtlasFrame = ATLAS_FRAMES.heroIdle;
  let scale = 1;
  let offsetY = 0;
  let rotation = 0;

  switch (animation.name) {
    case "idle":
      offsetY = Math.sin(animation.time * 2.8) * 0.8;
      break;
    case "walk": {
      const phase = cycleBeat(animation.cycle, 15);
      const frames = [
        ATLAS_FRAMES.heroIdle,
        ATLAS_FRAMES.heroRunA,
        ATLAS_FRAMES.heroIdle,
        ATLAS_FRAMES.heroRunB,
      ] as const;
      const poseScale = [0.99, 1, 0.985, 1] as const;
      const poseBob = [0, -1.2, 0, -0.8] as const;
      frame = frames[phase];
      scale = poseScale[phase];
      offsetY = poseBob[phase];
      rotation = Math.sign(player.vx) * 0.012;
      break;
    }
    case "run": {
      const phase = cycleBeat(animation.cycle, 20);
      const frames = [
        ATLAS_FRAMES.heroRunA,
        ATLAS_FRAMES.heroRunB,
        ATLAS_FRAMES.heroRunA,
        ATLAS_FRAMES.heroRunB,
      ] as const;
      const poseScale = [1, 0.975, 1.015, 0.99] as const;
      const poseBob = [0, -2, 0.4, -1.1] as const;
      frame = frames[phase];
      scale = poseScale[phase];
      offsetY = poseBob[phase];
      rotation = Math.sign(player.vx) * 0.036;
      break;
    }
    case "jump":
      frame = ATLAS_FRAMES.heroJump;
      scale = 1.015;
      rotation = player.facing * -0.025;
      break;
    case "doubleJump": {
      const progress = Math.min(1, animation.time / 0.14);
      frame = progress < 0.48 ? ATLAS_FRAMES.heroApex : ATLAS_FRAMES.heroJump;
      scale = 1.055 - progress * 0.03;
      offsetY = -2 * (1 - progress);
      rotation = player.facing * (-0.13 + progress * 0.09);
      break;
    }
    case "wallJump": {
      const progress = Math.min(1, animation.time / 0.12);
      frame = ATLAS_FRAMES.heroJump;
      scale = 1.04 - progress * 0.025;
      offsetY = -1;
      rotation = player.facing * (-0.15 + progress * 0.06);
      break;
    }
    case "apex":
      frame = ATLAS_FRAMES.heroApex;
      offsetY = -1.5;
      rotation = player.facing * -0.012;
      break;
    case "fall":
      frame = ATLAS_FRAMES.heroFall;
      rotation = Math.sign(player.vx) * 0.022;
      break;
    case "wallSlide":
      frame = ATLAS_FRAMES.heroFall;
      offsetY = 1.5 + Math.sin(animation.time * 15) * 0.45;
      rotation = player.wallNormal * 0.085;
      break;
    case "land": {
      const progress = Math.min(1, animation.time / 0.13);
      frame =
        progress < 0.38 ? ATLAS_FRAMES.heroFall : ATLAS_FRAMES.heroIdle;
      scale = 0.94 + progress * 0.06;
      offsetY = 2.4 * (1 - progress);
      break;
    }
    case "hurt": {
      const progress = Math.min(1, animation.time / 0.55);
      frame = ATLAS_FRAMES.heroFall;
      scale = 1 - progress * 0.08;
      offsetY = -Math.sin(progress * Math.PI) * 9;
      rotation = player.facing * (0.24 + progress * 0.55);
      break;
    }
  }

  const height = 112 * scale;
  const width = height * (frame.width / frame.height);
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
  let frame: AtlasFrame = isBeetle
    ? ATLAS_FRAMES.beetleIdle
    : ATLAS_FRAMES.emberIdle;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let alpha = 1;

  if (enemy.kind === "emberling") {
    if (animation.name === "walk") {
      const phase = cycleBeat(animation.cycle, 9);
      frame =
        phase === 0 || phase === 2
          ? ATLAS_FRAMES.emberIdle
          : ATLAS_FRAMES.emberWalk;
      scale = phase === 0 || phase === 2 ? 0.98 : 1;
      offsetY = phase === 1 ? -1.8 : phase === 3 ? -1 : 0;
      rotation = enemy.direction * (phase === 1 ? 0.025 : -0.012);
    } else if (animation.name === "turn") {
      frame = ATLAS_FRAMES.emberIdle;
      const progress = Math.min(1, animation.time / 0.14);
      scale = 0.94 + Math.sin(progress * Math.PI) * 0.045;
      offsetY = Math.sin(progress * Math.PI) * -2;
      rotation = enemy.direction * Math.sin(progress * Math.PI) * 0.05;
    } else if (animation.name === "defeated") {
      const progress = Math.min(1, animation.time / 0.34);
      frame = ATLAS_FRAMES.emberWalk;
      offsetX = enemy.direction * progress * 9;
      offsetY = -Math.sin(progress * Math.PI) * 13;
      rotation = enemy.direction * progress * 1.2;
      alpha = 1 - progress;
    }
  } else {
    switch (animation.name) {
      case "charge":
        frame = ATLAS_FRAMES.beetleCharge;
        offsetX = Math.sin(animation.time * 48) * 1.4;
        scale = 1 + Math.min(0.035, animation.time * 0.08);
        rotation = enemy.direction * -0.025;
        break;
      case "dash":
        frame = ATLAS_FRAMES.beetleDash;
        offsetY = 1 + Math.sin(animation.cycle * 0.08) * 0.7;
        rotation = enemy.direction * 0.018;
        break;
      case "recover":
        frame = ATLAS_FRAMES.beetleStunned;
        offsetY = Math.sin(animation.time * 16) * 1.4;
        rotation = Math.sin(animation.time * 18) * 0.035;
        break;
      case "defeated": {
        const progress = Math.min(1, animation.time / 0.38);
        frame = ATLAS_FRAMES.beetleStunned;
        offsetY = -Math.sin(progress * Math.PI) * 8;
        rotation = enemy.direction * progress * 0.28;
        alpha = 1 - progress;
        break;
      }
      default:
        frame = ATLAS_FRAMES.beetleIdle;
        scale = 1 + Math.sin(animation.time * 2.6) * 0.008;
        break;
    }
  }

  const baseHeight = isBeetle ? 86 : 76;
  const height = baseHeight * scale;
  const width = height * (frame.width / frame.height);
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
  state: GameState,
  level: LevelDefinition,
  cameraX: number,
  scale: number,
  time: number,
) => {
  for (const star of level.stars) {
    if (state.collected.includes(star.id)) continue;
    const bob = Math.sin(time * 3 + star.x * 0.01) * 5;
    const size = 62 * scale;
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

  for (const checkpoint of level.checkpoints) {
    const active = state.activeCheckpoint === checkpoint.id;
    const glow = active ? 1 : 0.76 + Math.sin(time * 3) * 0.08;
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

  drawAtlas(
    ctx,
    atlas,
    ATLAS_FRAMES.gate,
    (level.finish.x - cameraX - 30) * scale,
    (level.finish.y - 36) * scale,
    184 * scale,
    218 * scale,
  );

  for (const enemy of state.enemies) {
    if (
      !enemy.alive &&
      (enemy.animation.name !== "defeated" || enemy.animation.time >= 0.4)
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
    drawAtlas(
      ctx,
      atlas,
      pose.frame,
      (-pose.width * scale) / 2,
      -pose.height * scale,
      pose.width * scale,
      pose.height * scale,
      enemy.direction < 0,
      pose.alpha,
    );
    ctx.restore();

    if (
      enemy.alive &&
      enemy.kind === "beetle" &&
      enemy.phase === "charge"
    ) {
      ctx.save();
      ctx.fillStyle = `rgba(255,205,104,${0.55 + Math.sin(time * 22) * 0.25})`;
      ctx.font = `${Math.max(18, 24 * scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("!!", (enemy.x - cameraX + enemy.width / 2) * scale, (enemy.y - 16) * scale);
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
  drawAtlas(
    ctx,
    atlas,
    heroPose.frame,
    (-heroPose.width / 2) * scale,
    (-heroPose.height + heroPose.offsetY) * scale,
    heroPose.width * scale,
    heroPose.height * scale,
    state.player.facing < 0,
    heroOpacity,
  );
  ctx.restore();

  if (isAtlasReady(atlas)) return;

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
  bursts: VisualBurst[],
  cameraX: number,
  scale: number,
) => {
  for (const burst of bursts) {
    const progress = Math.min(1, burst.age / 0.65);
    const alpha = 1 - progress;
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

  const distanceMist = ctx.createLinearGradient(0, height * 0.42, 0, height * 0.78);
  distanceMist.addColorStop(0, "rgba(68,58,91,0)");
  distanceMist.addColorStop(0.55, "rgba(68,67,98,.22)");
  distanceMist.addColorStop(1, "rgba(31,29,54,.5)");
  ctx.fillStyle = distanceMist;
  ctx.fillRect(0, height * 0.32, width, height * 0.5);

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
  drawLightBeams(ctx, width, height, lowQuality);

  const platforms = getRuntimePlatforms(state, level);
  for (const platform of platforms) {
    if (
      platform.x + platform.width < cameraX - 150 ||
      platform.x > cameraX + viewWorldWidth + 150
    ) {
      continue;
    }
    drawPlatform(ctx, atlas, platform, cameraX, scale);
  }

  for (const hazard of level.hazards) {
    if (hazard.x + hazard.width < cameraX || hazard.x > cameraX + viewWorldWidth) continue;
    drawSpikes(ctx, atlas, hazard, cameraX, scale);
  }

  drawWorldEntities(ctx, atlas, state, level, cameraX, scale, time);
  drawBursts(ctx, activeBursts, cameraX, scale);

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
