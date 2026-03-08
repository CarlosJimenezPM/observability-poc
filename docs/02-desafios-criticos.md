# Desafíos y Consideraciones Críticas

## 1. Consistencia Eventual

**Problema:** El usuario puede ver un dato en el dashboard 100ms antes de que esté "firme" en la DB principal.

**Solución:** Diseñar la UI para tolerar esto:
- Indicadores visuales de "sincronizando..."
- Estados optimistas con rollback si falla
- No mostrar datos críticos hasta confirmación

---

## 2. Backpressure (Contrapresión)

**Problema:** Llegan 10,000 eventos/segundo pero la DB solo puede escribir 5,000.

**Solución:** Mecanismos de buffering:
- Colas con capacidad de almacenamiento temporal
- Rate limiting en origen
- Sampling para métricas no críticas
- Auto-scaling de consumidores

---

## 3. Costos de Infraestructura

**Problema:** WebSockets abiertos + OLAP DBs consumen mucha más RAM/CPU que arquitectura pasiva.

**Consideraciones:**
- Dimensionar correctamente desde el inicio
- Usar connection pooling para WebSockets
- Agregar datos antes de almacenar (reducir volumen)
- Tier de retención: datos calientes vs fríos

---

## 4. Orden de Eventos

**Problema:** En sistemas distribuidos, los mensajes pueden llegar desordenados.
- Ejemplo: "Enviado" antes de "Empaquetado"

**Soluciones:**
- Timestamps en cada evento
- Números de secuencia
- Particionamiento por entidad (todos los eventos de un pedido van a la misma partición)
- Reordenamiento en el consumidor (buffer + sort)

---

## Checklist Pre-Implementación

- [ ] Definir SLA de latencia aceptable (¿100ms? ¿1s?)
- [ ] Estimar volumen de eventos/segundo
- [ ] Identificar eventos críticos vs informativos
- [ ] Definir política de retención de datos
- [ ] Planificar estrategia de backpressure
- [ ] Diseñar UI tolerante a consistencia eventual
