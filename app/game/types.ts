export type Vec = { x: number; y: number };

export type Rect = Vec & { width: number; height: number };

export type PlatformKind = "stone" | "wood" | "crumble" | "moving";

export type Platform = Rect & {
  id: string;
  kind: PlatformKind;
  travel?: Vec;
  speed?: number;
  phase?: number;
};

export type EnemyKind = "emberling" | "beetle";

export type EnemySeed = Rect & {
  id: string;
  kind: EnemyKind;
  minX: number;
  maxX: number;
};

export type StarSeed = Vec & { id: string };

export type LevelDefinition = {
  spawn: Vec;
  platforms: Platform[];
  hazards: Rect[];
  stars: StarSeed[];
  checkpoints: Array<Rect & { id: string }>;
  enemies: EnemySeed[];
  finish: Rect;
};

