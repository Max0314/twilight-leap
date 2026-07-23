# Twilight Leap Movement Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make moving platforms reliable, add one air jump and a mobile-friendly wall slide/wall jump, and deliver a stable, complete hero run animation.

**Architecture:** Extend the deterministic simulation with support-platform and wall-contact state. Resolve moving platforms from previous/current transforms, keep jump actions edge-triggered, and expose a pure renderer pose helper so animation geometry is testable without a browser.

**Tech Stack:** TypeScript, React 19, Canvas 2D, Vitest, vinext/Sites

## Global Constraints

- Preserve the existing level, art atlas, enemy behavior, keyboard controls, and touch controls.
- One air jump maximum before landing.
- Wall slide activates automatically while airborne and falling against a wall.
- Wall jump launches away from the contacted wall and must work from the existing jump button.
- Use test-first development for every behavior change.

---

### Task 1: Moving-platform support

**Files:**
- Modify: `app/game/simulation.ts`
- Test: `app/game/__tests__/simulation.test.ts`

**Interfaces:**
- Produces: `PlayerState.supportPlatformId: string | null`
- Consumes: `getRuntimePlatforms(state, level)` at previous/current elapsed times

- [ ] Add failing tests showing that a rider inherits a lift's vertical delta and a fast rising lift catches a descending player.
- [ ] Run `npm test -- app/game/__tests__/simulation.test.ts` and confirm the new assertions fail for support loss/skip-through.
- [ ] Add previous/current platform sampling, relative-motion landing, and support-platform carry.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Double jump and wall movement

**Files:**
- Modify: `app/game/simulation.ts`
- Test: `app/game/__tests__/simulation.test.ts`

**Interfaces:**
- Produces: `PlayerState.airJumpsRemaining`, `wallNormal`, `wallJumpLock`
- Consumes: edge-triggered `InputState.jump`, horizontal platform collision contacts

- [ ] Add failing tests for one double jump, no third jump, automatic wall-slide speed cap, and rebound direction.
- [ ] Run the focused simulation tests and confirm each new behavior fails for the intended missing state.
- [ ] Implement air-jump reset/consumption, wall contact, slide cap, rebound impulse, and respawn reset.
- [ ] Re-run the focused tests and confirm all pass.

### Task 3: Complete hero run presentation

**Files:**
- Modify: `app/game/renderer.ts`
- Test: `app/game/__tests__/renderer.test.ts`

**Interfaces:**
- Produces: exported pure `getHeroPose(state)` returning frame and anchored render geometry
- Consumes: player velocity/contact state and `state.elapsed`

- [ ] Add failing renderer tests for simulation-time frame selection, preserved aspect ratio, and stable bottom-center anchoring.
- [ ] Run the renderer tests and confirm the helper/geometry expectations fail.
- [ ] Implement the four-beat run pose, velocity-scaled cadence, bottom-center aspect-preserving layout, lean, and bob.
- [ ] Re-run renderer tests and confirm they pass.

### Task 4: Control guidance and regression checks

**Files:**
- Modify: `app/page.tsx`
- Test: `app/game/__tests__/page.test.tsx`

**Interfaces:**
- Produces: discoverable keyboard/touch copy for double jump and wall jump

- [ ] Add a failing page test that expects the new movement guidance.
- [ ] Update concise visible help text without adding controls.
- [ ] Run `npm test`, `npm run lint`, and TypeScript/build validation.

### Task 5: Rendered QA and publishing

**Files:**
- No committed QA artifacts

- [ ] Run the app and exercise start, movement, repeated jump, and touch-sized layout in a local browser automation fallback because the Browser plugin is unavailable.
- [ ] Confirm page identity, nonblank render, no framework overlay, console health, screenshot evidence, and interaction response.
- [ ] Run `npm run build`, package the validated output, save a new Sites version, deploy publicly, and poll until succeeded.
- [ ] Open and return the deployed URL.

