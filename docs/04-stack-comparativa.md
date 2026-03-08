# Stack Tecnológico - Comparativa Batch vs Streaming

## Tabla Comparativa

| Capa | Tradicional (Batch) | Tiempo Real (Streaming) |
|------|---------------------|-------------------------|
| **Ingesta** | REST API directo a DB | Kafka / Redpanda / RabbitMQ |
| **Procesamiento** | Cron Jobs / Scripts nocturnos | Apache Flink / ksqlDB |
| **Almacenamiento** | PostgreSQL / MySQL | ClickHouse / TimescaleDB / Elasticsearch |
| **Frontend** | React Query / Axios (Polling) | Socket.io / GraphQL Subscriptions |

---

## Stack Sugerido para PoC

### Opción Minimalista
- **Ingesta:** RabbitMQ (más simple que Kafka)
- **Procesamiento:** ksqlDB o directo sin procesamiento complejo
- **Almacenamiento:** TimescaleDB (familiar si usas PostgreSQL)
- **Entrega:** Socket.io

### Opción Enterprise
- **Ingesta:** Kafka / Redpanda
- **Procesamiento:** Apache Flink
- **Almacenamiento:** ClickHouse
- **Entrega:** GraphQL Subscriptions

---

## Nota sobre Redpanda

Alternativa a Kafka:
- Compatible con API de Kafka
- Más fácil de operar
- Escrito en C++ (mejor rendimiento)
- Sin dependencia de ZooKeeper
