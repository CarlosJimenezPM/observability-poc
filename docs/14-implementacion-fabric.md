# Implementación en Microsoft Fabric

> **Contexto:** Este documento mapea la arquitectura del PoC a Microsoft Fabric, simplificando significativamente el stack.
> Ver también: [Implementación Azure tradicional](07-implementacion-azure.md), [ARCHITECTURE.md](../ARCHITECTURE.md)

## Comparativa: Azure Tradicional vs Fabric

| Componente | Azure Tradicional | Microsoft Fabric |
|------------|-------------------|------------------|
| CDC | Debezium en ACI | **Mirroring** (nativo) |
| Broker | Event Hubs / Redpanda | No necesario (mirroring directo) |
| Procesamiento | Python Workers / Functions | **Dataflows Gen2** |
| Storage | ADLS Gen2 + Delta Lake | **OneLake** (Delta nativo) |
| Motor SQL | Databricks / Synapse | **SQL Analytics Endpoint** |
| Capa semántica | Cube.js en App Service | **Power BI Semantic Models** |
| Dashboards | Custom / Power BI | **Power BI integrado** |
| MCP Server | App Service / Container Apps | App Service (externo a Fabric) |

## Arquitectura Simplificada

```
┌─────────────────────────────────────────────────────────────────┐
│                    MICROSOFT FABRIC                             │
│                                                                 │
│  ┌─────────────┐         ┌─────────────┐      ┌─────────────┐  │
│  │ SQL Server  │         │             │      │   OneLake   │  │
│  │ (Mirrored)  │────────▶│  Mirroring  │─────▶│   (Delta)   │  │
│  │             │  ~seg   │   nativo    │      │             │  │
│  └─────────────┘         └─────────────┘      └──────┬──────┘  │
│                                                      │         │
│                                               ┌──────▼──────┐  │
│                                               │   Lakehouse │  │
│                                               │      +      │  │
│                                               │ SQL Endpoint│  │
│                                               └──────┬──────┘  │
│                                                      │         │
│  ┌─────────────┐                              ┌──────▼──────┐  │
│  │  Dataflows  │◀────────────────────────────▶│  Semantic   │  │
│  │   Gen2      │     transformaciones         │   Model     │  │
│  │ (opcional)  │                              │ (tenant_id) │  │
│  └─────────────┘                              └──────┬──────┘  │
│                                                      │         │
└──────────────────────────────────────────────────────┼─────────┘
                                                       │
                         ┌─────────────────────────────┼─────────┐
                         │                             │         │
                    ┌────▼────┐                  ┌─────▼─────┐   │
                    │Power BI │                  │MCP Server │   │
                    │Dashboard│                  │(App Svc)  │   │
                    └─────────┘                  └───────────┘   │
                                                                 │
                         CLIENTES                                │
                         ─────────────────────────────────────────
```

## Componentes Fabric

### 1. Mirroring (reemplaza Debezium + Event Hubs)

Mirroring replica datos de SQL Server/PostgreSQL/Cosmos DB a OneLake automáticamente.

**Ventajas sobre Debezium:**
- Cero infraestructura que mantener
- Configuración en UI, no YAML
- Latencia ~segundos (near-real-time)
- Cambios de schema automáticos

**Configuración:**
```
Fabric Workspace → New → Mirrored Database → SQL Server
→ Seleccionar tablas → Activar
```

**Bases de datos soportadas:**
- SQL Server / Azure SQL
- Azure Cosmos DB
- PostgreSQL (preview)
- Snowflake

---

### 2. OneLake (reemplaza ADLS + Delta Lake)

OneLake es el Data Lake unificado de Fabric. Todos los datos se almacenan en formato Delta automáticamente.

**Ventajas:**
- Un solo namespace para toda la organización
- Delta Lake incluido (no hay que configurar)
- Shortcuts a datos externos (ADLS, S3, GCS)
- Gobernanza centralizada

**Estructura:**
```
OneLake/
├── Workspace_Produccion/
│   ├── Lakehouse_Principal/
│   │   ├── Tables/
│   │   │   ├── orders        ← Mirrored desde SQL Server
│   │   │   ├── customers     ← Mirrored
│   │   │   └── orders_gold   ← Transformado
│   │   └── Files/
│   └── Semantic_Model/
└── Workspace_Dev/
```

---

### 3. Lakehouse + SQL Endpoint (reemplaza Databricks/Synapse)

Cada Lakehouse tiene automáticamente un SQL Analytics Endpoint para queries.

**Características:**
- SQL estándar sobre Delta Lake
- Sin cluster que aprovisionar
- Pago por query (serverless)
- Compatible con cualquier herramienta SQL

**Conexión desde herramientas externas:**
```
Server: xxxx.datawarehouse.fabric.microsoft.com
Database: Lakehouse_Principal
Auth: Azure AD
```

---

### 4. Dataflows Gen2 (reemplaza Python Workers)

Para transformaciones Bronze → Silver → Gold, si son necesarias.

