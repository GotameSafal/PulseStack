import { createClient, type ClickHouseClient } from "@clickhouse/client";

export interface ClickHouseConfig {
  url: string;
  username: string;
  password: string;
  database: string;
}

/**
 * Creates and returns a configured ClickHouse client instance.
 * Reads from environment variables if no config is provided.
 */
export function createClickHouseClient(
  config?: Partial<ClickHouseConfig>
): ClickHouseClient {
  const url = config?.url ?? process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
  const username = config?.username ?? process.env.CLICKHOUSE_USER ?? "default";
  const password = config?.password ?? process.env.CLICKHOUSE_PASSWORD ?? "";
  const database = config?.database ?? process.env.CLICKHOUSE_DB ?? "pulsestack";

  return createClient({
    url,
    username,
    password,
    database,
    clickhouse_settings: {
      // Allow experimental JSON type if needed in future
      allow_experimental_object_type: 0,
    },
  });
}

export type { ClickHouseClient };
