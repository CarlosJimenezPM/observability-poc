-- =============================================
-- ClickHouse: Row-Level Security (RLS)
-- =============================================
--
-- Defense-in-depth: Even if Cube.js fails to filter,
-- ClickHouse will enforce tenant isolation at DB level.
--
-- Usage:
--   SET param_tenant_id = 'tenant_A';
--   SELECT * FROM orders;  -- Only sees tenant_A data
--
-- =============================================

-- ============================================
-- USER: cube (for Cube.js connections)
-- ============================================
-- Password should be changed in production!
CREATE USER IF NOT EXISTS cube 
IDENTIFIED WITH sha256_password BY 'cube_secure_password_change_me'
SETTINGS 
    param_tenant_id = '' CONST;  -- Must be set per session

-- Grant read access to analytics tables
GRANT SELECT ON default.orders TO cube;
GRANT SELECT ON default.orders_daily TO cube;
GRANT SELECT ON default.events TO cube;
GRANT SELECT ON default.metrics TO cube;
GRANT SELECT ON default.metrics_hourly TO cube;

-- ============================================
-- ROW POLICIES: Tenant isolation
-- ============================================

-- Policy for orders table
CREATE ROW POLICY IF NOT EXISTS tenant_isolation_orders ON default.orders
FOR SELECT
USING tenant_id = getSetting('param_tenant_id')
TO cube;

-- Policy for orders_daily materialized view
CREATE ROW POLICY IF NOT EXISTS tenant_isolation_orders_daily ON default.orders_daily
FOR SELECT
USING tenant_id = getSetting('param_tenant_id')
TO cube;

-- Policy for events table
CREATE ROW POLICY IF NOT EXISTS tenant_isolation_events ON default.events
FOR SELECT
USING tenant_id = getSetting('param_tenant_id')
TO cube;

-- Policy for metrics table
CREATE ROW POLICY IF NOT EXISTS tenant_isolation_metrics ON default.metrics
FOR SELECT
USING tenant_id = getSetting('param_tenant_id')
TO cube;

-- Policy for metrics_hourly materialized view
CREATE ROW POLICY IF NOT EXISTS tenant_isolation_metrics_hourly ON default.metrics_hourly
FOR SELECT
USING tenant_id = getSetting('param_tenant_id')
TO cube;

-- ============================================
-- ADMIN USER: For direct access (bypasses RLS)
-- ============================================
-- Keep default user for admin tasks, CDC ingestion, etc.
-- RLS policies only apply to 'cube' user

-- ============================================
-- VERIFICATION
-- ============================================
SELECT '✅ Row-Level Security configured:' as status;
SELECT '   - User "cube" created with RLS policies' as info;
SELECT '   - Policies on: orders, orders_daily, events, metrics, metrics_hourly' as tables;
SELECT '   - Set param_tenant_id before queries' as usage;
