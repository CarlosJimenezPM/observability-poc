# 🔭 Observability PoC

Arquitectura de referencia para plataformas de observabilidad multi-tenant con separación OLTP/OLAP.

## 🎯 ¿Qué hace este proyecto?

Este PoC demuestra cómo construir una **plataforma SaaS multi-tenant** que:

1. **Separa operación de analítica** — Las operaciones del día a día (OLTP) no compiten con los dashboards y reportes (OLAP)
2. **Garantiza aislamiento de datos** — Cada tenant solo ve sus propios datos, imposible acceder a datos de otros clientes
3. **Escala independientemente** — La carga analítica no afecta el rendimiento operacional
4. **Está preparada para IA** — Incluye servidor MCP para que agentes de IA consulten datos de forma segura

### El problema que resuelve

En un SaaS típico, cuando 100 usuarios abren dashboards a las 9AM, la base de datos operacional se satura y las operaciones del día a día se ralentizan. Además, si no hay controles estrictos, un bug podría filtrar datos entre clientes.

### La solución

```
┌─────────────┐     WAL      ┌─────────────┐              ┌─────────────┐
│ PostgreSQL  │─────────────▶│  Debezium   │─────────────▶│  Redpanda   │
│   (OLTP)    │     CDC      │   Server    │    events    │   (Kafka)   │
│ operaciones │              └─────────────┘              └──────┬──────┘
└─────────────┘                                                  │
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
                                                          │   SIEMPRE   │
                                                          └─────────────┘
```

- **PostgreSQL**: Donde ocurren las operaciones (crear pedidos, actualizar estados)
- **Debezium CDC**: Lee el WAL de PostgreSQL y captura cambios automáticamente
- **Redpanda**: Message broker que recibe eventos de Debezium
- **ClickHouse**: Consume automáticamente de Redpanda via Kafka Engine (no requiere código)
- **Cube.js**: Capa semántica que inyecta `tenant_id` en TODAS las consultas (seguridad multi-tenant)

> **Patrón correcto**: El simulador y el frontend escriben **SOLO a PostgreSQL**. Debezium CDC captura los cambios del WAL y los envía a Redpanda automáticamente. **Cero dual-write = consistencia garantizada.**

## 🚀 Quick Start

### Opción 1: GitHub Codespaces (Un click)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/CarlosJimenezPM/observavility-poc?quickstart=1)

### Opción 2: Local con Make

```bash
git clone https://github.com/CarlosJimenezPM/observavility-poc.git
cd observavility-poc

make up           # Levanta todo (detecta arquitectura automáticamente)
make simulator    # Genera datos de prueba (opcional)
```

Abre http://localhost:3000 para el frontend.

### Comandos disponibles

```bash
make help         # Ver todos los comandos
make up           # Levanta infra + frontend
make down         # Parar todo
make logs         # Ver logs
make simulator    # Genera datos de prueba
make demo         # Test JWT multitenancy
make clean        # Limpiar todo
```

## ⚠️ Simplificaciones del PoC vs. Producción

> **Este PoC demuestra el patrón arquitectónico correcto (CDC con Debezium).** Las siguientes tablas documentan simplificaciones de seguridad y operaciones que deberías reforzar en producción.

### ✅ Lo que el PoC hace BIEN

| Patrón | Implementación |
|--------|----------------|
| **CDC (no dual-write)** | Debezium lee el WAL de PostgreSQL → Redpanda → ClickHouse. El simulador y frontend escriben **SOLO** a PostgreSQL. |
| **Capa semántica** | Cube.js inyecta `tenant_id` en todas las queries automáticamente |
| **Separación OLTP/OLAP** | PostgreSQL para operaciones, ClickHouse para dashboards |
| **Streaming real** | Redpanda (Kafka-compatible) con Kafka Engine en ClickHouse |

### 🟠 Desviaciones de Seguridad

| Lo que hace el PoC | Por qué no es ideal | Qué hacer en producción |
|--------------------|---------------------|-------------------------|
| **Sin RLS en ClickHouse** — Solo Cube.js filtra por tenant_id | Si alguien accede directo a ClickHouse, ve todos los datos | Activar **Row-Level Security** en ClickHouse como segunda capa de defensa |

### 🟠 Desviaciones de Seguridad

