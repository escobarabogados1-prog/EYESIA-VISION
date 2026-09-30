# EYESIA VISION

## Documentacion de la Fase 1

- [PRD](docs/PRD.md) - objetivos, alcance y criterios de aceptacion.
- [Diseño tecnico](docs/DESIGN.md) - arquitectura y contratos.
- [Contexto del proyecto](memory-bank/project-context.md) - estado y comandos.
- [Decisiones](memory-bank/decisions.md) - decisiones tecnicas registradas.

## Arquitectura actual (Fase 2)

```
CÁMARA IP (MJPEG/HTTP, Basic Auth)
   → Frigate (detección de objetos, vía ffmpeg + preset MJPEG)
      → Mosquitto (MQTT local, topic frigate/events)
         → Node.js / Express (src/services/mqtt.js → src/services/events.js)
           → API REST (/api/events/latest, /api/events/health, /api/status)
           → cola latest-wins → contexto OIV → Ollama → Decision Gate (dry-run)

La cámara sigue además conectada directamente a Node.js (src/services/camera.js)
para el relay MJPEG original (/api/camera/frame, /api/camera/stream), sin cambios.
```

Operational Intelligence analiza eventos de vigilancia mediante un proveedor
intercambiable. Ollama/Qwen es el default experimental; el contrato OIV no
depende de ese motor. Sin política, el Decision Gate bloquea la propuesta; una
coincidencia solo genera una vista previa `dry_run`, nunca ejecuta acciones externas.
Dashboard avanzado, notificaciones externas y licenciamiento siguen fuera del
alcance actual.

## Variables de entorno

Copia `.env.example` a `.env` y complétalo:

- `CAMERA_PASSWORD` — contraseña de la cámara (usuario fijo `elith1`).
- `MQTT_URL` — URL del broker MQTT (por defecto `mqtt://localhost:1883`).
- `FRIGATE_TOPIC_PREFIX` — prefijo de topics de Frigate (por defecto `frigate`).
- `FRIGATE_URL` y `FRIGATE_CAMERA` — origen del relay MJPEG de Frigate.
- `AI_PROVIDER` — `ollama` (predeterminado experimental) o
  `openai-compatible`.
- `AI_TIMEOUT_MS` y `AI_SEED` — timeout y semilla del proveedor.
- `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS` y `OLLAMA_SEED` — analyzer
  local experimental y generación determinista.
- `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_MODEL` y
  `OPENAI_COMPATIBLE_API_KEY` — endpoint compatible opcional; la key puede
  quedar vacía para un runtime local sin autenticación.

`.env` nunca debe subirse a Git (ya está en `.gitignore`).

`npm test` valida el software con dependencias simuladas. `npm run eval:model`
es un diagnóstico de calidad que requiere el motor configurado.
`npm run eval:ollama` conserva la evaluación experimental de `qwen2.5:3b`; no
es un gate de software ni selecciona el modelo definitivo.

Con un servidor OpenAI-compatible instalado y activo, selecciona
`AI_PROVIDER=openai-compatible` y configura su URL/modelo antes de ejecutar
`npm run eval:model`.

## Arrancar Mosquitto y Frigate

```bash
export CAMERA_PASSWORD=tu-password-real
docker compose up -d
```

Esto levanta:
- `eyesia-mosquitto` (Mosquitto, puerto 1883)
- `eyesia-frigate` (Frigate, UI en http://localhost:5000)

La contraseña de la cámara se inyecta en Frigate vía la variable de entorno
`FRIGATE_CAMERA_PASSWORD` (definida en `docker-compose.yml` a partir de
`CAMERA_PASSWORD`), y Frigate la sustituye en `frigate/config/config.yml`.

## Arrancar Node.js

Node.js sigue corriendo fuera de Docker, como hasta ahora:

```bash
npm install
CAMERA_PASSWORD=tu-password-real npm run start   # o: node src/index.js
```

(Si no existe `npm run start`, usa directamente `node src/index.js`.)

## Endpoints

Existentes (sin cambios de comportamiento):
- `GET /`
- `GET /api/camera/frame`
- `GET /api/camera/stream`

Actualizado:
- `GET /api/status` — ahora refleja estado real de cámara, MQTT y último evento
  (antes de esta fase era completamente estático).

Nuevos:
- `GET /api/events/latest` — último evento EYESIA normalizado. `204` si aún no
  ha llegado ninguno.
- `GET /api/events/latest/analysis` — análisis del último evento. `204` si no
  tiene análisis asociado.
- `GET /api/events/latest/decision` — decisión del gate asociada al último
  evento. En el prototipo, el gate solo bloquea o simula; no ejecuta acciones.
- `GET /api/events/health` — si MQTT está conectado, si Frigate está enviando
  eventos, cuándo llegó el último, la cola y contadores del journal volátil.
  No devuelve el contenido del journal.

## Comprobar que MQTT funciona

```bash
docker logs eyesia-mosquitto      # debe mostrar el listener activo en 1883
docker logs eyesia-frigate        # buscar líneas de conexión MQTT y de ffmpeg/detect
curl http://localhost:3001/api/events/health
```

## Comprobar que llegan eventos EYESIA

Camina/muévete frente a la cámara y luego:

```bash
curl http://localhost:3001/api/events/latest
```

Debe devolver un JSON con `object`, `camera_id`, `confidence`, `timestamp`, etc.
Si sigue devolviendo `204`, revisa en este orden: Mosquitto → Frigate → red de
la cámara (ver sección de bloqueos en el informe de entrega).
