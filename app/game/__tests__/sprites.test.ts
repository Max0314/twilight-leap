import { describe, expect, it } from "vitest";

import {
  BEETLE_CLIPS,
  HERO_CLIPS,
  SPRITE_SHEET_PATHS,
  frameFromClip,
} from "../sprites";

describe("sprite sheets", () => {
  it("keeps every runtime sheet under the public sprite root", () => {
    for (const path of Object.values(SPRITE_SHEET_PATHS)) {
      expect(path.startsWith("/assets/sprites/")).toBe(true);
      expect(path.endsWith(".png")).toBe(true);
    }
  });

  it("advances looping locomotion from distance", () => {
    const first = frameFromClip(HERO_CLIPS.run, 0, 0);
    const next = frameFromClip(HERO_CLIPS.run, 0, 20);
    expect(first.sheet).toBe("heroLocomotion");
    expect(next.index).not.toBe(first.index);
  });

  it("holds the final frame of non-looping actions", () => {
    const death = frameFromClip(BEETLE_CLIPS.death, 99);
    expect(death.index).toBe(
      BEETLE_CLIPS.death.start + BEETLE_CLIPS.death.count - 1,
    );
  });
});
