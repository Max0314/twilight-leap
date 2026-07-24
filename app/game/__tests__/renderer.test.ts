import { describe, expect, it } from "vitest";

import * as renderer from "../renderer";

const {
  ATLAS_FRAMES,
  GAME_ATLAS_SIZE,
  getEnemyPose,
  getHeroPose,
  getScreenShakeStrength,
} = renderer;
const atlasApi = renderer as typeof renderer & {
  isAtlasReady?: (
    atlas: Pick<HTMLImageElement, "complete" | "naturalWidth" | "naturalHeight"> | null,
  ) => boolean;
  getHeroPose?: (state: import("../simulation").GameState) => {
    frame: { width: number; height: number };
    width: number;
    height: number;
    anchorX: number;
    anchorY: number;
    rotation: number;
  };
};

describe("renderer atlas map", () => {
  it("keeps every production-art crop inside the generated atlas", () => {
    for (const [name, frame] of Object.entries(ATLAS_FRAMES)) {
      expect(frame.x, name).toBeGreaterThanOrEqual(0);
      expect(frame.y, name).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.width, name).toBeLessThanOrEqual(GAME_ATLAS_SIZE);
      expect(frame.y + frame.height, name).toBeLessThanOrEqual(GAME_ATLAS_SIZE);
    }
  });

  it("rejects incomplete and failed atlas images before drawing", () => {
    expect(atlasApi.isAtlasReady).toBeTypeOf("function");
    if (!atlasApi.isAtlasReady) return;

    expect(
      atlasApi.isAtlasReady({ complete: false, naturalWidth: 1_254, naturalHeight: 1_254 }),
    ).toBe(false);
    expect(
      atlasApi.isAtlasReady({ complete: true, naturalWidth: 0, naturalHeight: 0 }),
    ).toBe(false);
    expect(
      atlasApi.isAtlasReady({ complete: true, naturalWidth: 1_254, naturalHeight: 1_254 }),
    ).toBe(true);
  });

  it("builds a complete distance-driven run cycle with a bottom-center anchor", async () => {
    const { LEVEL } = await import("../level");
    const { createGame } = await import("../simulation");
    const state = createGame(LEVEL);
    state.player.vx = 300;
    state.player.grounded = true;
    state.player.animation = { name: "run", time: 0.12, cycle: 0 };

    const first = getHeroPose(state);
    state.elapsed = 20;
    const sameDistance = getHeroPose(state);
    state.player.animation.cycle = 21;
    const nextBeat = getHeroPose(state);

    expect(first.width / first.height).toBeCloseTo(
      first.frame.width / first.frame.height,
      5,
    );
    expect(first.anchorX).toBe(state.player.x + state.player.width / 2);
    expect(first.anchorY).toBe(state.player.y + state.player.height + 8);
    expect(first.animation).toBe("run");
    expect(sameDistance.frame).toBe(first.frame);
    expect(nextBeat.frame).not.toBe(first.frame);
  });

  it("keeps jump, double-jump, wall-slide, and landing poses distinct", async () => {
    const { LEVEL } = await import("../level");
    const { createGame } = await import("../simulation");
    const state = createGame(LEVEL);
    state.player.grounded = false;
    state.player.vy = -500;

    state.player.animation = { name: "jump", time: 0.08, cycle: 0 };
    const jump = getHeroPose(state);
    state.player.animation = { name: "doubleJump", time: 0.03, cycle: 0 };
    const doubleJump = getHeroPose(state);
    state.player.animation = { name: "wallSlide", time: 0.1, cycle: 0 };
    state.player.wallNormal = -1;
    const wallSlide = getHeroPose(state);
    state.player.animation = { name: "land", time: 0.02, cycle: 0 };
    const land = getHeroPose(state);

    expect(jump.animation).toBe("jump");
    expect(doubleJump.frame).not.toBe(jump.frame);
    expect(Math.abs(wallSlide.rotation)).toBeGreaterThan(Math.abs(jump.rotation));
    expect(land.animation).toBe("land");
  });

  it("maps monster state machines to animated poses and defeat fades", async () => {
    const { LEVEL } = await import("../level");
    const { createGame } = await import("../simulation");
    const state = createGame(LEVEL);
    const ember = state.enemies.find((enemy) => enemy.kind === "emberling")!;
    const beetle = state.enemies.find((enemy) => enemy.kind === "beetle")!;

    ember.animation = { name: "walk", time: 0.1, cycle: 0 };
    const emberStepA = getEnemyPose(ember);
    ember.animation.cycle = 10;
    const emberStepB = getEnemyPose(ember);
    expect(emberStepB.frame).not.toBe(emberStepA.frame);

    beetle.animation = { name: "charge", time: 0.2, cycle: 0 };
    expect(getEnemyPose(beetle).frame).toBe(ATLAS_FRAMES.beetleCharge);
    beetle.animation = { name: "dash", time: 0.1, cycle: 20 };
    expect(getEnemyPose(beetle).frame).toBe(ATLAS_FRAMES.beetleDash);
    beetle.animation = { name: "defeated", time: 0.3, cycle: 0 };
    expect(getEnemyPose(beetle).alpha).toBeLessThan(1);
  });

  it("fully disables screen shake without suppressing impact bursts", () => {
    const bursts = [
      { id: 1, type: "hurt" as const, x: 0, y: 0, age: 0.1 },
    ];
    expect(getScreenShakeStrength(bursts, false, true)).toBeGreaterThan(0);
    expect(getScreenShakeStrength(bursts, false, false)).toBe(0);
    expect(getScreenShakeStrength(bursts, true, true)).toBe(0);
  });
});
