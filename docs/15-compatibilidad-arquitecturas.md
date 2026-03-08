# 15. Compatibilidad de Arquitecturas (x86_64 vs ARM64)

## Lecciones Aprendidas

Durante la implementación de este PoC, encontramos limitaciones importantes al ejecutar ciertas bases de datos OLAP en arquitecturas ARM64 (Raspberry Pi, Apple Silicon).

## El Problema: ClickHouse en ARM

### Síntomas

```bash
$ docker logs clickhouse-1
/entrypoint.sh: line 42: Illegal instruction (core dumped)
```

El contenedor inicia pero crashea inmediatamente con código de salida 132 (SIGILL).

### Causa Raíz

ClickHouse está optimizado para x86_64 y utiliza instrucciones SIMD avanzadas:

- **AVX2** (Advanced Vector Extensions 2)
- **SSE4.2** (Streaming SIMD Extensions)

Estas instrucciones no existen en procesadores ARM64. Aunque ClickHouse publica imágenes para `linux/arm64`, algunas versiones están compiladas con flags que asumen instrucciones no disponibles en todos los chips ARM.

### Versiones Probadas

| Imagen | Resultado en Raspberry Pi 4 |
|--------|----------------------------|
| `clickhouse/clickhouse-server:latest` | ❌ SIGILL |
| `clickhouse/clickhouse-server:23.8-alpine` | ❌ SIGILL |
| `yandex/clickhouse-server` | ❌ SIGILL |

## Soluciones Evaluadas

### Opción 1: Hosting en la Nube (Recomendado para producción)

**Ventajas:**
- ClickHouse funciona sin modificaciones
- Arquitectura idéntica a producción
- Mejor rendimiento

**Opciones:**
- **ClickHouse Cloud** - Tier gratuito disponible
- **VM x86_64** - Hetzner (~€4/mes), DigitalOcean (~$6/mes)
- **GitHub Codespaces** - Ideal para demos, gratis (60h/mes)

### Opción 2: TimescaleDB (Elegida para ARM)

TimescaleDB es una extensión de PostgreSQL para series temporales que:

- ✅ Funciona perfectamente en ARM64
- ✅ Sintaxis SQL estándar (compatible con Cube.js)
- ✅ Hypertables con particionado automático
- ✅ Continuous aggregates (similar a materialized views de ClickHouse)

**Trade-offs vs ClickHouse:**

| Aspecto | ClickHouse | TimescaleDB |
|---------|------------|-------------|
| Rendimiento columnar | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Compresión | ~10x | ~3-5x |
| Compatibilidad ARM | ❌ | ✅ |
| Curva aprendizaje | Media | Baja (es PostgreSQL) |
| Ecosistema | Específico | Todo el ecosistema PG |

### Opción 3: Otras Alternativas ARM-Compatible

| Base de Datos | Tipo | Notas |
|---------------|------|-------|
| **QuestDB** | TSDB columnar | Imagen ARM64 nativa |
| **DuckDB** | OLAP embebido | Excelente para edge/local |
| **Apache Druid** | OLAP distribuido | Pesado para Pi |

## Arquitectura Implementada

### Para x86_64 (Producción / Codespaces)

```
docker-compose.yml
├── PostgreSQL (OLTP)
├── ClickHouse (OLAP)  ← Base de datos analítica principal
├── Redpanda (Streaming)
└── Cube.js (Capa semántica)
```

### Para ARM64 (Desarrollo local / Raspberry Pi)

```
docker-compose.arm.yml
├── PostgreSQL (OLTP)
├── TimescaleDB (OLAP)  ← Alternativa compatible ARM
├── Redpanda (Streaming)
└── Cube.js (Capa semántica)
```

## Compatibilidad del Schema de Cube.js

El schema de Cube.js se diseñó para ser compatible con ambas bases de datos:

```javascript
// cube/schema/Orders.js
cube('Orders', {
  sql: `SELECT * FROM orders`,  // Funciona en ambas DBs
  
  // Evitar funciones específicas de ClickHouse como:
  // - toStartOfDay(), toYYYYMM()
  // - arrayElement(), tuples
  // - Diccionarios externos
});
```

### Funciones a Evitar para Compatibilidad Cruzada

| ClickHouse | Equivalente PostgreSQL/TimescaleDB |
|------------|-------------------------------------|
| `toStartOfDay(ts)` | `date_trunc('day', ts)` |
| `toYYYYMM(ts)` | `to_char(ts, 'YYYYMM')` |
| `now()` | `NOW()` |
| `today()` | `CURRENT_DATE` |
| `arrayElement(arr, n)` | `arr[n]` |

## GitHub Codespaces: La Mejor de Ambos Mundos

Para demostraciones y desarrollo colaborativo, GitHub Codespaces ofrece:

1. **Entorno x86_64** - ClickHouse funciona sin modificaciones
2. **One-click setup** - Clone → Codespace → Stack corriendo
3. **Gratis** - 60 horas/mes incluidas en GitHub
4. **Compartible** - Cualquiera puede abrir el repo y probarlo

### Configuración

```json
// .devcontainer/devcontainer.json
{
  "name": "Observability PoC",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "postCreateCommand": "docker compose up -d"
}
```

## Recomendaciones

### Para Desarrollo Local

```bash
# Si tienes x86_64 (Intel/AMD)
docker compose up -d

# Si tienes ARM64 (Raspberry Pi, Mac M1/M2)
docker compose -f docker-compose.arm.yml up -d
```

### Para CI/CD

GitHub Actions usa runners x86_64 por defecto → ClickHouse funciona.

### Para Demos/Presentaciones

Usar GitHub Codespaces → Entorno consistente y portable.

## Conclusión

La incompatibilidad de ClickHouse con ARM no es un blocker, sino una oportunidad para:

1. **Diseñar schemas portables** que funcionen en múltiples backends
2. **Ofrecer flexibilidad** a usuarios con diferentes infraestructuras
3. **Aprovechar Codespaces** para onboarding sin fricción

El patrón OLTP/OLAP con capa semántica (Cube.js) abstrae las diferencias entre bases de datos, permitiendo cambiar el backend sin modificar las aplicaciones cliente.
