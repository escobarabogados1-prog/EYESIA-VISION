# ADR 0001: Cola acotada de análisis latest-wins

- Estado: Aceptada para el prototipo Node.js
- Fecha: 2026-09-30

## Contexto

El callback MQTT iniciaba un análisis Ollama por cada evento sin limitar la
concurrencia. El servicio de eventos solo conserva el evento más reciente y
descarta el resultado de análisis si ese evento ya fue reemplazado.

En una prueba controlada de 100 eventos con una demora simulada de 50 ms por
respuesta, el comportamiento previo inició 100 solicitudes simultáneas; solo 1
resultado pudo asociarse al evento más reciente y 99 quedaron obsoletos. La
demora fue simulada: no representa una medición de Ollama ni de la cámara.

## Decisión

El proceso mantiene como máximo un análisis activo y un evento pendiente. Si
llegan más eventos mientras se analiza uno, el pendiente se reemplaza por el
más reciente y se incrementa `coalesced`. Al completar un análisis, solo se
adjunta su resultado si el objeto de evento sigue siendo el último recibido.
Los resultados que ya no corresponden al último evento se cuentan como
`staleResults`.

El endpoint existente `/api/events/health` expone los contadores de la cola.
Los eventos MQTT continúan actualizando el último evento en memoria. La cola no
es durable: un reinicio pierde cualquier análisis activo o pendiente.

## Consecuencias

- La cantidad de solicitudes concurrentes a Ollama queda limitada a una.
- La memoria pendiente de análisis queda limitada a un evento.
- Bajo ráfagas, pueden omitirse análisis de eventos intermedios; esta omisión
  queda contabilizada y no se presenta como almacenamiento o procesamiento
  histórico.
- La política no cierra ni define criterios de Gate 3. Los límites y umbrales
  oficiales siguen pendientes de aprobación.
- Persistencia, reintentos y recuperación tras reinicio quedan fuera de esta
  decisión.