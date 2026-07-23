import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "app/game/__tests__/**/*.test.ts",
      "app/game/__tests__/**/*.test.tsx",
    ],
  },
});
