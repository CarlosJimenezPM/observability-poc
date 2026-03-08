# Observability PoC

Proof of Concept de observabilidad en tiempo real para SaaS multitenant.

## TL;DR

> **Escritura:** Backend → DB Operacional → CDC → Kafka → DB Analítica

> **Lectura:** Dashboard → Semantic Layer (+ tenant_id) → DB Analítica

## Documentación

| Doc | Contenido |
|-----|-----------|
| [00-resumen-ejecutivo](docs/00-resumen-ejecutivo.md) | Flujo completo en 2 frases + diagrama |
| [01-arquitectura-general](docs/01-arquitectura-general.md) | Event-Driven, Ingesta, Procesamiento |
| [02-almacenamiento-tsdb](docs/02-almacenamiento-tsdb.md) | Bases de datos de series temporales |
| [03-capa-entrega](docs/03-capa-entrega.md) | Push vs Pull, WebSockets, SSE |
| [04-stack-comparativa](docs/04-stack-comparativa.md) | Batch vs Streaming |
| [05-desafios-criticos](docs/05-desafios-criticos.md) | Backpressure, consistencia, costos |
| [06-patron-oltp-olap](docs/06-patron-oltp-olap.md) | Dos bases de datos: operacional + analítica |
| [07-arquitectura-multitenant](docs/07-arquitectura-multitenant.md) | Aislamiento lógico, RLS |
| [08-seguridad-dashboards-custom](docs/08-seguridad-dashboards-custom.md) | Semantic Layer, Cube.js |
| [09-patrones-escritura](docs/09-patrones-escritura.md) | CDC, Outbox, Telemetría |

## Stack Sugerido

| Capa | Tecnología |
|------|------------|
| DB Operacional | PostgreSQL |
| CDC | Debezium |
| Message Broker | Kafka / Redpanda |
| DB Analítica | ClickHouse / TimescaleDB |
| Semantic Layer | Cube.js |
| Frontend | Socket.io / GraphQL Subscriptions |