**Cuándo usarlos:**
- Limpieza de datos
- Joins entre tablas
- Agregaciones programadas

**Cuándo NO son necesarios:**
- Si Mirroring + SQL Endpoint es suficiente
- Si las transformaciones se hacen en el Semantic Model

---

### 5. Semantic Model (reemplaza Cube.js)

Power BI Semantic Models (antes "datasets") son la capa semántica de Fabric.

**Implementación de multi-tenant:**

```dax
// En el modelo, crear rol "TenantFilter"
// Con regla DAX en la tabla Orders:

[tenant_id] = USERPRINCIPALNAME()

// O con lookup table:
[tenant_id] = LOOKUPVALUE(
    TenantUsers[tenant_id],
    TenantUsers[email],
    USERPRINCIPALNAME()
)
```

**Row-Level Security (RLS):**
1. Crear roles en el modelo
2. Asignar usuarios/grupos a roles
3. Fabric aplica filtro automáticamente

**Ventajas sobre Cube.js:**
- Integrado nativamente
- RLS con Azure AD
- Caché automático
- Sin infraestructura adicional

**Desventajas:**
- Menos flexible que queryRewrite
- Requiere Power BI Pro/Premium
- MCP necesita adaptador custom

---

### 6. MCP Server (externo a Fabric)

Fabric no tiene MCP nativo. El MCP Server se despliega en App Service y conecta al SQL Endpoint.

**Arquitectura:**

```
Claude/GPT → MCP Server → SQL Analytics Endpoint → OneLake
                 ↓
          API Key → tenant_id → RLS o WHERE clause
```

**Conexión desde MCP:**

```javascript
// mcp-server - conectar a Fabric SQL Endpoint
const config = {
  server: 'xxxx.datawarehouse.fabric.microsoft.com',
  database: 'Lakehouse_Principal',
  authentication: {
    type: 'azure-active-directory-service-principal-secret',
    options: {
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      tenantId: process.env.AZURE_TENANT_ID
    }
  }
};
```

**Seguridad multi-tenant:**

Opción A: RLS en Fabric (recomendada)
```sql
-- El service principal del MCP tiene un rol que filtra por tenant
-- Se pasa el tenant_id como parámetro de sesión
```

Opción B: WHERE en MCP (como en el PoC actual)
```javascript
// queryRewrite añade WHERE tenant_id = X
query.filters.push({
  member: 'Orders.tenantId',
  operator: 'equals',
  values: [tenantId]
});
```

---

## Comparativa de Latencia

| Arquitectura | Latencia CDC | Latencia Query |
|--------------|--------------|----------------|
| PoC (ClickHouse) | 1-5 seg | <100ms |
| Azure tradicional (Medallion) | 1-5 min | 1-5 seg |
| **Microsoft Fabric** | **5-30 seg** | **<1 seg** |

Fabric es un punto medio: mejor latencia que Medallion tradicional, sin la complejidad de mantener ClickHouse.

---

## Costos

| Componente | Modelo |
|------------|--------|
| Mirroring | Incluido en Fabric Capacity |
| OneLake Storage | ~$0.023/GB/mes |
| SQL Endpoint | CU consumidos por query |
| Semantic Model | Incluido en Fabric Capacity |
| Power BI | Pro ($10/user/mes) o incluido en Capacity |

**Fabric Capacity (F SKUs):**
- F2: ~$260/mes (dev/test)
- F64: ~$8,300/mes (producción pequeña)
- Pay-as-you-go disponible

---

## Migración desde PoC

| PoC | Fabric | Esfuerzo |
|-----|--------|----------|
| PostgreSQL | Mirroring a OneLake | Bajo (configuración UI) |
| Debezium + Redpanda | Eliminado | — |
| ClickHouse | SQL Endpoint | Bajo (SQL compatible) |
| Cube.js models | Semantic Model (DAX) | Medio (traducir YAML a DAX) |
| MCP Server | App Service + conexión a SQL Endpoint | Medio (cambiar driver) |
| Frontend React | Power BI embebido o mantener | Variable |

---

## Cuándo elegir Fabric vs PoC

| Escenario | Recomendación |
|-----------|---------------|
| Ya tienes Microsoft 365 E5 / Power BI Premium | **Fabric** (incluido) |
| Equipo pequeño, sin expertise en infra | **Fabric** |
| Necesitas <5 seg de latencia | **PoC (ClickHouse)** |
| Multi-cloud / vendor-agnostic | **PoC** |
| Data science / ML avanzado | **Fabric** (notebooks integrados) |
| Control total del stack | **PoC** |

---

## Referencias

- [Microsoft Fabric Documentation](https://learn.microsoft.com/fabric/)
- [Mirroring in Fabric](https://learn.microsoft.com/fabric/database/mirrored-database/overview)
- [Lakehouse SQL Endpoint](https://learn.microsoft.com/fabric/data-engineering/lakehouse-sql-analytics-endpoint)
- [Row-Level Security in Power BI](https://learn.microsoft.com/power-bi/enterprise/service-admin-rls)
