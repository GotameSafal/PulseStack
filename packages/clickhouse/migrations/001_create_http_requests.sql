-- Migration: 001_create_http_requests
-- Table: http_requests
-- Engine: MergeTree, partitioned by month, sorted by (project_id, timestamp, id)

CREATE TABLE IF NOT EXISTS pulsestack.http_requests
(
    id            String,
    project_id    String,
    timestamp     DateTime64(3, 'UTC'),
    method        LowCardinality(String),
    path          String,
    status_code   UInt16,
    duration_ms   Float64,
    client_ip     Nullable(String),
    user_agent    Nullable(String),
    headers       Map(String, String),
    query_params  Map(String, String),
    request_body_size  Nullable(UInt32),
    response_body_size Nullable(UInt32),
    ingested_at   DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
SETTINGS index_granularity = 8192;
