# Plan de Implementación PoC

## Objetivo

Construir una PoC funcional que corra en local con Docker Compose, sin gastar en cloud.

---

## Stack del PoC (Azure → Open Source)

| Concepto | Azure (Producción) | PoC (Local) |
|----------|-------------------|-------------|
| OLTP | PostgreSQL Flexible | PostgreSQL |
| Streaming | Event Hubs | Redpanda (Kafka ligero) |
| OLAP | Azure Data Explorer | ClickHouse |
| Semantic Layer | Cube.js en App Service | Cube.js en Docker |

> **Redpanda:** Clon de Kafka en C++, no requiere Zookeeper. Perfecto para local.

---

## Fases de Implementación

### Fase 1: Infraestructura (`docker-compose.yml`)

Levanta los 4 servicios:
- PostgreSQL (OLTP)
- Redpanda (Streaming)
- ClickHouse (OLAP)
- Cube.js (Semantic Layer)

> ⚠️ **Seguridad:** Los valores por defecto son solo para desarrollo local. Ver `.env.example` para configuración de producción.

```yaml
# docker-compose.yml (simplificado)
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-operations}
      POSTGRES_USER: ${POSTGRES_USER:-admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secret}
    ports:
      - "5432:5432"  # ⚠️ Producción: usar red interna

  redpanda:
    image: redpandadata/redpanda:latest
    command:
      - redpanda start
      - --smp 1
      - --memory 512M
      - --overprovisioned
      # Dual listener: interno (Docker) + externo (host)
      - --kafka-addr internal://0.0.0.0:9092,external://0.0.0.0:19092
      - --advertise-kafka-addr internal://redpanda:9092,external://localhost:19092
    ports:
      - "19092:19092"  # Acceso desde host
      - "9092:9092"    # Red interna Docker

  clickhouse:
    image: clickhouse/clickhouse-server:latest
    ports:
      - "8123:8123"
      - "9000:9000"
    volumes:
      - ./clickhouse/init:/docker-entrypoint-initdb.d

  cube:
    image: cubejs/cube:latest
    ports:
      - "4000:4000"
    environment:
      CUBEJS_DB_TYPE: clickhouse
      CUBEJS_DB_HOST: clickhouse
      CUBEJS_API_SECRET: ${CUBEJS_API_SECRET:-dev-secret}
      CUBEJS_DEV_MODE: ${CUBEJS_DEV_MODE:-true}  # ⚠️ false en producción
    volumes:
      - ./cube:/cube/conf
```

---

### Fase 2: Simulador de Operación (`simulator.js`)

Script que genera datos falsos cada 2 segundos.

```javascript
// simulator.js
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

const kafka = new Kafka({ brokers: ['localhost:9092'] });
const producer = kafka.producer();
const pg = new Pool({ connectionString: 'postgres://admin:secret@localhost/operations' });

const tenants = ['tenant_A', 'tenant_B', 'tenant_C'];
const products = ['Widget', 'Gadget', 'Gizmo'];

async function simulate() {
  await producer.connect();
  
  setInterval(async () => {
    const order = {
      id: crypto.randomUUID(),
      tenant_id: tenants[Math.floor(Math.random() * tenants.length)],
      product: products[Math.floor(Math.random() * products.length)],
      amount: Math.floor(Math.random() * 1000) + 10,
      timestamp: new Date().toISOString()
    };
    
    // Escribir en Postgres (OLTP)
    await pg.query(
      'INSERT INTO orders (id, tenant_id, product, amount, created_at) VALUES ($1, $2, $3, $4, $5)',
      [order.id, order.tenant_id, order.product, order.amount, order.timestamp]
    );
    
    // Enviar a Redpanda (simula CDC)
    await producer.send({
      topic: 'orders',
      messages: [{ value: JSON.stringify(order) }]
    });
    
    console.log('Order created:', order);
  }, 2000);
}

simulate();
```

> **Nota:** En producción usarías CDC (Debezium) en lugar de escribir a ambos.

---

### Fase 3: Ingesta en ClickHouse

ClickHouse lee directamente de Kafka/Redpanda sin código.

```sql
-- 1. Tabla conectada a Redpanda
CREATE TABLE orders_kafka (
    id String,
    tenant_id String,
    product String,
    amount Float64,
    timestamp DateTime64
) ENGINE = Kafka
SETTINGS 
    kafka_broker_list = 'redpanda:9092',
    kafka_topic_list = 'orders',
    kafka_group_name = 'clickhouse_consumer',
    kafka_format = 'JSONEachRow';

-- 2. Tabla OLAP optimizada
CREATE TABLE orders_olap (
    id String,
    tenant_id String,
    product String,
    amount Float64,
    timestamp DateTime64
) ENGINE = MergeTree()
ORDER BY (tenant_id, timestamp);

-- 3. Materialized View que mueve datos automáticamente
CREATE MATERIALIZED VIEW orders_mv TO orders_olap AS
SELECT * FROM orders_kafka;
```

