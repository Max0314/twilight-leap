# Twilight Leap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publicly deploy a polished single-level browser platform game named 《暮光跃境》 with responsive keyboard/touch controls, original detailed pixel scenery, enemies, collectibles, checkpoint recovery, and a finish summary.

**Architecture:** A vinext/React shell owns menus, HUD, pause, touch controls, and lifecycle. A pure TypeScript simulation owns deterministic game state and collision, while a Canvas 2D renderer draws four parallax layers, entities, lighting, fog, and particles. Browser-only adapters connect input, audio, local persistence, responsive canvas sizing, and the animation loop to the pure simulation.

**Tech Stack:** Sites vinext starter, React, TypeScript, Canvas 2D, CSS, Vitest, browser localStorage, Web Audio API.

## Global Constraints

- One public route and one complete 2–3 minute level.
- Exactly 12 collectible stars, one checkpoint, two enemy types, and one finish gate.
- Original characters, world, enemies, synthesized sounds, and approved generated pixel-art production assets only; Canvas code owns collision, layout, lighting, fog, and particles, with no copied game assets.
- Keyboard: arrows or A/D, Space/W/Up, R, Escape.
- Touch: simultaneous left/right movement and jump, safe-area aware, portrait playable and landscape recommended.
- Fixed-step simulation with desktop target of 60 FPS and graceful visual reduction on weaker/mobile devices.
- Respect `prefers-reduced-motion`; keep gameplay geometry unchanged by performance settings.
- Device-local best time, best star count, and sound preference only.
- Cloudflare Worker-compatible ESM output from the bundled Sites starter.

---

## File Map

- `app/page.tsx`: client page, view states, HUD, menus, touch controls, and game lifecycle.
- `app/layout.tsx`: title, description, viewport, Open Graph, and X metadata.
- `app/globals.css`: full-screen stage, overlays, responsive controls, and decorative webpage framing.
- `app/game/types.ts`: shared geometry, level, game-state, input, event, and entity types.
- `app/game/level.ts`: immutable level geometry, 12 stars, enemies, hazards, checkpoint, and finish gate.
- `app/game/simulation.ts`: player movement, collision, enemy AI, collection, damage, respawn, pause-safe updates, and completion.
- `app/game/renderer.ts`: four-layer pixel scene, camera, light, fog, particles, entities, HUD-adjacent world prompts, and quality scaling.
- `app/game/audio.ts`: user-gesture-safe synthesized effects and sound preference.
- `app/game/storage.ts`: versioned, failure-tolerant local record reads and writes.
- `app/game/GameCanvas.tsx`: animation loop, canvas resize, input listeners, touch bridge, and simulation/render integration.
- `app/game/__tests__/level.test.ts`: level invariants.
- `app/game/__tests__/simulation.test.ts`: physics, enemies, collection, checkpoint, and finish behaviors.
- `app/game/__tests__/storage.test.ts`: local record schema and unavailable-storage fallback.
- `public/og.png`: bespoke social preview matching the finished game.

---

### Task 1: Initialize Sites and lock level invariants

**Files:**
- Modify: `package.json`
- Create: `app/game/types.ts`
- Create: `app/game/level.ts`
- Create: `app/game/__tests__/level.test.ts`

**Interfaces:**
- Consumes: Sites starter scripts and TypeScript configuration.
- Produces: `LEVEL: LevelDefinition`, `WORLD_WIDTH`, `WORLD_HEIGHT`, and shared types used by every game module.

- [ ] **Step 1: Initialize the project once and add the test runner**

Run the bundled Sites initializer against the project root, retain its package manager and lockfile, then run:

```powershell
npm install --save-dev vitest
```

Add this exact script to `package.json`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing level test**

```ts
import { describe, expect, it } from "vitest";
import { LEVEL, WORLD_WIDTH } from "../level";

describe("LEVEL", () => {
  it("contains the complete single-level contract", () => {
    expect(LEVEL.stars).toHaveLength(12);
    expect(LEVEL.checkpoints).toHaveLength(1);
    expect(new Set(LEVEL.enemies.map((enemy) => enemy.kind))).toEqual(
      new Set(["emberling", "beetle"]),
    );
    expect(LEVEL.finish.x).toBeGreaterThan(WORLD_WIDTH * 0.85);
    expect(LEVEL.spawn.x).toBeLessThan(LEVEL.finish.x);
  });
});
```

- [ ] **Step 3: Run the test and verify RED**

Run: `npm test -- app/game/__tests__/level.test.ts`  
Expected: FAIL because `../level` does not exist.

- [ ] **Step 4: Implement shared types and level data**

Use these public contracts in `types.ts`:

