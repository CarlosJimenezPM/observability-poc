# Desafíos y Consideraciones Críticas

## ¿Cuándo necesitas esta arquitectura?

### ✅ Sí la necesitas si:

- Más de **50 usuarios concurrentes** en dashboards
- Base de datos con **más de 5M filas** en tablas analíticas
- **Multi-tenancy** (varios clientes comparten infraestructura)
- Dashboards complejos que ejecutan **queries pesadas**
- La BD operacional supera **50% CPU** en horas pico

### ❌ No la necesitas si:

| Situación | Por qué |
|-----------|---------|
| < 10 usuarios concurrentes | PostgreSQL aguanta bien |
| Datos < 1M filas | Índices bien puestos son suficientes |
| Sin multi-tenancy | No hay riesgo de filtrar datos |
| MVP / Validación | Complejidad innecesaria al principio |
| Equipo pequeño (1-3 devs) | Más infra = más mantenimiento |

**Regla práctica**: Si puedes resolver con `CREATE INDEX` y tu BD no supera 50% CPU en picos → no lo necesitas todavía.

---

## ¿Qué pasa si no la implementas (cuando sí la necesitas)?

| Problema | Síntoma | Impacto |
|----------|---------|---------|
| **BD saturada** | Operaciones lentas a las 9AM | Usuarios frustrados |
| **Latencia** | Crear pedido tarda 3s en vez de 200ms | Pérdida de ventas |
| **Filtración de datos** | Bug muestra datos de otro cliente | GDPR, demandas |
| **No escala** | Más clientes = todo más lento | Límite de crecimiento |
| **Costes** | Escalar verticalmente (más RAM/CPU) | Factura x10 |

---

## Desafíos Técnicos

### 1. Consistencia Eventual

**Problema:** El usuario puede ver un dato en el dashboard 100ms antes de que esté "firme" en la DB principal.

**Solución:** Diseñar la UI para tolerarlo:
- Indicadores visuales de "sincronizando..."
- Estados optimistas con rollback si falla
- No mostrar datos críticos hasta confirmación

---

### 2. Backpressure (Contrapresión)

**Problema:** Llegan 10,000 eventos/segundo pero la DB solo puede escribir 5,000.

**Solución:** Mecanismos de buffering:
- Colas con capacidad de almacenamiento temporal
- Rate limiting en origen
- Sampling para métricas no críticas
- Auto-scaling de consumidores

---

### 3. Costos de Infraestructura

**Problema:** WebSockets + OLAP DBs consumen más RAM/CPU que arquitectura pasiva.

**Consideraciones:**
- Dimensionar correctamente desde el inicio
- Usar connection pooling para WebSockets
- Agregar datos antes de almacenar (reducir volumen)
- Tier de retención: datos calientes vs fríos

---

### 4. Orden de Eventos

**Problema:** En sistemas distribuidos, los mensajes pueden llegar desordenados.

**Soluciones:**
- Timestamps en cada evento
- Números de secuencia
- Particionamiento por entidad
- Reordenamiento en el consumidor

---

## Checklist Pre-Implementación

- [ ] Definir SLA de latencia aceptable (¿100ms? ¿1s?)
- [ ] Estimar volumen de eventos/segundo
- [ ] Identificar eventos críticos vs informativos
- [ ] Definir política de retención de datos
- [ ] Planificar estrategia de backpressure
- [ ] Diseñar UI tolerante a consistencia eventual
