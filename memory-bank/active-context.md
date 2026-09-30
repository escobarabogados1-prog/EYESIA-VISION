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
EDGE Go objetivo. Fases 1-8 estan implementadas: video, MQTT, contrato OIV,
cola latest-wins, analyzer Ollama, adaptador Frigate, contrato de contexto
neutral y Decision Gate fail-closed en modo dry-run. Se verificaron relay/
camara y MQTT reales; Context y Gate tienen pruebas sinteticas.

## Siguiente paso

Definir con el propietario politicas y semanticas por dominio, y un mecanismo
confiable de aprobacion/autorizacion. Despues, anadir casos etiquetados y
auditoria durable. Mientras falten esos controles, el runtime debe seguir
bloqueando propuestas por `POLICY_MISSING`; no habilitar acciones reales.

## Pendientes

- Estado reciente: `/api/status` expone `cola_analisis`; con Ollama caido
	conserva HTTP 200 y `estado=operativo`, mientras reporta `failed=1`. Hay 16
	pruebas automatizadas aprobadas. No existe executor real ni aprobacion
	confiable de politicas.
- Git: `main` local contiene `93b4bcd` y `f86b0d6`; `origin/main` sigue en
	`4b9618a`. El push agoto 20 s (`124`); no se confirmo publicacion. `eyesia/`
	permanece sin modificar y fuera de esos commits.
- Proximo: definir registro confiable/aprobacion de politicas y autorizacion,
  evaluar casos etiquetados por dominio y mantener el executor deshabilitado
  hasta que esos controles y la auditoria durable esten aprobados.
- Confirmar requisitos cambiados del producto.
- Confirmar clasificaciones, riesgos y acciones.
- Decidir persistencia historica.
- Definir politica de procesamiento de eventos `new`, `update` y `end`.
- Recibir los 10 criterios oficiales de Gate 3.
- Revisar migracion Node.js -> Go EDGE solo despues de definir Gate 3 y reunir
	evidencia de requisitos que la justifiquen.