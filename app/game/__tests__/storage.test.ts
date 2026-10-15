import { describe, expect, it } from "vitest";

import { createAccountAdapter, loadPrefs, savePrefs, updateRecords } from "../storage";

describe("storage", () => {
  it("keeps guest records and account preferences in separate namespaces", () => {
    const rows = new Map<string, string>();
    const storage = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
    const adapter = createAccountAdapter(storage, () => {});
    const guest = { version: 2 as const, sound: true, screenShake: false, bestTime: 90, bestStars: 8 };
    savePrefs(guest, storage);
    adapter.setAccount("a".repeat(43));
    expect(loadPrefs(storage).bestTime).toBeNull();
    expect(adapter.captureGuest()).toEqual(guest);
    savePrefs({ ...guest, bestTime: 70, bestStars: 10 }, storage);
    adapter.setAccount("b".repeat(43));
    expect(loadPrefs(storage).bestStars).toBe(0);
    expect(() => adapter.restoreAccount(guest, "a".repeat(43))).toThrow();
    adapter.restoreAccount({ ...guest, bestTime: 50, bestStars: 12 }, "b".repeat(43));
    expect(loadPrefs(storage).bestTime).toBe(50);
    adapter.setAccount("a".repeat(43)); expect(loadPrefs(storage).bestTime).toBe(70);
    adapter.setAccount(null); expect(loadPrefs(storage)).toEqual(guest);
  });
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
      version: 2,
      sound: true,
      screenShake: true,
      bestTime: null,
      bestStars: 0,
    });
    expect(() =>
      savePrefs(
        {
          version: 2,
          sound: false,
          screenShake: false,
          bestTime: 72,
          bestStars: 10,
        },
        broken,
      ),
    ).not.toThrow();
  });

  it("migrates existing records and enables screen shake by default", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          version: 1,
          sound: false,
          bestTime: 72,
          bestStars: 10,
        }),
      setItem: () => undefined,
    };

    expect(loadPrefs(storage)).toEqual({
      version: 2,
      sound: false,
      screenShake: true,
      bestTime: 72,
      bestStars: 10,
    });
  });

  it("keeps the fastest time and highest star count", () => {
    const next = updateRecords(
      {
        version: 2,
        sound: true,
        screenShake: false,
        bestTime: 80,
        bestStars: 9,
      },
      95,
      12,
    );
    expect(next.bestTime).toBe(80);
    expect(next.bestStars).toBe(12);
    expect(next.screenShake).toBe(false);
  });
});
