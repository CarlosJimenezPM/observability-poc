# 🔭 Real-Time Multitenant Observability PoC

Proof of Concept de arquitectura de observabilidad en tiempo real para SaaS multitenant.

## 🎯 Problema que resuelve

| Problema | Solución |
|----------|----------|
| ❌ Dual-write (inconsistencia) | ✅ CDC → Event streaming |
| ❌ Dashboards lentos | ✅ OLAP separada (ClickHouse) |
| ❌ Datos filtrados entre tenants | ✅ Semantic Layer con filtro obligatorio |
| ❌ IA con alucinaciones | ✅ MCP sobre Cube.js |

## 🏗️ Arquitectura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Simulator  │────▶│  PostgreSQL │     │             │
│  (Orders)   │     │   (OLTP)    │     │             │
└──────┬──────┘     └─────────────┘     │             │
       │                                │  ClickHouse │
       │ Kafka/Redpanda                 │   (OLAP)    │
       └───────────────────────────────▶│             │
                                        └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │   Cube.js   │
                                        │  + tenant   │
                                        │   filter    │
                                        └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │  Dashboard  │
                                        │  / Chatbot  │
                                        └─────────────┘
```

## 🛠️ Stack

| Componente | Tecnología | Puerto |
|------------|------------|--------|
| OLTP | PostgreSQL | 5432 |
| Streaming | Redpanda (Kafka) | 9092 |
| OLAP | ClickHouse | 8123 |
| Semantic Layer | Cube.js | 4000 |

## 🚀 Quick Start

### 1. Levantar infraestructura

```bash
docker-compose up -d
```

### 2. Esperar a que los servicios estén listos (~30s)

```bash
docker-compose ps
```

### 3. Iniciar el simulador

```bash
cd simulator
npm install
npm start
```

### 4. Ver datos en ClickHouse

```bash
docker exec -it observability-poc-clickhouse-1 clickhouse-client

SELECT tenant_id, count(), sum(amount) 
FROM orders_olap 
GROUP BY tenant_id;
```

### 5. Consultar via Cube.js

```bash
# Con token de Tenant A
curl -H "Authorization: Bearer $(echo -n '{"tenantId":"tenant_A"}' | base64)" \
  "http://localhost:4000/cubejs-api/v1/load?query={\"measures\":[\"Orders.totalAmount\"]}"
```

### 6. Demo de seguridad multitenant

```bash
./demo/test_multitenancy.sh
```

## 📁 Estructura

```
observability-poc/
├── docker-compose.yml          # Infraestructura completa
├── simulator/
│   ├── package.json
│   └── simulator.js            # Genera pedidos aleatorios
├── clickhouse/
│   └── init/
│       └── 01_create_tables.sql  # Tablas + Kafka Engine
├── cube/
│   └── schema/
│       └── Orders.js           # Semantic Layer + seguridad
├── demo/
│   └── test_multitenancy.sh    # Demo de aislamiento
└── docs/                       # Documentación arquitectónica
```

## 🔒 Seguridad Multitenant

El filtro `tenant_id` se inyecta **obligatoriamente** en cada query:

```javascript
// cube/schema/Orders.js
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
}
```

**Es matemáticamente imposible que un tenant vea datos de otro.**

## 📚 Documentación

| # | Doc | Tema |
|---|-----|------|
| 00 | [resumen-ejecutivo](docs/00-resumen-ejecutivo.md) | TL;DR + diagrama completo |
| 01 | [arquitectura-general](docs/01-arquitectura-general.md) | Event-Driven, Ingesta |
| 02 | [almacenamiento-tsdb](docs/02-almacenamiento-tsdb.md) | ClickHouse, ADX, TimescaleDB |
| 03 | [capa-entrega](docs/03-capa-entrega.md) | Push vs Pull, WebSockets |
| 04 | [stack-comparativa](docs/04-stack-comparativa.md) | Batch vs Streaming |
| 05 | [desafios-criticos](docs/05-desafios-criticos.md) | Backpressure, costos |
| 06 | [patron-oltp-olap](docs/06-patron-oltp-olap.md) | Dos bases de datos |
| 07 | [arquitectura-multitenant](docs/07-arquitectura-multitenant.md) | Aislamiento lógico, RLS |
| 08 | [seguridad-dashboards](docs/08-seguridad-dashboards-custom.md) | Semantic Layer, Cube.js |
| 09 | [patrones-escritura](docs/09-patrones-escritura.md) | CDC, Outbox, Telemetría |
| 10 | [implementacion-azure](docs/10-implementacion-azure.md) | Servicios Azure |
| 11 | [integracion-agentes-ia](docs/11-integracion-agentes-ia.md) | IA + Capa Semántica |
| 12 | [mcp-cube-integracion](docs/12-mcp-cube-integracion.md) | MCP + Cube.js |
| 13 | [olap-vs-vectorial](docs/13-olap-vs-vectorial.md) | Columnar vs Vectorial |
| 14 | [plan-implementacion-poc](docs/14-plan-implementacion-poc.md) | Código de la PoC |

## 📝 Notas

- **CDC simplificado:** El simulador escribe a Postgres Y Kafka. En producción usarías Debezium.
- **Autenticación:** Los tokens son Base64 simple. En producción usarías JWT firmados.
- **Pre-agregaciones:** Cube.js puede cachear queries en Redis para mejor performance.

## 🎥 Demo

```bash
# Terminal 1: Infraestructura
docker-compose up

# Terminal 2: Simulador
cd simulator && npm start

# Terminal 3: Queries
./demo/test_multitenancy.sh
```

---

**Stack en producción (Azure):** PostgreSQL Flexible → Event Hubs → ADX → Cube.js → Web PubSub
