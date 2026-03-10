# Resumen Ejecutivo

## Objetivo

Transformar un SaaS de un modelo **pasivo** a uno **reactivo** (orientado a eventos) sin penalizar el rendimiento operacional y garantizando seguridad multitenant.

## Decisiones Clave

| Decisión | Implementación |
|----------|----------------|
| Separar OLTP / OLAP | PostgreSQL (operaciones) + ClickHouse (dashboards) |
| Streaming | CDC vía Redpanda/Kafka (cero dual-writes) |
| Seguridad multi-tenant | Cube.js inyecta `tenant_id` en todas las queries |
| Cache | Redis para queries repetidas |
| IA-Ready | Servidor MCP sobre Cube.js |

## Flujo de Datos

```
PostgreSQL → Redpanda → ClickHouse → Cube.js → Dashboards/IA
   (OLTP)    (stream)     (OLAP)    (+Redis)
```

## Stack

| Capa | PoC Local | Producción Azure |
|------|-----------|------------------|
| OLTP | PostgreSQL | PostgreSQL Flexible |
| Streaming | Redpanda | Event Hubs |
| OLAP | ClickHouse | Azure Data Explorer |
| Semantic | Cube.js + Redis | Cube.js + Redis |

## Quick Start

```bash
docker compose up -d                    # Levantar infra
KAFKA_BROKER=localhost:19092 \
  node simulator/simulator.js           # Generar datos
cd demo && npm install && \
  ./test_multitenancy.sh                # Validar seguridad
```

> ✅ **Este PoC implementa el patrón arquitectónico correcto** (CDC con Debezium, no dual-write). Ver [Simplificaciones del PoC vs. Producción](../README.md#-simplificaciones-del-poc-vs-producción) para consideraciones de seguridad adicionales en producción.

## Documentación

| Doc | Tema |
|-----|------|
| [01-fundamentos](01-fundamentos-arquitectura.md) | EDA, OLAP, Push |
| [02-desafios](02-desafios-criticos.md) | Cuándo usar, riesgos |
| [03-patron-oltp-olap](03-patron-oltp-olap.md) | Dos bases de datos |
| [04-multitenant](04-arquitectura-multitenant.md) | Aislamiento |
| [05-seguridad](05-seguridad-dashboards.md) | Semantic Layer |
| [10-implementacion](10-plan-implementacion-poc.md) | Código |
| [11-guia-demo](11-guia-demo.md) | Cómo presentar |
