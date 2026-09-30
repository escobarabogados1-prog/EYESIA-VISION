# Contexto del proyecto

## Arquitectura oficial de producto

EYESIA VISION es una plataforma de Intelligence Spine con OIV (Operational
Intelligence Visual) como producto transversal B2B.

- EDGE: Go 1.22+.
- Razonamiento: Ollama + Qwen2-VL.
- Cloud: Supabase + PostgreSQL 16.
- Licenciamiento: Keygen CE.
- Buses: MQTT + NATS.

Pipeline:

```text
Frigate -> MQTT -> EDGE -> Context -> Ollama -> Guardrails -> Executor -> Memoria
```

Estado declarado: Capa 3 ACTIVA, Operational Intelligence + Ollama. Gate 3
abierto con 10 criterios pendientes.

Regla suprema: "El calendario es una aspiracion. El gate es la realidad."
Ninguna capa avanza sin cerrar el gate anterior.

## Identidad

- Proyecto: ELITH SECURITYCAM / EYESIA VISION.
- Runtime del prototipo actual: Node.js CommonJS.
- Runtime objetivo de EDGE: Go 1.22+.
- API: Express.
- Mensajeria: MQTT con Mosquitto.
- Deteccion: Frigate.
- IA local prevista: Ollama.

## Implementacion principal

La aplicacion raiz es la implementacion activa. El directorio `eyesia/` es
una copia o fase anterior y no debe modificarse junto con la raiz salvo que se
solicite expresamente.

## Comandos conocidos

```bash
npm install
node src/index.js
docker compose up -d
```

## Estado actual del repositorio

- Existe relay MJPEG.
- Existe recepcion y normalizacion MQTT.
- Existe contrato de Operational Intelligence, cola bounded latest-wins y
	puerto intercambiable de proveedor. Ollama/Qwen es el default experimental;
	tambien existe un adaptador OpenAI-compatible.
- `llama.cpp server` es la alternativa local preparada; el runtime no esta
	instalado ni fue evaluado en este entorno.
- Existe un contrato OIV de contexto neutral por dominio; el adaptador Frigate
	resume snapshots `before`/`after` con valores escalares antes del analisis.
- Una fixture retail sintetica valida neutralidad del contrato; no hay un
	adaptador retail ni ejecucion automatica implementados.
- Decision Gate compara propuestas contra reglas exactas; bloquea si falta
	politica y solo permite `dry_run` aun con coincidencia.
- Decision Journal conserva hasta 100 registros minimos en memoria y expone
	solo contadores en health; no es auditoria durable.
- La integracion completa y su persistencia siguen en evolucion.
- El repositorio aun no contiene EDGE en Go, Supabase, NATS, Keygen CE ni
	Qwen2-VL integrados como implementacion verificable.
- La Capa 3 esta declarada activa a nivel de producto, pero Gate 3 permanece
	abierto a nivel de control de entrega.

## Variables sensibles

Las credenciales deben permanecer en `.env`, nunca en el repositorio.