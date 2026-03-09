/**
 * Simulador de Operaciones
 * 
 * Genera pedidos aleatorios y los envía a:
 * - PostgreSQL (OLTP) - Base de datos operacional
 * - Redpanda (Kafka) - Para streaming a ClickHouse
 * 
 * ClickHouse consume automáticamente del topic 'orders' via Kafka Engine.
 * En producción, usarías CDC (Debezium) en lugar de escribir a ambos.
 */

const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

// Configuración
const INTERVAL = parseInt(process.env.INTERVAL) || 2000;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const PG_URL = process.env.PG_URL || 'postgres://admin:secret@localhost:5432/operations';

// Datos de prueba
const TENANTS = ['tenant_A', 'tenant_B', 'tenant_C'];
const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Home'];
const STATUSES = ['pending', 'completed', 'shipped', 'cancelled'];
const REGIONS = ['North', 'South', 'East', 'West'];

// Clientes
const kafka = new Kafka({
  clientId: 'observability-simulator',
  brokers: [KAFKA_BROKER]
});
const producer = kafka.producer();
const pg = new Pool({ connectionString: PG_URL });

// Generar UUID simple
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Elegir elemento aleatorio
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generar pedido aleatorio
function generateOrder() {
  return {
    order_id: `ORD-${uuid().slice(0, 8)}`,
    tenant_id: pick(TENANTS),
    customer_id: `CUST-${Math.floor(Math.random() * 1000)}`,
    product_category: pick(CATEGORIES),
    amount: Math.floor(Math.random() * 500) + 10,
    quantity: Math.floor(Math.random() * 5) + 1,
    status: pick(STATUSES),
    region: pick(REGIONS),
    time: new Date().toISOString()
  };
}

// Inicializar tabla en PostgreSQL
async function initPostgres() {
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
      created_at TIMESTAMPTZ NOT NULL
    )
  `);
  console.log('✅ PostgreSQL table ready');
}

// Crear topic en Redpanda
async function initKafka() {
  const admin = kafka.admin();
  await admin.connect();
  
  const topics = await admin.listTopics();
  if (!topics.includes('orders')) {
    await admin.createTopics({
      topics: [{ topic: 'orders', numPartitions: 3 }]
    });
    console.log('✅ Kafka topic "orders" created');
  } else {
    console.log('✅ Kafka topic "orders" exists');
  }
  
  await admin.disconnect();
}

// Loop principal
async function simulate() {
  console.log('🚀 Starting Observability Simulator');
  console.log(`   Kafka: ${KAFKA_BROKER}`);
  console.log(`   Interval: ${INTERVAL}ms`);
  console.log(`   Tenants: ${TENANTS.join(', ')}`);
  console.log('');
  
  await initPostgres();
  await initKafka();
  await producer.connect();
  
  console.log('');
  console.log('📊 Generating orders... (Ctrl+C to stop)');
  console.log('');
  
  let count = 0;
  
  setInterval(async () => {
    try {
      const order = generateOrder();
      count++;
      
      // Escribir en PostgreSQL (OLTP)
      await pg.query(
        `INSERT INTO orders (order_id, tenant_id, customer_id, product_category, amount, quantity, status, region, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [order.order_id, order.tenant_id, order.customer_id, order.product_category, 
         order.amount, order.quantity, order.status, order.region, order.time]
      );
      
      // Enviar a Redpanda → ClickHouse lo consume automáticamente
      await producer.send({
        topic: 'orders',
        messages: [{
          key: order.tenant_id,
          value: JSON.stringify(order)
        }]
      });
      
      console.log(
        `[${count}] ${order.tenant_id} | ${order.product_category.padEnd(12)} | $${order.amount.toString().padStart(3)} | ${order.status}`
      );
      
    } catch (error) {
      console.error('Error:', error.message);
    }
  }, INTERVAL);
}

// Manejo de señales
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  await producer.disconnect();
  await pg.end();
  process.exit(0);
});

simulate().catch(console.error);
