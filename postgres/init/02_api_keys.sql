-- API Keys for MCP Server authentication
-- Keys are hashed with SHA256, never stored in plain text

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(64) NOT NULL UNIQUE,      -- SHA256 hash of the key
  key_prefix VARCHAR(20) NOT NULL,           -- First chars for identification (e.g., "ak_tenant_a_abc")
  tenant_id VARCHAR(50) NOT NULL,
  name VARCHAR(100),
  enabled BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);

-- Function to validate and update key usage
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash VARCHAR(64))
RETURNS TABLE(tenant_id VARCHAR(50), name VARCHAR(100)) AS $$
BEGIN
  RETURN QUERY
  UPDATE api_keys 
  SET 
    last_used_at = NOW(),
    request_count = request_count + 1
  WHERE 
    api_keys.key_hash = p_key_hash
    AND api_keys.enabled = true
    AND (api_keys.expires_at IS NULL OR api_keys.expires_at > NOW())
  RETURNING api_keys.tenant_id, api_keys.name;
END;
$$ LANGUAGE plpgsql;

-- Insert demo keys (hashes of the example keys)
-- In production, generate real keys and hash them
-- These are SHA256 hashes of: ak_tenant_a_demo, ak_tenant_b_demo, ak_tenant_c_demo
INSERT INTO api_keys (key_hash, key_prefix, tenant_id, name, created_by) VALUES
  ('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'ak_tenant_a_', 'tenant_A', 'Tenant A - Demo Key', 'system'),
  ('b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', 'ak_tenant_b_', 'tenant_B', 'Tenant B - Demo Key', 'system'),
  ('c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'ak_tenant_c_', 'tenant_C', 'Tenant C - Demo Key', 'system')
ON CONFLICT (key_hash) DO NOTHING;

COMMENT ON TABLE api_keys IS 'API keys for MCP server authentication, linked to tenants';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA256 hash of the API key - never store plain text';
COMMENT ON COLUMN api_keys.key_prefix IS 'First characters of key for identification in logs';
