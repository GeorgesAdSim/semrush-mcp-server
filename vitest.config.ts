import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/tools/account.ts",
        "src/tools/cluster-enrichment.ts",
        "src/tools/recommender.ts",
        "src/utils/summaries.ts",
        "src/utils/governance.ts",
      ],
    },
  },
});
