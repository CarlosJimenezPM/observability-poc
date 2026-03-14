# Seguridad para Dashboards Customizables (Self-Service Analytics)

## El Problema

> Si el cliente puede construir sus propios dashboards, ¿cómo evito que haga `SELECT * FROM ventas` y vea datos de la competencia?

**Regla de oro:** NUNCA dar conexión directa (ODBC/JDBC) al Data Lake.

---

## Solución: Capa Semántica (Semantic Layer)

Una capa intermedia que intercepta, valida y transforma las consultas.

---

## Patrón 1: Proxy de Consultas ⭐ RECOMENDADO

El cliente NO envía SQL, envía una **intención** (JSON).

### Flujo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. FRONTEND (Cliente)                                       │
│    Usuario arrastra widget "Ventas Totales"                 │
│    Envía: { "metric": "total_sales", "group_by": "month" }  │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. API (Tu Backend)                                         │
│    - Verifica JWT del usuario                               │
│    - Extrae tenant_id del token                             │
│    - Busca definición de "total_sales"                      │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. INYECCIÓN DE SEGURIDAD                                   │
│    Transforma a SQL seguro:                                 │
│    SELECT sum(amount) FROM sales                            │
│    WHERE tenant_id = 'cliente_A'  ← FORZADO                 │
│    GROUP BY month                                           │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. EJECUCIÓN                                                │
│    Backend envía SQL seguro a la DB                         │
│    Retorna solo datos permitidos                            │
└─────────────────────────────────────────────────────────────┘
```

### Herramienta: Cube.js ⭐

- **Estándar de la industria** para Semantic Layer
- Open source
- Conecta a: ClickHouse, BigQuery, PostgreSQL, etc.

**Ejemplo de esquema Cube:**
```javascript
cube('Sales', {
  sql: `SELECT * FROM sales`,
  
  // Seguridad: SIEMPRE filtra por tenant
  queryRewrite: (query, { securityContext }) => {
    query.filters.push({
      member: 'Sales.tenant_id',
      operator: 'equals',
      values: [securityContext.tenantId]
    });
    return query;
  },
  
  measures: {
    totalAmount: {
      type: 'sum',
      sql: 'amount'
    }
  }
});
```

### Ventajas

| Beneficio | Descripción |
|-----------|-------------|
| **Abstracción** | Cliente no ve nombres de tablas/columnas reales |
| **Seguridad infalible** | Filtro se inyecta en servidor, imposible saltarlo |
| **Caché** | 50 usuarios del mismo tenant = 1 query a DB (Redis) |
| **Gobernanza** | Control central de métricas y definiciones |

---

## Patrón 2: RLS Nativo de la Base de Datos

La DB misma rechaza queries sin permiso.

### Flujo

```sql
-- PostgreSQL:
SET app.current_tenant = 'cliente_A';
CREATE POLICY tenant_isolation ON sales
  USING (tenant_id = current_setting('app.current_tenant'));

-- ClickHouse:
SET param_tenant_id = 'cliente_A';
CREATE ROW POLICY filter_tenant ON sales 
  FOR SELECT USING tenant_id = getSetting('param_tenant_id');

-- Cualquier SELECT se filtra automáticamente
```

### Soporte por DB

| Base de Datos | Soporte RLS |
|---------------|-------------|
| PostgreSQL | ✅ Excelente, nativo |
| ClickHouse | ✅ Row Policies |
| Elasticsearch | ✅ Document-level security |

### ⚠️ Riesgos

- Si olvidas setear la variable de sesión → filtras datos o error
- Más difícil de auditar que Patrón 1
- Seguridad depende de configuración correcta de DB

---

## Patrón 3: Vistas Parametrizadas ❌ NO ESCALA

Crear una vista por cliente con filtro aplicado.

```sql
CREATE VIEW view_cliente_A AS 
SELECT * FROM sales WHERE tenant_id = 'cliente_A';
```

### Por qué no usarlo

- 1,000 clientes = 1,000 vistas SQL
- Inmanejable de mantener
- Nightmare de migrations

---

## Recomendación Final

Para SaaS Operativo con Dashboards Custom:

```
┌─────────────────────────────────────────┐
│     Semantic Layer (Cube.js)            │  ← Primera línea
│     Inyección automática tenant_id      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│     RLS en Base de Datos                │  ← Segunda línea (defensa en profundidad)
│     Por si algo falla arriba            │
└─────────────────────────────────────────┘
```

**Defensa en profundidad:** Usa ambas capas.

> ✅ **Este PoC implementa defensa en profundidad:**
> - **Capa 1:** Cube.js `queryRewrite` inyecta filtro `tenant_id` automáticamente
> - **Capa 2:** ClickHouse Row-Level Security (RLS) con row policies por tenant
> 
> Para activar RLS en ClickHouse: `CUBEJS_USE_RLS=true` en el docker-compose.
> Ver `clickhouse/init/02_row_level_security.sql` para la configuración.

---

## Configuración Segura del PoC

### Variables de Entorno

El PoC usa un archivo `.env` para manejar secretos (ver `.env.example`):

```bash
# Copiar template
cp .env.example .env

# Generar secret seguro para Cube.js
openssl rand -hex 32
```

### Checklist de Producción

| Configuración | Desarrollo | Producción |
|---------------|------------|------------|
| `CUBEJS_DEV_MODE` | `true` | `false` |
| `CUBEJS_API_SECRET` | Cualquier valor | Secret generado (32+ bytes) |
| Puertos DB expuestos | Sí (debug) | No (red interna Docker) |
| Tokens de autenticación | Base64 simple | JWT firmados (RS256/HS256) |

### Ejemplo: JWT en Producción

```javascript
// cube.js
const jwt = require('jsonwebtoken');

module.exports = {
  checkAuth: (req, auth) => {
    const token = jwt.verify(auth, process.env.CUBEJS_API_SECRET);
    req.securityContext = { tenantId: token.tenantId };
  }
};
```

---

## Seguridad del Servidor MCP (Integración IA)

El servidor MCP implementa **autenticación por API Key** para garantizar aislamiento entre tenants cuando agentes de IA consultan datos.

### Cómo funciona

1. Cada API key está vinculada a un `tenant_id` específico
2. El agente (Claude Desktop, etc.) envía la key en el header `Authorization`
3. El MCP server valida la key y extrae el tenant automáticamente
4. **No existe parámetro `tenantId`** en los tools — imposible pedir datos de otro tenant

### Configuración

```json
// mcp-server/api-keys.json
{
  "keys": {
    "ak_tenant_a_xxxxx": {
      "tenantId": "tenant_A",
      "name": "Tenant A - Production",
      "enabled": true
    }
  }
}
```

### Generar API Keys seguras

```bash
openssl rand -hex 20 | sed 's/^/ak_mytenant_/'
```

### Checklist de Seguridad MCP

- [x] API keys por tenant (no parámetro de usuario)
- [x] tenant_id extraído de key, no de input
- [x] Keys desactivables (`enabled: false`)
- [ ] No commitear `api-keys.json` (añadir a `.gitignore`)
- [ ] HTTPS en producción
- [ ] Rotación periódica de keys

Ver detalles completos en [08-integracion-ia-mcp.md](./08-integracion-ia-mcp.md).
