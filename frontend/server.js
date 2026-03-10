/**
 * Backend API for the Demo Frontend (CDC Mode)
 * 
 * Receives orders and writes ONLY to PostgreSQL.
 * Debezium CDC captures changes from the WAL and streams to Redpanda.
 * ClickHouse consumes from Redpanda automatically.
 * 
 * Flow: Frontend → API → PostgreSQL → (WAL) → Debezium → Redpanda → ClickHouse
 * 
 * This is the CORRECT pattern: no dual-write, guaranteed consistency.
 */

import 'dotenv/config';
import express from 'express';
import pgModule from 'pg';

const { Pool } = pgModule;

const app = express();
app.use(express.json());

// Configuration from environment
const PORT = process.env.PORT || 4001;
const PG_URL = process.env.PG_URL || 'postgres://admin:secret@localhost:5432/operations';

// PostgreSQL connection
const pg = new Pool({ connectionString: PG_URL });

// Initialize
async function init() {
  // Test connection
  try {
    await pg.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL');
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
    throw err;
  }

  // Create table if not exists
  await pg.query(`
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
    )
  `);
  console.log('✅ PostgreSQL table ready');
  
  console.log('');
  console.log('📋 CDC Pipeline:');
  console.log('   API → PostgreSQL → (WAL) → Debezium → Redpanda → ClickHouse');
  console.log('');
}

// Create order endpoint
app.post('/api/orders', async (req, res) => {
  const order = req.body;

  try {
    // Write ONLY to PostgreSQL
    // Debezium CDC will capture this and stream to Redpanda → ClickHouse
    await pg.query(
      `INSERT INTO orders (order_id, tenant_id, customer_id, product_category, amount, quantity, status, region, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [order.order_id, order.tenant_id, order.customer_id, order.product_category,
       order.amount, order.quantity, order.status, order.region, order.time || new Date().toISOString()]
    );

    console.log(`✓ Order ${order.order_id} created for ${order.tenant_id} (CDC will stream to OLAP)`);
    res.json({ success: true, order });

  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pg.query('SELECT 1');
    res.json({ status: 'ok', mode: 'cdc' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Start server
init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API server running on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});
