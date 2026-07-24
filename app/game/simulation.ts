import { WORLD_HEIGHT, WORLD_WIDTH } from "./level";
import type {
  EnemyKind,
  LevelDefinition,
  Platform,
  Rect,
  Vec,
} from "./types";

export type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpQueued?: boolean;
  jumpPressed?: boolean;
};

export type GameEvent =
  | { type: "jump" | "land" | "stomp" | "hurt" | "checkpoint" | "finish" }
  | { type: "star"; id: string };

export type GameMode = "playing" | "paused" | "respawning" | "finished";

export type PlayerAnimationName =
  | "idle"
  | "walk"
  | "run"
  | "jump"
  | "doubleJump"
  | "wallJump"
  | "apex"
  | "fall"
  | "wallSlide"
  | "land"
  | "hurt";

export type EnemyAnimationName =
  | "idle"
  | "walk"
  | "turn"
  | "charge"
  | "dash"
  | "recover"
  | "defeated";

export type AnimationState<Name extends string> = {
  name: Name;
  time: number;
  cycle: number;
};

export type PlayerState = Rect & {
  vx: number;
  vy: number;
  grounded: boolean;
  coyote: number;
  jumpBuffer: number;
  wasJumpHeld: boolean;
  facing: -1 | 1;
  invulnerable: number;
  supportPlatformId: string | null;
  airJumpsRemaining: number;
  wallNormal: -1 | 0 | 1;
  wallJumpLock: number;
  doubleJumpAccent: number;
  animation: AnimationState<PlayerAnimationName>;
};

export type EnemyPhase = "patrol" | "idle" | "charge" | "dash" | "recover";

export type EnemyState = Rect & {
  id: string;
  kind: EnemyKind;
  minX: number;
  maxX: number;
  direction: -1 | 1;
  phase: EnemyPhase;
  phaseTime: number;
  alive: boolean;
  animation: AnimationState<EnemyAnimationName>;
};

export type CrumbleState = Record<string, number>;

export type GameState = {
  mode: GameMode;
  player: PlayerState;
  enemies: EnemyState[];
  collected: string[];
  activeCheckpoint: string | null;
  checkpointPosition: Vec;
  elapsed: number;
  respawnTimer: number;
  finishEmitted: boolean;
  crumble: CrumbleState;
};

export type StepResult = { state: GameState; events: GameEvent[] };

export const PHYSICS = {
  gravity: 2_100,
  runAcceleration: 2_200,
  airAcceleration: 1_250,
  friction: 2_400,
  maxRunSpeed: 350,
  jumpSpeed: 760,
  doubleJumpSpeed: 700,
  wallJumpSpeed: 720,
  wallJumpHorizontalSpeed: 390,
  wallSlideSpeed: 180,
  wallJumpLockSeconds: 0.12,
  maxAirJumps: 1,
  coyoteSeconds: 0.11,
  jumpBufferSeconds: 0.12,
  respawnSeconds: 0.55,
  invulnerableSeconds: 1,
} as const;

const PLAYER_WIDTH = 46;
const PLAYER_HEIGHT = 64;
const CRUMBLE_DELAY = 0.42;
const CRUMBLE_RESET = 1.75;
const WALK_SPEED = 32;
const RUN_SPEED = 235;
const LAND_POSE_SECONDS = 0.13;
const TURN_POSE_SECONDS = 0.14;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const approach = (value: number, target: number, amount: number) => {
  if (value < target) return Math.min(value + amount, target);
  if (value > target) return Math.max(value - amount, target);
  return target;
};

const transitionAnimation = <Name extends string>(
  animation: AnimationState<Name>,
  name: Name,
  dt: number,
  cycleDelta = 0,
) => {
  if (animation.name !== name) {
    animation.name = name;
    animation.time = 0;
  } else {
    animation.time += dt;
  }
  animation.cycle += cycleDelta;
};

const selectPlayerAnimation = (state: GameState): PlayerAnimationName => {
  const player = state.player;
  if (state.mode === "respawning") return "hurt";
  if (player.grounded) {
    if (
      player.animation.name === "land" &&
      player.animation.time < LAND_POSE_SECONDS
    ) {
      return "land";
    }
    const speed = Math.abs(player.vx);
    if (speed >= RUN_SPEED) return "run";
    if (speed >= WALK_SPEED) return "walk";
    return "idle";
  }
  if (player.wallJumpLock > 0) return "wallJump";
  if (player.doubleJumpAccent > 0) return "doubleJump";
  if (player.wallNormal !== 0 && player.vy > 0) return "wallSlide";
  if (player.vy < -170) return "jump";
  if (player.vy < 170) return "apex";
  return "fall";
};

