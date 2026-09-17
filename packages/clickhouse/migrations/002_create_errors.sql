-- Migration: 002_create_errors
-- Table: errors
-- Engine: MergeTree, partitioned by month, sorted by (project_id, timestamp, id)

CREATE TABLE IF NOT EXISTS pulsestack.errors
(
    id          String,
    project_id  String,
    timestamp   DateTime64(3, 'UTC'),
    name        String,
    message     String,
    stack       Nullable(String),
    fingerprint Nullable(String),
    handled     Bool DEFAULT false,
    context     String DEFAULT '{}',   -- JSON-encoded key-value context
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
SETTINGS index_granularity = 8192;
