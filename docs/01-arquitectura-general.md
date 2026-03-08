# Arquitectura General - Real-Time Observability

## Concepto Fundamental

**Cambio de paradigma:**
- ❌ Modelo **pasivo**: el usuario consulta los datos
- ✅ Modelo **reactivo**: los datos buscan al usuario

**Implicación arquitectónica:**
- Abandonar arquitectura **Request-Response** tradicional
- Adoptar **Event-Driven Architecture (EDA)**

---

## 1. Capa de Ingesta de Datos

### Del API REST al Streaming

En arquitectura tradicional: backend → escribe en DB → fin.
En tiempo real: cada acción es un **evento** que debe transmitirse.

### Componentes clave

#### Message Broker
- **Opciones:** Apache Kafka, RabbitMQ, Amazon Kinesis
- **Función:** La aplicación no escribe directamente en DB de análisis, sino que "publica" eventos
- **Ejemplos de eventos:** `pedido_completado`, `camion_llegada`

#### Change Data Capture (CDC)
- **Herramienta:** Debezium
- **Función:** Lee el log de transacciones de la DB principal (PostgreSQL/MySQL)
- **Ventaja:** Convierte cada INSERT/UPDATE en evento en tiempo real **sin reescribir el backend**

---

## 2. Capa de Procesamiento

### Stream Processing

No se puede esperar a procesos batch nocturnos. Los datos se procesan **"en vuelo"**.

#### Windowing (Ventanas de Tiempo)
- **Caso de uso:** "promedio de velocidad en los últimos 5 minutos"
- **Motores:** Apache Flink, Spark Streaming, ksqlDB

#### Enriquecimiento en Caliente
- **Problema:** Datos crudos necesitan contexto (ej: llega ID de usuario → necesitas nombre y rol)
- **Requisito:** Resolución en milisegundos
- **Solución:** Cachés de ultra-baja latencia como **Redis**

---

## Tecnologías Mencionadas

| Categoría | Opciones |
|-----------|----------|
| Message Broker | Kafka, RabbitMQ, Kinesis |
| CDC | Debezium |
| Stream Processing | Flink, Spark Streaming, ksqlDB |
| Caché | Redis |