const updatePlayerAnimation = (
  state: GameState,
  dt: number,
  forced?: PlayerAnimationName,
) => {
  const player = state.player;
  const name = forced ?? selectPlayerAnimation(state);
  const locomotionDistance =
    name === "walk" || name === "run" ? Math.abs(player.vx) * dt : 0;
  transitionAnimation(player.animation, name, dt, locomotionDistance);
  if (name === "hurt" || name === "land") {
    player.animation.cycle = 0;
  }
};

const setEnemyAnimation = (
  enemy: EnemyState,
  name: EnemyAnimationName,
  dt: number,
  cycleDelta = 0,
) => transitionAnimation(enemy.animation, name, dt, cycleDelta);

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

export function getRuntimePlatforms(
  state: Pick<GameState, "elapsed" | "crumble">,
  level: LevelDefinition,
): Platform[] {
  const result: Platform[] = [];

  for (const platform of level.platforms) {
    const crumbleTime = state.crumble[platform.id];
    if (
      platform.kind === "crumble" &&
      crumbleTime !== undefined &&
      crumbleTime >= CRUMBLE_DELAY &&
      crumbleTime < CRUMBLE_RESET
    ) {
      continue;
    }

    if (platform.kind === "moving" && platform.travel) {
      const phase = platform.phase ?? 0;
      const speed = platform.speed ?? 0.7;
      const progress = (Math.sin(state.elapsed * speed * Math.PI * 2 + phase) + 1) / 2;
      result.push({
        ...platform,
        x: platform.x + platform.travel.x * progress,
        y: platform.y + platform.travel.y * progress,
      });
      continue;
    }

    result.push(platform);
  }

  return result;
}

export function createGame(level: LevelDefinition): GameState {
  return {
    mode: "playing",
    player: {
      x: level.spawn.x,
      y: level.spawn.y,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
      grounded: true,
      coyote: PHYSICS.coyoteSeconds,
      jumpBuffer: 0,
      wasJumpHeld: false,
      facing: 1,
      invulnerable: 0,
      supportPlatformId: null,
      airJumpsRemaining: PHYSICS.maxAirJumps,
      wallNormal: 0,
      wallJumpLock: 0,
      doubleJumpAccent: 0,
      animation: { name: "idle", time: 0, cycle: 0 },
    },
    enemies: level.enemies.map((enemy, index) => ({
      ...enemy,
      direction: index % 2 === 0 ? 1 : -1,
      phase: enemy.kind === "emberling" ? "patrol" : "idle",
      phaseTime: 0,
      alive: true,
      animation: {
        name: enemy.kind === "emberling" ? "walk" : "idle",
        time: 0,
        cycle: 0,
      },
    })),
    collected: [],
    activeCheckpoint: null,
    checkpointPosition: { ...level.spawn },
    elapsed: 0,
    respawnTimer: 0,
    finishEmitted: false,
    crumble: {},
  };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      animation: { ...state.player.animation },
    },
    enemies: state.enemies.map((enemy) => ({
      ...enemy,
      animation: { ...enemy.animation },
    })),
    collected: [...state.collected],
    checkpointPosition: { ...state.checkpointPosition },
    crumble: { ...state.crumble },
  };
}

function triggerRespawn(state: GameState, events: GameEvent[]) {
  if (state.mode === "respawning" || state.player.invulnerable > 0) return;
  state.mode = "respawning";
  state.respawnTimer = PHYSICS.respawnSeconds;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.supportPlatformId = null;
  state.player.wallNormal = 0;
  state.player.wallJumpLock = 0;
  state.player.doubleJumpAccent = 0;
  state.player.animation = { name: "hurt", time: 0, cycle: 0 };
  events.push({ type: "hurt" });
}

function updateCrumble(state: GameState, dt: number) {
  for (const [id, time] of Object.entries(state.crumble)) {
    const next = time + dt;
    if (next >= CRUMBLE_RESET) delete state.crumble[id];
    else state.crumble[id] = next;
  }
}

