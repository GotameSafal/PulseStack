-- Migration: 003_create_database_queries
-- Table: database_queries
-- Engine: MergeTree, partitioned by month, sorted by (project_id, timestamp, id)

CREATE TABLE IF NOT EXISTS pulsestack.database_queries
(
    id            String,
    project_id    String,
    timestamp     DateTime64(3, 'UTC'),
    query         String,
    duration_ms   Float64,
    table_name    Nullable(String),
    driver        Nullable(LowCardinality(String)),
    rows_affected Nullable(UInt32),
    ingested_at   DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
SETTINGS index_granularity = 8192;
