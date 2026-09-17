-- Initialization script for ClickHouse in docker-compose
-- Ensures pulsestack database and analytical tables are ready on startup

CREATE DATABASE IF NOT EXISTS pulsestack;

-- 001_create_http_requests
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

-- 002_create_errors
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
    context     String DEFAULT '{}',
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
SETTINGS index_granularity = 8192;

-- 003_create_database_queries
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

-- 004_create_background_jobs
CREATE TABLE IF NOT EXISTS pulsestack.background_jobs
(
    id          String,
    project_id  String,
    timestamp   DateTime64(3, 'UTC'),
    queue       String,
    name        String,
    duration_ms Float64,
    status      LowCardinality(String),
    attempts    UInt8 DEFAULT 1,
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
SETTINGS index_granularity = 8192;

-- 005_create_custom_events
CREATE TABLE IF NOT EXISTS pulsestack.custom_events
(
    id          String,
    project_id  String,
    timestamp   DateTime64(3, 'UTC'),
    name        String,
    payload     String DEFAULT '{}',
    attributes  Map(String, String),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp, id)
SETTINGS index_granularity = 8192;
