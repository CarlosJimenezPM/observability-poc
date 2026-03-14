# Decisiones de Arquitectura (ADRs)

Este documento recoge las decisiones técnicas clave del proyecto y su justificación.

---

## ADR-001: ClickHouse como motor OLAP principal

**Estado:** Aceptada  
**Fecha:** 2026-03-14

### Contexto

Para la capa analítica (OLAP) del sistema multi-tenant, necesitamos una base de datos que:
- Soporte agregaciones masivas en tiempo real
- Escale horizontalmente
- Integre nativamente con streaming (Kafka/Redpanda)
- Permita aislamiento por tenant

### Decisión

**ClickHouse** como motor OLAP principal.

### Justificación

| Criterio | ClickHouse | TimescaleDB |
|----------|------------|-------------|
| **Arquitectura** | Columnar nativo (OLAP puro) | Row-based con extensión (PostgreSQL) |
| **Agregaciones** | Milisegundos en billones de filas | Segundos en millones |
| **Kafka nativo** | Sí (Kafka Engine) | No (requiere Kafka Connect) |
| **Adopción** | Cloudflare, Uber, Spotify, PostHog | Startups pequeñas |
| **Multi-tenant** | Row policies nativas | RLS de PostgreSQL |

### Consecuencias

- ✅ Rendimiento óptimo para dashboards en tiempo real
- ✅ Arquitectura más limpia (sin conectores intermedios)
- ✅ Alineación con estándares de la industria
- ⚠️ Requiere arquitectura x86_64 para soporte oficial

---

## ADR-002: TimescaleDB como fallback para ARM

**Estado:** Aceptada  
**Fecha:** 2026-03-14

### Contexto

ClickHouse no tiene imagen Docker oficial para ARM64 (Raspberry Pi, Apple Silicon en algunos casos). Para garantizar que el PoC funcione en cualquier entorno de desarrollo, necesitamos una alternativa.

### Decisión

Mantener **TimescaleDB** como alternativa OLAP para arquitecturas ARM.

### Implementación

```
docker-compose.yml      → ClickHouse (x86_64)
docker-compose.arm.yml  → TimescaleDB (ARM64)
```

### Justificación

| Aspecto | Beneficio |
|---------|-----------|
| **Developer Experience** | Cualquiera puede probar el PoC en su máquina |
| **Pragmatismo** | Trade-off documentado > purismo técnico |
| **Portabilidad** | Funciona en Raspberry Pi, M1/M2 Macs, servidores ARM |

### Consecuencias

- ✅ El PoC funciona en cualquier arquitectura
- ✅ Demuestra capacidad de manejar trade-offs
- ⚠️ Dos archivos compose a mantener
- ⚠️ TimescaleDB no tiene Kafka Engine nativo (usa polling o conectores)

### Nota para producción

En producción, usar exclusivamente ClickHouse en infraestructura x86_64. TimescaleDB es solo para desarrollo local en ARM.

---

## ADR-003: Cube.js como capa semántica

**Estado:** Aceptada  
**Fecha:** 2026-03-14

### Contexto

Los dashboards multi-tenant necesitan:
- Filtrado automático por tenant (seguridad)
- Abstracción de queries SQL
- Caché inteligente
- API unificada para frontend e IA

### Decisión

**Cube.js** como capa semántica entre clientes y OLAP.

### Justificación

- `queryRewrite` inyecta `tenant_id` automáticamente (seguridad)
- Soporta múltiples backends (ClickHouse, PostgreSQL, etc.)
- API REST/GraphQL estándar
- Integración natural con MCP para agentes IA

---

## ADR-004: MCP para integración con IA

**Estado:** Aceptada  
**Fecha:** 2026-03-14

### Contexto

Los agentes de IA (Claude, GPT, etc.) necesitan acceder a datos analíticos de forma segura, sin:
- Acceso directo a la base de datos
- Posibilidad de "olvidar" filtros de seguridad
- Alucinaciones sobre esquemas inexistentes

### Decisión

Implementar servidor **MCP (Model Context Protocol)** con:
- Autenticación por API key vinculada a tenant
- Tools tipados con Zod para parámetros
- Queries a través de Cube.js (nunca SQL directo)

### Arquitectura

```
Claude Desktop → MCP Server → Cube.js → ClickHouse
                     ↓
              API Key → tenant_id
```

### Consecuencias

- ✅ Agentes IA solo ven datos de su tenant
- ✅ Imposible hacer queries arbitrarias
- ✅ Schema descubrible (tools/list)
- ✅ Mismo modelo de seguridad que dashboards

---

## ADR-005: API Keys en PostgreSQL (no JSON)

**Estado:** Aceptada  
**Fecha:** 2026-03-14

### Contexto

Inicialmente las API keys se almacenaban en un archivo JSON. Esto es problemático en producción.

### Decisión

Migrar API keys a **PostgreSQL** (base de datos operacional).

### Justificación

| JSON file | PostgreSQL |
|-----------|------------|
| Requiere reinicio para cambios | Cambios en caliente |
| Sin auditoría | `last_used_at`, `request_count` |
| Sin expiración | `expires_at` |
| Sin hash | SHA256 (nunca texto plano) |

### Implementación

```sql
CREATE TABLE api_keys (
  key_hash VARCHAR(64) UNIQUE,  -- SHA256
  tenant_id VARCHAR(50),
  enabled BOOLEAN,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT
);
```

### Fallback

El servidor MCP mantiene soporte para JSON como fallback cuando PostgreSQL no está disponible (desarrollo sin Docker).
