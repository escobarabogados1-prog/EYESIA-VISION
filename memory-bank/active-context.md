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
EDGE Go objetivo. El analyzer OIV usa un puerto de proveedor; Ollama/Qwen sigue
como motor experimental y hay un adaptador OpenAI-compatible preparado para
`llama.cpp server`. Contexto OIV, Decision Gate y journal volatil siguen
desacoplados del motor; el gate bloquea por defecto y las coincidencias solo
son dry-run.

## Siguiente paso

Instalar/configurar un runtime OpenAI-compatible en hardware aprobado y evaluar
su comportamiento con casos etiquetados; mantener `qwen2.5:3b` como baseline
experimental. Definir requisitos de persistencia antes de sustituir el journal
volatil por auditoria durable.

## Pendientes

- Estado reciente: `/api/status` expone `cola_analisis`; con Ollama caido
	conserva HTTP 200 y `estado=operativo`, mientras reporta `failed=1`. Hay 21
	pruebas automatizadas aprobadas. No existe executor real ni aprobacion
	confiable de politicas.
- Git: `main` y `origin/main` sincronizados en `c712137` al iniciar esta fase.
- No se encontro `llama-server`, `llamafile`, LM Studio ni `vllm` instalado;
	la alternativa compatible queda preparada, sin descarga de modelo.
- Proximo: integrar almacenamiento/auditoria de decisiones independiente del
	proveedor y ejecutar una evaluacion comparativa solo cuando el runtime y los
	casos etiquetados esten disponibles.
- Confirmar requisitos cambiados del producto.
- Confirmar clasificaciones, riesgos y acciones.
- Decidir persistencia historica.
- Definir politica de procesamiento de eventos `new`, `update` y `end`.
- Recibir los 10 criterios oficiales de Gate 3.
- Revisar migracion Node.js -> Go EDGE solo despues de definir Gate 3 y reunir
	evidencia de requisitos que la justifiquen.