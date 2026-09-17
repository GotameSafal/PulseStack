import { describe, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

const EXPECTED_TABLES = [
  "http_requests",
  "errors",
  "database_queries",
  "background_jobs",
  "custom_events",
];

describe("ClickHouse DDL migrations", () => {
  it("has exactly 5 migration files", async () => {
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql"));
    expect(files).toHaveLength(5);
  });

  it("migration files are numbered sequentially starting from 001", async () => {
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    files.forEach((file, idx) => {
      const expectedPrefix = String(idx + 1).padStart(3, "0");
      expect(file.startsWith(expectedPrefix)).toBe(true);
    });
  });

  it("each migration uses IF NOT EXISTS (idempotent)", async () => {
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
      expect(sql.toUpperCase()).toContain("IF NOT EXISTS");
    }
  });

  it("each migration targets the pulsestack database", async () => {
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
      expect(sql).toContain("pulsestack.");
    }
  });

  it("each migration uses MergeTree engine", async () => {
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
      expect(sql.toUpperCase()).toContain("MERGETREE");
    }
  });

  it("each expected table has a corresponding migration file", async () => {
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    const allContent = await Promise.all(
      files.map((f) => readFile(join(MIGRATIONS_DIR, f), "utf-8"))
    );
    const combined = allContent.join("\n");

    for (const table of EXPECTED_TABLES) {
      expect(combined).toContain(`pulsestack.${table}`);
    }
  });

  it("http_requests table has required columns", async () => {
    const sql = await readFile(join(MIGRATIONS_DIR, "001_create_http_requests.sql"), "utf-8");
    const requiredColumns = [
      "id",
      "project_id",
      "timestamp",
      "method",
      "path",
      "status_code",
      "duration_ms",
    ];
    for (const col of requiredColumns) {
      expect(sql).toContain(col);
    }
  });

  it("http_requests table is partitioned by month", async () => {
    const sql = await readFile(join(MIGRATIONS_DIR, "001_create_http_requests.sql"), "utf-8");
    expect(sql.toUpperCase()).toContain("PARTITION BY TOYYYYMM");
  });

  it("http_requests ORDER BY includes project_id, timestamp, id", async () => {
    const sql = await readFile(join(MIGRATIONS_DIR, "001_create_http_requests.sql"), "utf-8");
    expect(sql).toContain("ORDER BY (project_id, timestamp, id)");
  });
});
