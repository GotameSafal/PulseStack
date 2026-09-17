import { describe, it, expect, vi } from "vitest";
import { createClickHouseClient } from "../src/client.js";

// We mock the @clickhouse/client module to avoid real network connections in unit tests.
vi.mock("@clickhouse/client", () => ({
  createClient: vi.fn((config: Record<string, unknown>) => ({
    _config: config,
    close: vi.fn(),
    command: vi.fn(),
    insert: vi.fn(),
    query: vi.fn(),
  })),
}));

describe("createClickHouseClient", () => {
  it("creates a client with provided config values", () => {
    const client = createClickHouseClient({
      url: "http://ch:8123",
      username: "admin",
      password: "secret",
      database: "testdb",
    });

    // The mock returns an object with _config set from the createClient call args
    const mock = client as unknown as { _config: Record<string, unknown> };
    expect(mock._config.url).toBe("http://ch:8123");
    expect(mock._config.username).toBe("admin");
    expect(mock._config.password).toBe("secret");
    expect(mock._config.database).toBe("testdb");
  });

  it("falls back to environment variable defaults", () => {
    process.env.CLICKHOUSE_URL = "http://env-host:8123";
    process.env.CLICKHOUSE_USER = "env_user";
    process.env.CLICKHOUSE_PASSWORD = "env_pass";
    process.env.CLICKHOUSE_DB = "env_db";

    const client = createClickHouseClient();

    const mock = client as unknown as { _config: Record<string, unknown> };
    expect(mock._config.url).toBe("http://env-host:8123");
    expect(mock._config.username).toBe("env_user");
    expect(mock._config.password).toBe("env_pass");
    expect(mock._config.database).toBe("env_db");

    // Clean up
    delete process.env.CLICKHOUSE_URL;
    delete process.env.CLICKHOUSE_USER;
    delete process.env.CLICKHOUSE_PASSWORD;
    delete process.env.CLICKHOUSE_DB;
  });

  it("falls back to hardcoded defaults when env vars are absent", () => {
    const client = createClickHouseClient();

    const mock = client as unknown as { _config: Record<string, unknown> };
    expect(mock._config.url).toBe("http://localhost:8123");
    expect(mock._config.username).toBe("default");
    expect(mock._config.database).toBe("pulsestack");
  });

  it("partial config overrides only supplied fields", () => {
    process.env.CLICKHOUSE_URL = "http://env-host:8123";
    process.env.CLICKHOUSE_USER = "env_user";

    const client = createClickHouseClient({ database: "override_db" });

    const mock = client as unknown as { _config: Record<string, unknown> };
    expect(mock._config.url).toBe("http://env-host:8123");
    expect(mock._config.username).toBe("env_user");
    expect(mock._config.database).toBe("override_db");

    delete process.env.CLICKHOUSE_URL;
    delete process.env.CLICKHOUSE_USER;
  });
});
