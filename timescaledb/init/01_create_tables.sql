-- Habilitar extensión TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================
-- TABLA: events (Hypertable para series temporales)
-- ============================================
CREATE TABLE events (
    time TIMESTAMPTZ NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    source VARCHAR(100),
    payload JSONB,
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    metadata JSONB
);

-- Convertir a hypertable (particionado automático por tiempo)
SELECT create_hypertable('events', 'time');

-- Índices para consultas frecuentes
CREATE INDEX idx_events_tenant ON events (tenant_id, time DESC);
CREATE INDEX idx_events_type ON events (event_type, time DESC);
CREATE INDEX idx_events_user ON events (user_id, time DESC) WHERE user_id IS NOT NULL;

-- ============================================
-- TABLA: metrics (Hypertable para métricas)
-- ============================================
CREATE TABLE metrics (
    time TIMESTAMPTZ NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    tags JSONB,
    source VARCHAR(100)
);

SELECT create_hypertable('metrics', 'time');

CREATE INDEX idx_metrics_tenant ON metrics (tenant_id, time DESC);
CREATE INDEX idx_metrics_name ON metrics (metric_name, time DESC);

-- ============================================
-- TABLA: orders (Para demo de analytics)
-- ============================================
CREATE TABLE orders (
    time TIMESTAMPTZ NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,
    order_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100),
    product_category VARCHAR(100),
    amount DECIMAL(12,2),
    quantity INTEGER,
    status VARCHAR(50),
    region VARCHAR(50)
);

SELECT create_hypertable('orders', 'time');

CREATE INDEX idx_orders_tenant ON orders (tenant_id, time DESC);
CREATE INDEX idx_orders_status ON orders (status, time DESC);
CREATE INDEX idx_orders_order_id ON orders (order_id);  -- For CDC deduplication

-- ============================================
-- Continuous Aggregates (Pre-agregaciones)
-- ============================================

-- Agregación horaria de métricas
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    tenant_id,
    metric_name,
    AVG(value) as avg_value,
    MIN(value) as min_value,
    MAX(value) as max_value,
    COUNT(*) as sample_count
FROM metrics
GROUP BY bucket, tenant_id, metric_name;

-- Agregación diaria de orders
CREATE MATERIALIZED VIEW orders_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    tenant_id,
    product_category,
    region,
    SUM(amount) as total_amount,
    SUM(quantity) as total_quantity,
    COUNT(*) as order_count
FROM orders
GROUP BY bucket, tenant_id, product_category, region;

-- ============================================
-- Datos de ejemplo
-- ============================================
-- Insert sample data with unique order IDs (INIT- prefix to avoid conflicts with real orders)
INSERT INTO orders (time, tenant_id, order_id, customer_id, product_category, amount, quantity, status, region)
SELECT
    NOW() - (random() * interval '30 days'),
    (ARRAY['tenant_A', 'tenant_B', 'tenant_C'])[1 + floor(random() * 3)::int],
    'INIT-' || to_char(generate_series, 'FM00000'),
    'CUST-' || (1 + floor(random() * 100)::int),
    (ARRAY['Electronics', 'Clothing', 'Food', 'Books', 'Home'])[1 + floor(random() * 5)::int],
    (random() * 500 + 10)::decimal(12,2),
    (1 + floor(random() * 5))::int,
    (ARRAY['completed', 'pending', 'shipped', 'cancelled'])[1 + floor(random() * 4)::int],
    (ARRAY['North', 'South', 'East', 'West'])[1 + floor(random() * 4)::int]
FROM generate_series(1, 1000);

-- Insertar métricas de ejemplo
INSERT INTO metrics (time, tenant_id, metric_name, value, source)
SELECT
    NOW() - (random() * interval '7 days'),
    'tenant_' || (1 + floor(random() * 3)::int),
    (ARRAY['cpu_usage', 'memory_usage', 'request_latency', 'error_rate'])[1 + floor(random() * 4)::int],
    random() * 100,
    'simulator'
FROM generate_series(1, 5000);

SELECT 'TimescaleDB initialized with sample data' as status;
