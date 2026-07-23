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

  it("keeps stars readable above platforms and patrol lanes wide enough", () => {
    for (const star of LEVEL.stars) {
      const supportingPlatform = LEVEL.platforms.find(
        (platform) =>
          star.x >= platform.x &&
          star.x <= platform.x + platform.width &&
          star.y < platform.y &&
          platform.y - star.y <= 180,
      );
      expect(supportingPlatform, `${star.id} needs a readable platform`).toBeDefined();
    }

    for (const enemy of LEVEL.enemies) {
      expect(enemy.maxX - enemy.minX).toBeGreaterThanOrEqual(100);
    }
  });
});
