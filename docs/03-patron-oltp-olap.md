# Patrón de Dos Bases de Datos: OLTP + OLAP

## Concepto Clave

> **Separar la operación del análisis.**

Se duplican los datos pero se gana **velocidad** y **estabilidad**.

---

## 1. Base de Datos Operacional (OLTP)

### Características
- **Tecnología:** PostgreSQL, MySQL, SQL Server
- **Función:** "Fuente de la verdad" del día a día
- **Operaciones:** Crear pedidos, descontar inventario, procesar pagos
- **Optimización:** Escritura fila por fila

### ¿Por qué NO sirve para observabilidad?

❌ Consultas pesadas bloquean la DB:
```sql
-- Esta query puede tumbar tu SaaS
SELECT AVG(eficiencia) 
FROM dispositivos 
WHERE timestamp > NOW() - INTERVAL '10 seconds'
-- Si tienes 5,000 dispositivos...
```

❌ Si se bloquea → usuarios no pueden operar → SaaS caído

---

## 2. Base de Datos Analítica (OLAP / TSDB)

### Características
- **Tecnología:** ClickHouse, Elasticsearch, TimescaleDB, Snowflake
- **Función:** Recibe copia de datos en tiempo real vía eventos
- **Optimización:** Almacenamiento **columnar** (no por filas)

### ¿Por qué es necesaria?

✅ **Estructura columnar:** Calcular promedios/sumas sobre millones de datos tarda milisegundos

✅ **Aislamiento:** Puedes bombardearla con queries sin afectar la operación principal

---

## Sincronización: El Pipeline

```
┌─────────────────┐
│  Usuario hace   │
│  una acción     │
└────────┬────────┘
         ▼
┌─────────────────┐
│   DB OLTP       │  ← Fuente de verdad
│  (PostgreSQL)   │
└────────┬────────┘
         │
         │ CDC (Debezium) detecta cambio
         ▼
┌─────────────────┐
│ Message Broker  │  ← Kafka / RabbitMQ
│    (Evento)     │
└────────┬────────┘
         │
         │ Milisegundos
         ▼
┌─────────────────┐
│   DB OLAP       │  ← Para dashboards
│  (ClickHouse)   │
└─────────────────┘
```

---

## Resumen

| Aspecto | DB Operacional (OLTP) | DB Analítica (OLAP) |
|---------|----------------------|---------------------|
| **Propósito** | Que el negocio funcione | Que el negocio entienda qué pasa |
| **Operación principal** | Escribir | Leer / Analizar |
| **Optimización** | Transacciones ACID | Agregaciones rápidas |
| **Consultas** | Puntuales (1 pedido) | Masivas (millones de filas) |
| **Latencia escritura** | Crítica | Tolerable (ms de delay) |

---

## Trade-off

- **Costo:** Almacenas datos dos veces
- **Complejidad:** Necesitas mantener el pipeline de sincronización
- **Beneficio:** Sistema estable + dashboards rápidos
