# Observability PoC

Proof of Concept de observabilidad en tiempo real para SaaS multitenant con integración de IA.

## Objetivo

> Transformar el SaaS de un modelo **pasivo** a uno **reactivo** (orientado a eventos) sin penalizar el rendimiento de la operación diaria y garantizando la seguridad multitenant.

## TL;DR

- **Escritura:** Backend → PostgreSQL → CDC (Debezium) → Event Hubs → ADX
- **Lectura:** Dashboard/IA → MCP → Cube.js (+ tenant_id) → ADX

## Stack Azure

| Capa | Servicio |
|------|----------|
| Operación (OLTP) | Azure Database for PostgreSQL |
| CDC | Debezium en Container Instances |
| Streaming | Azure Event Hubs |
| Análisis (OLAP) | Azure Data Explorer (ADX) |
| Semantic Layer | Cube.js en App Service |
| Caché | Azure Cache for Redis |
| WebSockets | Azure Web PubSub / SignalR |
| IA | Servidor MCP sobre Cube.js |

## Documentación

| Doc | Tema |
|-----|------|
| [00-resumen-ejecutivo](docs/00-resumen-ejecutivo.md) | Resumen completo + diagramas |
| [01-arquitectura-general](docs/01-arquitectura-general.md) | Event-Driven, Ingesta, Procesamiento |
| [02-almacenamiento-tsdb](docs/02-almacenamiento-tsdb.md) | TSDB: ClickHouse, ADX, TimescaleDB |
| [03-capa-entrega](docs/03-capa-entrega.md) | Push vs Pull, WebSockets |
| [04-stack-comparativa](docs/04-stack-comparativa.md) | Batch vs Streaming |
| [05-desafios-criticos](docs/05-desafios-criticos.md) | Backpressure, consistencia, costos |
| [06-patron-oltp-olap](docs/06-patron-oltp-olap.md) | Dos bases de datos |
| [07-arquitectura-multitenant](docs/07-arquitectura-multitenant.md) | Aislamiento lógico, RLS |
| [08-seguridad-dashboards-custom](docs/08-seguridad-dashboards-custom.md) | Semantic Layer, Cube.js |
| [09-patrones-escritura](docs/09-patrones-escritura.md) | CDC, Outbox, Telemetría |
| [10-implementacion-azure](docs/10-implementacion-azure.md) | Servicios Azure específicos |
| [11-integracion-agentes-ia](docs/11-integracion-agentes-ia.md) | IA + Capa Semántica |
| [12-mcp-cube-integracion](docs/12-mcp-cube-integracion.md) | MCP + Cube.js |

## Decisiones Clave

1. **Separación OLTP/OLAP** — Operación y analítica no compiten
2. **CDC, no Dual-Write** — Consistencia garantizada
3. **Infra compartida + tenant_id** — Costos controlados, seguridad lógica
4. **MCP + Cube.js** — IA segura, cero alucinaciones
