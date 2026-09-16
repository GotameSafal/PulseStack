import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseClientOptions {
  connectionString?: string;
  max?: number;
  ssl?: boolean | "require" | "allow" | "prefer";
}

/**
 * Creates and returns a typed Drizzle database client using postgres.js.
 */
export function createDbClient(options: DatabaseClientOptions = {}): Database {
  const connectionString =
    options.connectionString ||
    process.env.DATABASE_URL ||
    "postgresql://pulsestack:pulsestack_secret@localhost:5432/pulsestack";

  const client = postgres(connectionString, {
    max: options.max ?? 10,
    ssl: options.ssl,
  });

  return drizzle(client, { schema });
}
