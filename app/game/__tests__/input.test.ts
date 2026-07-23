import { describe, expect, it } from "vitest";

import * as gameCanvas from "../GameCanvas";
import type { InputState } from "../simulation";

type InputApi = {
  clearInputState?: (input: InputState) => void;
  shouldActivateShortcut?: (
    code: string,
    pressed: boolean,
    repeat: boolean,
  ) => boolean;
  shouldRequestFocusPause?: (running: boolean, paused: boolean) => boolean;
  setInputAction?: (
    input: InputState,
    key: "left" | "right" | "jump",
    pressed: boolean,
  ) => void;
  readInputFrame?: (keyboard: InputState, touch: InputState) => InputState;
};

const inputApi = gameCanvas as typeof gameCanvas & InputApi;

describe("keyboard input safeguards", () => {
  it("fires pause and restart shortcuts only on the first keydown", () => {
    expect(inputApi.shouldActivateShortcut).toBeTypeOf("function");
    if (!inputApi.shouldActivateShortcut) return;

    expect(inputApi.shouldActivateShortcut("Escape", true, false)).toBe(true);
    expect(inputApi.shouldActivateShortcut("KeyR", true, false)).toBe(true);
    expect(inputApi.shouldActivateShortcut("Escape", true, true)).toBe(false);
    expect(inputApi.shouldActivateShortcut("KeyR", true, true)).toBe(false);
    expect(inputApi.shouldActivateShortcut("Escape", false, false)).toBe(false);
  });

  it("clears every held action after focus loss or pause", () => {
    expect(inputApi.clearInputState).toBeTypeOf("function");
    if (!inputApi.clearInputState) return;

    const input = { left: true, right: true, jump: true };
    inputApi.clearInputState(input);
    expect(input).toEqual({
      left: false,
      right: false,
      jump: false,
      jumpQueued: false,
    });
  });

  it("requests focus-loss pause only while actively playing", () => {
    expect(inputApi.shouldRequestFocusPause).toBeTypeOf("function");
    if (!inputApi.shouldRequestFocusPause) return;

    expect(inputApi.shouldRequestFocusPause(true, false)).toBe(true);
    expect(inputApi.shouldRequestFocusPause(true, true)).toBe(false);
    expect(inputApi.shouldRequestFocusPause(false, false)).toBe(false);
  });

  it("latches a rapid jump tap until one simulation frame consumes it", () => {
    expect(inputApi.setInputAction).toBeTypeOf("function");
    expect(inputApi.readInputFrame).toBeTypeOf("function");
    if (!inputApi.setInputAction || !inputApi.readInputFrame) return;

    const keyboard: InputState = { left: false, right: false, jump: false };
    const touch: InputState = { left: false, right: false, jump: false };
    inputApi.setInputAction(touch, "jump", true);
    const firstPress = inputApi.readInputFrame(keyboard, touch);
    inputApi.setInputAction(touch, "jump", false);
    inputApi.setInputAction(touch, "jump", true);
    const rapidRepress = inputApi.readInputFrame(keyboard, touch);

    expect(firstPress.jumpPressed).toBe(true);
    expect(rapidRepress.jumpPressed).toBe(true);
    expect(inputApi.readInputFrame(keyboard, touch).jumpPressed).toBe(false);
  });
});
