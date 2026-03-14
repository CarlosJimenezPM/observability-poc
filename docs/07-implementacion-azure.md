# Implementación en Azure

> **Contexto:** Este documento mapea la arquitectura del PoC a servicios Azure equivalentes.
> Ver también: [ARCHITECTURE.md](../ARCHITECTURE.md), [FAQ de Arquitectura](FAQ-arquitectura.md), [ADRs](13-decisiones-arquitectura.md)

## Stack Completo

| Función | PoC (local) | Servicio Azure |
|---------|-------------|----------------|
| Operación (OLTP) | PostgreSQL | Azure Database for PostgreSQL |
| Streaming / Cola | Redpanda | Azure Event Hubs (Kafka API) |
| CDC | Debezium | Debezium en Azure Container Instances |
| Análisis (OLAP) | ClickHouse | Azure Data Explorer (ADX / Kusto) |
| Capa Semántica | Cube.js | App Service + Azure Cache for Redis |
| Integración IA | MCP Server | App Service o Azure Container Apps |
| WebSockets | — | Azure Web PubSub / SignalR Service |

---

## 1. Capa de Operación (Día a día del SaaS)

### Backend / API
- **Azure App Service** — para APIs tradicionales
- **Azure Kubernetes Service (AKS)** — si usas microservicios

### Base de Datos Operacional (OLTP)
- **Azure Database for PostgreSQL (Flexible Server)**
- Robusta y escalable
- Soporta CDC vía replicación lógica

---

## 2. Capa de Ingesta y Streaming

### Message Broker
- **Azure Event Hubs**
- Equivalente nativo a Apache Kafka
- Millones de eventos/segundo
- Latencia de milisegundos

### CDC (Change Data Capture)
- **Debezium en Azure Container Instances (ACI)**
- Lee el WAL de PostgreSQL
- Empuja cambios a Event Hubs automáticamente

### Telemetría Directa
- Frontend → **Azure API Management** → Event Hubs
- Datos no críticos (clicks, GPS) saltan PostgreSQL

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│ API Mgmt    │────▶│ Event Hubs  │
│  (telemetry)│     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 3. Capa de Almacenamiento Analítico

### Azure Data Explorer (ADX / Kusto) ⭐

**Por qué ADX:**
- Diseñado para telemetría, logs y series temporales
- **Integración directa con Event Hubs** (sin código)
- Consultas rápidas sobre miles de millones de registros
- **RLS nativo** para multitenant

### Integración Event Hubs → ADX

```
┌─────────────┐     ┌─────────────┐
│ Event Hubs  │────▶│    ADX      │  ← Ingesta automática
│             │     │  (Kusto)    │     configurada en portal
└─────────────┘     └─────────────┘
```

---

## 4. Capa Semántica y Entrega

### Semantic Layer
- **Cube.js en Azure App Service**
- Conecta a Azure Data Explorer
- Aplica reglas de seguridad (tenant_id)
- Caché con **Azure Cache for Redis**

### WebSockets (Push en tiempo real)
- **Azure Web PubSub** — más simple
- **Azure SignalR Service** — más features

Mantienen conexión abierta con navegadores y "empujan" datos nuevos.

### MCP Server (Integración IA)
- **Azure Container Apps** — serverless, escala a cero
- **Azure App Service** — si prefieres PaaS tradicional

**Configuración:**
```yaml
# Container Apps environment variables
CUBE_API_URL: https://<cube-app>.azurewebsites.net
DATABASE_URL: postgresql://<user>@<server>.postgres.database.azure.com/<db>
MCP_PORT: 3001
```

**Seguridad:**
- API keys en Azure Database for PostgreSQL (misma instancia OLTP)
- Azure Key Vault para secretos
- Managed Identity para conexión a PostgreSQL

**Exposición:**
- Azure API Management como gateway
- Rate limiting por API key
- WAF para protección adicional

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Claude/GPT  │────▶│ API Mgmt    │────▶│ MCP Server  │
│  (Agente)   │     │ (gateway)   │     │ (Container) │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │   Cube.js   │
                                        │ (App Svc)   │
                                        └─────────────┘
