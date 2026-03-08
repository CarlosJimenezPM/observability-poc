# Cube.js MCP Server

Servidor MCP (Model Context Protocol) que expone Cube.js a agentes de IA.

## Herramientas Disponibles

| Tool | Descripción |
|------|-------------|
| `list_cubes` | Lista todos los cubos disponibles con sus medidas y dimensiones |
| `query_analytics` | Ejecuta queries de analytics |
| `get_cube_schema` | Obtiene el schema detallado de un cubo |

## Uso con Claude Desktop

Añade a tu `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cube-analytics": {
      "command": "node",
      "args": ["/path/to/observability-poc/mcp-server/index.js"],
      "env": {
        "CUBE_API_URL": "http://localhost:4000"
      }
    }
  }
}
```

## Uso con Clawdbot

Añade a tu configuración de Clawdbot:

```yaml
mcp:
  servers:
    cube-analytics:
      command: node
      args:
        - /home/carlos/Projects/observability-poc/mcp-server/index.js
      env:
        CUBE_API_URL: http://localhost:4000
```

## Ejemplos de Uso

Una vez conectado, el agente puede:

**Listar cubos:**
```
"¿Qué datos de analytics tenemos disponibles?"
→ Llama list_cubes
```

**Consultar datos:**
```
"¿Cuántos pedidos hay por categoría?"
→ Llama query_analytics con:
   measures: ["Orders.count"]
   dimensions: ["Orders.productCategory"]
```

**Consulta compleja:**
```
"Ventas totales por región, solo pedidos completados"
→ Llama query_analytics con:
   measures: ["Orders.totalAmount"]
   dimensions: ["Orders.region"]
   filters: [{"member": "Orders.status", "operator": "equals", "values": ["completed"]}]
```

## Test Manual

```bash
# Verificar que Cube.js está corriendo
curl http://localhost:4000/cubejs-api/v1/meta

# Ejecutar servidor MCP (modo debug)
node index.js
```
