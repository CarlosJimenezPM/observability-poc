# MCP + Cube.js: El Combo Ganador

## Concepto

> **MCP (Model Context Protocol)** estandariza cómo los agentes de IA se conectan a fuentes de datos externas de forma segura.

Montar un servidor MCP sobre Cube.js es la arquitectura más moderna y escalable para IA en tu SaaS.

---

## Sinergia: Cada pieza hace lo que mejor sabe

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌───────────────┐                                          │
│  │  Agente IA    │  Entiende lenguaje natural               │
│  │ (Gemini/GPT)  │  "¿Cómo va mi operación hoy?"            │
│  └───────┬───────┘                                          │
│          │                                                  │
│          │ Protocolo MCP                                    │
│          ▼                                                  │
│  ┌───────────────┐                                          │
│  │  Servidor MCP │  Puente estándar                         │
│  │               │  Expone: get_metric, list_metrics        │
│  └───────┬───────┘                                          │
│          │                                                  │
│          │ REST / GraphQL                                   │
│          ▼                                                  │
│  ┌───────────────┐                                          │
│  │   Cube.js     │  Inyecta tenant_id                       │
│  │               │  Traduce a KQL/SQL                       │
│  │   + Redis     │  Cachea respuestas                       │
│  └───────┬───────┘                                          │
│          │                                                  │
│          ▼                                                  │
│  ┌───────────────┐                                          │
│  │     ADX       │  Ejecuta query                           │
│  └───────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Flujo Paso a Paso

### 1. Usuario pregunta
```
"¿Cuántos pedidos hemos entregado tarde esta semana?"
```

### 2. Agente razona
- Sabe que necesita datos
- Via MCP, revisa herramientas disponibles
- Decide usar `obtener_metrica`

### 3. Petición MCP → Cube.js
```json
{
  "tool": "get_metric",
  "params": {
    "metric": "pedidos_retrasados",
    "time_filter": "this_week"
  },
  "context": {
    "tenant_id": "empresa_123"  // Del token de sesión
  }
}
```

### 4. Cube.js actúa
1. Identifica la métrica
2. Aplica seguridad del tenant
3. Revisa caché Redis
   - Si existe → retorna al instante
   - Si no → consulta ADX

### 5. Respuesta al usuario
```
"Esta semana han tenido 14 pedidos entregados tarde, 
un 8% menos que la semana anterior."
```

---

## Ventajas de MCP + Cube.js

### 1. Cero Alucinaciones de Esquema

| Sin MCP/Cube | Con MCP/Cube |
|--------------|--------------|
| IA ve tablas reales | IA ve catálogo de métricas |
| Puede inventar columnas | Solo usa lo expuesto |
| `SELECT * FROM t_ops_log_002` ❌ | `get_metric("efficiency")` ✅ |

### 2. Agnóstico al Modelo

```
Hoy: Gemini ──┐
              │
Mañana: GPT ──┼──▶ MCP ──▶ Cube.js ──▶ ADX
              │
Futuro: Claude┘

Todos entienden MCP → cero cambios en tu backend
```

### 3. Descubrimiento Dinámico

```
1. Añades métrica "fuel_efficiency" en Cube.js

2. MCP pregunta a Cube.js su esquema actualizado

3. Agente IA descubre automáticamente la nueva métrica

4. Usuario puede preguntar:
   "¿Cuál es la eficiencia de combustible?"
   
   → Funciona sin reprogramar el agente
```

---

## Herramientas MCP a Exponer

```typescript
// Definición de tools para el servidor MCP

const tools = [
  {
    name: "list_available_metrics",
    description: "Lista todas las métricas disponibles para consultar",
    parameters: {}
  },
  {
    name: "get_metric",
    description: "Obtiene el valor de una métrica específica",
    parameters: {
      metric: { type: "string", required: true },
      time_range: { 
        type: "string", 
        enum: ["today", "this_week", "this_month", "custom"] 
      },
      group_by: { 
        type: "string",
        enum: ["day", "week", "region", "seller"]
      }
    }
  },
  {
    name: "compare_periods",
    description: "Compara una métrica entre dos períodos",
    parameters: {
      metric: { type: "string", required: true },
      period_a: { type: "string", required: true },
      period_b: { type: "string", required: true }
    }
  }
];
```

---

## Arquitectura Completa con MCP

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTES                               │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Dashboard │  │ Chatbot  │  │  Slack   │  │ Alertas  │    │
│  │  Web     │  │  en App  │  │   Bot    │  │   IA     │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       │             └──────┬──────┴─────────────┘           │
│       │                    │                                │
│       │                    ▼                                │
│       │           ┌─────────────────┐                       │
│       │           │   Servidor MCP  │  ← Agentes IA         │
│       │           └────────┬────────┘                       │
│       │                    │                                │
│       └────────────────────┼────────────────────────────────│
│                            ▼                                │
│                   ┌─────────────────┐                       │
│                   │    Cube.js      │                       │
│                   │  Semantic Layer │                       │
│                   │   + tenant_id   │                       │
│                   │   + Redis cache │                       │
│                   └────────┬────────┘                       │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             ▼
                      ┌──────────────┐
                      │     ADX      │
                      └──────────────┘
```

---

## Implementación: Stack Técnico

| Componente | Tecnología |
|------------|------------|
| Servidor MCP | Node.js + `@modelcontextprotocol/sdk` |
| Semantic Layer | Cube.js |
| Caché | Redis |
| Hosting MCP | Azure App Service / Container Apps |
| Base Analítica | Azure Data Explorer |

---

## Checklist MCP

- [ ] Instalar SDK de MCP (`@modelcontextprotocol/sdk`)
- [ ] Definir tools que exponen métricas de Cube.js
- [ ] Implementar autenticación (extraer tenant_id)
- [ ] Conectar MCP → Cube.js API
- [ ] Habilitar descubrimiento dinámico de esquema
- [ ] Tests de seguridad multi-tenant
- [ ] Documentar tools disponibles para el equipo de IA
