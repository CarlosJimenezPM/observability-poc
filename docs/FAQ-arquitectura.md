# FAQ de Arquitectura — Preguntas Difíciles

Respuestas preparadas para críticas técnicas del proyecto.

---

## Sobre la Arquitectura

### 1. ¿Por qué Redpanda y no Kafka directamente?

**Respuesta corta:** Simplicidad operacional, misma API.

**Respuesta completa:**
- Redpanda es 100% compatible con el protocolo Kafka (mismo cliente, misma API)
- No requiere JVM ni ZooKeeper → menos recursos, arranque más rápido
- Para un PoC, reduce complejidad sin sacrificar realismo
- En producción podrías swapear a Kafka/Confluent sin cambiar código

**Si insisten:** "El overhead de Redpanda vs Kafka es ~10% menos latencia en benchmarks. Pero honestamente, para un PoC la diferencia es irrelevante. La decisión fue pragmática, no dogmática."

---

### 2. ¿Qué pasa si Debezium se cae? ¿Cómo recuperas eventos perdidos?

**Respuesta:**
- Debezium guarda su **offset** en el propio Kafka/Redpanda
- Si se cae y reinicia, continúa desde el último offset confirmado
- El WAL de PostgreSQL retiene eventos (configurable con `wal_keep_size`)
- Debezium puede hacer **snapshot inicial** si pierde sincronía

**Limitación honesta:** Si el WAL se trunca antes de que Debezium se recupere, necesitas un snapshot completo. En producción configuras retención de WAL suficiente + alertas en lag de Debezium.

**Mitigación real:**
```yaml
# postgresql.conf
wal_keep_size = 1GB  # Retener suficiente WAL
```

---

### 3. ¿Cuál es el lag real PostgreSQL → ClickHouse?

**Respuesta:**
- **Típico:** 1-5 segundos (Debezium polling + Kafka Engine)
- **Peor caso:** 10-30 segundos bajo carga

**Contexto:** Para dashboards analíticos, <30 segundos es "real-time" suficiente. No estamos sirviendo trading de alta frecuencia.

**Si necesitas menos lag:** Kafka Engine de ClickHouse puede configurarse con `kafka_poll_max_batch_size` más bajo, pero trade-off es más I/O.

---

### 4. ¿Por qué Cube.js y no ClickHouse directo?

**Respuesta:** Cube.js no es overhead, es la capa de seguridad multi-tenant.

| Sin Cube.js | Con Cube.js |
|-------------|-------------|
| Cada cliente debe añadir `WHERE tenant_id = X` | `queryRewrite` lo inyecta siempre |
| Un bug = filtración de datos | Imposible olvidar el filtro |
| SQL expuesto al frontend | API abstracta |
| Sin caché | Caché inteligente por query |

**Además:**
- Un modelo de datos (`Orders.yaml`) vs SQL esparcido en el frontend
- Misma API para dashboard y MCP
- Si cambias de ClickHouse a otro OLAP, solo tocas config

---

## Sobre Multi-tenancy

### 5. `queryRewrite` es tu única defensa. ¿Y si bypasean Cube.js?

**Respuesta:** No es la única, es la primera línea. Defensa en profundidad:

1. **Cube.js queryRewrite** — Inyecta filtro siempre
2. **ClickHouse Row Policies** — RLS a nivel DB (opcional, activar con `CUBEJS_USE_RLS=true`)
3. **Red interna Docker** — ClickHouse no expuesto al exterior en producción
4. **Sin credenciales directas** — Frontend solo habla con Cube.js

**El bypass requeriría:**
- Acceso a la red interna Docker
- Credenciales de ClickHouse (que no están en el frontend)
- Saltarse el proxy/ingress

**Implementación RLS en ClickHouse:**
```sql
CREATE ROW POLICY tenant_isolation ON orders
FOR SELECT USING tenant_id = getSetting('param_tenant_id')
TO ALL;
```

---

### 6. ¿Has probado SQL injection en tenant_id?

**Respuesta:** Cube.js usa **parámetros preparados**, no concatenación de strings.

```javascript
// Esto es lo que hace queryRewrite internamente:
query.filters.push({
  member: 'Orders.tenantId',
  operator: 'equals',
  values: [securityContext.tenantId]  // Parametrizado, no interpolado
});
```

El `tenantId` viene del JWT decodificado server-side, nunca del input del usuario.

**Test que puedes hacer:**
```bash
# Intenta inyectar
curl -H "Authorization: Bearer <token_con_tenantId=\"'; DROP TABLE--\">" ...
# Resultado: error de parsing, no ejecución
```

---

### 7. ¿Por qué row-level y no schema-per-tenant o database-per-tenant?

**Trade-offs:**

| Estrategia | Pros | Contras |
|------------|------|---------|
| **Row-level** (elegida) | Simple, un schema | "Noisy neighbor", índices compartidos |
| **Schema-per-tenant** | Aislamiento lógico | Migrations ×N, conexiones ×N |
| **DB-per-tenant** | Aislamiento total | Operacionalmente complejo, costoso |

**Justificación:**
- Para <1000 tenants, row-level escala bien
- ClickHouse maneja billones de rows con filtros eficientes
- Migrations son una vez, no N veces
- Si un tenant crece mucho → se puede migrar a schema dedicado

**Cuándo cambiaría:** Si un tenant necesita compliance especial (GDPR, datos en otra región), iría a schema o DB separado para ese tenant.

