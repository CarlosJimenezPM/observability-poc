# Capa de Entrega - Push vs Pull

## Anti-patrón: Polling

El navegador preguntando "¿hay datos nuevos?" cada segundo **satura el servidor**.

## Solución: Push

El servidor **empuja** actualizaciones al frontend cuando ocurren.

---

## Tecnologías de Push

### WebSockets
- Canal bidireccional persistente
- Ideal para actualizaciones frecuentes
- **Librería:** Socket.io

### Server-Sent Events (SSE)
- Unidireccional (servidor → cliente)
- Más simple que WebSockets
- Funciona sobre HTTP estándar

### GraphQL Subscriptions
- Si ya usas GraphQL
- Forma elegante de manejar tiempo real
- Basado en WebSockets internamente

---

## Patrón: Backend for Frontend (BFF) Reactivo

```
Message Broker (Kafka)
        ↓
   BFF Reactivo (suscrito a eventos)
        ↓
   WebSocket/SSE
        ↓
   Frontend (React/Vue)
```

**Función del BFF:**
1. Se suscribe al Message Broker
2. Filtra eventos relevantes para cada cliente conectado
3. Reenvía mensajes al navegador en tiempo real
