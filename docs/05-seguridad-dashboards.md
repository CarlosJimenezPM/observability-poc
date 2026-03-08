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
-- 1. Backend setea variable de sesión al conectar
SET parameter tenant_id = 'cliente_A';

-- 2. DB tiene política pre-configurada
CREATE ROW POLICY filter_tenant ON sales 
FOR SELECT 
USING tenant_id = currentUser();

-- 3. Cualquier SELECT se filtra automáticamente
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
