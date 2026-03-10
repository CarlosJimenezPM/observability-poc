/**
 * Simulador de Operaciones (CDC Mode)
 * 
 * Genera pedidos aleatorios y los escribe SOLO a PostgreSQL.
 * 
 * Debezium CDC captura los cambios del WAL de PostgreSQL y los envía
 * automáticamente a Redpanda. ClickHouse consume de Redpanda.
 * 
 * Flow: Simulator → PostgreSQL → (WAL) → Debezium → Redpanda → ClickHouse
 * 
 * This is the CORRECT pattern: no dual-write, guaranteed consistency.
 */

const { Pool } = require('pg');

// Configuración
const INTERVAL = parseInt(process.env.INTERVAL) || 2000;
const PG_URL = process.env.PG_URL || 'postgres://admin:secret@localhost:5432/operations';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 1;

// Datos de prueba
const TENANTS = ['tenant_A', 'tenant_B', 'tenant_C'];
const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Home'];
const STATUSES = ['pending', 'completed', 'shipped', 'cancelled'];
const REGIONS = ['North', 'South', 'East', 'West'];

// Cliente PostgreSQL
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
    region: pick(REGIONS)
  };
}

// Verificar que la tabla existe
async function ensureTable() {
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

// Loop principal
async function simulate() {
  console.log('');
  console.log('🚀 Observability Simulator (CDC Mode)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('   Architecture:');
  console.log('   Simulator → PostgreSQL → (WAL) → Debezium → Redpanda → ClickHouse');
  console.log('');
  console.log('   ✓ This simulator writes ONLY to PostgreSQL');
  console.log('   ✓ Debezium captures changes from the WAL automatically');
  console.log('   ✓ No dual-write = guaranteed consistency');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   PostgreSQL: ${PG_URL.replace(/:[^:]*@/, ':***@')}`);
  console.log(`   Interval: ${INTERVAL}ms`);
  console.log(`   Batch size: ${BATCH_SIZE}`);
  console.log(`   Tenants: ${TENANTS.join(', ')}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  await ensureTable();
  
  console.log('');
  console.log('📊 Generating orders... (Ctrl+C to stop)');
  console.log('');
  
  let count = 0;
  
  setInterval(async () => {
    try {
      // Generate batch of orders
      const orders = Array.from({ length: BATCH_SIZE }, generateOrder);
      
      // Insert all orders in a single transaction
      const client = await pg.connect();
      try {
        await client.query('BEGIN');
        
        for (const order of orders) {
          await client.query(
            `INSERT INTO orders (order_id, tenant_id, customer_id, product_category, amount, quantity, status, region) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [order.order_id, order.tenant_id, order.customer_id, order.product_category, 
             order.amount, order.quantity, order.status, order.region]
          );
          
          count++;
          console.log(
            `[${count}] ${order.tenant_id} | ${order.product_category.padEnd(12)} | $${order.amount.toString().padStart(3)} | ${order.status}`
          );
        }
        
        await client.query('COMMIT');
        
        if (BATCH_SIZE > 1) {
          console.log(`    └─ Committed batch of ${BATCH_SIZE} orders`);
        }
        
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }, INTERVAL);
}

// Manejo de señales
process.on('SIGINT', async () => {
  console.log('\n');
  console.log('🛑 Shutting down...');
  await pg.end();
  console.log('✅ PostgreSQL connection closed');
  process.exit(0);
});

simulate().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
