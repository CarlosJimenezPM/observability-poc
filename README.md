# 🔭 Real-Time Multitenant Observability PoC

Arquitectura de observabilidad en tiempo real para SaaS multitenant con integración de IA.

## 🎯 Problema → Solución

| Problema | Solución |
|----------|----------|
| Dual-write (inconsistencia) | CDC → Event streaming |
| Dashboards lentos | OLAP separada (ClickHouse/ADX) |
| Datos filtrados entre tenants | Semantic Layer + tenant_id forzado |
| IA con alucinaciones | MCP sobre Cube.js |

## 🏗️ Arquitectura

```
Frontend → Backend → PostgreSQL
                         │
                    CDC (Debezium)
                         │
                         ▼
                    Event Hubs / Redpanda
                         │
                         ▼
                    ClickHouse / ADX
                         │
                         ▼
              Cube.js (+ tenant_id + MCP)
                         │
                         ▼
              Dashboard / Chatbot IA
```

## 🚀 Quick Start

```bash
# 1. Levantar infraestructura
docker-compose up -d

# 2. Iniciar simulador (genera pedidos cada 2s)
cd simulator && npm install && npm start

# 3. Demo de seguridad multitenant
./demo/test_multitenancy.sh
```

## 📁 Estructura

```
observability-poc/
├── docker-compose.yml        # PostgreSQL + Redpanda + ClickHouse + Cube
├── simulator/                # Generador de datos
├── clickhouse/init/          # Tablas + Kafka Engine
├── cube/schema/              # Semantic Layer + seguridad
├── demo/                     # Scripts de demo
└── docs/                     # 10 documentos de arquitectura
```

## 📚 Documentación

| # | Doc | Tema |
|---|-----|------|
| 00 | [resumen-ejecutivo](docs/00-resumen-ejecutivo.md) | TL;DR + diagrama |
| 01 | [fundamentos-arquitectura](docs/01-fundamentos-arquitectura.md) | EDA, Ingesta, OLAP, Push |
| 02 | [desafios-criticos](docs/02-desafios-criticos.md) | Backpressure, consistencia |
| 03 | [patron-oltp-olap](docs/03-patron-oltp-olap.md) | Dos bases de datos |
| 04 | [arquitectura-multitenant](docs/04-arquitectura-multitenant.md) | Aislamiento lógico |
| 05 | [seguridad-dashboards](docs/05-seguridad-dashboards.md) | Semantic Layer, Cube.js |
| 06 | [patrones-escritura](docs/06-patrones-escritura.md) | CDC vs Dual-write |
| 07 | [implementacion-azure](docs/07-implementacion-azure.md) | Mapeo a servicios Azure |
| 08 | [integracion-ia-mcp](docs/08-integracion-ia-mcp.md) | IA + MCP + Cube.js |
| 09 | [olap-vs-vectorial](docs/09-olap-vs-vectorial.md) | Columnar vs Embeddings |
| 10 | [plan-implementacion-poc](docs/10-plan-implementacion-poc.md) | Código de la PoC |

## 🔒 Seguridad Multitenant

```javascript
// cube/schema/Orders.js
queryRewrite: (query, { securityContext }) => {
  query.filters.push({
    member: 'Orders.tenantId',
    operator: 'equals',
    values: [securityContext.tenantId]  // FORZADO
  });
  return query;
}
```

## 🛠️ Stack

| Componente | Local | Azure |
|------------|-------|-------|
| OLTP | PostgreSQL | PostgreSQL Flexible |
| Streaming | Redpanda | Event Hubs |
| OLAP | ClickHouse | Azure Data Explorer |
| Semantic | Cube.js | Cube.js + Redis |
| Push | Socket.io | Web PubSub |
