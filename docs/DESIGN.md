# Diseño tecnico - EYESIA VISION

## Arquitectura oficial

EYESIA VISION es un Intelligence Spine con OIV como producto transversal B2B.
La implementacion objetivo usa EDGE en Go 1.22+, Ollama + Qwen2-VL para
razonamiento, Supabase + PostgreSQL 16 para cloud, Keygen CE para licencias y
MQTT + NATS como buses de eventos.

```text
Frigate -> MQTT -> EDGE -> Context -> Ollama -> Guardrails -> Executor -> Memoria
```

El repositorio actual contiene un prototipo Node.js/Express. Esa implementacion
no debe confundirse con la arquitectura objetivo: la migracion de Node.js a
EDGE Go es una brecha registrada que requiere decision y evidencia.

## Principios

- Operational Intelligence es el nucleo transversal; vigilancia es un dominio,
  no el modelo del producto completo.
- Cada dominio adapta sus fuentes a un contexto canonico y conserva su propia
  semantica, politica y conjunto de acciones.
- Frigate detecta; no decide el riesgo de negocio.
- MQTT transporta eventos; no contiene logica de dominio.
- Node.js coordina adaptadores y expone la API.
- Operational Intelligence analiza mediante un puerto reemplazable.
- Ollama es infraestructura, no el contrato central del sistema.
- Los eventos externos se normalizan una sola vez.
- El contexto y el resultado del modelo son datos no confiables.
- El executor deniega por defecto si faltan politica aprobada, autorizacion o
  registro auditable; hoy no hay acciones automaticas habilitadas.
- Ninguna capa se considera lista mientras su gate permanezca abierto.

## Arquitectura actual del repositorio

```text
Camara IP
  -> Frigate
  -> Mosquitto / MQTT
  -> src/services/mqtt.js
  -> evento normalizado
  -> src/services/events.js
  -> adaptador Frigate -> contexto canonico OIV
  -> Operational Intelligence / proveedor seleccionado
  -> Decision Gate fail-closed (solo dry-run)
  -> API REST
```

Retail/afluencia e inventario podran conectar adaptadores al mismo contrato
cuando sus fuentes, semantica y politicas esten definidas. No forman parte de
la implementacion actual.

## Arquitectura objetivo de la Fase 1

```text
Camara IP
  -> Frigate
  -> MQTT
  -> adaptador MQTT
  -> contrato interno de evento
  -> servicio de eventos
  -> Operational Intelligence
  -> puerto de proveedor -> adaptador configurable
  -> resultado de analisis
  -> API REST
```

La API y los servicios Node.js son una base de transicion. El destino es que
EDGE en Go sea el propietario del pipeline y que Node.js quede como adaptador
temporal o sea retirado tras cerrar los criterios correspondientes.

## Modulos

### `src/services/mqtt.js`

Conecta con Mosquitto, se suscribe a los topics de Frigate y convierte el
payload externo al contrato interno. No clasifica ni genera alertas.

### `src/services/events.js`

Conserva temporalmente el evento y el resultado asociado. En Fase 1 la
persistencia es en memoria y no debe considerarse almacenamiento historico.

### `src/services/operational-intelligence/analyzer.js`

Construye el prompt/contexto y valida la salida con `contract.js`. Solo conoce
el puerto `provider.generate({prompt, timeoutMs})`; no conoce endpoints HTTP,
autenticacion ni formato de transporte del motor.

### `src/services/operational-intelligence/providers/`

`createProvider()` selecciona el adaptador mediante `AI_PROVIDER`. Los
adaptadores devuelven texto JSON; el analyzer aplica el mismo contrato OIV para
cualquiera de ellos.

- `ollama.js`: proveedor predeterminado experimental, actualmente
  `qwen2.5:3b`. Se conserva para comparar resultados; no es requisito para la
  suite tecnica.
- `openai-compatible.js`: adaptador para endpoints locales compatibles con
  `/v1/chat/completions`, incluidos `llama.cpp server`. Acepta URL/modelo y una
  API key opcional mediante entorno. `llama-server` no esta instalado en el
  entorno actual, por lo que el adaptador esta probado con mocks, no contra un
  motor real.

### `src/services/operational-intelligence/decision-gate.js`

Compara la propuesta con reglas exactas de una politica del mismo dominio.
Sin politica, con politica no aprobada/invalida o ante cualquier diferencia,
devuelve `BLOCKED` sin accion. Una coincidencia produce solo `SIMULATED` con
`execution.attempted=false`; no hay executor de acciones externas. El prototipo
no tiene registro confiable ni flujo de aprobacion de politicas: los metadatos
de aprobacion solo se ejercitan en pruebas sinteticas y no habilitan produccion.
`GET /api/events/latest/decision` expone la decision asociada al ultimo evento.

### `src/services/operational-intelligence/decision-journal.js`