```ts
export type Vec = { x: number; y: number };
export type Rect = Vec & { width: number; height: number };
export type Platform = Rect & { kind: "stone" | "wood" | "crumble" | "moving"; travel?: Vec };
export type EnemyKind = "emberling" | "beetle";
export type EnemySeed = Rect & { id: string; kind: EnemyKind; minX: number; maxX: number };
export type LevelDefinition = {
  spawn: Vec;
  platforms: Platform[];
  hazards: Rect[];
  stars: Array<Vec & { id: string }>;
  checkpoints: Array<Rect & { id: string }>;
  enemies: EnemySeed[];
  finish: Rect;
};
```

Export an immutable `LEVEL` whose platform route spans a 7,200 × 900 world, includes 12 uniquely identified stars, one checkpoint near the midpoint, at least three instances of each enemy kind, moving/crumble platforms, spikes, pits, and a finish gate after x=6,600.

- [ ] **Step 5: Run the test and verify GREEN**

Run: `npm test -- app/game/__tests__/level.test.ts`  
Expected: 1 test passes.

- [ ] **Step 6: Commit the level contract**

```powershell
git add package.json package-lock.json app/game/types.ts app/game/level.ts app/game/__tests__/level.test.ts
git commit -m "feat: define Twilight Leap level contract"
```

---

### Task 2: Build deterministic player and enemy simulation

**Files:**
- Create: `app/game/simulation.ts`
- Create: `app/game/__tests__/simulation.test.ts`

**Interfaces:**
- Consumes: `LevelDefinition`, `LEVEL`, and geometry types from Task 1.
- Produces: `createGame(level)`, `stepGame(state, input, dt, level)`, `setPaused(state, paused)`, and serializable `GameState`/`GameEvent` values.

- [ ] **Step 1: Write failing behavior tests**

```ts
import { describe, expect, it } from "vitest";
import { LEVEL } from "../level";
import { createGame, stepGame } from "../simulation";

describe("simulation", () => {
  it("moves, jumps, and lands without tunneling", () => {
    let state = createGame(LEVEL);
    for (let i = 0; i < 30; i += 1) state = stepGame(state, { left: false, right: true, jump: false }, 1 / 60, LEVEL).state;
    const movedX = state.player.x;
    state = stepGame(state, { left: false, right: true, jump: true }, 1 / 60, LEVEL).state;
    expect(movedX).toBeGreaterThan(LEVEL.spawn.x);
    expect(state.player.vy).toBeLessThan(0);
  });

  it("collects a star exactly once", () => {
    let state = createGame(LEVEL);
    state.player.x = LEVEL.stars[0].x;
    state.player.y = LEVEL.stars[0].y;
    let result = stepGame(state, { left: false, right: false, jump: false }, 1 / 60, LEVEL);
    expect(result.state.collected).toContain(LEVEL.stars[0].id);
    expect(result.events.filter((event) => event.type === "star")).toHaveLength(1);
    result = stepGame(result.state, { left: false, right: false, jump: false }, 1 / 60, LEVEL);
    expect(result.events.filter((event) => event.type === "star")).toHaveLength(0);
  });

  it("stomps an emberling and respawns after side damage", () => {
    const enemySeed = LEVEL.enemies.find((enemy) => enemy.kind === "emberling")!;
    let stomp = createGame(LEVEL);
    stomp.player.x = enemySeed.x;
    stomp.player.y = enemySeed.y - stomp.player.height;
    stomp.player.vy = 260;
    const stomped = stepGame(stomp, { left: false, right: false, jump: false }, 1 / 60, LEVEL);
    expect(stomped.events.some((event) => event.type === "stomp")).toBe(true);

    let hurt = createGame(LEVEL);
    hurt.player.x = enemySeed.x;
    hurt.player.y = enemySeed.y;
    const damaged = stepGame(hurt, { left: false, right: false, jump: false }, 1 / 60, LEVEL);
    expect(damaged.state.mode).toBe("respawning");
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- app/game/__tests__/simulation.test.ts`  
Expected: FAIL because `../simulation` does not exist.

- [ ] **Step 3: Implement the simulation contracts**

Use these state/event shapes and constants:

```ts
export type InputState = { left: boolean; right: boolean; jump: boolean };
export type GameEvent =
  | { type: "jump" | "land" | "stomp" | "hurt" | "checkpoint" | "finish" }
  | { type: "star"; id: string };
export type GameMode = "playing" | "paused" | "respawning" | "finished";
export const PHYSICS = {
  gravity: 2100,
  runAcceleration: 2200,
  airAcceleration: 1250,
  friction: 2400,
  maxRunSpeed: 350,
  jumpSpeed: 760,
  coyoteSeconds: 0.11,
  jumpBufferSeconds: 0.12,
  respawnSeconds: 0.55,
  invulnerableSeconds: 1,
} as const;
```

