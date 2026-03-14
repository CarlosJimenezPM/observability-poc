#!/usr/bin/env node
/**
 * CDC Consumer for TimescaleDB
 * Consumes events from Redpanda (Debezium CDC) and inserts into TimescaleDB
 * 
 * This is the ARM equivalent of ClickHouse's Kafka Engine
 */

import { Kafka } from "kafkajs";
import pg from "pg";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "redpanda:9092").split(",");
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "cdc.public.orders";
const KAFKA_GROUP = process.env.KAFKA_GROUP || "timescale-cdc-consumer";

const PG_URL = process.env.PG_URL || "postgresql://admin:secret@timescaledb:5432/analytics";

console.log("🚀 CDC Consumer starting...");
console.log(`   Kafka: ${KAFKA_BROKERS.join(", ")}`);
console.log(`   Topic: ${KAFKA_TOPIC}`);
console.log(`   PostgreSQL: ${PG_URL.replace(/:[^:@]+@/, ":***@")}`);

// --- PostgreSQL connection ---
const pool = new pg.Pool({ connectionString: PG_URL });

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("✅ Connected to TimescaleDB");
  } finally {
    client.release();
  }
}

// --- Insert order into TimescaleDB ---
async function insertOrder(order) {
  // Check if order already exists (TimescaleDB doesn't support simple UNIQUE on non-partition columns)
  const checkQuery = "SELECT 1 FROM orders WHERE order_id = $1 LIMIT 1";
  const existing = await pool.query(checkQuery, [order.order_id]);
  
  if (existing.rows.length > 0) {
    console.log(`⏭️  Order ${order.order_id} already exists, skipping`);
    return;
  }
  
  const query = `
    INSERT INTO orders (time, tenant_id, order_id, customer_id, product_category, amount, quantity, status, region)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  
  const values = [
    order.created_at ? new Date(order.created_at) : new Date(),
    order.tenant_id,
    order.order_id,
    order.customer_id,
    order.product_category,
    order.amount,
    order.quantity,
    order.status,
    order.region,
  ];
  
  await pool.query(query, values);
}

// --- Kafka consumer ---
const kafka = new Kafka({
  clientId: "cdc-consumer",
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 1000,
    retries: 10,
  },
});

const consumer = kafka.consumer({ groupId: KAFKA_GROUP });

async function startConsumer() {
  await consumer.connect();
  console.log("✅ Connected to Redpanda");
  
  await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: false });
  console.log(`✅ Subscribed to topic: ${KAFKA_TOPIC}`);
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const value = message.value?.toString();
        if (!value) return;
        
        const event = JSON.parse(value);
        
        // Debezium format: payload contains the actual data
        // With ExtractNewRecordState SMT, we get flat records
        const order = event.payload || event;
        
        if (!order.order_id) {
          console.log("⚠️  Skipping message without order_id");
          return;
        }
        
        await insertOrder(order);
        console.log(`✓ Inserted order ${order.order_id} for ${order.tenant_id}`);
        
      } catch (error) {
        console.error("❌ Error processing message:", error.message);
      }
    },
  });
}

// --- Main ---
async function main() {
  await initDb();
  await startConsumer();
  console.log("🎯 CDC Consumer running - waiting for events...");
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await consumer.disconnect();
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  await pool.end();
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
