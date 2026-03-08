# Resumen Ejecutivo

## Objetivo

> Transformar el SaaS de un modelo **pasivo** a uno **reactivo** (orientado a eventos) sin penalizar el rendimiento de la operación diaria y garantizando la seguridad multitenant.

---

## Decisiones Arquitectónicas Clave

### 1. Separación de Bases de Datos (OLTP vs OLAP)

| Base de Datos | Función | Tecnología Azure |
|---------------|---------|------------------|
| **Operacional (OLTP)** | Día a día del negocio | PostgreSQL Flexible |
| **Analítica (OLAP)** | Observabilidad y dashboards | Azure Data Explorer (ADX) |

### 2. Sincronización en Tiempo Real (Cero Dual-Writes)

- ❌ El backend NO escribe en ambas DBs
- ✅ **CDC (Debezium)** lee cambios transaccionales
- ✅ Los envía a **Azure Event Hubs**
- ✅ Event Hubs alimenta ADX en milisegundos

### 3. Multitenencia Segura y Eficiente

- Todos los clientes comparten la misma DB analítica (costos + mantenimiento)
- **Capa Semántica (Cube.js)** inyecta `tenant_id` en cada consulta
- Aislamiento lógico, no físico

### 4. Preparación para IA (Agentes Seguros)

- **Servidor MCP** sobre la capa semántica
- Agentes IA consultan métricas en lenguaje natural
- La IA NO ve tablas reales → cero alucinaciones
- Imposible saltarse el filtro de seguridad

---

## Flujo de Datos

```
                         ESCRITURA
                              
┌──────────┐    ┌──────────┐    ┌─────────────┐
│ Frontend │───▶│ Backend  │───▶│ PostgreSQL  │
└──────────┘    └──────────┘    └──────┬──────┘
                                       │
                                CDC (Debezium)
                                       │
                                       ▼
                                ┌─────────────┐
                                │ Event Hubs  │
                                └──────┬──────┘
                                       │
                                       ▼
                                ┌─────────────┐
                                │    ADX      │
                                └──────┬──────┘
                                       │
                         LECTURA       │
                                       │
┌──────────┐    ┌──────────┐    ┌──────┴──────┐
│Dashboard │◀───│ Cube.js  │◀───│ + tenant_id │
│ /Chatbot │    │  + MCP   │    └─────────────┘
└──────────┘    └──────────┘
```

---

## Stack Azure Completo

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

---

## Beneficios

| Aspecto | Resultado |
|---------|-----------|
| **Rendimiento** | Operación y analítica no compiten |
| **Seguridad** | tenant_id inyectado siempre |
| **Escalabilidad** | Infra compartida, costos controlados |
| **IA-Ready** | MCP + Cube.js = consultas seguras |
| **Consistencia** | Dashboard y chatbot = mismos números |

---

## Documentación Detallada

| Doc | Tema |
|-----|------|
| [01-arquitectura-general](01-arquitectura-general.md) | Event-Driven, Ingesta, Procesamiento |
| [02-almacenamiento-tsdb](02-almacenamiento-tsdb.md) | TSDB: ClickHouse, ADX, TimescaleDB |
| [03-capa-entrega](03-capa-entrega.md) | Push vs Pull, WebSockets |
| [04-stack-comparativa](04-stack-comparativa.md) | Batch vs Streaming |
| [05-desafios-criticos](05-desafios-criticos.md) | Backpressure, consistencia, costos |
| [06-patron-oltp-olap](06-patron-oltp-olap.md) | Dos bases de datos |
| [07-arquitectura-multitenant](07-arquitectura-multitenant.md) | Aislamiento lógico, RLS |
| [08-seguridad-dashboards-custom](08-seguridad-dashboards-custom.md) | Semantic Layer, Cube.js |
| [09-patrones-escritura](09-patrones-escritura.md) | CDC, Outbox, Telemetría |
| [10-implementacion-azure](10-implementacion-azure.md) | Servicios Azure específicos |
| [11-integracion-agentes-ia](11-integracion-agentes-ia.md) | IA + Capa Semántica |
| [12-mcp-cube-integracion](12-mcp-cube-integracion.md) | MCP + Cube.js |