```

---

## Diagrama Completo Azure

```
                        ┌─────────────────────────────────────┐
                        │         CAPA OPERACIÓN              │
                        │                                     │
    ┌──────────┐       │  ┌──────────┐    ┌──────────────┐   │
    │ Frontend │───────┼─▶│ App Svc  │───▶│ PostgreSQL   │   │
    │   SaaS   │       │  │ (API)    │    │ Flex Server  │   │
    └──────────┘       │  └──────────┘    └──────┬───────┘   │
                        │                         │           │
                        └─────────────────────────┼───────────┘
                                                  │
                        ┌─────────────────────────┼───────────┐
                        │      CAPA STREAMING     │           │
                        │                         ▼           │
    ┌──────────┐       │  ┌──────────┐    ┌──────────────┐   │
    │Telemetría│───────┼─▶│ API Mgmt │───▶│              │   │
    │ directa  │       │  └──────────┘    │  Event Hubs  │   │
    └──────────┘       │                  │              │   │
                        │  ┌──────────┐    │              │   │
                        │  │ Debezium │───▶│  (Kafka API) │   │
                        │  │  (ACI)   │    │              │   │
                        │  └──────────┘    └──────┬───────┘   │
                        │                         │           │
                        └─────────────────────────┼───────────┘
                                                  │
                        ┌─────────────────────────┼───────────┐
                        │      CAPA ANALÍTICA     │           │
                        │                         ▼           │
                        │                  ┌──────────────┐   │
                        │                  │    Azure     │   │
                        │                  │    Data      │   │
                        │                  │   Explorer   │   │
                        │                  │   (Kusto)    │   │
                        │                  └──────┬───────┘   │
                        │                         │           │
                        └─────────────────────────┼───────────┘
                                                  │
                        ┌─────────────────────────┼───────────┐
                        │      CAPA ENTREGA       │           │
                        │                         ▼           │
                        │  ┌──────────┐    ┌──────────────┐   │
                        │  │  Redis   │◀───│   Cube.js    │   │
                        │  │  Cache   │    │  (App Svc)   │   │
                        │  └──────────┘    └──────┬───────┘   │
                        │                         │           │
                        │                  ┌──────▼───────┐   │
                        │                  │  Web PubSub  │   │
                        │                  │  / SignalR   │   │
                        │                  └──────┬───────┘   │
                        │                         │           │
                        └─────────────────────────┼───────────┘
                                                  │
                                                  ▼
                                           ┌──────────┐
                                           │Dashboard │
                                           │ Cliente  │
                                           └──────────┘
```

---

## Consideraciones de Costos

| Servicio | Modelo de Pricing |
|----------|-------------------|
| Event Hubs | Por throughput units + eventos |
| ADX | Por clúster (compute + storage) |
| Web PubSub | Por unidades + mensajes |
| Redis Cache | Por tier y tamaño |

**Tip:** ADX tiene tier "Dev/Test" más económico para PoC.

---

## 5. MCP Server en Azure

### Opción A: Azure Container Apps (Recomendada)

```bash
az containerapp create \
  --name mcp-server \
  --resource-group observability-rg \
  --environment observability-env \
  --image ghcr.io/<org>/mcp-server:latest \
  --target-port 3001 \
  --ingress external \
  --env-vars \
    CUBE_API_URL=https://cube-app.azurewebsites.net \
    DATABASE_URL=secretref:postgres-url
```

**Ventajas:**
- Escala a cero (ahorro cuando no hay agentes conectados)
- Managed TLS
- Integración con Dapr para service discovery

### Opción B: Azure App Service

Si ya tienes Cube.js en App Service, puedes colocar MCP en el mismo App Service Plan.

### Almacenamiento de API Keys

```sql
-- En Azure Database for PostgreSQL
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(64) UNIQUE NOT NULL,
  tenant_id VARCHAR(50) NOT NULL,
  name VARCHAR(100),
  enabled BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  request_count BIGINT DEFAULT 0
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

---

## Referencias

- [ARCHITECTURE.md](../ARCHITECTURE.md) — Estructura del PoC
- [FAQ de Arquitectura](FAQ-arquitectura.md) — Respuestas a preguntas técnicas
- [ADRs](13-decisiones-arquitectura.md) — Decisiones de diseño
- [MCP Integration](08-integracion-ia-mcp.md) — Detalle del servidor MCP
