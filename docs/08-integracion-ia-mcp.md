# Integración con IA: Semantic Layer + MCP

## Por qué la Capa Semántica es clave para IA

> Sin ella, la IA puede "olvidar" filtros de seguridad o alucinar tablas que no existen.

### ❌ Problemas de SQL directo

| Problema | Riesgo |
|----------|--------|
| Seguridad | IA omite `WHERE tenant_id = X` |
| Alucinaciones | Inventa columnas o cruza mal |
| Complejidad | IA ve tablas crudas (`t_ops_log_002`) |

### ✅ Con Capa Semántica

```
Agente IA → Semantic Layer → DB
              ↓
         + tenant_id forzado
         + catálogo de métricas
         + caché Redis
```

---

## MCP: Model Context Protocol

> Estandariza cómo los agentes de IA se conectan a datos de forma segura.

### Arquitectura MCP + Cube.js

```
┌───────────────┐
│  Agente IA    │  "¿Cómo van las ventas?"
│(Claude/GPT/…) │
└───────┬───────┘
        │ Protocolo MCP + API Key
        ▼
┌───────────────┐
│  Servidor MCP │  Valida API Key → extrae tenant_id
└───────┬───────┘
        │ REST
        ▼
┌───────────────┐
│   Cube.js     │  Inyecta tenant_id, cachea en Redis
└───────┬───────┘
        ▼
┌───────────────┐
│   ADX/OLAP    │
└───────────────┘
```

---

## 🔐 Autenticación por API Key

El servidor MCP implementa **aislamiento por tenant mediante API keys**. Cada key está vinculada a un tenant específico, eliminando la posibilidad de acceder a datos de otros tenants.

### Almacenamiento de Keys

| Fuente | Uso | Características |
|--------|-----|-----------------|
| **PostgreSQL** | Producción | Keys hasheadas (SHA256), tracking de uso, expiración, revocación |
| **JSON fallback** | Desarrollo | Archivo local cuando DB no disponible |

El servidor intenta PostgreSQL primero; si no está disponible, usa el JSON.

### Tabla `api_keys` (PostgreSQL)

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA256, nunca texto plano
  key_prefix VARCHAR(20) NOT NULL,        -- Para identificación en logs
  tenant_id VARCHAR(50) NOT NULL,
  name VARCHAR(100),
  enabled BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Gestión de Keys (CLI)

```bash
cd mcp-server

# Crear nueva key
node manage-keys.js create tenant_A "Producción - App móvil"

# Listar todas las keys
node manage-keys.js list

# Revocar key
node manage-keys.js revoke ak_tenant_a_abc

# Rotar key (revoca antigua, crea nueva)
node manage-keys.js rotate ak_tenant_a_abc
```

### Cómo funciona

1. **Cliente envía API key** en header `Authorization: Bearer <api_key>`
2. **MCP Server hashea** la key y busca en PostgreSQL (o JSON fallback)
3. **Valida** que esté enabled y no expirada
4. **Extrae `tenantId`** y actualiza `last_used_at`, `request_count`
5. **Todas las queries** se ejecutan con ese tenant_id inyectado
6. **No existe parámetro `tenantId`** en los tools — es imposible pedir datos de otro tenant

---

## Configuración en Claude Desktop

Añadir en `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "analytics": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer ak_tenant_a_xxxxx"
      }
    }
  }
}
```

> **Importante**: Cada usuario/instalación de Claude Desktop debe tener su propia API key. No compartir keys entre usuarios.

---

## Flujo Completo

1. **Usuario pregunta:** "¿Cuántos pedidos retrasados esta semana?"

2. **IA llama herramienta MCP** (con API key en header):
```json
{
  "tool": "query_analytics",
  "params": { 
    "measures": ["Orders.count"],
    "filters": [{"member": "Orders.status", "operator": "equals", "values": ["pending"]}]
  }
}
```

3. **MCP Server:**
   - Valida API key → extrae `tenant_A`
   - Pasa query a Cube.js con tenant_id

4. **Cube.js procesa:**
   - Genera SQL con filtro forzado `WHERE tenant_id = 'tenant_A'`
   - Consulta DB (o caché)

5. **IA responde:** "14 pedidos retrasados, 8% menos que la semana pasada."

---

## Herramientas MCP Disponibles

| Tool | Descripción | Parámetros |
|------|-------------|------------|
| `whoami` | Muestra tenant autenticado | — |
| `list_cubes` | Lista cubos disponibles | — |
| `query_analytics` | Consulta métricas | measures, dimensions, filters, timeDimensions, limit |
| `get_cube_schema` | Schema detallado de un cubo | cubeName |

### Ejemplos de uso

**Total pedidos y revenue:**
```json
{ "measures": ["Orders.count", "Orders.totalAmount"] }
```

**Pedidos por categoría:**
```json
{ 
  "measures": ["Orders.count"],
  "dimensions": ["Orders.productCategory"]
}
```

**Pedidos completados por región:**
```json
{
  "measures": ["Orders.count", "Orders.totalAmount"],
  "dimensions": ["Orders.region"],
  "filters": [{"member": "Orders.status", "operator": "equals", "values": ["completed"]}]
}
```

**Pedidos por día (últimos 7 días):**
```json
{
  "measures": ["Orders.count"],
  "timeDimensions": [{"dimension": "Orders.createdAt", "granularity": "day", "dateRange": "last 7 days"}]
}
```

---

## Ventajas

| Ventaja | Descripción |
|---------|-------------|
| **Cero alucinaciones** | IA solo ve métricas expuestas, no tablas |
| **Seguridad total** | API key determina tenant, imposible saltarlo |
| **Agnóstico al modelo** | Claude, GPT, Gemini → todos entienden MCP |
| **Descubrimiento dinámico** | Nueva métrica en Cube → IA la descubre automáticamente |
| **Consistencia** | Dashboard y chatbot = mismos números |
| **Keys revocables** | Desactivar acceso sin tocar código |

---

## Arquitectura con Múltiples Consumidores

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Dashboard │  │ Chatbot  │  │  Slack   │  │ Alertas  │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │
     │             └──────┬──────┴─────────────┘
     │                    │ API Key por tenant
     │                    ▼
     │           ┌─────────────────┐
     │           │   Servidor MCP  │
     │           │  (valida keys)  │
     │           └────────┬────────┘
     │                    │
     └────────────────────┼─────────────────────
                          ▼
                 ┌─────────────────┐
                 │    Cube.js      │  ← Única fuente de verdad
                 │  + tenant_id    │
                 │  + Redis cache  │
                 └────────┬────────┘
                          ▼
                   ┌──────────────┐
                   │   ADX/OLAP   │
                   └──────────────┘
```

---

## Stack Técnico

| Componente | Tecnología |
|------------|------------|
| Servidor MCP | Node.js + `@modelcontextprotocol/sdk` |
| Autenticación | API Keys (archivo JSON o DB) |
| Semantic Layer | Cube.js |
| Caché | Redis |
| Hosting | Azure App Service / Docker |

---

## Seguridad: Checklist

- [x] API keys por tenant (no parámetro de usuario)
- [x] tenant_id extraído de key, no de input
- [x] Keys desactivables (`enabled: false`)
- [ ] No commitear `api-keys.json` (usar `.gitignore`)
- [ ] HTTPS en producción
- [ ] Rotación periódica de keys
- [ ] Monitorizar uso por API key
- [ ] Rate limiting por key

---

## Testing de Seguridad

```bash
# Sin API key → 401
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

# Con API key inválida → 401
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_key" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

# Con API key válida → 200
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak_tenant_a_xxxxx" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{}},"id":1}'
```
