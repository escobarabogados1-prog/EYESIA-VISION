### `src/services/operational-intelligence/context-contract.js` y `context.js`

Construye contexto factual para el analisis a partir del evento normalizado y
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
  -> Operational Intelligence / Ollama
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
  -> adaptador Ollama
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

Orquesta la llamada al proveedor de IA y valida la respuesta mediante
`contract.js`. Debe tener timeout, errores controlados y configuracion externa.

`context-contract.js` valida y crea un sobre OIV independiente del dominio:
dominio, fuente, sujeto, instante, ciclo opcional, observaciones tipadas y
cambios con valores escalares. `context.js` adapta eventos Frigate al contrato
y expone objeto, score detector y zona; no asigna riesgo, no infiere intenciones
y no reenvia `raw_event` completo.

Cada adaptador de dominio es responsable de minimizar y revisar sus datos antes
de crear el contexto. El contrato impide estructuras anidadas arbitrarias en
las señales para evitar pasar payloads fuente completos.

La fixture sintetica `retail_analytics` comprueba que el contrato puede
representar afluencia e inventario sin campos de Frigate. No implementa esos
adaptadores ni habilita su analisis.

Adapta el evento Frigate al contrato canonico OIV. El contrato representa un
dominio, sujeto, instante, ciclo, observaciones tipadas y cambios con valores
escalares. El adaptador expone observaciones de objeto, score detector y zona;
no asigna riesgo, no infiere intenciones y no reenvia `raw_event` completo.

Cada adaptador de dominio es responsable de minimizar y revisar sus datos antes
de crear el contexto. El contrato impide estructuras anidadas arbitrarias en
las señales para evitar pasar payloads fuente completos.

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

El pipeline objetivo separa la propuesta del modelo, la validacion de politica,
la autorizacion y la ejecucion. No se habilita un executor conectado a sistemas
externos hasta que el dominio tenga politicas y permisos aprobados, pruebas de
casos etiquetados y trazabilidad de cada accion. La estructura actual termina
en el analisis; esa frontera de ejecucion sigue pendiente.

## Flujo de errores

1. JSON MQTT invalido: registrar y descartar el mensaje.
2. Evento que no cumple el contrato: registrar y no analizar.
3. Ollama no disponible: conservar el evento con estado `analysis_pending`.
4. Respuesta invalida: registrar el error y no publicar una clasificacion.
5. Evento nuevo mientras se analiza uno anterior: no sobrescribir el evento
   mas reciente con una respuesta antigua.

## Configuracion

```env
MQTT_URL=mqtt://localhost:1883
FRIGATE_TOPIC_PREFIX=frigate
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
```

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