function updateEnemies(state: GameState, dt: number) {
  const playerCenter = state.player.x + state.player.width / 2;

  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      setEnemyAnimation(enemy, "defeated", dt);
      continue;
    }

    if (enemy.kind === "emberling") {
      let turned = false;
      enemy.x += enemy.direction * 54 * dt;
      if (enemy.x <= enemy.minX) {
        enemy.x = enemy.minX;
        enemy.direction = 1;
        turned = true;
      } else if (enemy.x >= enemy.maxX) {
        enemy.x = enemy.maxX;
        enemy.direction = -1;
        turned = true;
      }
      const turning =
        turned ||
        (enemy.animation.name === "turn" &&
          enemy.animation.time < TURN_POSE_SECONDS);
      setEnemyAnimation(enemy, turning ? "turn" : "walk", dt, 54 * dt);
      continue;
    }

    if (enemy.phase === "idle") {
      const enemyCenter = enemy.x + enemy.width / 2;
      const sameLane = Math.abs(state.player.y - enemy.y) < 150;
      if (sameLane && Math.abs(playerCenter - enemyCenter) < 380) {
        enemy.direction = playerCenter < enemyCenter ? -1 : 1;
        enemy.phase = "charge";
        enemy.phaseTime = 0.48;
      }
    } else {
      enemy.phaseTime -= dt;
      if (enemy.phase === "charge" && enemy.phaseTime <= 0) {
        enemy.phase = "dash";
        enemy.phaseTime = 0.72;
      } else if (enemy.phase === "dash") {
        enemy.x += enemy.direction * 330 * dt;
        if (
          enemy.x <= enemy.minX ||
          enemy.x >= enemy.maxX ||
          enemy.phaseTime <= 0
        ) {
          enemy.x = clamp(enemy.x, enemy.minX, enemy.maxX);
          enemy.phase = "recover";
          enemy.phaseTime = 0.72;
        }
      } else if (enemy.phase === "recover" && enemy.phaseTime <= 0) {
        enemy.phase = "idle";
        enemy.phaseTime = 0;
      }
    }

    const animationName: EnemyAnimationName =
      enemy.phase === "charge"
        ? "charge"
        : enemy.phase === "dash"
          ? "dash"
          : enemy.phase === "recover"
            ? "recover"
            : "idle";
    setEnemyAnimation(
      enemy,
      animationName,
      dt,
      animationName === "dash" ? 330 * dt : 0,
    );
  }
}

function resolveHorizontal(
  player: PlayerState,
  platforms: Platform[],
  dt: number,
): -1 | 0 | 1 {
  const previousX = player.x;
  player.x += player.vx * dt;
  let wallNormal: -1 | 0 | 1 = 0;

  for (const platform of platforms) {
    const vertical =
      player.y + player.height > platform.y + 2 &&
      player.y < platform.y + platform.height - 2;
    if (!vertical) continue;

    if (overlaps(player, platform)) {
      const previousRight = previousX + player.width;
      const platformRight = platform.x + platform.width;
      if (player.vx > 0 || previousRight <= platform.x + 2) {
        player.x = platform.x - player.width;
        wallNormal = -1;
      } else if (player.vx < 0 || previousX >= platformRight - 2) {
        player.x = platformRight;
        wallNormal = 1;
      }
      player.vx = 0;
      continue;
    }

    const rightGap = Math.abs(player.x + player.width - platform.x);
    const leftGap = Math.abs(player.x - (platform.x + platform.width));
    if (rightGap <= 2) wallNormal = -1;
    else if (leftGap <= 2) wallNormal = 1;
  }

  player.x = clamp(player.x, 0, WORLD_WIDTH - player.width);
  if (player.x === 0) wallNormal = 1;
  else if (player.x === WORLD_WIDTH - player.width) wallNormal = -1;
  return wallNormal;
}

