-- ===========================================
-- PostgreSQL CDC Setup for Debezium
-- ===========================================
-- This script prepares PostgreSQL for Change Data Capture

-- Create the orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50),
    product_category VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    region VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Create publication for Debezium CDC
-- This tells PostgreSQL which tables to track for replication
CREATE PUBLICATION debezium_pub FOR TABLE orders;

-- Grant replication permissions to the admin user
-- (In production, use a dedicated replication user)
ALTER USER admin WITH REPLICATION;

-- Log successful setup
DO $$
BEGIN
    RAISE NOTICE 'CDC setup complete: publication "debezium_pub" created for table "orders"';
END $$;
