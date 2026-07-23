import { describe, expect, it } from "vitest";

import * as renderer from "../renderer";

const { ATLAS_FRAMES, GAME_ATLAS_SIZE } = renderer;
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

  it("builds aspect-correct hero poses from simulation time and a bottom-center anchor", async () => {
    expect(atlasApi.getHeroPose).toBeTypeOf("function");
    if (!atlasApi.getHeroPose) return;

    const { LEVEL } = await import("../level");
    const { createGame } = await import("../simulation");
    const state = createGame(LEVEL);
    state.player.vx = 300;
    state.player.grounded = true;
    state.elapsed = 0.12;

    const first = atlasApi.getHeroPose(state);
    state.elapsed = 0.24;
    const second = atlasApi.getHeroPose(state);

    expect(first.width / first.height).toBeCloseTo(
      first.frame.width / first.frame.height,
      5,
    );
    expect(first.anchorX).toBe(state.player.x + state.player.width / 2);
    expect(first.anchorY).toBe(state.player.y + state.player.height + 8);
    expect(second.frame).not.toBe(first.frame);
  });

  it("keeps double-jump and wall-jump accents brief and distinct", async () => {
    expect(atlasApi.getHeroPose).toBeTypeOf("function");
    if (!atlasApi.getHeroPose) return;

    const { LEVEL } = await import("../level");
    const { createGame } = await import("../simulation");
    const state = createGame(LEVEL);
    state.player.grounded = false;
    state.player.vy = -500;

    state.player.doubleJumpAccent = 0.1;
    const doubleJump = atlasApi.getHeroPose(state);
    state.player.doubleJumpAccent = 0;
    state.player.wallJumpLock = 0.1;
    const wallJump = atlasApi.getHeroPose(state);
    state.player.wallJumpLock = 0;
    const ordinaryJump = atlasApi.getHeroPose(state);

    expect(doubleJump.height).toBeGreaterThan(ordinaryJump.height);
    expect(Math.abs(wallJump.rotation)).toBeGreaterThan(Math.abs(ordinaryJump.rotation));
  });
});
