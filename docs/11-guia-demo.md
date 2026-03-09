# Guía de Demo (20-30 min)

## Preparación

```bash
# Levantar infraestructura
docker compose up -d

# Verificar que todo está corriendo
docker compose ps

# Instalar dependencias del demo
cd demo && npm install && cd ..
```

---

## Estructura de la Presentación

### 1. El Problema (5 min)

*"Imaginad que tenemos 100 clientes abriendo dashboards a las 9AM..."*

Puntos a mencionar:
- La BD operacional se satura con queries analíticas
- Los usuarios que crean pedidos sufren latencia
- **Peor aún**: un bug podría filtrar datos entre clientes

---

### 2. La Solución - Diagrama (3 min)

Dibujar o mostrar:

```
PostgreSQL → Redpanda → ClickHouse → Cube.js
   (OLTP)    (stream)     (OLAP)    (seguridad)
```

Explicar cada componente:
- **PostgreSQL**: Operaciones del día a día (crear pedidos)
- **Redpanda**: Captura cambios en tiempo real
- **ClickHouse**: Optimizado para queries analíticas masivas
- **Cube.js**: Inyecta `tenant_id` en TODAS las queries

---

### 3. Demo en Vivo (15 min)

#### A) Mostrar datos fluyendo (3 min)

**Terminal 1** - Simulador generando pedidos:
```bash
KAFKA_BROKER=localhost:19092 node simulator/simulator.js
```

**Terminal 2** - Datos llegando a ClickHouse en tiempo real:
```bash
watch -n2 'curl -s "http://localhost:8123/" -d "SELECT tenant_id, count() FROM orders GROUP BY tenant_id"'
```

*"Cada pedido va a PostgreSQL Y automáticamente a ClickHouse via Redpanda"*

---

#### B) Seguridad multi-tenant con JWT (5 min)

```bash
cd demo && ./test_multitenancy.sh
```

Puntos a destacar:
- *"Mismo endpoint, distinto token, distintos datos"*
- *"Sin token = rechazado"*
- *"Token inválido = rechazado"*
- *"Imposible ver datos de otro tenant"*

---

#### C) Cube.js Playground (5 min)

1. Abrir http://localhost:4000
2. Mostrar cómo arrastrar métricas y dimensiones
3. Ejecutar una query
4. *"Esto es lo que verían los clientes - sin escribir SQL"*

---

#### D) El código de seguridad (2 min)

Mostrar `cube/cube.js`:

```javascript
// Este filtro se añade SIEMPRE, en el servidor
query.filters.push({
  member: 'Orders.tenantId',
  operator: 'equals', 
  values: [securityContext.tenantId]
});
```

*"Da igual qué pida el cliente, este filtro se añade siempre"*

---

### 4. Cierre y Preguntas (5 min)

#### Puntos clave a destacar:

| Beneficio | Cómo lo logramos |
|-----------|------------------|
| Escala independiente | OLTP y OLAP separados |
| Seguridad por diseño | `tenant_id` inyectado en servidor |
| Respuestas rápidas | Cache Redis |
| Preparado para IA | Servidor MCP incluido |

#### Preguntas frecuentes:

**¿Y si no tenemos ClickHouse?**
> El PoC incluye TimescaleDB como alternativa para ARM/desarrollo.

**¿Esto funciona en Azure?**
> Sí, ver `docs/07-implementacion-azure.md` para el mapeo de servicios.

**¿Cuándo deberíamos implementar esto?**
> Ver `docs/02-desafios-criticos.md` - hay una checklist de criterios.

---

## Demo Rápida (5 min)

Si tienes poco tiempo:

```bash
# 1. Levantar todo
docker compose up -d

# 2. Demo de seguridad (lo más impactante)
cd demo && npm install && ./test_multitenancy.sh
```

Mensaje clave: *"Mismo endpoint + distinto JWT = datos completamente aislados"*
