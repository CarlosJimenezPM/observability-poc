# Resumen Ejecutivo

## Objetivo

> Transformar el SaaS de un modelo **pasivo** a uno **reactivo** (orientado a eventos) sin penalizar el rendimiento de la operación diaria y garantizando la seguridad multitenant.

---

## Decisiones Arquitectónicas Clave

### 1. Separación OLTP / OLAP
- **Operacional:** PostgreSQL (día a día)
- **Analítica:** ADX / ClickHouse (dashboards)

### 2. Sincronización (Cero Dual-Writes)
- CDC (Debezium) lee cambios → Event Hubs → OLAP

### 3. Multitenencia Segura
- Infra compartida + `tenant_id` inyectado siempre via Cube.js

### 4. IA-Ready
- Servidor MCP sobre Cube.js = consultas seguras sin alucinaciones

---

## Flujo de Datos

```
        ESCRITURA                          LECTURA

┌──────────┐    ┌─────────────┐     ┌──────────┐    ┌──────────┐
│ Frontend │───▶│ PostgreSQL  │     │Dashboard │◀───│ Cube.js  │
└──────────┘    └──────┬──────┘     │ /Chatbot │    │  + MCP   │
                       │            └──────────┘    └────┬─────┘
                  CDC (Debezium)                         │
                       │                                 │
                       ▼                                 ▼
                ┌─────────────┐                   ┌─────────────┐
                │ Event Hubs  │──────────────────▶│  ADX/OLAP   │
                └─────────────┘                   └─────────────┘
```

---

## Stack

| Capa | Local (PoC) | Azure (Producción) |
|------|-------------|-------------------|
| OLTP | PostgreSQL | PostgreSQL Flexible |
| Streaming | Redpanda | Event Hubs |
| OLAP | ClickHouse | Azure Data Explorer |
| Semantic | Cube.js | Cube.js + Redis |
| Push | Socket.io | Web PubSub |

---

## PoC Funcional

```bash
docker-compose up -d              # Infraestructura
cd simulator && npm start         # Datos de prueba
./demo/test_multitenancy.sh       # Demo seguridad
```

---

## Documentación

| # | Doc | Tema |
|---|-----|------|
| 01 | [fundamentos-arquitectura](01-fundamentos-arquitectura.md) | EDA, Ingesta, OLAP, Push |
| 02 | [desafios-criticos](02-desafios-criticos.md) | Backpressure, consistencia |
| 03 | [patron-oltp-olap](03-patron-oltp-olap.md) | Dos bases de datos |
| 04 | [arquitectura-multitenant](04-arquitectura-multitenant.md) | Aislamiento lógico |
| 05 | [seguridad-dashboards](05-seguridad-dashboards.md) | Semantic Layer |
| 06 | [patrones-escritura](06-patrones-escritura.md) | CDC, Outbox |
| 07 | [implementacion-azure](07-implementacion-azure.md) | Servicios Azure |
| 08 | [integracion-ia-mcp](08-integracion-ia-mcp.md) | IA + MCP + Cube.js |
| 09 | [olap-vs-vectorial](09-olap-vs-vectorial.md) | Columnar vs Embeddings |
| 10 | [plan-implementacion-poc](10-plan-implementacion-poc.md) | Código ejecutable |
