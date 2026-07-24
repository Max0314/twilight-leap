export type GamePrefs = {
  version: 2;
  sound: boolean;
  screenShake: boolean;
  bestTime: number | null;
  bestStars: number;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const DEFAULT_PREFS: GamePrefs = {
  version: 2,
  sound: true,
  screenShake: true,
  bestTime: null,
  bestStars: 0,
};

export const STORAGE_KEY = "twilight-leap:v1";

const getDefaultStorage = (): StorageLike | undefined => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
};

type LegacyGamePrefs = Omit<GamePrefs, "version" | "screenShake"> & {
  version: 1;
};

const hasValidRecords = (
  prefs: Partial<GamePrefs> | Partial<LegacyGamePrefs>,
) =>
  (prefs.bestTime === null ||
    (typeof prefs.bestTime === "number" && Number.isFinite(prefs.bestTime))) &&
  typeof prefs.bestStars === "number" &&
  Number.isFinite(prefs.bestStars);

const isPrefs = (value: unknown): value is GamePrefs => {
  if (!value || typeof value !== "object") return false;
  const prefs = value as Partial<GamePrefs>;
  return (
    prefs.version === 2 &&
    typeof prefs.sound === "boolean" &&
    typeof prefs.screenShake === "boolean" &&
    hasValidRecords(prefs)
  );
};

const isLegacyPrefs = (value: unknown): value is LegacyGamePrefs => {
  if (!value || typeof value !== "object") return false;
  const prefs = value as Partial<LegacyGamePrefs>;
  return (
    prefs.version === 1 &&
    typeof prefs.sound === "boolean" &&
    hasValidRecords(prefs)
  );
};

const normalizeRecords = <T extends GamePrefs>(prefs: T): T => ({
  ...prefs,
  bestStars: Math.max(0, Math.min(12, Math.floor(prefs.bestStars))),
});

export function loadPrefs(storage = getDefaultStorage()): GamePrefs {
  if (!storage) return { ...DEFAULT_PREFS };

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const value: unknown = JSON.parse(raw);
    if (isPrefs(value)) return normalizeRecords(value);
    if (isLegacyPrefs(value)) {
      return normalizeRecords({
        ...value,
        version: 2,
        screenShake: true,
      });
    }
    return { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(
  prefs: GamePrefs,
  storage = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be blocked in private or embedded browser contexts.
  }
}

export function updateRecords(
  prefs: GamePrefs,
  time: number,
  stars: number,
): GamePrefs {
  const safeTime = Math.max(0, time);
  return {
    ...prefs,
    bestTime:
      prefs.bestTime === null ? safeTime : Math.min(prefs.bestTime, safeTime),
    bestStars: Math.max(prefs.bestStars, Math.max(0, Math.min(12, stars))),
  };
}
