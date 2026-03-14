# ARCHITECTURE.md

## Overview

Multi-tenant observability platform demonstrating OLTP/OLAP separation with CDC (Change Data Capture).

**Pattern**: PostgreSQL (ops) → Debezium CDC → Redpanda → ClickHouse (analytics) → Cube.js (semantic layer)

## Directory Structure

```
observability-poc/
├── cube/                   # Semantic layer (Cube.js)
│   ├── cube.js             # Config + JWT auth + queryRewrite
│   └── model/Orders.yaml   # Dimensional model
├── frontend/               # React demo UI
│   ├── src/App.jsx         # Main app (Login → Dashboard)
│   └── server.js           # Express API backend
├── mcp-server/             # MCP server for AI agents
│   ├── index.js            # Server + tools (whoami, query_analytics, etc.)
│   └── manage-keys.js      # API key management CLI
├── simulator/              # Data generator
│   └── simulator.js        # Writes to PostgreSQL only
├── demo/                   # Test scripts
│   └── test_multitenancy.sh
├── clickhouse/init/        # ClickHouse schema (x86)
├── timescaledb/init/       # TimescaleDB schema (ARM)
├── postgres/init/          # PostgreSQL schema + CDC config
├── debezium/               # CDC connector config
├── cdc-consumer/           # ARM: manual CDC consumer (TimescaleDB)
└── docs/                   # Technical documentation
```

## Tech Stack

| Component | Purpose | Port |
|-----------|---------|------|
| **PostgreSQL** | OLTP (operations, writes) | 5432 |
| **Debezium** | CDC - reads WAL, emits events | 8083 |
| **Redpanda** | Kafka-compatible message broker | 9092/19092 |
| **ClickHouse** | OLAP (analytics, dashboards) | 8123 |
| **TimescaleDB** | OLAP alternative for ARM | 5433 |
| **Cube.js** | Semantic layer + tenant isolation | 4000 |
| **Redis** | Cache for Cube.js | 6379 |
| **Frontend** | React demo app | 3000 |
| **MCP Server** | AI agent integration | 3001 |

## Data Flow

```
Frontend/Simulator
      │
      ▼ (writes)
  PostgreSQL ───WAL──▶ Debezium ──events──▶ Redpanda
                                               │
                                        Kafka Engine
                                               │
                                               ▼
                                          ClickHouse
                                               │
                                               ▼
                                            Cube.js
                                               │
                                               ▼
                                    Dashboards / MCP / APIs
```

**Key insight**: Simulator and frontend write ONLY to PostgreSQL. CDC handles replication to OLAP. No dual-write = guaranteed consistency.

## Multi-tenant Security

Layered isolation:

1. **Cube.js `queryRewrite`** — Injects `WHERE tenant_id = X` on all queries
2. **ClickHouse RLS** — Row-level policies (optional, `CUBEJS_USE_RLS=true`)
3. **MCP API Keys** — Each key is bound to a specific tenant

```javascript
// cube.js - queryRewrite example
queryRewrite: (query, { securityContext }) => {
  query.filters.push({
    member: 'Orders.tenantId',
    operator: 'equals',
    values: [securityContext.tenantId]
  });
  return query;
}
```

## Architecture Variants

| Arch | OLAP DB | CDC Method | Compose File |
|------|---------|------------|--------------|
| x86_64 | ClickHouse | Kafka Engine (auto) | docker-compose.yml |
| ARM64 | TimescaleDB | cdc-consumer (manual) | docker-compose.arm.yml |

## Key Files to Edit

| Task | File(s) |
|------|---------|
| Add new metrics/dimensions | `cube/model/Orders.yaml` |
| Change tenant auth logic | `cube/cube.js` |
| Add MCP tools | `mcp-server/index.js` |
| Modify data schema | `postgres/init/*.sql`, `clickhouse/init/*.sql` |
| Frontend components | `frontend/src/components/` |

## Commands

```bash
make up           # Start everything (auto-detects arch)
make down         # Stop
make simulator    # Generate test data
make demo         # Test multitenancy
make logs-cdc     # Debug CDC pipeline
```
