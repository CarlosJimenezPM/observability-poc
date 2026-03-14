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

### Configuración de API Keys

```json
// mcp-server/api-keys.json
{
  "keys": {
    "ak_tenant_a_xxxxx": {
      "tenantId": "tenant_A",
      "name": "Tenant A - Production",
      "enabled": true
    },
    "ak_tenant_b_xxxxx": {
      "tenantId": "tenant_B",
      "name": "Tenant B - Production",
      "enabled": true
    }
  }
}
```

### Cómo funciona

1. **Cliente envía API key** en header `Authorization: Bearer <api_key>`
2. **MCP Server valida** la key y extrae el `tenantId` asociado
3. **Todas las queries** se ejecutan con ese tenant_id inyectado
4. **No existe parámetro `tenantId`** en los tools — es imposible pedir datos de otro tenant

### Generar API Keys seguras

```bash
openssl rand -hex 20 | sed 's/^/ak_mytenant_/'
# Ejemplo: ak_mytenant_a3f8c9d1e2b4a6f8c9d1e2b4a6f8c9d1e2b4a6f8
```

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