| Lo que hace el PoC | Por qué está mal | Qué hacer en producción |
|--------------------|------------------|-------------------------|
| **JWT sin verificar firma** — `CUBEJS_DEV_MODE=true` decodifica sin validar | Cualquiera puede forjar un token con el tenant_id que quiera | `CUBEJS_DEV_MODE=false` + verificar firma con secret seguro |
| **Contraseñas en docker-compose** — `secret`, `admin` visibles en código | Cualquiera que vea el repo tiene acceso | Usar `.env` (en `.gitignore`) con valores generados |
| **Todos los puertos expuestos** — PostgreSQL:5432, ClickHouse:8123, Redis:6379 | Cualquiera en la red puede conectarse a las DBs | Solo exponer Cube.js (4000), DBs en red interna Docker |
| **Sin TLS/HTTPS** — Todo va por HTTP sin cifrar | Tokens y datos viajan en texto plano | TLS obligatorio en producción |
| **Sin autenticación en ClickHouse** — `CLICKHOUSE_PASSWORD` vacío | Acceso sin credenciales | Configurar usuario/contraseña + red restringida |

### 🟡 Desviaciones Operacionales

| Lo que hace el PoC | Por qué está mal | Qué hacer en producción |
|--------------------|------------------|-------------------------|
| **Sin monitorización** — No hay Prometheus, Grafana, alertas | No sabes si algo falla hasta que un usuario se queja | Observabilidad de la plataforma: métricas, logs, alertas |
| **Sin healthchecks completos** — Solo básicos en docker-compose | No detectas degradación de servicios | Healthchecks de negocio, circuit breakers |
| **Sin backups** — Volúmenes Docker sin respaldo | Pierdes todo si falla el disco | Backups automáticos, política de retención |
| **Sin rate limiting** — Cube.js acepta cualquier cantidad de requests | DoS trivial, costos descontrolados | Rate limiting por tenant, quotas |

### Configuración de Producción

```bash
# 1. Crear archivo de secretos
cp .env.example .env

# 2. Generar valores seguros
echo "CUBEJS_API_SECRET=$(openssl rand -hex 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env
echo "CLICKHOUSE_PASSWORD=$(openssl rand -base64 24)" >> .env

# 3. Desactivar modo desarrollo
echo "CUBEJS_DEV_MODE=false" >> .env

# 4. Editar docker-compose para producción:
#    - Eliminar puertos de DBs (5432, 8123, 6379)
#    - Usar red interna Docker para comunicación entre servicios
#    - Añadir proxy inverso (nginx/traefik) con TLS
```

### Checklist Pre-Producción

- [x] ~~CDC (Debezium) en lugar de dual-write~~ ✅ **Ya implementado**
- [ ] `.env` con secretos generados, nunca en git
- [ ] `CUBEJS_DEV_MODE=false`
- [ ] Puertos de DBs no expuestos
- [ ] TLS/HTTPS en todos los endpoints públicos
- [ ] Row-Level Security en ClickHouse
- [ ] Monitorización y alertas
- [ ] Backups automatizados
- [ ] Rate limiting configurado
- [ ] Tests de seguridad: intentar acceder a datos de otro tenant

## 📦 Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **Cube.js** | 4000 | Capa semántica + Playground |
| **Redis** | 6379 | Cache para Cube.js |
| **ClickHouse** | 8123 | Base de datos OLAP (x86_64) |
| **TimescaleDB** | 5433 | Alternativa OLAP para ARM |
| **PostgreSQL** | 5432 | Base de datos OLTP |
| **Redpanda** | 9092 / 19092 | Message broker (Kafka-compatible) |

