import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClickHouseClient, type ClickHouseConfig } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

/**
 * Reads migration SQL files from the migrations/ directory in filename order,
 * then executes each one against ClickHouse via the HTTP interface.
 *
 * Each migration uses IF NOT EXISTS so it is idempotent and safe to re-run.
 */
export async function runMigrations(config?: Partial<ClickHouseConfig>): Promise<void> {
  const client = createClickHouseClient(config);

  try {
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort(); // lexicographic order → 001_, 002_, …

    if (files.length === 0) {
      console.log("[clickhouse] No migration files found.");
      return;
    }

    for (const file of files) {
      const filePath = join(MIGRATIONS_DIR, file);
      const sql = await readFile(filePath, "utf-8");

      console.log(`[clickhouse] Running migration: ${file}`);
      await client.command({ query: sql, clickhouse_settings: { wait_end_of_query: 1 } });
      console.log(`[clickhouse] ✓ ${file}`);
    }

    console.log(`[clickhouse] All ${files.length} migration(s) applied.`);
  } finally {
    await client.close();
  }
}
