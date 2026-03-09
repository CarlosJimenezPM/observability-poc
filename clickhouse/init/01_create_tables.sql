-- =============================================
-- ClickHouse: Tablas para Observability PoC
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
-- TABLA KAFKA: consume de Redpanda
-- ============================================
-- Esta tabla actúa como "puerta de entrada"
-- Los datos se leen de Kafka y se consumen una vez
CREATE TABLE IF NOT EXISTS orders_queue (
    order_id String,
    tenant_id String,
    customer_id Nullable(String),
    product_category String,
    amount Float64,
    quantity UInt32,
    status String,
    region String,
    time DateTime64(3)
)
ENGINE = Kafka
SETTINGS 
    kafka_broker_list = 'redpanda:9092',
    kafka_topic_list = 'orders',
    kafka_group_name = 'clickhouse_orders_consumer',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_max_block_size = 1048576;

-- ============================================
-- MATERIALIZED VIEW: mueve datos automáticamente
-- ============================================
-- Cada vez que llegan datos a orders_queue,
-- se insertan automáticamente en orders
CREATE MATERIALIZED VIEW IF NOT EXISTS orders_consumer TO orders AS
SELECT 
    time,
    tenant_id,
    order_id,
    customer_id,
    product_category,
    toDecimal64(amount, 2) AS amount,
    quantity,
    status,
    region
FROM orders_queue;

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

SELECT '✅ ClickHouse tables ready - Kafka consumer active on topic: orders' as status;
