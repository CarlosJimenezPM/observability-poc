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
┌─────────────┐            ┌─────────────┐   Kafka Engine  ┌─────────────┐
│ PostgreSQL  │            │  Redpanda   │────────────────▶│ ClickHouse  │
│   (OLTP)    │            │  (eventos)  │   auto-ingest   │   (OLAP)    │
│ operaciones │            │             │                 │ dashboards  │
└─────────────┘            └──────▲──────┘                 └──────┬──────┘
       │                          │                               │
       │    ┌──────────────┐      │                        ┌──────▼──────┐
       └───▶│  Simulador   │──────┘                        │   Cube.js   │
            │ (dual-write) │                               │ + tenant_id │
            └──────────────┘                               │   SIEMPRE   │
              En producción:                               └─────────────┘
              Debezium CDC
```

- **PostgreSQL**: Donde ocurren las operaciones (crear pedidos, actualizar estados)
- **Redpanda**: Message broker que recibe eventos en tiempo real
- **ClickHouse**: Consume automáticamente de Redpanda via Kafka Engine (no requiere código)
- **Cube.js**: Capa semántica que inyecta `tenant_id` en TODAS las consultas (seguridad multi-tenant)

> **Nota**: El simulador hace dual-write para simplificar el PoC. En producción usarías **Debezium CDC** para capturar cambios de PostgreSQL automáticamente.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/CarlosJimenezPM/observavility-poc?quickstart=1)

## 🚀 Quick Start

### Opción 1: GitHub Codespaces (Recomendado)

1. Click en el botón "Open in GitHub Codespaces" arriba
2. Espera ~2 minutos a que el entorno se configure
3. Accede a Cube.js Playground en el puerto 4000

### Opción 2: Local (x86_64)

```bash
git clone https://github.com/CarlosJimenezPM/observavility-poc.git
cd observavility-poc
docker compose up -d
```

### Opción 3: Local (ARM64 - Raspberry Pi / Apple Silicon)

```bash
docker compose -f docker-compose.arm.yml up -d
```

## ⚠️ Seguridad

> **IMPORTANTE**: Este proyecto está configurado para **desarrollo local únicamente**. Los valores por defecto NO son seguros para producción.

### Antes de desplegar en producción:

1. **Configura variables de entorno seguras**
   ```bash
   cp .env.example .env
   # Edita .env con contraseñas fuertes
   # Genera el secret de Cube.js: openssl rand -hex 32
   ```

2. **Desactiva el modo desarrollo de Cube.js**
   ```bash
   CUBEJS_DEV_MODE=false
   ```

3. **Restringe los puertos expuestos**
   - Solo expón el puerto de la aplicación (4000 para Cube.js)
   - Bases de datos y Redpanda admin deben ser internos

4. **Usa JWT firmados para autenticación**
   - Los tokens Base64 del demo (`test_multitenancy.sh`) son solo para pruebas
   - En producción, implementa JWT con firma RS256/HS256

### Riesgos en la configuración actual (desarrollo):

| Riesgo | Archivo | Mitigación |
|--------|---------|------------|
| Contraseñas en texto plano | `docker-compose*.yml` | Usar `.env` (en `.gitignore`) |
| `CUBEJS_DEV_MODE=true` | `docker-compose*.yml` | Cambiar a `false` en producción |
| Puertos DB expuestos | `docker-compose*.yml` | Usar red interna Docker |
| Tokens Base64 sin firma | `demo/*.sh` | Implementar JWT firmados |

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

### Ejecutar el Simulador

El simulador genera pedidos aleatorios y los envía a PostgreSQL (OLTP) y Redpanda (streaming).

```bash
# Instalar dependencias
cd simulator && npm install && cd ..

# Ejecutar (desde el host, fuera de Docker)
KAFKA_BROKER=localhost:19092 node simulator/simulator.js

# O desde dentro de Docker (otro contenedor)
KAFKA_BROKER=redpanda:9092 node simulator/simulator.js
```

Variables de entorno:
- `KAFKA_BROKER`: Broker Kafka/Redpanda (default: `localhost:9092`)
- `PG_URL`: Connection string PostgreSQL (default: `postgres://admin:secret@localhost:5432/operations`)
- `INTERVAL`: Milisegundos entre pedidos (default: `2000`)

### Probar Cube.js Playground

1. Abre http://localhost:4000
2. Explora el schema `Orders`
3. Construye queries arrastrando dimensiones y medidas

### Query ClickHouse directo

```bash
# Versión del servidor
curl "http://localhost:8123/" -d "SELECT version()"

# Contar orders por tenant
curl "http://localhost:8123/" -d "SELECT tenant_id, count() FROM orders GROUP BY tenant_id"
```

### Validar multitenancy (JWT)

```bash
cd demo && npm install && cd ..
./demo/test_multitenancy.sh
```

### Generar tokens JWT

```bash
cd demo
node generate-token.js tenant_A    # Token para Tenant A
node generate-token.js tenant_B    # Token para Tenant B
```

## 📁 Estructura

```
observability-poc/
├── .devcontainer/
│   └── devcontainer.json   # Config GitHub Codespaces
├── .env.example            # Template de variables de entorno
├── .gitignore              # Archivos excluidos (incluye .env)
├── clickhouse/
│   └── init/
│       └── 01_create_tables.sql
├── timescaledb/
│   └── init/
│       └── 01_create_tables.sql
├── cube/
│   ├── cube.js             # Configuración Cube.js
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
- [15 - Compatibilidad Arquitecturas (x86 vs ARM)](docs/15-compatibilidad-arquitecturas.md)

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