function resolveVertical(
  state: GameState,
  previousPlatforms: Platform[],
  platforms: Platform[],
  dt: number,
  events: GameEvent[],
): boolean {
  const player = state.player;
  const previousY = player.y;
  const previousBottom = previousY + player.height;
  const wasGrounded = player.grounded;
  const previousSupportId = player.supportPlatformId;
  player.y += player.vy * dt;
  player.grounded = false;
  player.supportPlatformId = null;

  let landingPlatform: Platform | null = null;

  for (const platform of platforms) {
    const horizontal =
      player.x + player.width > platform.x + 3 &&
      player.x < platform.x + platform.width - 3;
    if (!horizontal) continue;

    const previousPlatform = previousPlatforms.find(
      (candidate) => candidate.id === platform.id,
    );
    const relativeCrossedTop = Boolean(
      previousPlatform &&
        previousBottom <= previousPlatform.y + 2 &&
        player.y + player.height >= platform.y,
    );
    const carriedAcrossTop =
      previousSupportId === platform.id &&
      previousBottom <= platform.y + 2 &&
      player.y + player.height >= platform.y;

    if (relativeCrossedTop || carriedAcrossTop) {
      if (!landingPlatform || platform.y < landingPlatform.y) landingPlatform = platform;
    }
  }

  if (landingPlatform) {
    const impactSpeed = player.vy;
    player.y = landingPlatform.y - player.height;
    player.vy = 0;
    player.grounded = true;
    player.supportPlatformId = landingPlatform.id;
    player.airJumpsRemaining = PHYSICS.maxAirJumps;
    player.doubleJumpAccent = 0;
    player.coyote = PHYSICS.coyoteSeconds;
    if (!wasGrounded && impactSpeed > 220) events.push({ type: "land" });
    if (
      landingPlatform.kind === "crumble" &&
      state.crumble[landingPlatform.id] === undefined
    ) {
      state.crumble[landingPlatform.id] = 0;
    }
  } else if (player.vy < 0) {
    for (const platform of platforms) {
      const horizontal =
        player.x + player.width > platform.x + 3 &&
        player.x < platform.x + platform.width - 3;
      const platformBottom = platform.y + platform.height;
      const crossedBottom =
        previousY >= platformBottom - 6 && player.y <= platformBottom;
      if (horizontal && crossedBottom) {
        player.y = platformBottom;
        player.vy = 0;
        break;
      }
    }
  }
  return Boolean(landingPlatform && !wasGrounded);
}

export function setPaused(state: GameState, paused: boolean): GameState {
  if (paused && state.mode === "playing") return { ...state, mode: "paused" };
  if (!paused && state.mode === "paused") return { ...state, mode: "playing" };
  return state;
}

