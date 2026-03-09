/**
 * Backend API for the Demo Frontend
 * 
 * Receives orders and writes to:
 * - PostgreSQL (OLTP)
 * - Redpanda (Kafka) → ClickHouse
 */

const express = require('express');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 4001;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:19092';
const PG_URL = process.env.PG_URL || 'postgres://admin:secret@localhost:5432/operations';

// Kafka producer
const kafka = new Kafka({
  clientId: 'demo-frontend',
  brokers: [KAFKA_BROKER]
});
const producer = kafka.producer();

// PostgreSQL pool
const pg = new Pool({ connectionString: PG_URL });

// Initialize
async function init() {
  await producer.connect();
  console.log('✅ Connected to Redpanda');

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
}

// Create order endpoint
app.post('/api/orders', async (req, res) => {
  const order = req.body;

  try {
    // Write to PostgreSQL
    await pg.query(
      `INSERT INTO orders (order_id, tenant_id, customer_id, product_category, amount, quantity, status, region, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [order.order_id, order.tenant_id, order.customer_id, order.product_category,
       order.amount, order.quantity, order.status, order.region, order.time]
    );

    // Send to Redpanda → ClickHouse
    await producer.send({
      topic: 'orders',
      messages: [{
        key: order.tenant_id,
        value: JSON.stringify(order)
      }]
    });

    console.log(`✓ Order ${order.order_id} created for ${order.tenant_id}`);
    res.json({ success: true, order });

  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
init().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});
