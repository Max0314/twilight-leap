import { describe, expect, it } from "vitest";

import { loadPrefs, savePrefs, updateRecords } from "../storage";

describe("storage", () => {
  it("falls back when storage is unavailable", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(loadPrefs(broken)).toEqual({
      version: 1,
      sound: true,
      bestTime: null,
      bestStars: 0,
    });
    expect(() =>
      savePrefs(
        { version: 1, sound: false, bestTime: 72, bestStars: 10 },
        broken,
      ),
    ).not.toThrow();
  });

  it("keeps the fastest time and highest star count", () => {
    const next = updateRecords(
      { version: 1, sound: true, bestTime: 80, bestStars: 9 },
      95,
      12,
    );
    expect(next.bestTime).toBe(80);
    expect(next.bestStars).toBe(12);
  });
});
