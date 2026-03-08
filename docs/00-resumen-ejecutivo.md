# Resumen Ejecutivo - Flujo de Datos

## En 2 frases

> **Escritura:** Tu backend escribe únicamente en la Base de Datos Operacional, mientras un proceso automático (CDC) detecta ese cambio y lo replica instantáneamente en la Base de Datos Analítica sin tocar tu código principal.

> **Lectura:** Los dashboards consultan la Base de Datos Analítica a través de una API segura (Capa Semántica) que inyecta filtros de aislamiento por cliente, entregando métricas en tiempo real sin ralentizar la operación del negocio.

---

## Diagrama Completo

```
                           ESCRITURA
                              
    ┌──────────┐    ┌──────────┐    ┌─────────────┐
    │ Frontend │───▶│ Backend  │───▶│ DB Operac.  │
    └──────────┘    └──────────┘    │ (PostgreSQL)│
                                    └──────┬──────┘
                                           │
                                    CDC (Debezium)
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │   Kafka     │
                                    └──────┬──────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │ DB Analítica│
                                    │ (ClickHouse)│
                                    └──────┬──────┘
                                           │
                           LECTURA         │
                                           │
    ┌──────────┐    ┌──────────┐    ┌──────┴──────┐
    │Dashboard │◀───│ Semantic │◀───│  + filtro   │
    │ Cliente  │    │  Layer   │    │  tenant_id  │
    └──────────┘    │ (Cube.js)│    └─────────────┘
                    └──────────┘
```

---

## Principios Clave

1. **Desacoplamiento:** Backend no sabe que existe la analítica
2. **Consistencia:** CDC garantiza que los datos llegan
3. **Seguridad:** Capa semántica inyecta tenant_id siempre
4. **Rendimiento:** Operación y analítica no compiten por recursos
