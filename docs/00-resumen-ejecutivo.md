# Resumen Ejecutivo

## Objetivo

> Transformar el SaaS de un modelo **pasivo** a uno **reactivo** (orientado a eventos) sin penalizar el rendimiento de la operación diaria y garantizando la seguridad multitenant.

---

## ¿Cuándo necesitas esta arquitectura?

### ✅ Sí la necesitas si:

- Más de **50 usuarios concurrentes** en dashboards
- Base de datos con **más de 5M filas** en tablas analíticas
- **Multi-tenancy** (varios clientes comparten infraestructura)
- Dashboards complejos que ejecutan **queries pesadas**
- La BD operacional supera **50% CPU** en horas pico

### ❌ No la necesitas si:

| Situación | Por qué |
|-----------|---------|
| < 10 usuarios concurrentes | PostgreSQL aguanta bien |
| Datos < 1M filas | Índices bien puestos son suficientes |
| Sin multi-tenancy | No hay riesgo de filtrar datos |
| MVP / Validación | Complejidad innecesaria al principio |
| Equipo pequeño (1-3 devs) | Más infra = más mantenimiento |

**Regla práctica**: Si puedes resolver con `CREATE INDEX` y tu BD no supera 50% CPU en picos → no lo necesitas todavía.

---

## ¿Qué pasa si no la implementas (cuando sí la necesitas)?

| Problema | Síntoma | Impacto |
|----------|---------|---------|
| **BD saturada** | Operaciones lentas a las 9AM | Usuarios frustrados |
| **Latencia** | Crear pedido tarda 3s en vez de 200ms | Pérdida de ventas |
| **Filtración de datos** | Bug muestra datos de otro cliente | GDPR, demandas |
| **No escala** | Más clientes = todo más lento | Límite de crecimiento |
| **Costes** | Escalar verticalmente (más RAM/CPU) | Factura x10 |

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

---

## Guía de Demo (20-30 min)

### 1. El Problema (5 min)

*"Imaginad que tenemos 100 clientes abriendo dashboards a las 9AM..."*

- La BD operacional se satura
- Los usuarios que crean pedidos sufren latencia
- Un bug podría filtrar datos entre clientes

### 2. La Solución - Diagrama (3 min)

```
PostgreSQL → Redpanda → ClickHouse → Cube.js
  (OLTP)     (stream)     (OLAP)     (seguridad)
```

- Operaciones y analítica separadas
- Datos fluyen en tiempo real
- Cube.js inyecta `tenant_id` SIEMPRE

### 3. Demo en Vivo (15 min)

**A) Datos fluyendo** (3 min)
```bash
# Terminal 1: Simulador
KAFKA_BROKER=localhost:19092 node simulator/simulator.js

# Terminal 2: Datos llegando
watch -n2 'curl -s "http://localhost:8123/" -d "SELECT tenant_id, count() FROM orders GROUP BY tenant_id"'
```

**B) Seguridad JWT** (5 min)
```bash
cd demo && npm install && ./test_multitenancy.sh
```
*"Mismo endpoint, distinto token, distintos datos."*

**C) Cube.js Playground** (5 min)
- Abrir http://localhost:4000
- Arrastrar métricas y dimensiones

**D) Código de seguridad** (2 min)
```javascript
// cube/cube.js
query.filters.push({
  member: 'Orders.tenantId',
  operator: 'equals', 
  values: [securityContext.tenantId]  // ← SIEMPRE
});
```

### 4. Puntos clave

- ✅ Escala independiente (OLTP vs OLAP)
- ✅ Seguridad por diseño
- ✅ Cache con Redis
- ✅ Preparado para IA (servidor MCP)