export function stepGame(
  source: GameState,
  input: InputState,
  requestedDt: number,
  level: LevelDefinition,
): StepResult {
  const state = cloneState(source);
  const events: GameEvent[] = [];
  const dt = clamp(requestedDt, 0, 1 / 30);

  if (dt === 0 || state.mode === "paused" || state.mode === "finished") {
    return { state, events };
  }

  if (state.mode === "respawning") {
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) {
      state.mode = "playing";
      state.player.x = state.checkpointPosition.x;
      state.player.y = state.checkpointPosition.y;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.grounded = false;
      state.player.invulnerable = PHYSICS.invulnerableSeconds;
      state.player.supportPlatformId = null;
      state.player.airJumpsRemaining = PHYSICS.maxAirJumps;
      state.player.wallNormal = 0;
      state.player.wallJumpLock = 0;
      state.player.doubleJumpAccent = 0;
    }
    updatePlayerAnimation(state, dt);
    return { state, events };
  }

  const previousElapsed = state.elapsed;
  state.elapsed += dt;
  state.player.invulnerable = Math.max(0, state.player.invulnerable - dt);
  state.player.doubleJumpAccent = Math.max(
    0,
    state.player.doubleJumpAccent - dt,
  );
  updateCrumble(state, dt);

  const player = state.player;
  let forcedPlayerAnimation: PlayerAnimationName | undefined;
  const previousPlatforms = getRuntimePlatforms(
    { elapsed: previousElapsed, crumble: state.crumble },
    level,
  );
  const platforms = getRuntimePlatforms(state, level);
  if (player.supportPlatformId) {
    const previousSupport = previousPlatforms.find(
      (platform) => platform.id === player.supportPlatformId,
    );
    const currentSupport = platforms.find(
      (platform) => platform.id === player.supportPlatformId,
    );
    if (previousSupport && currentSupport) {
      player.x += currentSupport.x - previousSupport.x;
      player.y += currentSupport.y - previousSupport.y;
    } else {
      player.supportPlatformId = null;
      player.grounded = false;
    }
  }
  const previousPlayerBottom = player.y + player.height;
  const direction = Number(input.right) - Number(input.left);
  const acceleration = player.grounded
    ? PHYSICS.runAcceleration
    : PHYSICS.airAcceleration;

  player.wallJumpLock = Math.max(0, player.wallJumpLock - dt);
  if (direction !== 0 && player.wallJumpLock === 0) {
    player.vx = clamp(
      player.vx + direction * acceleration * dt,
      -PHYSICS.maxRunSpeed,
      PHYSICS.maxRunSpeed,
    );
    player.facing = direction < 0 ? -1 : 1;
  } else if (player.wallJumpLock === 0) {
    player.vx = approach(player.vx, 0, PHYSICS.friction * dt);
  }

  const jumpPressed =
    Boolean(input.jumpPressed) || (input.jump && !player.wasJumpHeld);
  if (jumpPressed) {
    player.jumpBuffer = PHYSICS.jumpBufferSeconds;
  } else {
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  }
  player.wasJumpHeld = input.jump;

  if (player.grounded) player.coyote = PHYSICS.coyoteSeconds;
  else player.coyote = Math.max(0, player.coyote - dt);

  const wallProbe = { ...player };
  const availableWallNormal = resolveHorizontal(wallProbe, platforms, dt);
  if (availableWallNormal !== 0) player.wallNormal = availableWallNormal;

  if (jumpPressed && !player.grounded && player.wallNormal !== 0) {
    player.vx = player.wallNormal * PHYSICS.wallJumpHorizontalSpeed;
    player.vy = -PHYSICS.wallJumpSpeed;
    player.facing = player.wallNormal;
    player.wallJumpLock = PHYSICS.wallJumpLockSeconds;
    player.doubleJumpAccent = 0;
    player.jumpBuffer = 0;
    player.supportPlatformId = null;
    forcedPlayerAnimation = "wallJump";
    events.push({ type: "jump" });
  } else if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -PHYSICS.jumpSpeed;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.supportPlatformId = null;
    forcedPlayerAnimation = "jump";
    events.push({ type: "jump" });
  } else if (
    jumpPressed &&
    !player.grounded &&
    player.airJumpsRemaining > 0
  ) {
    player.vy = -PHYSICS.doubleJumpSpeed;
    player.airJumpsRemaining -= 1;
    player.doubleJumpAccent = 0.14;
    player.jumpBuffer = 0;
    player.supportPlatformId = null;
    forcedPlayerAnimation = "doubleJump";
    events.push({ type: "jump" });
  }

  const gravityMultiplier = !input.jump && player.vy < 0 ? 1.75 : 1;
  player.vy += PHYSICS.gravity * gravityMultiplier * dt;

  player.wallNormal = resolveHorizontal(player, platforms, dt);
  if (
    !player.grounded &&
    player.wallNormal !== 0 &&
    player.vy > PHYSICS.wallSlideSpeed
  ) {
    player.vy = PHYSICS.wallSlideSpeed;
  }
  const landed = resolveVertical(
    state,
    previousPlatforms,
    platforms,
    dt,
    events,
  );
  if (landed) forcedPlayerAnimation = "land";
  updateEnemies(state, dt);

  for (const enemy of state.enemies) {
    if (!enemy.alive || !overlaps(player, enemy)) continue;

    const stomped =
      player.vy >= 0 &&
      previousPlayerBottom <= enemy.y + 18 &&
      player.y + player.height >= enemy.y;

    if (stomped) {
      enemy.alive = false;
      enemy.animation = { name: "defeated", time: 0, cycle: 0 };
      player.y = enemy.y - player.height;
      player.vy = -420;
      forcedPlayerAnimation = "jump";
      events.push({ type: "stomp" });
    } else {
      triggerRespawn(state, events);
      break;
    }
  }

  if (state.mode === "playing") {
    for (const hazard of level.hazards) {
      if (overlaps(player, hazard)) {
        triggerRespawn(state, events);
        break;
      }
    }
  }

  if (state.mode === "playing" && player.y > WORLD_HEIGHT + 120) {
    triggerRespawn(state, events);
  }

  if (state.mode === "playing") {
    const collected = new Set(state.collected);
    for (const star of level.stars) {
      if (collected.has(star.id)) continue;
      const starRect = { x: star.x - 18, y: star.y - 18, width: 36, height: 36 };
      if (overlaps(player, starRect)) {
        collected.add(star.id);
        events.push({ type: "star", id: star.id });
      }
    }
    state.collected = [...collected];

    for (const checkpoint of level.checkpoints) {
      if (state.activeCheckpoint === checkpoint.id || !overlaps(player, checkpoint)) continue;
      state.activeCheckpoint = checkpoint.id;
      state.checkpointPosition = {
        x: checkpoint.x + 8,
        y: checkpoint.y - player.height,
      };
      events.push({ type: "checkpoint" });
    }

    if (overlaps(player, level.finish) && !state.finishEmitted) {
      state.mode = "finished";
      state.finishEmitted = true;
      player.vx = 0;
      player.vy = 0;
      events.push({ type: "finish" });
    }
  }

  updatePlayerAnimation(
    state,
    dt,
    state.player.animation.name === "hurt" ? "hurt" : forcedPlayerAnimation,
  );
  return { state, events };
}
