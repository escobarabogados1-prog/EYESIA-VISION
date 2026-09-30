# Estado del proyecto para revision

- Fecha: 2026-09-30
- Producto: EYESIA VISION / OIV
- Runtime activo: prototipo Node.js de la raiz
- Estado del Gate 3: ABIERTO; los diez criterios oficiales siguen pendientes de aprobacion
- Este documento es un snapshot para revision y nuevas instrucciones, no una aprobacion de producto.

## Estado actual

- `npm test`: 12 pruebas aprobadas en la ultima ejecucion.
- `npm run eval:ollama`: herramienta diagnostica provisional; no define ni aprueba criterios de Gate 3.
- Ollama accesible ahora desde este entorno en `host.docker.internal:11434`; modelo disponible: `qwen2.5:3b`.
- Mosquitto y Frigate no estaban activos en la ultima comprobacion de `docker compose ps`.
- No hay implementacion Go ni migracion aprobada.

## Trabajo verificado

- Relay: Node obtiene MJPEG de Frigate; `/api/camera/frame` y `/api/camera/stream` devolvieron frames reales en una prueba local.
- MQTT: suscripcion y recuperacion tras reiniciar Mosquitto verificadas en prueba local.
- Cola de analisis: maximo un analisis activo y un evento pendiente; el resto se coalesce con contador. Es memoria volatil.
- Context: el analyzer recibe un resumen factual allowlisted de snapshots Frigate `before`/`after`; los campos arbitrarios de `raw_event` no se reenvian a Ollama.
- Contexto OIV: contrato neutral probado con Frigate y fixture retail sintetica; no implica soporte funcional retail.
- Fallo de Ollama: el evento queda accesible en `/api/events/latest`, el analisis devuelve HTTP 204 y la cola cuenta `failed`/`lastError`; Node sigue respondiendo.
- Salud: `/api/status` y `/api/events/health` exponen la cola. Actualmente `/api/status` conserva `estado: operativo` ante fallo de analisis.
- Suite: pruebas unitarias cubren normalizacion `new`/`update`/`end`, contexto OIV sintetico, contratos, timeout, prompt, cola y respuesta HTTP de `/api/status`.

## Hallazgo principal de calidad

Una comparacion real con eventos minimos que solo difieren en confianza detectora mostro:

| Confianza detectora | Resultado del modelo | Latencia |
|---|---|---:|
| 0.1 | `DETECCION / BAJO`; confianza de salida 0.1 | 42.2 s |
| 0.99 | `ALERTA / MEDIO`; confianza de salida 0.99 | 40.1 s |

Para el segundo caso no habia contexto adicional de amenaza; el modelo justifico la alerta por la confianza alta, aunque el prompt prohíbe decidir el riesgo solo por confianza. `temperature=0` y `OLLAMA_SEED=42` no evitaron esta violacion. Es evidencia exploratoria, no un criterio oficial ni una politica aprobada. No se implemento un guardrail de riesgo.

## Decisiones que requieren confirmacion

1. Definir que evidencia, aparte de la confianza detectora, puede justificar `ALERTA` o `INCIDENTE`.
2. Definir si la confianza de salida del modelo se elimina, se mantiene solo como dato no confiable o se calibra externamente.
3. Definir si `estado: operativo` significa que la API responde o que todo el pipeline esta saludable.
4. Aprobar los diez criterios de Gate 3 y sus escenarios/umbrales.

## Recomendacion

Aprobar primero un conjunto pequeno de casos etiquetados con resultado esperado. Usarlo para evaluar el modelo y despues implementar guardrails deterministas solo para la politica aprobada. Mantener Node como runtime mientras se completa esa evidencia; no iniciar migracion a Go antes de que Gate 3 y el caso comercial de migracion esten definidos.

## Comandos de validacion

- `npm test`
- `npm run eval:ollama` (invoca Ollama real; puede tardar hasta 60 s por solicitud)

## Archivos de referencia

- `docs/gate3-readiness.md`: matriz preliminar, no aprobada como criterios oficiales.
- `docs/adr/0001-bounded-analysis-queue.md`: decision de cola en memoria latest-wins.
- `memory-bank/progress.md`: historial de evidencia y trabajo realizado.
- `memory-bank/active-context.md`: contexto operativo y pendientes.
