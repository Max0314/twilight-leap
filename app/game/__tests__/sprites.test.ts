import { describe, expect, it } from "vitest";

import {
  BEETLE_CLIPS,
  HERO_CLIPS,
  SPRITE_SHEET_PATHS,
  frameFromClip,
} from "../sprites";
import { PHYSICS } from "../simulation";

describe("sprite sheets", () => {
  it("keeps every runtime sheet under the public sprite root", () => {
    for (const path of Object.values(SPRITE_SHEET_PATHS)) {
      expect(path.startsWith("/assets/sprites/")).toBe(true);
      expect(path.endsWith(".png")).toBe(true);
    }
  });

  it("content-fingerprints the frequently revised run sheet", () => {
    expect(SPRITE_SHEET_PATHS.heroRun).toMatch(
      /\/hero-run-[a-f0-9]{8}\.png$/,
    );
  });

  it("advances running at a readable distance-driven cadence", () => {
    const first = frameFromClip(HERO_CLIPS.run, 0, 0);
    const beforeNextBeat = frameFromClip(HERO_CLIPS.run, 0, 21.874);
    const next = frameFromClip(HERO_CLIPS.run, 0, 21.875);
    expect(first.sheet).toBe("heroRun");
    expect(HERO_CLIPS.run.count).toBe(16);
    expect(beforeNextBeat.index).toBe(first.index);
    expect(next.index).not.toBe(first.index);
    expect(
      PHYSICS.maxRunSpeed / HERO_CLIPS.run.distancePerFrame,
    ).toBe(16);
  });

  it("holds the final frame of non-looping actions", () => {
    const death = frameFromClip(BEETLE_CLIPS.death, 99);
    expect(death.index).toBe(
      BEETLE_CLIPS.death.start + BEETLE_CLIPS.death.count - 1,
    );
  });
});
