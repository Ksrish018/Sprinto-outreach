import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Live golden set: `npm run golden`. Reads .env through node --env-file; never runs in CI.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/golden/**/*.test.ts"],
    // Test workers do not inherit --import, so the local DNS fallback is loaded here too.
    setupFiles: ["./scripts/dns-fallback.mjs"],
    environment: "node",
    testTimeout: 40 * 60_000,
  },
});
