# 🔭 Observability PoC

Arquitectura de referencia para plataformas de observabilidad multi-tenant con separación OLTP/OLAP.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/YOUR_USERNAME/observability-poc?quickstart=1)

## 🚀 Quick Start

### Opción 1: GitHub Codespaces (Recomendado)

1. Click en el botón "Open in GitHub Codespaces" arriba
2. Espera ~2 minutos a que el entorno se configure
3. Accede a Cube.js Playground en el puerto 4000

### Opción 2: Local (x86_64)

```bash
git clone https://github.com/YOUR_USERNAME/observability-poc.git
cd observability-poc
docker compose up -d
```

### Opción 3: Local (ARM64 - Raspberry Pi / Apple Silicon)

```bash
docker compose -f docker-compose.arm.yml up -d
```

## 📦 Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **Cube.js** | 4000 | Capa semántica + Playground |
| **ClickHouse** | 8123 | Base de datos OLAP (x86_64) |
| **TimescaleDB** | 5433 | Alternativa OLAP para ARM |
| **PostgreSQL** | 5432 | Base de datos OLTP |
| **Redpanda** | 9092 | Message broker (Kafka-compatible) |

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

### Validar multitenancy

```bash
./demo/test_multitenancy.sh
```

## 📁 Estructura

```
observability-poc/
├── .devcontainer/          # Config GitHub Codespaces
├── clickhouse/
│   └── init/               # Scripts inicialización ClickHouse
├── timescaledb/
│   └── init/               # Scripts inicialización TimescaleDB (ARM)
├── cube/
│   └── schema/             # Modelos Cube.js
├── simulator/              # Generador de datos de prueba
├── demo/                   # Scripts de validación
├── docs/                   # Documentación técnica
├── docker-compose.yml      # Stack principal (x86_64)
└── docker-compose.arm.yml  # Stack alternativo (ARM64)
```

## 📚 Documentación

- [00 - Resumen Ejecutivo](docs/00-resumen-ejecutivo.md)
- [01 - Arquitectura General](docs/01-arquitectura-general.md)
- [02 - Almacenamiento TSDB](docs/02-almacenamiento-tsdb.md)
- [03 - Capa de Entrega](docs/03-capa-entrega.md)
- [Más docs...](docs/)

## 🔐 Seguridad Multi-tenant

El aislamiento de datos se implementa en múltiples capas:

1. **Cube.js**: `queryRewrite` inyecta filtro `tenant_id` automáticamente
2. **ClickHouse**: Row-level policies (opcional)
3. **Redpanda**: Topics por tenant o headers de partición

## 🛠️ Tecnologías

- **Cube.js**: Capa semántica y APIs
- **ClickHouse**: OLAP columnar de alto rendimiento
- **TimescaleDB**: Alternativa OLAP basada en PostgreSQL
- **PostgreSQL**: OLTP tradicional
- **Redpanda**: Streaming Kafka-compatible

## 📄 Licencia

MIT
