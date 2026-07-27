import type { GameEvent } from "./simulation";

type VibrationTarget = {
  vibrate(pattern: number | number[]): boolean;
};

export const getHapticPattern = (
  event: GameEvent,
): number | number[] | null => {
  switch (event.type) {
    case "jump":
      return 8;
    case "land":
      return 16;
    case "stomp":
      return [28, 18, 20];
    case "hurt":
      return 70;
    case "star":
      return 10;
    case "checkpoint":
      return [18, 28, 26];
    case "finish":
      return [20, 35, 30, 35, 45];
  }
};

const getVibrationTarget = (): VibrationTarget | null => {
  if (typeof navigator === "undefined") return null;
  return typeof navigator.vibrate === "function"
    ? (navigator as VibrationTarget)
    : null;
};

export const playHaptic = (
  event: GameEvent,
  enabled: boolean,
  reducedMotion: boolean,
  target = getVibrationTarget(),
) => {
  if (!enabled || reducedMotion || !target) return false;
  const pattern = getHapticPattern(event);
  return pattern === null ? false : target.vibrate(pattern);
};

export const cancelHaptics = (target = getVibrationTarget()) => {
  if (!target) return false;
  return target.vibrate(0);
};
