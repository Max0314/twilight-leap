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
let account: string | null = null;
export const currentStorageKey = () => account ? `twilight-leap:account:v2:${account}` : STORAGE_KEY;

const getDefaultStorage = (): StorageLike | undefined => {
  if (typeof window === "undefined") return undefined;
  try { return window.localStorage; } catch { return undefined; }
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

export function loadPrefs(storage = getDefaultStorage(), key = currentStorageKey()): GamePrefs {
  if (!storage) return { ...DEFAULT_PREFS };

  try {
    const raw = storage.getItem(key);
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
  key = currentStorageKey(),
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(prefs));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("fribench:local-save-changed"));
  } catch {
    // Storage can be blocked in private or embedded browser contexts.
  }
}

type Bridge = { connectStorage(adapter: ReturnType<typeof createAccountAdapter>): Promise<void> };
declare global { interface Window { FribenchAccount?: Bridge } }
export function createAccountAdapter(storage: StorageLike, changed: () => void) {
  return {
    setAccount(key: string | null) {
      const next = key && /^[\w-]{43}$/.test(key) ? key : null;
      if (account !== next) { account = next; changed(); }
    },
    captureGuest: () => storage.getItem(STORAGE_KEY) ? loadPrefs(storage, STORAGE_KEY) : null,
    captureAccount: (key: string) => key === account && storage.getItem(currentStorageKey()) ? loadPrefs(storage) : null,
    restoreAccount(payload: unknown, key: string) {
      if (key !== account || !account || !isPrefs(payload)) throw new Error("Account changed or invalid save");
      const previous = storage.getItem(currentStorageKey());
      if (previous) storage.setItem(currentStorageKey() + ":before-restore", previous);
      storage.setItem(currentStorageKey(), JSON.stringify(normalizeRecords(payload))); changed();
    },
    describe: (payload: GamePrefs) => `游客星辉 ${payload.bestStars}/12，最快用时 ${payload.bestTime === null ? "暂无" : payload.bestTime.toFixed(2) + " 秒"}。`,
  };
}
export function connectAccountStorage(changed: () => void) {
  const connect = () => { const storage = getDefaultStorage(); if (storage && window.FribenchAccount) void window.FribenchAccount.connectStorage(createAccountAdapter(storage, changed)); };
  window.addEventListener("fribench:ready", connect); connect();
  return () => window.removeEventListener("fribench:ready", connect);
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