---

## Sobre MCP

### 8. ¿Cuál es el caso de uso real de MCP + Analytics?

**Casos concretos:**

1. **Soporte interno:** "Claude, ¿cuántos pedidos tiene tenant_X este mes?" → sin abrir dashboard
2. **Alertas inteligentes:** Agente monitorea métricas y avisa proactivamente
3. **Reportes ad-hoc:** "Dame un resumen de revenue por región" → respuesta en lenguaje natural
4. **Onboarding:** Nuevo empleado pregunta sobre datos sin aprender SQL

**El diferenciador:** El agente NO puede ver datos de otros tenants. Misma seguridad que dashboards, pero interfaz conversacional.

---

### 9. ¿API keys en JSON para producción? ¿En serio?

**Respuesta:** No. Lee el ADR-005.

- **Desarrollo:** JSON fallback (conveniente, sin Docker)
- **Producción:** PostgreSQL con:
  - Keys hasheadas (SHA256)
  - Expiración (`expires_at`)
  - Auditoría (`last_used_at`, `request_count`)
  - Rotación sin reinicio

```sql
SELECT * FROM validate_api_key(sha256($key));
-- Retorna tenant_id si válida, NULL si no
```

---

## Sobre Escalabilidad

### 10. ¿Cuántos tenants soporta? ¿100? ¿10,000?

**Respuesta directa:**
- **Row-level en ClickHouse:** Fácilmente 10,000+ tenants
- **Cube.js:** Cada tenant es un filtro, no una conexión separada
- **Redpanda:** Un topic compartido, particionado

**Bottleneck real:** No es el número de tenants, es el volumen de datos total.

**Benchmark aproximado (single node ClickHouse):**
- 10,000 tenants × 1M rows c/u = 10B rows → funciona
- 100 tenants × 1B rows c/u = 100B rows → necesitas cluster

---

### 11. ¿Qué pasa si tenant A tiene 100M rows y tenant B tiene 1000?

**Problema:** "Noisy neighbor" — queries de A afectan a B.

**Mitigaciones en ClickHouse:**
1. **Índices por tenant_id** — Filtrado rápido
2. **Particionado por tenant_id** — Datos físicamente separados
3. **Quotas** — Limitar CPU/memoria por query

```sql
-- Particionado
CREATE TABLE orders (...)
ENGINE = MergeTree()
PARTITION BY tenant_id
ORDER BY (tenant_id, created_at);
```

**Si el tenant crece demasiado:** Migrar a schema dedicado o cluster separado. El 1% de tenants que genera el 90% del volumen merece tratamiento especial.

---

### 12. ¿Cómo manejas schema migrations sin downtime?

**Respuesta honesta:** El PoC no lo resuelve completamente. Pero el patrón sería:

1. **PostgreSQL (OLTP):** Migraciones normales con Flyway/Liquibase
2. **Debezium:** Detecta cambios de schema automáticamente
3. **ClickHouse:** 
   - Añadir columnas es instantáneo (columnar)
   - Cambiar tipos requiere recrear tabla (usar Materialized Views como abstracción)

**Patrón expand-contract:**
```sql
-- 1. Expand: añadir columna nueva
ALTER TABLE orders ADD COLUMN status_v2 String;

-- 2. Migrate: dual-write durante transición
-- 3. Contract: eliminar columna vieja cuando ya no se usa
```

---

## Preguntas Incómodas

### 13. ¿Por qué esto y no Fivetran + Snowflake + Metabase?

**Respuesta honesta:** Si tienes presupuesto y quieres managed, usa eso.

**Cuándo este patrón tiene sentido:**
- Quieres control total (on-prem, compliance estricto)
- El lag de Fivetran (~15 min) no es aceptable
- No quieres vendor lock-in
- El costo de Snowflake a escala es prohibitivo
- Necesitas integración con IA (MCP) que ellos no ofrecen

**Cuándo NO usar esto:**
- Equipo pequeño sin expertise en infra
- Presupuesto para managed services
- No necesitas real-time

**Posición:** Este PoC demuestra el patrón para quienes necesitan self-hosted. No compite con SaaS, lo complementa.

---

### 14. ¿Tienes esto en producción en algún sitio real?

**Respuesta honesta:** Este repo es un PoC, no un producto en producción.

**Pero el patrón sí está probado:**
- Cloudflare usa ClickHouse para analytics
- Uber usa Debezium para CDC a gran escala
- Cube.js está en producción en cientos de empresas

**Lo que falta para producción:**
- [ ] TLS en todos los endpoints
- [ ] Secrets management (Vault, etc.)
- [ ] Monitorización (Prometheus/Grafana)
- [ ] Backups automatizados
- [ ] Rate limiting
- [ ] Tests de carga

**El PoC demuestra que el patrón funciona. Productizarlo requiere el trabajo de infra habitual.**

---

## Resumen

| Crítica | Respuesta corta |
|---------|-----------------|
| "Redpanda no es Kafka" | Compatible 100%, menos ops |
| "Debezium puede perder datos" | Offsets + WAL retention |
| "Lag real-time?" | 1-5s típico, suficiente para dashboards |
| "Cube.js es overhead" | Es la capa de seguridad, no overhead |
| "Row-level no escala" | Sí escala con particionado |
| "MCP es un gimmick" | Diferenciador real para IA segura |
| "No está en producción" | Patrón probado, PoC para demo |
