export interface WorkerConfig {
  redisUrl: string;
  streamKey: string;
  consumerGroup: string;
  consumerName: string;
  dlqKey: string;
  batchSize: number;
  blockMs: number;
  maxRetries: number;
  claimMinIdleTimeMs: number;
  clickhouseUrl: string;
  clickhouseUser?: string;
  clickhousePassword?: string;
  clickhouseDb?: string;
  databaseUrl?: string;
  alertEvalIntervalMs?: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    redisUrl: env.REDIS_URL || "redis://localhost:6379",
    streamKey: env.STREAM_KEY || "telemetry:stream",
    consumerGroup: env.CONSUMER_GROUP || "cg:ingestion",
    consumerName: env.CONSUMER_NAME || `worker-${process.pid}`,
    dlqKey: env.DLQ_KEY || "telemetry:dlq",
    batchSize: env.BATCH_SIZE ? parseInt(env.BATCH_SIZE, 10) : 500,
    blockMs: env.BLOCK_MS ? parseInt(env.BLOCK_MS, 10) : 2000,
    maxRetries: env.MAX_RETRIES ? parseInt(env.MAX_RETRIES, 10) : 3,
    claimMinIdleTimeMs: env.CLAIM_MIN_IDLE_TIME_MS ? parseInt(env.CLAIM_MIN_IDLE_TIME_MS, 10) : 60000,
    clickhouseUrl: env.CLICKHOUSE_URL || "http://localhost:8123",
    clickhouseUser: env.CLICKHOUSE_USER || "default",
    clickhousePassword: env.CLICKHOUSE_PASSWORD || "",
    clickhouseDb: env.CLICKHOUSE_DB || "pulsestack",
    databaseUrl: env.DATABASE_URL || "postgresql://pulsestack:pulsestack_secret@localhost:5432/pulsestack",
    alertEvalIntervalMs: env.ALERT_EVAL_INTERVAL_MS ? parseInt(env.ALERT_EVAL_INTERVAL_MS, 10) : 60000,
  };
}
