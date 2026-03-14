/**
 * API Key Authentication
 * PostgreSQL + JSON fallback
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

let pgPool = null;
let useDatabase = false;
let jsonKeys = {};

// --- Hash API key ---
export function hashApiKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

// --- Load JSON fallback keys ---
function loadJsonKeys() {
  try {
    const keysPath = process.env.API_KEYS_FILE || join(__dirname, "..", "api-keys.json");
    const data = JSON.parse(readFileSync(keysPath, "utf-8"));
    console.log(`📁 Loaded ${Object.keys(data.keys).length} API keys from JSON fallback`);
    return data.keys;
  } catch (error) {
    console.log("⚠️  Could not load api-keys.json");
    return {};
  }
}

// --- Initialize PostgreSQL connection ---
export async function initAuth() {
  const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
  
  try {
    pgPool = new pg.Pool({ 
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
    });
    
    const client = await pgPool.connect();
    await client.query("SELECT 1");
    client.release();
    
    console.log("✅ Connected to PostgreSQL for API key validation");
    useDatabase = true;
  } catch (error) {
    console.log("⚠️  PostgreSQL not available, using JSON fallback:", error.message);
    useDatabase = false;
  }
  
  jsonKeys = loadJsonKeys();
  
  return { useDatabase, jsonKeysCount: Object.keys(jsonKeys).length };
}

// --- Close database connection ---
export async function closeAuth() {
  if (pgPool) {
    await pgPool.end();
  }
}

// --- Validate API Key ---
export async function validateApiKey(apiKey) {
  if (!apiKey) return null;
  
  const key = apiKey.replace(/^Bearer\s+/i, "").trim();
  if (!key) return null;
  
  // Try database first
  if (useDatabase && pgPool) {
    try {
      const keyHash = hashApiKey(key);
      const result = await pgPool.query(
        "SELECT * FROM validate_api_key($1)",
        [keyHash]
      );
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        console.log(`🔑 [DB] Authenticated: ${row.name} (${row.tenant_id})`);
        return {
          tenantId: row.tenant_id,
          name: row.name,
          source: "database",
        };
      }
    } catch (error) {
      console.error("Database validation error:", error.message);
    }
  }
  
  // JSON fallback
  const keyData = jsonKeys[key];
  if (keyData && keyData.enabled) {
    console.log(`🔑 [JSON] Authenticated: ${keyData.name} (${keyData.tenantId})`);
    return {
      tenantId: keyData.tenantId,
      name: keyData.name,
      source: "json",
    };
  }
  
  return null;
}

// --- Extract API key from request ---
export function extractApiKey(req) {
  const authHeader = req.headers["authorization"];
  if (authHeader) return authHeader;
  
  const apiKeyHeader = req.headers["x-api-key"];
  if (apiKeyHeader) return apiKeyHeader;
  
  if (req.query.api_key) return req.query.api_key;
  
  return null;
}

// --- Get auth status ---
export function getAuthStatus() {
  return {
    source: useDatabase ? "postgresql" : "json",
    jsonKeysLoaded: Object.keys(jsonKeys).length,
  };
}
