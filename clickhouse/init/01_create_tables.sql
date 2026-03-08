-- =============================================
-- ClickHouse: Tablas para Observability PoC
-- =============================================

-- 1. Tabla conectada a Redpanda (Kafka Engine)
CREATE TABLE IF NOT EXISTS orders_kafka (
    id String,
    tenant_id String,
    product String,
    amount Float64,
    timestamp DateTime64(3)
) ENGINE = Kafka
SETTINGS 
    kafka_broker_list = 'redpanda:9092',
    kafka_topic_list = 'orders',
    kafka_group_name = 'clickhouse_consumer',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1;

-- 2. Tabla OLAP optimizada para queries analíticas
CREATE TABLE IF NOT EXISTS orders_olap (
    id String,
    tenant_id String,
    product String,
    amount Float64,
    timestamp DateTime64(3),
    
    -- Columnas calculadas para analítica
    date Date DEFAULT toDate(timestamp),
    hour UInt8 DEFAULT toHour(timestamp)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, timestamp, id)
SETTINGS index_granularity = 8192;

-- 3. Materialized View: mueve datos automáticamente Kafka → OLAP
CREATE MATERIALIZED VIEW IF NOT EXISTS orders_mv TO orders_olap AS
SELECT 
    id,
    tenant_id,
    product,
    amount,
    timestamp
FROM orders_kafka;

-- 4. Tabla para métricas agregadas por hora (opcional, optimiza queries)
CREATE TABLE IF NOT EXISTS orders_hourly (
    tenant_id String,
    date Date,
    hour UInt8,
    product String,
    order_count UInt64,
    total_amount Float64,
    avg_amount Float64
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (tenant_id, date, hour, product);

-- 5. Materialized View para agregación automática
CREATE MATERIALIZED VIEW IF NOT EXISTS orders_hourly_mv TO orders_hourly AS
SELECT
    tenant_id,
    toDate(timestamp) AS date,
    toHour(timestamp) AS hour,
    product,
    count() AS order_count,
    sum(amount) AS total_amount,
    avg(amount) AS avg_amount
FROM orders_kafka
GROUP BY tenant_id, date, hour, product;
