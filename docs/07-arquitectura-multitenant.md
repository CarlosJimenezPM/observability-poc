# Arquitectura Multitenant

## Principio Fundamental

> **Una Tubería, Muchos Vecinos**
> 
> Infraestructura compartida con aislamiento lógico.

**NO:** Una base de datos por cliente (pesadilla de infra y costos)

**SÍ:** Una tabla gigante con columna `tenant_id`

---

## ¿Por qué compartir infraestructura?

Las DBs analíticas (ClickHouse, Snowflake, BigQuery, TimescaleDB) funcionan **mejor** con muchos datos juntos:

| Ventaja | Explicación |
|---------|-------------|
| **Compresión** | Datos juntos → mejor compresión → menos disco |
| **Mantenimiento** | Un `ALTER TABLE` vs ejecutar script en 500 DBs |
| **Costos** | Un clúster potente < 500 instancias ociosas |

---

## Seguridad: Aislamiento Lógico

### Riesgo
> "¿Qué pasa si Cliente A ve datos de Cliente B?"

### Estrategia 1: Ingesta Etiquetada (Tagging)

El `tenant_id` se pega **desde el origen**:

```json
// ❌ INCORRECTO - sin tenant
{ "accion": "login", "usuario": "juan" }

// ✅ CORRECTO - con tenant desde origen
{ 
  "tenant_id": "empresa_123", 
  "accion": "login", 
  "usuario": "juan" 
}
```

### Estrategia 2: Row-Level Security (RLS)

El API **inyecta forzosamente** el filtro de tenant:

```sql
-- Usuario pide:
SELECT sum(ventas) FROM metrics

-- Backend transforma a:
SELECT sum(ventas) FROM metrics 
WHERE tenant_id = 'su_empresa_uuid'  -- ← Inyectado
```

> **Nota:** PostgreSQL, ClickHouse y otras soportan RLS nativo - la DB rechaza queries sin permiso.

---

## Arquitectura Completa Multitenant

```
┌──────────────────────────────────────────────────┐
│                   INGESTA                        │
│  Eventos de TODOS los tenants → mismo Kafka      │
│  Cada mensaje lleva tenant_id                    │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│                ALMACENAMIENTO                    │
│  Una sola DB OLAP / Data Lake                    │
│  Particionada por fecha o tenant_id              │
└───────────────────────┬──────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────┐
│                   CONSULTA                       │
│  API filtra por tenant_id SIEMPRE                │
│  RLS como segunda capa de seguridad              │
└──────────────────────────────────────────────────┘
```

---

## Excepciones: Cuándo SÍ separar

Solo en dos casos crear infraestructura dedicada (silos):

### 1. Requisitos Legales Estrictos
- Cliente es banco o gobierno
- Contrato o ley exige aislamiento físico
- Ejemplos: normativa sanitaria, GDPR especial

### 2. Cliente "Ballena" (VIP)
- Volumen de datos satura a los demás
- **Noisy Neighbor Problem:** un cliente afecta rendimiento de otros
- Solución: clúster dedicado para el gigante

---

## Checklist Multitenant

- [ ] Todos los eventos llevan `tenant_id` desde origen
- [ ] API inyecta filtro de tenant en TODAS las queries
- [ ] RLS activado en la DB como segunda capa
- [ ] Logs y métricas también etiquetados por tenant
- [ ] Tests de seguridad: intentar acceder a datos de otro tenant
- [ ] Documentar excepciones (clientes con infra dedicada)
