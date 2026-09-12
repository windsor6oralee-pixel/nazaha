import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run against the real dev database (DATABASE_URL, loaded by Prisma Client
// from .env). Files run serially because they share one database and clean up after themselves.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
