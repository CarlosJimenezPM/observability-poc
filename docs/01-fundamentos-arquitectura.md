# Fundamentos de Arquitectura Real-Time

## Cambio de Paradigma

| Modelo | Descripción |
|--------|-------------|
| ❌ **Pasivo** | El usuario consulta los datos |
| ✅ **Reactivo** | Los datos buscan al usuario |

**Implicación:** Abandonar Request-Response → adoptar **Event-Driven Architecture (EDA)**

---

## 1. Capa de Ingesta

### Message Broker
El backend no escribe directo en DB de análisis, "publica" eventos.

| Tecnología | Características |
|------------|-----------------|
| **Kafka** | Estándar, muy escalable |
| **Redpanda** | Compatible Kafka, más ligero, sin Zookeeper |
| **RabbitMQ** | Más simple, bueno para empezar |

### Change Data Capture (CDC)
- **Herramienta:** Debezium
- **Función:** Lee el WAL de PostgreSQL/MySQL
- **Ventaja:** Convierte INSERT/UPDATE en eventos **sin cambiar código**

---

## 2. Capa de Procesamiento (Stream Processing)

Los datos se procesan "en vuelo", no en batch nocturno.

| Concepto | Tecnología | Ejemplo |
|----------|------------|---------|
| **Windowing** | Flink, ksqlDB | "Promedio últimos 5 min" |
| **Enriquecimiento** | Redis | Añadir nombre a ID en ms |

---

## 3. Capa de Almacenamiento (OLAP / TSDB)

Las DB relacionales colapsan con escrituras masivas. Necesitas DBs columnares.

### Por caso de uso

| Caso | Opciones |
|------|----------|
| **Analítica general** | ClickHouse, Druid, Pinot, ADX |
| **Métricas/Sensores** | TimescaleDB, InfluxDB |

### Criterios de selección
- Volumen de escritura (eventos/segundo)
- Tipo de queries (agregaciones vs puntuales)
- Familiaridad del equipo

---

## 4. Capa de Entrega (Push vs Pull)

### ❌ Anti-patrón: Polling
El navegador preguntando cada segundo satura el servidor.

### ✅ Solución: Push

| Tecnología | Características |
|------------|-----------------|
| **WebSockets** | Bidireccional, Socket.io |
| **SSE** | Unidireccional, más simple |
| **GraphQL Subscriptions** | Elegante si ya usas GraphQL |

### Patrón BFF Reactivo
```
Kafka → BFF (suscrito) → WebSocket → Frontend
```

---

## Stack Comparativo

| Capa | Batch (Tradicional) | Streaming (Real-Time) |
|------|---------------------|----------------------|
| Ingesta | REST → DB | Kafka / Event Hubs |
| Proceso | Cron jobs | Flink / ksqlDB |
| Storage | PostgreSQL | ClickHouse / ADX |
| Frontend | Polling | WebSockets |

---

## Stack Recomendado

### Para PoC (local)
- **Streaming:** Redpanda
- **OLAP:** ClickHouse
- **Entrega:** Socket.io

### Para Producción (Azure)
- **Streaming:** Event Hubs
- **OLAP:** Azure Data Explorer
- **Entrega:** Web PubSub / SignalR

→ Ver [07-implementacion-azure](07-implementacion-azure.md) para detalle de servicios.
