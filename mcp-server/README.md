# 🤖 MCP Server for Cube.js Analytics

Servidor MCP que permite a agentes de IA (Claude Desktop, etc.) consultar datos analíticos de forma segura, con aislamiento por tenant mediante API keys.

## 🔐 Autenticación

Cada API key está vinculada a un `tenant_id`. El servidor valida la key y automáticamente filtra los datos al tenant correspondiente.

### Fuentes de API Keys

1. **PostgreSQL** (producción) — Keys hasheadas en tabla `api_keys`
2. **JSON fallback** (desarrollo) — Archivo `api-keys.json` local

El servidor intenta PostgreSQL primero; si no está disponible, usa el JSON.

## 🚀 Quick Start

### Con el stack completo (PostgreSQL disponible)

```bash
# Levantar infraestructura
make up

# Crear una API key
cd mcp-server
npm install
node manage-keys.js create tenant_A "Mi primera key"

# Copiar la key generada y configurar Claude Desktop

# Iniciar servidor
npm start
```

### Desarrollo local (sin PostgreSQL)

```bash
cd mcp-server
npm install

# Copiar template de keys
cp api-keys.example.json api-keys.json
# Editar api-keys.json con tus keys

npm start
```

## 📋 Gestión de API Keys (CLI)

```bash
# Crear nueva key
node manage-keys.js create <tenant_id> [nombre]
node manage-keys.js create tenant_A "Producción - App móvil"

# Listar todas las keys
node manage-keys.js list

# Revocar key (por prefijo)
node manage-keys.js revoke ak_tenant_a_abc

# Rotar key (revoca antigua, crea nueva)
node manage-keys.js rotate ak_tenant_a_abc
```

### Ejemplo de salida al crear key

```
✅ API Key created successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API Key: ak_tenant_a_3f8c9d1e2b4a6f8c9d1e2b4a6f8c9d1e2b4a6f8c
Tenant:  tenant_A
Name:    Producción - App móvil
```

## ⚙️ Configuración en Claude Desktop

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

> **Importante**: Cada usuario/instalación debe tener su propia API key.

## 🛠️ Tools Disponibles

| Tool | Descripción |
|------|-------------|
| `whoami` | Muestra tenant autenticado y fuente de auth |
| `list_cubes` | Lista cubos analíticos disponibles |
| `query_analytics` | Consulta métricas (count, revenue, etc.) |
| `get_cube_schema` | Schema detallado de un cubo |

### Ejemplos de queries

**Total de pedidos y revenue:**
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

## 🔒 Seguridad

### Base de datos

- Keys hasheadas con SHA256 (nunca en texto plano)
- Tracking de uso: `last_used_at`, `request_count`
- Expiración opcional: `expires_at`
- Revocación instantánea: `enabled = false`

### Tabla `api_keys`

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA256
  key_prefix VARCHAR(20) NOT NULL,        -- Para identificación
  tenant_id VARCHAR(50) NOT NULL,
  name VARCHAR(100),
  enabled BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Checklist de producción

- [ ] Generar keys únicas con `manage-keys.js create`
- [ ] No commitear `api-keys.json`
- [ ] HTTPS en producción
- [ ] Rotar keys periódicamente
- [ ] Monitorizar `request_count` por key
- [ ] Configurar `expires_at` si aplica

## 📡 Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| POST | `/mcp` | Endpoint principal MCP |
| GET | `/mcp` | SSE streams |
| DELETE | `/mcp` | Terminar sesión |
| GET | `/health` | Health check (muestra authSource) |
| GET | `/` | Info del servidor |

## 🐛 Debug

```bash
# Ver logs del servidor
npm start 2>&1 | tee mcp.log

# Health check (muestra si usa DB o JSON)
curl http://localhost:3001/health

# Test sin key (debe dar 401)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'
```

## 🌐 Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `MCP_PORT` | 3001 | Puerto del servidor |
| `CUBE_API_URL` | http://localhost:4000 | URL de Cube.js |
| `DATABASE_URL` | postgresql://postgres:postgres@localhost:5432/postgres | PostgreSQL |
| `API_KEYS_FILE` | ./api-keys.json | Fallback JSON |
