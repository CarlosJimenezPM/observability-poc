# CLAUDE.md

## Quick Context

Read these first:
- **ARCHITECTURE.md** — Project structure, tech stack, data flow
- **STATE.md** — Current status, recent changes, TODOs

## Commands

```bash
make up           # Start all services
make down         # Stop all
make test         # Run all tests
make simulator    # Generate test data
make logs-cdc     # Debug CDC pipeline
```

## Code Conventions

### JavaScript/Node.js
- ES6+ syntax, async/await over callbacks
- No TypeScript (yet) — plain JS with JSDoc comments where helpful
- `const` by default, `let` when mutation needed
- Error messages should be actionable: "Token missing tenantId claim" not "Invalid token"

### Naming
- Files: `kebab-case.js`
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- SQL: `snake_case` for columns, lowercase for keywords

### Security Patterns
- **Never trust client input** — validate tenant_id server-side
- **queryRewrite in Cube.js** — always inject tenant filter
- **API keys over JWTs for MCP** — simpler, server-to-server

### Docker Compose
- Two files: `docker-compose.yml` (x86/ClickHouse) and `docker-compose.arm.yml` (ARM/TimescaleDB)
- Makefile auto-detects architecture
- Never hardcode secrets in compose files for production

## Testing

```bash
# All tests
make test

# Individual components
cd mcp-server && node test-mcp.js   # MCP server tests
cd demo && ./test_multitenancy.sh   # Multitenancy JWT test
```

Tests should be runnable with services up (`make up` first).

## Common Tasks

| Task | Where to look |
|------|---------------|
| Add new metric/dimension | `cube/model/Orders.yaml` |
| Change auth logic | `cube/cube.js` (checkAuth, queryRewrite) |
| Add MCP tool | `mcp-server/index.js` |
| Modify schema | `postgres/init/`, `clickhouse/init/`, `timescaledb/init/` |
| Frontend component | `frontend/src/components/` |

## Data Flow Reminder

```
Writes → PostgreSQL ONLY
         ↓ (WAL)
      Debezium CDC
         ↓
      Redpanda
         ↓
      ClickHouse (auto via Kafka Engine)
```

**Never dual-write.** The simulator and frontend write only to PostgreSQL.
