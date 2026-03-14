# 🤖 MCP Server for Cube.js Analytics

Servidor MCP que permite a agentes de IA (Claude Desktop, etc.) consultar datos analíticos de forma segura, con aislamiento por tenant mediante API keys.

## 🔐 Autenticación

Cada API key está vinculada a un `tenant_id`. El servidor valida la key y automáticamente filtra los datos al tenant correspondiente.

### Configurar API Keys

Edita `api-keys.json`:

```json
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

Para generar keys seguras:
```bash
openssl rand -hex 20 | sed 's/^/ak_mytenant_/'
```

### Pasar la API Key

El servidor acepta la key en:
1. Header `Authorization: Bearer <api_key>` (recomendado)
2. Header `X-API-Key: <api_key>`
3. Query param `?api_key=<api_key>` (para SSE)

## 🚀 Uso

### Levantar el servidor

```bash
# Con el stack completo
make up
cd mcp-server && npm start

# O standalone (apuntando a Cube.js externo)
CUBE_API_URL=http://your-cube:4000 npm start
```

### Configurar en Claude Desktop

Añade en `claude_desktop_config.json`:

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

> **Importante**: Cada usuario/instalación de Claude Desktop debe tener su propia API key configurada.

## 🛠️ Tools Disponibles

| Tool | Descripción |
|------|-------------|
| `whoami` | Muestra el tenant autenticado |
| `list_cubes` | Lista cubos analíticos disponibles |
| `query_analytics` | Consulta métricas (count, revenue, etc.) |
| `get_cube_schema` | Schema detallado de un cubo |

### Ejemplos de queries

**Total de pedidos y revenue:**
```
Measures: ["Orders.count", "Orders.totalAmount"]
```

**Pedidos por categoría:**
```
Measures: ["Orders.count"]
Dimensions: ["Orders.productCategory"]
```

**Pedidos completados por región:**
```
Measures: ["Orders.count", "Orders.totalAmount"]
Dimensions: ["Orders.region"]
Filters: [{"member": "Orders.status", "operator": "equals", "values": ["completed"]}]
```

**Pedidos por día (últimos 7 días):**
```
Measures: ["Orders.count"]
TimeDimensions: [{"dimension": "Orders.createdAt", "granularity": "day", "dateRange": "last 7 days"}]
```

## 🔒 Seguridad

- **Aislamiento por tenant**: Cada API key solo puede acceder a datos de su tenant
- **No hay parámetro tenantId**: El tenant se determina por la API key, no por input del usuario
- **Keys revocables**: Pon `enabled: false` para desactivar una key sin borrarla

### Checklist de producción

- [ ] Generar keys únicas y seguras para cada tenant
- [ ] No commitear `api-keys.json` (añadir a `.gitignore`)
- [ ] Usar HTTPS en producción
- [ ] Rotar keys periódicamente
- [ ] Monitorizar uso por API key

## 📡 Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/mcp` | Endpoint principal MCP |
| GET | `/mcp` | SSE streams |
| DELETE | `/mcp` | Terminar sesión |
| GET | `/health` | Health check |
| GET | `/` | Info del servidor |

## 🐛 Debug

Ver logs del servidor:
```bash
npm start 2>&1 | tee mcp.log
```

Test de autenticación:
```bash
# Sin API key (debe fallar)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

# Con API key (debe funcionar)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ak_tenant_a_xxxxx" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{}},"id":1}'
```

Health check:
```bash
curl http://localhost:3001/health
```
