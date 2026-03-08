# Almacenamiento - Bases de Datos de Series Temporales (TSDB)

## Problema

Las bases de datos relacionales (SQL) tradicionales **colapsan** bajo la carga de escrituras masivas requeridas para observabilidad en tiempo real.

## Requisito

**Escritura optimizada:** Bases de datos diseñadas para ingesta masiva (high throughput ingestion).

---

## Opciones por Caso de Uso

### OLAP en Tiempo Real (Analítica sobre grandes volúmenes)

| Base de Datos | Características |
|---------------|-----------------|
| **ClickHouse** | Columnar, muy rápida para agregaciones |
| **Druid** | Diseñada para OLAP en tiempo real |
| **Pinot** | LinkedIn, baja latencia |

### Métricas Puras (Sensores, Logs)

| Base de Datos | Características |
|---------------|-----------------|
| **TimescaleDB** | Extensión de PostgreSQL, familiar |
| **InfluxDB** | Nativa para series temporales |

---

## Criterios de Selección

- **Volumen de escritura:** eventos/segundo esperados
- **Tipo de queries:** agregaciones vs búsquedas puntuales
- **Familiaridad del equipo:** TimescaleDB si ya usan PostgreSQL
- **Retención:** cuánto tiempo guardar datos granulares vs agregados
