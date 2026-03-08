# Patrones de Escritura: Cómo llegan los datos a ambas DBs

## ❌ Anti-patrón: Dual Write (Escritura Doble)

**NO hagas esto:**

```javascript
async function crearPedido(datos) {
  // 1. Guardar en Postgres (Operacional)
  await dbOperacional.save(datos);
  
  // 2. Guardar en ClickHouse (Analítica)
  await dbAnalitica.save(datos);  // ← PELIGRO
  
  return "Pedido Creado";
}
```

### Problemas

| Problema | Consecuencia |
|----------|--------------|
| Paso 1 OK, Paso 2 falla | Inconsistencia: pedido existe en operacional pero no en analítica |
| Latencia | Usuario espera DB1 + DB2 |
| Métricas | Tus dashboards mienten |

---

## ✅ Solución A: Change Data Capture (CDC) ⭐ RECOMENDADO

### Concepto

> Tu backend es "tonto". Solo escribe en la DB operacional.
> No sabe que existe la capa de analítica.

### Flujo

```
┌─────────────────┐
│    Frontend     │
└────────┬────────┘
         │ API call
         ▼
┌─────────────────┐
│    Backend      │  ← Solo conoce DB operacional
└────────┬────────┘
         │ INSERT/UPDATE
         ▼
┌─────────────────┐
│  DB Operacional │  (PostgreSQL)
│   + WAL Log     │
└────────┬────────┘
         │           ← Respuesta rápida al usuario (FIN de la petición)
         │
         │ CDC (Debezium) lee el WAL
         ▼
┌─────────────────┐
│  Message Broker │  (Kafka)
│    (Evento)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DB Analítica   │  (ClickHouse)
└─────────────────┘
```

### Ventajas

- **Garantía matemática:** Si está en operacional → llegará a analítica
- **Consistencia eventual** asegurada
- **Cero código extra** en tu backend
- **Desacoplado:** DB analítica puede caerse sin afectar operación

---

## ✅ Solución B: Transactional Outbox

### Cuándo usarlo

Si **no quieres montar CDC/Kafka todavía** pero necesitas consistencia.

### Concepto

> Usa tu DB operacional como cola de mensajes temporal.

### Flujo

```sql
BEGIN;
  -- Dato de negocio
  INSERT INTO pedidos (id, item) VALUES (1, 'zapato');
  
  -- Evento en la misma transacción
  INSERT INTO outbox_events (tipo, payload) 
  VALUES ('pedido_creado', '{"id":1, "item":"zapato"}');
COMMIT;
```

**Si falla → ninguno se guarda**
**Si funciona → ambos se guardan**

### Worker en Background

```
┌─────────────────┐
│  outbox_events  │
└────────┬────────┘
         │ Worker lee eventos pendientes
         ▼
┌─────────────────┐
│  DB Analítica   │
└────────┬────────┘
         │ Si OK
         ▼
┌─────────────────┐
│ DELETE evento   │
│ de outbox       │
└─────────────────┘
```

### Estructura tabla outbox

```sql
CREATE TABLE outbox_events (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ NULL  -- NULL = pendiente
);
```

---

## 🔄 Excepción: Telemetría Pura

### Datos que NO son de negocio

- Clicks del usuario
- Movimientos del mouse
- Logs de "página vista"
- Temperatura de servidores
- Métricas de sensores

### ¿Por qué diferente?

- No necesitan transacciones ACID
- Si se pierde 1 de 1 millón → no pasa nada
- Volumen muy alto → saturaría DB operacional

### Flujo directo

```
┌─────────────────┐
│ Frontend/Device │
└────────┬────────┘
         │ POST /telemetry
         ▼
┌─────────────────┐
│  Collector API  │  ← Endpoint especial, ligero
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Kafka → OLAP   │  ← Directo, sin tocar PostgreSQL
└─────────────────┘
```

---

## Resumen: Qué usar según tipo de dato

| Tipo de Dato | Ejemplo | Flujo |
|--------------|---------|-------|
| **Crítico de negocio** | Pedidos, Pagos, Tareas | Backend → DB Op → CDC/Outbox → DB Analítica |
| **Telemetría** | Clicks, Logs, Sensores | Frontend → Collector → Kafka → DB Analítica |

---

## Decisión para PoC

| Opción | Complejidad | Recomendación |
|--------|-------------|---------------|
| **Outbox** | Baja | ✅ Para empezar rápido |
| **CDC (Debezium)** | Media-Alta | ✅ Para producción |
| **Dual Write** | Baja | ❌ Nunca |
