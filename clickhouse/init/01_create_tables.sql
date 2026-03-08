-- =============================================
-- ClickHouse: Tablas para Observability PoC
-- =============================================

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
-- TABLA: orders (Demo analytics)
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
-- DATOS DE EJEMPLO
-- ============================================

-- Generar 1000 orders de ejemplo
INSERT INTO orders (time, tenant_id, order_id, customer_id, product_category, amount, quantity, status, region)
SELECT
    now() - toIntervalDay(rand() % 30),
    concat('tenant_', toString(1 + rand() % 3)),
    concat('ORD-', toString(number)),
    concat('CUST-', toString(1 + rand() % 100)),
    arrayElement(['Electronics', 'Clothing', 'Food', 'Books', 'Home'], 1 + rand() % 5),
    round(10 + rand() % 490, 2),
    1 + rand() % 5,
    arrayElement(['completed', 'pending', 'shipped', 'cancelled'], 1 + rand() % 4),
    arrayElement(['North', 'South', 'East', 'West'], 1 + rand() % 4)
FROM numbers(1000);

-- Generar 5000 métricas de ejemplo
INSERT INTO metrics (time, tenant_id, metric_name, value, source)
SELECT
    now() - toIntervalHour(rand() % 168),
    concat('tenant_', toString(1 + rand() % 3)),
    arrayElement(['cpu_usage', 'memory_usage', 'request_latency', 'error_rate'], 1 + rand() % 4),
    rand() % 100,
    'simulator'
FROM numbers(5000);

SELECT 'ClickHouse initialized with sample data' as status;
