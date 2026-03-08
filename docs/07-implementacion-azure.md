# Implementación en Azure

## Stack Completo

| Función | Servicio Azure |
|---------|----------------|
| Operación (OLTP) | Azure Database for PostgreSQL |
| Streaming / Cola | Azure Event Hubs |
| CDC | Debezium en Azure Container Instances |
| Análisis (OLAP) | Azure Data Explorer (ADX / Kusto) |
| Capa Semántica | App Service (Cube.js) + Azure Cache for Redis |
| WebSockets | Azure Web PubSub / SignalR Service |

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
