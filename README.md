# 🔭 Observability PoC

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/CarlosJimenezPM/observability-poc?quickstart=1)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Docker](https://img.shields.io/badge/Docker-ready-blue)
![MCP](https://img.shields.io/badge/MCP-AI%20Ready-purple)

Arquitectura de referencia para plataformas de observabilidad multi-tenant con separación OLTP/OLAP.

## 🎯 ¿Qué hace este proyecto?

Este PoC demuestra cómo construir una **plataforma SaaS multi-tenant** que:

1. **Separa operación de analítica** — OLTP no compite con dashboards OLAP
2. **Garantiza aislamiento de datos** — Cada tenant solo ve sus propios datos
3. **Escala independientemente** — Carga analítica no afecta operaciones
4. **Está preparada para IA** — Servidor MCP para que agentes consulten datos

### La solución

```
┌─────────────┐     WAL      ┌─────────────┐              ┌─────────────┐
│ PostgreSQL  │─────────────▶│  Debezium   │─────────────▶│  Redpanda   │
│   (OLTP)    │     CDC      │   Server    │    events    │   (Kafka)   │
└─────────────┘              └─────────────┘              └──────┬──────┘
       ▲                                                   Kafka Engine
       │                                                         │
┌──────┴──────┐                                           ┌──────▼──────┐
│  Simulador  │                                           │ ClickHouse  │
│  Frontend   │                                           │   (OLAP)    │
│  (SOLO PG)  │                                           │ dashboards  │
└─────────────┘                                           └──────┬──────┘
                                                                 │
                                                          ┌──────▼──────┐
                                                          │   Cube.js   │
                                                          │ + tenant_id │
                                                          └─────────────┘
```

> **Patrón clave**: Writes van SOLO a PostgreSQL. Debezium CDC replica automáticamente a ClickHouse via Redpanda. **Cero dual-write = consistencia garantizada.**

## 🚀 Quick Start

### GitHub Codespaces (un click)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/CarlosJimenezPM/observability-poc?quickstart=1)

### Local

```bash
git clone https://github.com/CarlosJimenezPM/observability-poc.git
cd observability-poc

make up           # Levanta todo (detecta arquitectura automáticamente)
make simulator    # Genera datos de prueba
```

Frontend: http://localhost:3000 | Cube.js Playground: http://localhost:4000

### Comandos

```bash
make help         # Ver todos los comandos
make up           # Levantar stack
make down         # Parar
make test         # Correr tests
make simulator    # Generar datos
make demo         # Test multitenancy
make logs-cdc     # Debug CDC pipeline
```

## 📦 Stack

| Servicio | Puerto | Propósito |
|----------|--------|-----------|
| Frontend | 3000 | Demo UI React |
| Cube.js | 4000 | Capa semántica + Playground |
| MCP Server | 3001 | Integración IA |
| PostgreSQL | 5432 | OLTP |
| ClickHouse | 8123 | OLAP (x86) |
| TimescaleDB | 5433 | OLAP (ARM) |
| Redpanda | 9092 | Message broker |
| Debezium | 8083 | CDC |

## 🔐 Seguridad Multi-tenant

Aislamiento en múltiples capas:

| Capa | Mecanismo |
|------|-----------|
| **Cube.js** | `queryRewrite` inyecta `WHERE tenant_id = X` en todas las queries |
| **ClickHouse** | Row-Level Security (opcional, `CUBEJS_USE_RLS=true`) |
| **MCP** | API keys vinculadas a tenant específico |

## ⚠️ PoC vs Producción

Este PoC demuestra el **patrón arquitectónico correcto**. Para producción, reforzar:

| PoC (dev mode) | Producción |
|----------------|------------|
| JWT sin verificar firma | `CUBEJS_DEV_MODE=false` + secret seguro |
| Passwords en docker-compose | `.env` con secretos generados |
| Todos los puertos expuestos | Solo 3000/4000, DBs en red interna |
| Sin TLS | HTTPS obligatorio |

<details>
<summary>Checklist completo de producción</summary>

- [ ] `.env` con secretos generados, nunca en git
- [ ] `CUBEJS_DEV_MODE=false`
- [ ] Puertos de DBs no expuestos
- [ ] TLS/HTTPS en todos los endpoints
- [ ] Row-Level Security en ClickHouse
- [ ] Monitorización y alertas
- [ ] Backups automatizados
- [ ] Rate limiting por tenant

</details>

## 🤖 Servidor MCP

Permite que agentes de IA (Claude Desktop, etc.) consulten analytics de forma segura.

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "analytics": {
      "url": "http://localhost:3001/mcp",
      "headers": { "Authorization": "Bearer ak_tenant_a_xxxxx" }
    }
  }
}
```

Tools: `whoami`, `list_cubes`, `query_analytics`, `get_cube_schema`

Ver más: [mcp-server/README.md](mcp-server/README.md)

## 📚 Documentación

| Doc | Descripción |
|-----|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Estructura técnica del proyecto |
| [CLAUDE.md](CLAUDE.md) | Guía para agentes/contributors |
| [docs/](docs/) | Documentación detallada |

Docs destacados:
- [02 - Desafíos Críticos](docs/02-desafios-criticos.md) — ¿Cuándo usar esta arquitectura?
- [11 - Guía de Demo](docs/11-guia-demo.md) — Cómo presentar al equipo
- [13 - ADRs](docs/13-decisiones-arquitectura.md) — Decisiones de arquitectura

## 🛠️ Tecnologías

**Cube.js** · **ClickHouse** · **TimescaleDB** · **PostgreSQL** · **Redpanda** · **Debezium** · **React**

## 📄 Licencia

MIT
