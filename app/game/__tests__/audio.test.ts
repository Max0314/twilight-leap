import { describe, expect, it } from "vitest";

import { getToneForEvent } from "../audio";
import type { GameEvent } from "../simulation";

describe("audio recipes", () => {
  it("defines a distinct, audible recipe for every game event", () => {
    const events: GameEvent[] = [
      { type: "jump" },
      { type: "land" },
      { type: "stomp" },
      { type: "hurt" },
      { type: "checkpoint" },
      { type: "finish" },
      { type: "star", id: "star-01" },
    ];

    for (const event of events) {
      const recipe = getToneForEvent(event);
      expect(recipe.length).toBeGreaterThan(0);
      expect(recipe.every((tone) => tone.frequency > 0 && tone.duration > 0)).toBe(true);
    }

    expect(getToneForEvent({ type: "finish" })).toHaveLength(4);
    expect(getToneForEvent({ type: "star", id: "star-01" })[0].frequency).toBeGreaterThan(
      getToneForEvent({ type: "hurt" })[0].frequency,
    );
  });
});