`stepGame` must clamp a single step to 1/30 second, resolve horizontal and vertical axes separately, track grounded/coyote/jump-buffer state, prevent repeat star events, turn emberlings at patrol bounds, run beetles through idle→charge→dash→recover phases, distinguish stomp from side collision, activate the single checkpoint, respawn from the active checkpoint, and enter `finished` on gate contact.

- [ ] **Step 4: Run all simulation tests and verify GREEN**

Run: `npm test -- app/game/__tests__/simulation.test.ts`  
Expected: all simulation tests pass.

- [ ] **Step 5: Add edge-case tests before implementation changes**

Add separate tests for coyote jump, buffered jump on landing, checkpoint respawn position, beetle pre-dash charge, pause freezing elapsed time, and finish emitting once. Run each new test once in RED, then add only the missing behavior and rerun to GREEN.

- [ ] **Step 6: Commit the deterministic game core**

```powershell
git add app/game/simulation.ts app/game/__tests__/simulation.test.ts
git commit -m "feat: add deterministic platform game simulation"
```

---

### Task 3: Add record storage and synthesized sound

**Files:**
- Create: `app/game/storage.ts`
- Create: `app/game/audio.ts`
- Create: `app/game/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: completion stats and `GameEvent` from Task 2.
- Produces: `loadPrefs(storage?)`, `savePrefs(prefs, storage?)`, `updateRecords(prefs, time, stars)`, and `createAudioController()`.

- [ ] **Step 1: Write failing storage tests**

```ts
import { describe, expect, it } from "vitest";
import { loadPrefs, updateRecords } from "../storage";

