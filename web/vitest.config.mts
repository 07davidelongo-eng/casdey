import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests only, and only for the logic where a quiet bug is expensive:
 * who counts as dormant, and how a CSV row becomes a patient. Both decide who
 * gets emailed. Rendering is verified in the browser instead.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
