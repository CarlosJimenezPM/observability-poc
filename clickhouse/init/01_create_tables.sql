-- =============================================
-- ClickHouse: Tablas para Observability PoC
-- =============================================
-- 
-- Data flow:
--   PostgreSQL → Debezium CDC → Redpanda → ClickHouse
--   Topic: cdc.public.orders (created by Debezium)
--
-- =============================================

-- ============================================
-- TABLA: orders (destino final OLAP)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    time DateTime64(3) DEFAULT now64(3),
    tenant_id LowCardinality(String),
    order_id String,
    customer_id Nullable(String),
    product_category LowCardinality(String),
    amount Decimal(12, 2),
    quantity UInt32,
    status LowCardinality(String),
    region LowCardinality(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(time)
ORDER BY (tenant_id, time, order_id);

-- ============================================
-- TABLA KAFKA: consume CDC events from Redpanda
-- ============================================
-- Debezium sends data to topic: cdc.public.orders
-- With ExtractNewRecordState transform, we get flat records
-- Field names match PostgreSQL column names
CREATE TABLE IF NOT EXISTS orders_queue (
    order_id String,
    tenant_id String,
    customer_id Nullable(String),
    product_category String,
    amount Float64,
    quantity Int32,
    status String,
    region String,
    created_at String  -- ISO timestamp from PostgreSQL
)
ENGINE = Kafka
SETTINGS 
    kafka_broker_list = 'redpanda:9092',
    kafka_topic_list = 'cdc.public.orders',
    kafka_group_name = 'clickhouse_cdc_consumer',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_max_block_size = 1048576,
    kafka_skip_broken_messages = 100;

-- ============================================
-- MATERIALIZED VIEW: CDC → orders
-- ============================================
-- Transforms CDC records into OLAP format
CREATE MATERIALIZED VIEW IF NOT EXISTS orders_consumer TO orders AS
SELECT 
    parseDateTime64BestEffortOrNull(created_at, 3) AS time,
    tenant_id,
    order_id,
    customer_id,
    product_category,
    toDecimal64(amount, 2) AS amount,
    toUInt32(quantity) AS quantity,
    status,
    region
FROM orders_queue
WHERE order_id != '';  -- Skip any malformed records

-- ============================================
-- TABLA: events (Event sourcing)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    time DateTime64(3) DEFAULT now64(3),
    tenant_id LowCardinality(String),
    event_type LowCardinality(String),
    source LowCardinality(String),
    payload String,
    user_id Nullable(String),
    session_id Nullable(String),
    metadata String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(time)
ORDER BY (tenant_id, event_type, time)
TTL toDateTime(time) + INTERVAL 90 DAY;

-- ============================================
-- TABLA: metrics (Time series)
-- ============================================
CREATE TABLE IF NOT EXISTS metrics (
    time DateTime64(3) DEFAULT now64(3),
    tenant_id LowCardinality(String),
    metric_name LowCardinality(String),
    value Float64,
    tags String DEFAULT '{}',
    source LowCardinality(String)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(time)
ORDER BY (tenant_id, metric_name, time)
TTL toDateTime(time) + INTERVAL 30 DAY;

-- ============================================
-- VISTA MATERIALIZADA: orders_daily
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS orders_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(bucket)
ORDER BY (tenant_id, product_category, region, bucket)
AS SELECT
    toStartOfDay(time) AS bucket,
    tenant_id,
    product_category,
    region,
    sum(amount) AS total_amount,
    sum(quantity) AS total_quantity,
    count() AS order_count
FROM orders
GROUP BY bucket, tenant_id, product_category, region;

-- ============================================
-- VISTA MATERIALIZADA: metrics_hourly
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(bucket)
ORDER BY (tenant_id, metric_name, bucket)
AS SELECT
    toStartOfHour(time) AS bucket,
    tenant_id,
    metric_name,
    avg(value) AS avg_value,
    min(value) AS min_value,
    max(value) AS max_value,
    count() AS sample_count
FROM metrics
GROUP BY bucket, tenant_id, metric_name;

SELECT '✅ ClickHouse tables ready - Kafka consumer active on CDC topic: cdc.public.orders' as status;
