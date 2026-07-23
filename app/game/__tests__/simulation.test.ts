import { describe, expect, it } from "vitest";

import { LEVEL } from "../level";
import {
  PHYSICS,
  createGame,
  getRuntimePlatforms,
  setPaused,
  stepGame,
} from "../simulation";
import type { LevelDefinition } from "../types";

const idle = { left: false, right: false, jump: false };

const isolatedLevel = (platforms: LevelDefinition["platforms"]): LevelDefinition => ({
  spawn: { x: 0, y: 0 },
  platforms,
  hazards: [],
  stars: [],
  checkpoints: [],
  enemies: [],
  finish: { x: 10_000, y: 0, width: 10, height: 10 },
});

describe("simulation", () => {
  it("moves and jumps from a platform", () => {
    let state = createGame(LEVEL);

    for (let index = 0; index < 30; index += 1) {
      state = stepGame(
        state,
        { left: false, right: true, jump: false },
        1 / 60,
        LEVEL,
      ).state;
    }

    const movedX = state.player.x;
    state = stepGame(
      state,
      { left: false, right: true, jump: true },
      1 / 60,
      LEVEL,
    ).state;

    expect(movedX).toBeGreaterThan(LEVEL.spawn.x);
    expect(state.player.vy).toBeLessThan(0);
  });

  it("collects a star exactly once", () => {
    const state = createGame(LEVEL);
    state.player.x = LEVEL.stars[0].x - state.player.width / 2;
    state.player.y = LEVEL.stars[0].y - state.player.height / 2;

    let result = stepGame(state, idle, 1 / 60, LEVEL);
    expect(result.state.collected).toContain(LEVEL.stars[0].id);
    expect(result.events.filter((event) => event.type === "star")).toHaveLength(1);

    result = stepGame(result.state, idle, 1 / 60, LEVEL);
    expect(result.events.filter((event) => event.type === "star")).toHaveLength(0);
  });

  it("stomps an emberling but takes damage from the side", () => {
    const enemySeed = LEVEL.enemies.find((enemy) => enemy.kind === "emberling")!;

    const stomp = createGame(LEVEL);
    stomp.player.x = enemySeed.x + 4;
    stomp.player.y = enemySeed.y - stomp.player.height - 1;
    stomp.player.vy = 220;
    const stomped = stepGame(stomp, idle, 1 / 60, LEVEL);
    expect(stomped.events.some((event) => event.type === "stomp")).toBe(true);

    const hurt = createGame(LEVEL);
    hurt.player.x = enemySeed.x + 6;
    hurt.player.y = enemySeed.y + 2;
    const damaged = stepGame(hurt, idle, 1 / 60, LEVEL);
    expect(damaged.state.mode).toBe("respawning");
  });

  it("honors coyote time and a buffered landing jump", () => {
    const coyote = createGame(LEVEL);
    coyote.player.grounded = false;
    coyote.player.coyote = 0.08;
    coyote.player.y = 400;
    const coyoteJump = stepGame(
      coyote,
      { ...idle, jump: true },
      1 / 60,
      LEVEL,
    ).state;
    expect(coyoteJump.player.vy).toBeLessThan(0);

    let buffered = createGame(LEVEL);
    buffered.player.grounded = false;
    buffered.player.coyote = 0;
    buffered.player.y = 654;
    buffered.player.vy = 300;
    buffered = stepGame(
      buffered,
      { ...idle, jump: true },
      1 / 60,
      LEVEL,
    ).state;
    buffered = stepGame(
      buffered,
      { ...idle, jump: true },
      1 / 60,
      LEVEL,
    ).state;
    expect(buffered.player.vy).toBeLessThan(0);
  });

  it("activates the checkpoint and respawns there", () => {
    const checkpoint = LEVEL.checkpoints[0];
    const state = createGame(LEVEL);
    state.player.x = checkpoint.x;
    state.player.y = checkpoint.y;
    let result = stepGame(state, idle, 1 / 60, LEVEL);
    expect(result.state.activeCheckpoint).toBe(checkpoint.id);

    result.state.player.y = 1_100;
    result = stepGame(result.state, idle, 1 / 60, LEVEL);
    expect(result.state.mode).toBe("respawning");

    for (let index = 0; index < 40; index += 1) {
      result = stepGame(result.state, idle, 1 / 60, LEVEL);
    }
    expect(result.state.mode).toBe("playing");
    expect(result.state.player.x).toBe(checkpoint.x + 8);
  });

  it("telegraphs a beetle dash before it moves", () => {
    const beetleSeed = LEVEL.enemies.find((enemy) => enemy.kind === "beetle")!;
    const state = createGame(LEVEL);
    state.player.x = beetleSeed.x - 180;
    state.player.y = beetleSeed.y - state.player.height;
    const result = stepGame(state, idle, 1 / 60, LEVEL);
    const beetle = result.state.enemies.find((enemy) => enemy.id === beetleSeed.id)!;
    expect(beetle.phase).toBe("charge");
    expect(beetle.x).toBe(beetleSeed.x);
  });

  it("freezes time while paused", () => {
    const paused = setPaused(createGame(LEVEL), true);
    const result = stepGame(paused, idle, 1 / 30, LEVEL);
    expect(result.state.elapsed).toBe(0);
    expect(result.state.mode).toBe("paused");
  });

  it("finishes and emits the finish event only once", () => {
    const state = createGame(LEVEL);
    state.player.x = LEVEL.finish.x;
    state.player.y = LEVEL.finish.y;
    let result = stepGame(state, idle, 1 / 60, LEVEL);
    expect(result.state.mode).toBe("finished");
    expect(result.events.filter((event) => event.type === "finish")).toHaveLength(1);

    result = stepGame(result.state, idle, 1 / 60, LEVEL);
    expect(result.events.filter((event) => event.type === "finish")).toHaveLength(0);
  });

  it("carries a grounded rider through the fastest part of a vertical lift", () => {
    const level = isolatedLevel([
      {
        id: "test-lift",
        kind: "moving",
        x: 200,
        y: 620,
        width: 220,
        height: 28,
        travel: { x: 0, y: -120 },
        speed: 0.75,
        phase: Math.PI,
      },
    ]);
    const state = createGame(level);
    const lift = getRuntimePlatforms(state, level)[0];
    state.player.x = lift.x + 40;
    state.player.y = lift.y - state.player.height;
    state.player.grounded = true;
    Object.assign(state.player, { supportPlatformId: lift.id });

    const result = stepGame(state, idle, 1 / 60, level);
    const movedLift = getRuntimePlatforms(result.state, level)[0];

    expect(result.state.player.grounded).toBe(true);
    expect(result.state.player.y + result.state.player.height).toBeCloseTo(movedLift.y, 4);
  });

  it("lands on a fast rising lift using relative platform motion", () => {
    const level = isolatedLevel([
      {
        id: "rising-lift",
        kind: "moving",
        x: 200,
        y: 620,
        width: 220,
        height: 28,
        travel: { x: 0, y: -120 },
        speed: 0.75,
        phase: 0,
      },
    ]);
    const state = createGame(level);
    const lift = getRuntimePlatforms(state, level)[0];
    state.player.x = lift.x + 50;
    state.player.y = lift.y - state.player.height;
    state.player.vy = 30;
    state.player.grounded = false;
    state.player.coyote = 0;

    const result = stepGame(state, idle, 1 / 30, level);
    const movedLift = getRuntimePlatforms(result.state, level)[0];

    expect(result.state.player.grounded).toBe(true);
    expect(result.state.player.y + result.state.player.height).toBeCloseTo(movedLift.y, 4);
  });

  it("is caught when a rising lift overtakes an upward-moving player", () => {
    const level = isolatedLevel([
      {
        id: "overtaking-lift",
        kind: "moving",
        x: 200,
        y: 620,
        width: 220,
        height: 28,
        travel: { x: 0, y: -120 },
        speed: 0.75,
        phase: 0,
      },
    ]);
    const state = createGame(level);
    const lift = getRuntimePlatforms(state, level)[0];
    state.player.x = lift.x + 50;
    state.player.y = lift.y - state.player.height;
    state.player.vy = -100;
    state.player.grounded = false;
    state.player.coyote = 0;

    const result = stepGame(state, idle, 1 / 60, level);
    const movedLift = getRuntimePlatforms(result.state, level)[0];

    expect(result.state.player.grounded).toBe(true);
    expect(result.state.player.y + result.state.player.height).toBeCloseTo(movedLift.y, 4);
  });

  it("allows exactly one fresh-press double jump before landing", () => {
    let state = createGame(LEVEL);
    state = stepGame(state, { ...idle, jump: true }, 1 / 60, LEVEL).state;
    state = stepGame(state, idle, 1 / 60, LEVEL).state;

    const second = stepGame(state, { ...idle, jump: true }, 1 / 60, LEVEL);
    expect(second.events.some((event) => event.type === "jump")).toBe(true);
    expect(second.state.player.vy).toBeLessThan(-PHYSICS.jumpSpeed * 0.7);

    state = stepGame(second.state, idle, 1 / 60, LEVEL).state;
    const beforeThird = state.player.vy;
    const third = stepGame(state, { ...idle, jump: true }, 1 / 60, LEVEL);
    expect(third.events.some((event) => event.type === "jump")).toBe(false);
    expect(third.state.player.vy).toBeGreaterThan(beforeThird);
  });

  it("honors an explicitly latched jump edge while the button is held", () => {
    let state = createGame(LEVEL);
    state = stepGame(state, { ...idle, jump: true }, 1 / 60, LEVEL).state;

    const result = stepGame(
      state,
      { ...idle, jump: true, jumpPressed: true },
      1 / 60,
      LEVEL,
    );

    expect(result.events.some((event) => event.type === "jump")).toBe(true);
    expect(result.state.player.airJumpsRemaining).toBe(0);
  });

  it("slides down a wall and jumps away from it", () => {
    const level = isolatedLevel([
      { id: "wall", kind: "stone", x: 300, y: 100, width: 100, height: 700 },
    ]);
    let state = createGame(level);
    state.player.x = 300 - state.player.width + 1;
    state.player.y = 300;
    state.player.vx = 180;
    state.player.vy = 520;
    state.player.grounded = false;
    state.player.coyote = 0;

    state = stepGame(state, { ...idle, right: true }, 1 / 60, level).state;
    expect(state.player.vy).toBeLessThanOrEqual(190);

    const jumped = stepGame(
      state,
      { left: false, right: true, jump: true },
      1 / 60,
      level,
    );
    expect(jumped.events.some((event) => event.type === "jump")).toBe(true);
    expect(jumped.state.player.vx).toBeLessThan(0);
    expect(jumped.state.player.vy).toBeLessThan(0);
  });

  it.each([0, 1])(
    "prioritizes a wall jump when reaching the wall on the jump frame with %i air jumps",
    (airJumpsRemaining) => {
      const level = isolatedLevel([
        { id: "arrival-wall", kind: "stone", x: 300, y: 100, width: 100, height: 700 },
      ]);
      const state = createGame(level);
      state.player.x = 300 - state.player.width - 2;
      state.player.y = 300;
      state.player.vx = 120;
      state.player.vy = 240;
      state.player.grounded = false;
      state.player.coyote = 0;
      state.player.wallNormal = 0;
      state.player.airJumpsRemaining = airJumpsRemaining;

      const result = stepGame(
        state,
        { left: false, right: true, jump: true },
        1 / 60,
        level,
      );

      expect(result.events.some((event) => event.type === "jump")).toBe(true);
      expect(result.state.player.vx).toBeLessThan(0);
      expect(result.state.player.vy).toBeLessThan(0);
      expect(result.state.player.airJumpsRemaining).toBe(airJumpsRemaining);
    },
  );

  it("prioritizes a same-frame wall jump over remaining coyote time", () => {
    const level = isolatedLevel([
      { id: "coyote-wall", kind: "stone", x: 300, y: 100, width: 100, height: 700 },
    ]);
    const state = createGame(level);
    state.player.x = 300 - state.player.width - 2;
    state.player.y = 300;
    state.player.vx = 120;
    state.player.vy = 240;
    state.player.grounded = false;
    state.player.coyote = 0.05;

    const result = stepGame(
      state,
      { left: false, right: true, jump: true },
      1 / 60,
      level,
    );

    expect(result.state.player.vx).toBeLessThan(0);
    expect(result.state.player.wallJumpLock).toBeGreaterThan(0);
  });
});
