# simulator/CLAUDE.md

## Overview

Generates random order data for testing. Writes ONLY to PostgreSQL — CDC handles replication.

## Usage

```bash
# Via make (recommended)
make simulator

# Direct
cd simulator
npm install
node simulator.js

# With options
INTERVAL=1000 BATCH_SIZE=5 node simulator.js
```

## Environment Variables

| Var | Default | Description |
|-----|---------|-------------|
| `INTERVAL` | 2000 | Ms between batches |
| `BATCH_SIZE` | 1 | Orders per batch |
| `PG_URL` | postgres://admin:secret@localhost:5432/operations | PostgreSQL connection |

## Data Generated

```javascript
{
  order_id: "ORD-abc12345",
  tenant_id: "tenant_A",        // Random: A, B, or C
  customer_id: "CUST-123",
  product_category: "Electronics",
  amount: 150,
  quantity: 2,
  status: "pending",
  region: "North"
}
```

## Key Point

**This writes to PostgreSQL only.** The data flow is:

```
simulator.js → PostgreSQL → (WAL) → Debezium → Redpanda → ClickHouse
```

If you see data in PostgreSQL but not ClickHouse, check CDC:
```bash
make logs-cdc
```

## Modifying

To add fields:
1. Update `generateOrder()` in `simulator.js`
2. Update PostgreSQL schema in `postgres/init/`
3. Update ClickHouse schema in `clickhouse/init/` (or TimescaleDB for ARM)
4. Update Cube.js model in `cube/model/Orders.yaml`