> **Nota Redpanda**: Puerto `9092` para comunicación interna (entre contenedores Docker), puerto `19092` para acceso externo (desde el host).

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTES                                │
│              (Dashboards, APIs, Agentes IA)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA SEMÁNTICA                               │
│                      (Cube.js)                                  │
│  • Modelado dimensional         • Cache inteligente            │
│  • Control de acceso            • API unificada                │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│        OLTP             │     │         OLAP            │
│     (PostgreSQL)        │     │ (ClickHouse/TimescaleDB)│
│                         │     │                         │
│  • Datos operacionales  │────▶│  • Datos históricos     │
│  • Transacciones        │     │  • Agregaciones         │
│  • Baja latencia        │     │  • Alto volumen         │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MESSAGE BROKER                               │
│                     (Redpanda)                                  │
│           CDC / Event Streaming / Ingesta                       │
└─────────────────────────────────────────────────────────────────┘
```

## 🧪 Demo

### Frontend (Recomendado)

```bash
make frontend     # http://localhost:3000
```

- **Login por tenant** — Selecciona Tenant A, B o C
- **Dashboard** — Gráficos en tiempo real desde Cube.js
- **Crear pedidos** — Escribe a PostgreSQL → Redpanda → ClickHouse

### Otras formas de probar

```bash
make simulator              # Genera datos en background
make demo                   # Test JWT multitenancy (CLI)
open http://localhost:4000  # Cube.js Playground
```

### Query directo a ClickHouse

```bash
curl "http://localhost:8123/" -d "SELECT tenant_id, count() FROM orders GROUP BY tenant_id"
```

## 📁 Estructura

```
observability-poc/
├── .devcontainer/
│   └── devcontainer.json   # Config GitHub Codespaces
├── .env.example            # Template de variables de entorno
├── .gitignore              # Archivos excluidos (incluye .env)
├── frontend/               # 🆕 Demo UI React
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       └── OrderForm.jsx
│   ├── server.js           # API backend
│   └── package.json
├── clickhouse/
│   └── init/
│       └── 01_create_tables.sql
├── timescaledb/
│   └── init/
│       └── 01_create_tables.sql
├── cube/
│   ├── cube.js             # Configuración + JWT auth
│   └── model/
│       └── Orders.yaml     # Schema dimensional
├── mcp-server/             # Servidor MCP para integración IA
│   ├── index.js
│   └── package.json
├── simulator/
│   ├── simulator.js        # Generador de datos de prueba
│   └── package.json
├── demo/
│   ├── test_multitenancy.sh
│   ├── generate-token.js
│   └── validate_poc.sh
├── docs/                   # Documentación técnica
├── docker-compose.yml      # Stack x86_64 (ClickHouse)
└── docker-compose.arm.yml  # Stack ARM64 (TimescaleDB)
```

## 📚 Documentación

- [00 - Resumen Ejecutivo](docs/00-resumen-ejecutivo.md)
- [01 - Fundamentos de Arquitectura](docs/01-fundamentos-arquitectura.md)
- [02 - Desafíos Críticos](docs/02-desafios-criticos.md) ← *¿Cuándo usar esta arquitectura?*
- [03 - Patrón OLTP/OLAP](docs/03-patron-oltp-olap.md)
- [04 - Arquitectura Multitenant](docs/04-arquitectura-multitenant.md)
- [05 - Seguridad para Dashboards](docs/05-seguridad-dashboards.md)
- [10 - Plan de Implementación PoC](docs/10-plan-implementacion-poc.md)
- [11 - Guía de Demo](docs/11-guia-demo.md) ← *Cómo presentar al equipo*
- [12 - Compatibilidad Arquitecturas (x86 vs ARM)](docs/12-compatibilidad-arquitecturas.md)

[Ver todos los docs →](docs/)

## 🔐 Seguridad Multi-tenant

El aislamiento de datos se implementa en múltiples capas:

1. **Cube.js**: `queryRewrite` inyecta filtro `tenant_id` automáticamente
2. **ClickHouse**: Row-level policies (opcional)
3. **Redpanda**: Topics por tenant o headers de partición

### Autenticación (Producción)

El script `demo/test_multitenancy.sh` usa tokens Base64 simples para demostración. En producción:

```javascript
// cube.js - Ejemplo con JWT firmado
module.exports = {
  checkAuth: (req, auth) => {
    // Verificar JWT con tu librería preferida (jsonwebtoken, jose, etc.)
    const token = jwt.verify(auth, process.env.CUBEJS_API_SECRET);
    req.securityContext = { tenantId: token.tenantId };
  },
  queryRewrite: (query, { securityContext }) => {
    if (!securityContext.tenantId) {
      throw new Error('No tenant context');
    }
    query.filters.push({
      member: 'Orders.tenantId',
      operator: 'equals',
      values: [securityContext.tenantId]
    });
    return query;
  }
};
```

## 🛠️ Tecnologías

- **Cube.js**: Capa semántica y APIs
- **ClickHouse**: OLAP columnar de alto rendimiento
- **TimescaleDB**: Alternativa OLAP basada en PostgreSQL
- **PostgreSQL**: OLTP tradicional
- **Redpanda**: Streaming Kafka-compatible

## 📄 Licencia

MIT
