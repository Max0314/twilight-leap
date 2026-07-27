import { describe, expect, it, vi } from "vitest";

import {
  cancelHaptics,
  getHapticPattern,
  playHaptic,
} from "../feedback";

describe("impact feedback", () => {
  it("maps gameplay impacts to bounded vibration patterns", () => {
    expect(getHapticPattern({ type: "jump" })).toBe(8);
    expect(getHapticPattern({ type: "hurt" })).toBe(70);
    expect(getHapticPattern({ type: "finish" })).toEqual([
      20, 35, 30, 35, 45,
    ]);
  });

  it("does not vibrate when feedback or motion is disabled", () => {
    const target = { vibrate: vi.fn(() => true) };
    expect(playHaptic({ type: "hurt" }, false, false, target)).toBe(false);
    expect(playHaptic({ type: "hurt" }, true, true, target)).toBe(false);
    expect(target.vibrate).not.toHaveBeenCalled();
  });

  it("plays and cancels vibration through the same preference boundary", () => {
    const target = { vibrate: vi.fn(() => true) };
    expect(playHaptic({ type: "stomp" }, true, false, target)).toBe(true);
    expect(target.vibrate).toHaveBeenCalledWith([28, 18, 20]);
    expect(cancelHaptics(target)).toBe(true);
    expect(target.vibrate).toHaveBeenLastCalledWith(0);
  });
});
