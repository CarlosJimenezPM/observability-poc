# STATE.md

Current state of the observability-poc project.

## Status: ✅ Functional PoC

The core architecture is complete and working:
- [x] CDC pipeline (Debezium → Redpanda → ClickHouse)
- [x] Multi-tenant isolation (Cube.js queryRewrite)
- [x] Frontend demo with tenant login
- [x] MCP server for AI agents
- [x] ARM64 support (TimescaleDB variant)
- [x] Row-Level Security in ClickHouse (optional)
- [x] API key authentication for MCP

## Recent Changes

Latest commits:
- `ebe294b` feat(arm): add CDC consumer for TimescaleDB
- `c570381` docs: add Architecture Decision Records (ADRs)
- `f0f2a19` fix(mcp): fix invalid API key test
- `908f0f1` fix(mcp): use Zod schemas for tool parameters
- `6b988c1` fix(cube): remove driverFactory for ARM/x86 compat

## Known Issues / TODO

### 🟡 Not Production Ready
- [ ] JWT signature verification disabled (`CUBEJS_DEV_MODE=true`)
- [ ] Passwords hardcoded in docker-compose
- [ ] All ports exposed (should only expose 3000, 4000)
- [ ] No TLS/HTTPS
- [ ] No monitoring (Prometheus/Grafana)
- [ ] No backups configured
- [ ] No rate limiting

### 🔵 Nice to Have
- [ ] Record demo GIF for README
- [ ] Add more Cube.js models (beyond Orders)
- [ ] Automated E2E tests
- [ ] CI/CD pipeline

## Working On

*Nothing currently in progress.*

## Quick Test

```bash
# Start stack
make up

# Wait ~20s for services, then
make simulator   # Generate data
make demo        # Test tenant isolation

# Frontend: http://localhost:3000
# Cube.js Playground: http://localhost:4000
```

## Notes

- ARM64 (Raspberry Pi, M1) uses TimescaleDB instead of ClickHouse
- MCP API keys stored in `mcp-server/api-keys.json` (gitignored in prod)
- Debezium connector auto-registers on startup