Mantiene las ultimas 100 trazas minimas en memoria, independientes del motor.
Registra proveedor/modelo, dominio, clasificacion, riesgo y resultado del gate;
omite payloads, imagenes, contexto completo y razonamiento. `/api/events/health`
expone solo cantidad, capacidad, sobrescrituras y timestamp mas reciente. Es
diagnostico volatil, no auditoria durable ni retencion historica.

### `src/services/operational-intelligence/context-contract.js` y `context.js`

`context-contract.js` valida y crea un sobre OIV independiente del dominio:
dominio, fuente, sujeto, instante, ciclo opcional, observaciones tipadas y
cambios con valores escalares; limita el contexto a 16 KiB, 32 observaciones,
64 cambios y 64 campos por observacion. `context.js` adapta eventos Frigate al
contrato y expone objeto, score detector y zona; no asigna riesgo, no infiere
intenciones y no reenvia `raw_event` completo.

Cada adaptador de dominio es responsable de minimizar y revisar sus datos antes
de crear el contexto. El contrato impide estructuras anidadas arbitrarias en
las señales para evitar pasar payloads fuente completos.

La fixture sintetica `retail_analytics` comprueba que el contrato puede
representar afluencia e inventario sin campos de Frigate. No implementa esos
adaptadores ni habilita su analisis.

### `src/routes/status.js`

Expone el estado operativo de los servicios sin ocultar fallos de dependencias.

## Contrato interno de evento

```json
{
  "event_id": "string",
  "timestamp": "ISO-8601",
  "source": "frigate",
  "device": {
    "camera_id": "string"
  },
  "detection": {
    "object": "person",
    "confidence": 0.95
  },
  "event_type": "new|update|end",
  "zone": "string|null",
  "status": "open|closed",
  "raw_event": {}
}
```

Los alias publicos existentes (`camera_id`, `object`, `confidence`) pueden
mantenerse durante la transicion para no romper clientes actuales.

## Contrato de analisis

```json
{
  "classification": "DETECCION|ALERTA|INCIDENTE",
  "risk": "BAJO|MEDIO|ALTO",
  "confidence": 0.0,
  "factors": [],
  "reason": "string",
  "missing_data": [],
  "recommended_action": "REVISAR"
}
```

El resultado del modelo se considera no confiable hasta pasar por validacion.

## Frontera de decisiones

El pipeline separa la propuesta del modelo, la validacion de politica,
autorizacion y ejecucion. El prototipo implementa solo la comparacion
fail-closed, la previsualizacion `dry_run` y un journal volatil; no verifica
identidades de quienes aprueban politicas y no ejecuta acciones externas. El
endpoint de decision expone el resultado asociado al evento actual. Registro
durable, aprobacion confiable, autorizacion y executor siguen pendientes.

## Flujo de errores

1. JSON MQTT invalido: registrar y descartar el mensaje.
2. Evento que no cumple el contrato: registrar y no analizar.
3. Proveedor seleccionado no disponible: conservar el evento con estado `analysis_pending`.
4. Respuesta invalida: registrar el error y no publicar una clasificacion.
5. Evento nuevo mientras se analiza uno anterior: no sobrescribir el evento
   mas reciente con una respuesta antigua.

## Configuracion

```env
MQTT_URL=mqtt://localhost:1883
FRIGATE_TOPIC_PREFIX=frigate
AI_PROVIDER=ollama
AI_TIMEOUT_MS=60000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
OPENAI_COMPATIBLE_BASE_URL=http://localhost:8080/v1
OPENAI_COMPATIBLE_MODEL=local-model
```

Para el motor compatible se selecciona `AI_PROVIDER=openai-compatible`. No se
requiere credencial para un servidor local sin autenticacion.

`npm test` valida contratos y transporte con proveedores simulados; no mide
calidad de modelos ni necesita servicios de inferencia. `npm run eval:model`
ejecuta el diagnostico de calidad contra el proveedor configurado. El alias
`npm run eval:ollama` lo fija al Qwen experimental. Ningun resultado de esa
evaluacion provisional cierra Gate 3 ni declara un modelo definitivo.

## Decisiones pendientes

- Analizar solo `new`, solo `end` o ambos.
- Sustituir memoria por SQLite, PostgreSQL u otro almacenamiento.
- Reintentos y cola de analisis.
- Autenticacion y autorizacion de la API.
- Servicio Ollama en Docker o en el host.
- Contrato y frontera definitiva de EDGE en Go.
- Responsabilidad de NATS frente a MQTT.
- Modelo de Context, Guardrails, Executor y Memoria.
- Contratos semanticos, fuentes y politicas de cada dominio vertical.
- Requisitos de autorizacion, auditoria y respuesta ante abuso antes de
  habilitar acciones reales.
- Integracion de Supabase/PostgreSQL 16.
- Integracion de Keygen CE.
- Los 10 criterios de Gate 3.