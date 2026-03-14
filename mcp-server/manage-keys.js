#!/usr/bin/env node
/**
 * API Key Management CLI
 * 
 * Usage:
 *   node manage-keys.js create <tenant_id> [name]
 *   node manage-keys.js list
 *   node manage-keys.js revoke <key_prefix>
 *   node manage-keys.js rotate <key_prefix>
 */

import { createHash, randomBytes } from "crypto";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";

async function getPool() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  return pool;
}

function generateApiKey(tenantId) {
  const random = randomBytes(20).toString("hex");
  const prefix = `ak_${tenantId.toLowerCase().replace(/[^a-z0-9]/g, "_")}_`;
  return prefix + random;
}

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

async function createKey(tenantId, name) {
  const pool = await getPool();
  
  const apiKey = generateApiKey(tenantId);
  const keyHash = hashKey(apiKey);
  const keyPrefix = apiKey.substring(0, 20);
  
  try {
    await pool.query(
      `INSERT INTO api_keys (key_hash, key_prefix, tenant_id, name, created_by) 
       VALUES ($1, $2, $3, $4, $5)`,
      [keyHash, keyPrefix, tenantId, name || `${tenantId} API Key`, "cli"]
    );
    
    console.log("\n✅ API Key created successfully!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\nAPI Key: ${apiKey}`);
    console.log(`Tenant:  ${tenantId}`);
    console.log(`Name:    ${name || `${tenantId} API Key`}`);
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    console.log("Configure in Claude Desktop (claude_desktop_config.json):\n");
    console.log(JSON.stringify({
      mcpServers: {
        analytics: {
          url: "http://localhost:3001/mcp",
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        }
      }
    }, null, 2));
    
  } catch (error) {
    console.error("❌ Error creating key:", error.message);
  } finally {
    await pool.end();
  }
}

async function listKeys() {
  const pool = await getPool();
  
  try {
    const result = await pool.query(`
      SELECT 
        key_prefix, 
        tenant_id, 
        name, 
        enabled, 
        expires_at,
        last_used_at,
        request_count,
        created_at
      FROM api_keys 
      ORDER BY tenant_id, created_at DESC
    `);
    
    console.log("\n📋 API Keys:\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Prefix               │ Tenant     │ Name                    │ Enabled │ Requests │ Last Used");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    for (const row of result.rows) {
      const lastUsed = row.last_used_at ? new Date(row.last_used_at).toLocaleDateString() : "never";
      console.log(
        `${row.key_prefix.padEnd(20)} │ ${row.tenant_id.padEnd(10)} │ ${(row.name || "").substring(0, 23).padEnd(23)} │ ${row.enabled ? "✅" : "❌"}      │ ${String(row.request_count).padStart(8)} │ ${lastUsed}`
      );
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`Total: ${result.rows.length} keys\n`);
    
  } catch (error) {
    console.error("❌ Error listing keys:", error.message);
  } finally {
    await pool.end();
  }
}

async function revokeKey(keyPrefix) {
  const pool = await getPool();
  
  try {
    const result = await pool.query(
      `UPDATE api_keys SET enabled = false WHERE key_prefix LIKE $1 RETURNING tenant_id, name`,
      [`${keyPrefix}%`]
    );
    
    if (result.rows.length > 0) {
      console.log(`\n✅ Revoked ${result.rows.length} key(s):`);
      for (const row of result.rows) {
        console.log(`   - ${row.name} (${row.tenant_id})`);
      }
      console.log();
    } else {
      console.log(`\n⚠️  No keys found matching prefix: ${keyPrefix}\n`);
    }
    
  } catch (error) {
    console.error("❌ Error revoking key:", error.message);
  } finally {
    await pool.end();
  }
}

async function rotateKey(keyPrefix) {
  const pool = await getPool();
  
  try {
    // Find existing key
    const existing = await pool.query(
      `SELECT tenant_id, name FROM api_keys WHERE key_prefix LIKE $1 AND enabled = true`,
      [`${keyPrefix}%`]
    );
    
    if (existing.rows.length === 0) {
      console.log(`\n⚠️  No active key found matching prefix: ${keyPrefix}\n`);
      await pool.end();
      return;
    }
    
    const { tenant_id, name } = existing.rows[0];
    
    // Revoke old key
    await pool.query(
      `UPDATE api_keys SET enabled = false WHERE key_prefix LIKE $1`,
      [`${keyPrefix}%`]
    );
    
    // Create new key
    const apiKey = generateApiKey(tenant_id);
    const keyHash = hashKey(apiKey);
    const newPrefix = apiKey.substring(0, 20);
    
    await pool.query(
      `INSERT INTO api_keys (key_hash, key_prefix, tenant_id, name, created_by) 
       VALUES ($1, $2, $3, $4, $5)`,
      [keyHash, newPrefix, tenant_id, `${name} (rotated)`, "cli"]
    );
    
    console.log("\n🔄 API Key rotated successfully!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\nNew API Key: ${apiKey}`);
    console.log(`Tenant:      ${tenant_id}`);
    console.log(`Old prefix:  ${keyPrefix}... (now revoked)`);
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
  } catch (error) {
    console.error("❌ Error rotating key:", error.message);
  } finally {
    await pool.end();
  }
}

// CLI
const [,, command, ...args] = process.argv;

switch (command) {
  case "create":
    if (!args[0]) {
      console.log("Usage: node manage-keys.js create <tenant_id> [name]");
      process.exit(1);
    }
    await createKey(args[0], args.slice(1).join(" ") || null);
    break;
    
  case "list":
    await listKeys();
    break;
    
  case "revoke":
    if (!args[0]) {
      console.log("Usage: node manage-keys.js revoke <key_prefix>");
      process.exit(1);
    }
    await revokeKey(args[0]);
    break;
    
  case "rotate":
    if (!args[0]) {
      console.log("Usage: node manage-keys.js rotate <key_prefix>");
      process.exit(1);
    }
    await rotateKey(args[0]);
    break;
    
  default:
    console.log(`
API Key Management CLI

Usage:
  node manage-keys.js create <tenant_id> [name]   Create a new API key
  node manage-keys.js list                        List all API keys
  node manage-keys.js revoke <key_prefix>         Revoke key(s) by prefix
  node manage-keys.js rotate <key_prefix>         Rotate key (revoke old, create new)

Environment:
  DATABASE_URL    PostgreSQL connection string
                  Default: postgresql://postgres:postgres@localhost:5432/postgres
`);
}
