import { Redis } from "ioredis";
import { createClickHouseClient } from "@pulsestack/clickhouse";
import { createDbClient } from "@pulsestack/database";
import { loadConfig } from "./config.js";
import { BatchFlusher } from "./flusher.js";
import { IngestionConsumer } from "./consumer.js";
import { AlertEvaluationScheduler } from "./alerts/scheduler.js";

async function main() {
  const config = loadConfig();

  console.log(`[worker] Starting PulseStack worker: ${config.consumerName}`);
  console.log(`[worker] Redis URL: ${config.redisUrl}, Stream: ${config.streamKey}, Group: ${config.consumerGroup}`);
  console.log(`[worker] ClickHouse URL: ${config.clickhouseUrl}, DB: ${config.clickhouseDb}`);

  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const clickhouse = createClickHouseClient({
    url: config.clickhouseUrl,
    username: config.clickhouseUser,
    password: config.clickhousePassword,
    database: config.clickhouseDb,
  });

  const db = createDbClient({
    connectionString: config.databaseUrl,
  });

  const flusher = new BatchFlusher({ clickhouseClient: clickhouse });
  const consumer = new IngestionConsumer({
    config,
    redis,
    flusher,
  });

  const alertScheduler = new AlertEvaluationScheduler({
    db,
    clickhouse,
    redis,
    clickhouseDb: config.clickhouseDb,
    intervalMs: config.alertEvalIntervalMs,
  });

  const shutdown = async (signal: string) => {
    console.log(`[worker] Received ${signal}, shutting down gracefully...`);
    alertScheduler.stop();
    consumer.stop();
    await redis.quit();
    await clickhouse.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Start alert evaluation loop
  alertScheduler.start();

  // Start ingestion stream consumer
  await consumer.start();
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("[worker] Fatal error:", err);
    process.exit(1);
  });
}