describe("storage", () => {
  it("falls back when storage is unavailable", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadPrefs(broken)).toEqual({ version: 1, sound: true, bestTime: null, bestStars: 0 });
  });

  it("keeps the fastest time and highest star count", () => {
    const first = updateRecords({ version: 1, sound: true, bestTime: 80, bestStars: 9 }, 95, 12);
    expect(first.bestTime).toBe(80);
    expect(first.bestStars).toBe(12);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- app/game/__tests__/storage.test.ts`  
Expected: FAIL because `../storage` does not exist.

- [ ] **Step 3: Implement versioned preferences and audio controller**

Use this exact persisted schema:

```ts
export type GamePrefs = { version: 1; sound: boolean; bestTime: number | null; bestStars: number };
export const DEFAULT_PREFS: GamePrefs = { version: 1, sound: true, bestTime: null, bestStars: 0 };
export const STORAGE_KEY = "twilight-leap:v1";
```

Catch JSON, read, and write failures and return defaults without throwing. The audio controller lazily creates one `AudioContext` after a user gesture and maps jump, land, star, stomp, hurt, checkpoint, and finish events to short oscillator/gain envelopes. It exposes `setEnabled`, `resume`, `play(event)`, and `dispose`.

- [ ] **Step 4: Run storage tests and verify GREEN**

Run: `npm test -- app/game/__tests__/storage.test.ts`  
Expected: all storage tests pass.

- [ ] **Step 5: Commit persistence and audio**

```powershell
git add app/game/storage.ts app/game/audio.ts app/game/__tests__/storage.test.ts
git commit -m "feat: add local records and synthesized effects"
```

---

### Task 4: Draw the detailed Ember Court and connect the playable canvas

**Files:**
- Create: `app/game/renderer.ts`
- Create: `app/game/GameCanvas.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Delete: `app/_sites-preview/**`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `LEVEL`, `GameState`, `GameEvent`, preferences, and audio from Tasks 1–3.
- Produces: a responsive `GameCanvas` component with `status`, `input`, `restartToken`, `onStatus`, and `onFinish` props.

- [ ] **Step 1: Add an integration assertion before UI implementation**

Extend `level.test.ts` with a readability invariant that every star is positioned above a platform and every enemy patrol range is at least 100 pixels wide. Run the test and confirm RED against the current level data, then adjust only the offending level coordinates until it is GREEN.

- [ ] **Step 2: Implement the renderer**

`renderGame(ctx, state, level, options)` must:

```ts
export type RenderOptions = {
  width: number;
  height: number;
  dpr: number;
  reducedMotion: boolean;
  lowQuality: boolean;
  time: number;
};

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  level: LevelDefinition,
  options: RenderOptions,
): void;
```

Draw in this order: amber sky gradient and sunset disc; distant roofs/towers; misty middle ruins and foliage; volumetric light beams; playable masonry/platforms; hazards and wet-stone highlights; stars; enemies; player; foreground vines/railings; particles; warm vignette and subtle pixel-texture overlay. Snap gameplay sprites and platforms to integer world pixels, while fog/light remain smooth. Use parallax factors 0.12, 0.28, 1, and 1.18 for the four layers.

- [ ] **Step 3: Implement the animation and input bridge**

`GameCanvas.tsx` must own refs for canvas, simulation state, accumulator, held keyboard/touch actions, audio, and RAF id. Accumulate elapsed time and call `stepGame` in 1/60-second slices with a maximum of five catch-up steps per frame. Register one deduplicated keyboard listener pair, passive resize handling, visibility-change auto-pause, and cleanup for every listener/RAF/audio resource. Cap render DPR at 2 on desktop and 1.5 on touch devices.

- [ ] **Step 4: Replace the starter with the complete page shell**

Create these page states: `intro`, `playing`, `paused`, and `finished`. Render a cinematic title card with “暮光跃境 / TWILIGHT LEAP”, a one-sentence mission, a primary start button, concise keyboard/touch hints, and an originality note. During play render star count `n / 12`, timer, pause button, and touch controls. The finish panel shows time, collection, best records, and restart.

- [ ] **Step 5: Add responsive and accessible styling**

Use CSS safe-area insets, minimum 48px touch targets, visible pressed/focus states, high-contrast translucent panels, landscape-first canvas sizing, portrait notice, and a full-height background that matches the canvas palette. Hide touch controls for precise-pointer devices. Under `prefers-reduced-motion`, remove decorative transitions and set the renderer flag.

- [ ] **Step 6: Remove starter-only code and dependency**

Delete `app/_sites-preview`, remove its imports, remove `react-loading-skeleton` if unused, refresh the lockfile, and ensure no `codex-preview` marker remains.

- [ ] **Step 7: Run tests and commit the playable game**

Run: `npm test`  
Expected: all level, simulation, and storage tests pass.

```powershell
git add app package.json package-lock.json
git commit -m "feat: build playable Ember Court platformer"
```

---

### Task 5: Add metadata, social preview, and production validation

**Files:**
- Modify: `app/layout.tsx`
- Create: `public/og.png`

**Interfaces:**
- Consumes: final title, copy, palette, and visual motifs from Task 4.
- Produces: finished page metadata and a complete 1200 × 630 social image.

- [ ] **Step 1: Update site metadata**

Set the title to `暮光跃境 · Twilight Leap`, description to `穿越余烬古城，在光影交错的原创像素世界中收集星辉、越过敌人并抵达星门。`, viewport for responsive full-screen play, theme color `#160f1b`, and host-derived Open Graph/X image URL when the social image passes inspection.

- [ ] **Step 2: Generate exactly one bespoke social card**

Generate a cohesive landscape card using the finished amber sunset, red masonry, layered ruins, warm volumetric beams, tiny original traveler, patrol enemy silhouettes, and the exact title text `暮光跃境` plus subtitle `TWILIGHT LEAP`. Inspect the image for incorrect text; omit `og:image` if it is unusable rather than shipping a generic fallback.

- [ ] **Step 3: Run fresh full verification**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass; build exits 0 and emits Cloudflare-compatible `dist/server/index.js` plus static assets.

- [ ] **Step 4: Review the requirement checklist**

Confirm from source and test output: 12 stars, one checkpoint, two enemy kinds, stomp/side damage, moving and crumble platforms, finish summary, local records, audio toggle, keyboard, multitouch, auto-pause, reduced motion, responsive layout, four-layer parallax, detailed light/fog/particles, no copied assets, and no starter remnants.

- [ ] **Step 5: Commit the validated source**

```powershell
git add app/layout.tsx public/og.png
git commit -m "feat: finalize Twilight Leap sharing metadata"
```

---

### Task 6: Publish the exact validated build publicly with Sites

**Files:**
- Modify: `.openai/hosting.json`
- Create outside source: `work/twilight-leap-site.tar.gz`

**Interfaces:**
- Consumes: successful production build and exact committed source SHA.
- Produces: a public Sites deployment URL.

- [ ] **Step 1: Create the Sites project once**

Create the site with a stable Twilight Leap name/slug and store only its returned `project_id` in `.openai/hosting.json`.

- [ ] **Step 2: Push the validated source safely**

Use the temporary source credential only in a per-command HTTP authorization header. Do not place it in a remote URL or Git configuration. Use the pushed branch-head SHA for version saving.

- [ ] **Step 3: Package and save one version**

Run the bundled package helper with the project root and `work/twilight-leap-site.tar.gz`; confirm the archive contains `dist/server/index.js`, static assets, and staged hosting metadata. Save one version using the validated commit SHA and archive.

- [ ] **Step 4: Deploy publicly and poll to completion**

Deploy the saved version publicly, poll the deployment status until `succeeded` or terminal failure, then open the exact deployed URL in Codex and return that URL as the primary deliverable.
