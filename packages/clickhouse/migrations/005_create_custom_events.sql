-- Migration: 005_create_custom_events
-- Table: custom_events
-- Engine: MergeTree, partitioned by month, sorted by (project_id, timestamp, id)

CREATE TABLE IF NOT EXISTS pulsestack.custom_events
(
    id          String,
    project_id  String,
    timestamp   DateTime64(3, 'UTC'),
    name        String,
    payload     String DEFAULT '{}',    -- JSON-encoded arbitrary payload
    attributes  Map(String, String),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
SETTINGS index_granularity = 8192;
