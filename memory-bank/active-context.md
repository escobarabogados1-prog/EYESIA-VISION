# Contexto activo

## Arquitectura de referencia

EYESIA VISION: Intelligence Spine con OIV transversal B2B.

```text
Frigate -> MQTT -> EDGE -> Context -> Ollama -> Guardrails -> Executor -> Memoria
```

Stack objetivo: Go 1.22+, Ollama + Qwen2-VL, Supabase/PostgreSQL 16, Keygen CE,
MQTT y NATS.

Gate 3 esta abierto. Existen 10 criterios pendientes de definicion y evidencia.

## Trabajo actual

Endurecer el prototipo Node.js de la raiz, manteniendo separada la arquitectura
EDGE Go objetivo. Fases 1-7 estan implementadas: video, MQTT, contrato OIV,
cola latest-wins, analyzer Ollama, adaptador Frigate y contrato de contexto
neutral por dominio. Se verificaron relay/camara y MQTT reales; Context tiene
pruebas sinteticas de vigilancia y retail, sin hardware ni Ollama.

## Siguiente paso

`npm run eval:ollama` detecto que Ollama eleva `DETECCION/BAJO` a `ALERTA/MEDIO`
por detector confidence 0.99, sin contexto adicional; tambien copia ese score a
confidence de salida. Siguiente: acordar politica de riesgo/confidence con el
	propietario antes de guardrails y evaluar casos etiquetados. Fallo Ollama inaccesible ya se refleja
	en la cola expuesta tanto por `/api/status` como por `/api/events/health`; queda
	decidir si `estado=operativo` significa API disponible o pipeline saludable.
	Medir recuperacion MQTT y aprobar criterios/umbrales Gate 3.

## Pendientes

- Estado reciente: `/api/status` expone `cola_analisis`; con Ollama caido
	conserva HTTP 200 y `estado=operativo`, mientras reporta `failed=1`. Hay 12
	pruebas automatizadas aprobadas. Retail solo se valida como contrato sintetico.
- Proximo: acordar semanticas y politicas por dominio con el propietario,
	incluidos riesgo/confidence y significado de `estado=operativo`. Despues,
	definir propuestas de decision y autorizacion; ninguna accion se ejecuta sin
	politica aprobada y evidencia auditable.
- Confirmar requisitos cambiados del producto.
- Confirmar clasificaciones, riesgos y acciones.
- Decidir persistencia historica.
- Definir politica de procesamiento de eventos `new`, `update` y `end`.
- Recibir los 10 criterios oficiales de Gate 3.
- Revisar migracion Node.js -> Go EDGE solo despues de definir Gate 3 y reunir
	evidencia de requisitos que la justifiquen.