# cube/CLAUDE.md

## Overview

Cube.js semantic layer — sits between ClickHouse/TimescaleDB and clients (frontend, MCP server).

## Key Files

```
cube/
├── cube.js           # Config, JWT auth, queryRewrite (tenant isolation)
└── model/
    └── Orders.yaml   # Dimensional model (measures, dimensions)
```

## Security Model

Two layers of defense:

1. **queryRewrite** (cube.js) — Injects `WHERE tenant_id = X` on every query
2. **ClickHouse RLS** (optional) — Row policies at DB level (`CUBEJS_USE_RLS=true`)

```javascript
// cube.js - The critical security function
queryRewrite: (query, { securityContext }) => {
  query.filters.push({
    member: 'Orders.tenantId',
    operator: 'equals',
    values: [securityContext.tenantId]
  });
  return query;
}
```

## Auth Modes

| Mode | Behavior |
|------|----------|
| `CUBEJS_DEV_MODE=true` | Decodes JWT without verifying signature (demo only!) |
| `CUBEJS_DEV_MODE=false` | Verifies JWT signature with `CUBEJS_API_SECRET` |

## Adding Metrics

Edit `model/Orders.yaml`:

```yaml
cubes:
  - name: Orders
    sql: SELECT * FROM orders
    
    measures:
      - name: totalRevenue
        type: sum
        sql: amount
      
      # Add new measure here
      - name: avgOrderValue
        type: avg
        sql: amount
    
    dimensions:
      - name: category
        type: string
        sql: product_category
```

After changes, Cube.js hot-reloads in dev mode.

## Testing

```bash
# Cube.js Playground
open http://localhost:4000

# Direct API test
cd demo && ./test_multitenancy.sh
```

## Common Issues

- **"No tenant context"** — JWT missing or malformed, check token has `tenantId` claim
- **Empty results** — Tenant has no data, run `make simulator` first
- **ARM connection issues** — Check `CUBEJS_DB_TYPE` matches your compose file
