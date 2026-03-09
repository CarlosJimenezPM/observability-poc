#!/usr/bin/env node
/**
 * Generate JWT tokens for testing
 * 
 * Usage:
 *   node generate-token.js tenant_A
 *   node generate-token.js tenant_B --expires 1h
 */

const jwt = require('jsonwebtoken');

const SECRET = process.env.CUBEJS_API_SECRET || 'dev-secret-change-in-production';
const tenantId = process.argv[2] || 'tenant_A';
const expiresIn = process.argv[4] || '24h';

const payload = {
  tenantId: tenantId,
  userId: `user_${Math.floor(Math.random() * 1000)}`,
  role: 'user'
};

const token = jwt.sign(payload, SECRET, { expiresIn });

console.log(`\n🔐 JWT Token for ${tenantId}`);
console.log('─'.repeat(50));
console.log(token);
console.log('─'.repeat(50));
console.log(`\nPayload: ${JSON.stringify(payload)}`);
console.log(`Expires: ${expiresIn}`);
console.log(`\nUsage:`);
console.log(`  curl -H "Authorization: Bearer ${token.slice(0, 20)}..." http://localhost:4000/cubejs-api/v1/load?query=...\n`);
