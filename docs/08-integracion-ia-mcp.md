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
│ (Gemini/GPT)  │
└───────┬───────┘
        │ Protocolo MCP
        ▼
┌───────────────┐
│  Servidor MCP │  Expone: get_metric, list_metrics
└───────┬───────┘
        │ REST/GraphQL
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

## Flujo Completo

1. **Usuario pregunta:** "¿Cuántos pedidos retrasados esta semana?"

2. **IA decide llamar herramienta:**
```json
{
  "tool": "get_metric",
  "params": { "metric": "late_orders", "time": "this_week" }
}
```

3. **Cube.js procesa:**
   - Extrae tenant_id del JWT
   - Genera SQL con filtro forzado
   - Consulta DB (o caché)

4. **IA responde:** "14 pedidos retrasados, 8% menos que la semana pasada."

---

## Herramientas MCP a Exponer

```typescript
const tools = [
  {
    name: "list_available_metrics",
    description: "Lista métricas disponibles",
    parameters: {}
  },
  {
    name: "get_metric",
    description: "Obtiene valor de una métrica",
    parameters: {
      metric: { type: "string", required: true },
      time_range: { type: "string", enum: ["today", "this_week", "this_month"] },
      group_by: { type: "string", enum: ["day", "region", "product"] }
    }
  },
  {
    name: "compare_periods",
    description: "Compara métrica entre dos períodos",
    parameters: {
      metric: { type: "string", required: true },
      period_a: { type: "string", required: true },
      period_b: { type: "string", required: true }
    }
  }
];
```

---

## Ventajas

| Ventaja | Descripción |
|---------|-------------|
| **Cero alucinaciones** | IA solo ve métricas expuestas, no tablas |
| **Seguridad total** | tenant_id inyectado en servidor, imposible saltarlo |
| **Agnóstico al modelo** | Gemini, GPT, Claude → todos entienden MCP |
| **Descubrimiento dinámico** | Nueva métrica en Cube → IA la descubre automáticamente |
| **Consistencia** | Dashboard y chatbot = mismos números |

---

## Arquitectura con Múltiples Consumidores

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Dashboard │  │ Chatbot  │  │  Slack   │  │ Alertas  │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │
     │             └──────┬──────┴─────────────┘
     │                    │
     │                    ▼
     │           ┌─────────────────┐
     │           │   Servidor MCP  │
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
| Semantic Layer | Cube.js |
| Caché | Redis |
| Hosting | Azure App Service |

---

## Checklist

- [ ] Definir métricas en Cube.js
- [ ] Implementar servidor MCP con tools
- [ ] Conectar MCP → Cube.js API
- [ ] Autenticación: extraer tenant_id de JWT
- [ ] Tests: IA intenta acceder a otro tenant
- [ ] Documentar tools para equipo
