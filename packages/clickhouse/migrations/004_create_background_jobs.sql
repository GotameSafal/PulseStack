-- Migration: 004_create_background_jobs
-- Table: background_jobs
-- Engine: MergeTree, partitioned by month, sorted by (project_id, timestamp, id)

CREATE TABLE IF NOT EXISTS pulsestack.background_jobs
(
    id          String,
    project_id  String,
    timestamp   DateTime64(3, 'UTC'),
    queue       String,
    name        String,
    duration_ms Float64,
    status      LowCardinality(String),  -- 'started' | 'completed' | 'failed'
    attempts    UInt8 DEFAULT 1,
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
SETTINGS index_granularity = 8192;
