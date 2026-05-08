import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // DB-bound tests require a Postgres test database — not yet wired up.
    // Phase 1.2 covers pure functions only; integration tests for the wallet/credit
    // flows are deferred to a follow-up Phase 2/3 ticket.
    exclude: ["node_modules/**", ".next/**"],
    // Loads `.env` so module-level `prisma` initialization doesn't throw when test
    // files transitively import `@/lib/db` (e.g. via `lib/calculations/*`).
    setupFiles: ["./vitest.setup.ts"],
  },
})
