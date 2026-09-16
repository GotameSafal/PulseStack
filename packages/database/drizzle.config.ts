import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://pulsestack:pulsestack_secret@localhost:5432/pulsestack",
  },
  verbose: true,
  strict: true,
});
