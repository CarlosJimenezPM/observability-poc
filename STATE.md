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
- [x] Agent-friendly documentation (ARCHITECTURE.md, CLAUDE.md)

## Recent Changes

Latest commits:
- `a5e3a6f` refactor(mcp): modularize server into lib/
- `4414c49` docs: streamline README, remove redundancy
- `fb6f6db` docs: add agent-friendly documentation
- `ebe294b` feat(arm): add CDC consumer for TimescaleDB
- `c570381` docs: add Architecture Decision Records (ADRs)

Pending (not committed):
- None

## Project Structure

```
mcp-server/
├── index.js          # 192 lines (was 468)
└── lib/
    ├── auth.js       # API key validation
    ├── cube-client.js # Cube.js API helper  
    ├── mcp-factory.js # MCP server + tool registration
    └── tools.js      # Tool handlers
```

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
- [ ] Cross-tenant isolation test

## Working On

*Nothing currently in progress.*

## Quick Test

```bash
# Start stack
make up

# Wait ~20s for services, then
make simulator   # Generate data
make test        # Run all tests

# Frontend: http://localhost:3000
# Cube.js Playground: http://localhost:4000
```

## Notes

- ARM64 (Raspberry Pi, M1) uses TimescaleDB instead of ClickHouse
- MCP API keys stored in `mcp-server/api-keys.json` (gitignored in prod)
- Debezium connector auto-registers on startup