> Los datos fluyen automáticamente: Redpanda → orders_kafka → orders_olap

---

### Fase 4: Capa Semántica con Cube.js

#### Schema (`cube/schema/Orders.js`)

```javascript
cube('Orders', {
  sql: `SELECT * FROM orders_olap`,
  
  // SEGURIDAD: Filtro obligatorio por tenant
  queryRewrite: (query, { securityContext }) => {
    if (!securityContext.tenantId) {
      throw new Error('Tenant ID required');
    }
    query.filters.push({
      member: 'Orders.tenantId',
      operator: 'equals',
      values: [securityContext.tenantId]
    });
    return query;
  },
  
  measures: {
    count: { type: 'count' },
    totalAmount: { type: 'sum', sql: 'amount' },
    avgAmount: { type: 'avg', sql: 'amount' }
  },
  
  dimensions: {
    id: { sql: 'id', type: 'string', primaryKey: true },
    tenantId: { sql: 'tenant_id', type: 'string' },
    product: { sql: 'product', type: 'string' },
    timestamp: { sql: 'timestamp', type: 'time' }
  }
});
```

---

## Estructura del Repositorio

```
observability-poc/
├── .env.example             # Template de variables (copiar a .env)
├── .gitignore               # Excluye .env, node_modules, etc.
├── README.md
├── docker-compose.yml       # Stack x86_64 (ClickHouse)
├── docker-compose.arm.yml   # Stack ARM64 (TimescaleDB)
├── docs/                    # Documentación arquitectónica
├── simulator/
│   ├── package.json
│   └── simulator.js
├── clickhouse/
│   └── init/
│       └── 01_create_tables.sql
├── timescaledb/
│   └── init/                # Scripts para ARM
├── cube/
│   └── model/
│       └── Orders.yaml      # Schema Cube.js
└── demo/
    └── test_multitenancy.sh # Scripts de demo
```

---

## Demo de Seguridad Multitenant

> ⚠️ **SOLO PARA DEMO:** Los tokens Base64 no son seguros. En producción, usa JWT firmados con RS256/HS256.

```bash
# test_multitenancy.sh

# Token para Tenant A (⚠️ Base64 = solo demo)
TOKEN_A=$(echo '{"tenantId":"tenant_A"}' | base64)

# Token para Tenant B  
TOKEN_B=$(echo '{"tenantId":"tenant_B"}' | base64)

echo "=== Datos de Tenant A ==="
curl -H "Authorization: Bearer $TOKEN_A" \
  "http://localhost:4000/cubejs-api/v1/load?query={\"measures\":[\"Orders.totalAmount\"]}"

echo "=== Datos de Tenant B ==="
curl -H "Authorization: Bearer $TOKEN_B" \
  "http://localhost:4000/cubejs-api/v1/load?query={\"measures\":[\"Orders.totalAmount\"]}"

# Cada uno ve SOLO sus datos
```

### Producción: JWT Firmados

```javascript
// cube.js
const jwt = require('jsonwebtoken');

module.exports = {
  checkAuth: (req, auth) => {
    // Verificar firma del JWT
    const decoded = jwt.verify(auth, process.env.CUBEJS_API_SECRET);
    req.securityContext = { tenantId: decoded.tenantId };
  }
};
```

---

## README.md del Repo

```markdown
# Real-Time Multitenant Observability PoC

## Problema que resuelve
- ❌ Dual-write (inconsistencia)
- ❌ Latencia en dashboards
- ❌ Filtración de datos entre tenants

## Arquitectura
[Diagrama Mermaid aquí]

## Stack
- PostgreSQL (OLTP)
- Redpanda (Streaming)
- ClickHouse (OLAP)
- Cube.js (Semantic Layer)

## Ejecutar
docker-compose up -d
cd simulator && npm install && npm start

## Demo Multitenant
./demo/test_multitenancy.sh
```

---

## Checklist de Implementación

- [ ] Crear `docker-compose.yml`
- [ ] Script `simulator.js` con datos de prueba
- [ ] Tablas ClickHouse + Materialized View
- [ ] Schema Cube.js con `queryRewrite`
- [ ] Script de demo multitenancy
- [ ] README con diagrama y instrucciones
- [ ] Video demo (opcional, muy impactante)
