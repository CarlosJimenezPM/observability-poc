/**
 * Simulador de Operaciones
 * 
 * Genera pedidos aleatorios y los envía a:
 * - PostgreSQL (OLTP) - Base de datos operacional
 * - Redpanda (Kafka) - Para streaming a ClickHouse
 * 
 * En producción, usarías CDC (Debezium) en lugar de escribir a ambos.
 */

const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

// Configuración
const INTERVAL = parseInt(process.env.INTERVAL) || 2000; // ms entre pedidos
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const PG_URL = process.env.PG_URL || 'postgres://admin:secret@localhost:5432/operations';

// Datos de prueba
const TENANTS = ['tenant_A', 'tenant_B', 'tenant_C'];
const PRODUCTS = [
  { name: 'Widget Pro', minPrice: 50, maxPrice: 200 },
  { name: 'Gadget Plus', minPrice: 100, maxPrice: 500 },
  { name: 'Gizmo Ultra', minPrice: 200, maxPrice: 1000 },
  { name: 'Device Basic', minPrice: 10, maxPrice: 50 },
  { name: 'Tool Standard', minPrice: 25, maxPrice: 100 }
];

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

// Generar pedido aleatorio
function generateOrder() {
  const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
  const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
  const amount = Math.floor(Math.random() * (product.maxPrice - product.minPrice)) + product.minPrice;
  
  return {
    id: uuid(),
    tenant_id: tenant,
    product: product.name,
    amount: amount,
    timestamp: new Date().toISOString()
  };
}

// Inicializar tabla en PostgreSQL
async function initPostgres() {
  await pg.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(50) NOT NULL,
      product VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
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
  console.log(`   Interval: ${INTERVAL}ms`);
  console.log(`   Tenants: ${TENANTS.join(', ')}`);
  console.log('');
  
  await initPostgres();
  await initKafka();
  await producer.connect();
  
  console.log('');
  console.log('📊 Generating orders...');
  console.log('');
  
  let count = 0;
  
  setInterval(async () => {
    try {
      const order = generateOrder();
      count++;
      
      // Escribir en PostgreSQL (OLTP)
      await pg.query(
        'INSERT INTO orders (id, tenant_id, product, amount, created_at) VALUES ($1, $2, $3, $4, $5)',
        [order.id, order.tenant_id, order.product, order.amount, order.timestamp]
      );
      
      // Enviar a Redpanda (streaming a ClickHouse)
      await producer.send({
        topic: 'orders',
        messages: [{
          key: order.tenant_id,  // Particionado por tenant
          value: JSON.stringify(order)
        }]
      });
      
      console.log(
        `[${count}] ${order.tenant_id} | ${order.product.padEnd(15)} | $${order.amount.toString().padStart(4)}`
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

// Iniciar
simulate().catch(console.error);
