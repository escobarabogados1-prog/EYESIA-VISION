# EYESIA VISION

## Arquitectura actual (Fase 2)

```
CÁMARA IP (MJPEG/HTTP, Basic Auth)
   → Frigate (detección de objetos, vía ffmpeg + preset MJPEG)
      → Mosquitto (MQTT local, topic frigate/events)
         → Node.js / Express (src/services/mqtt.js → src/services/events.js)
            → API REST (/api/events/latest, /api/events/health, /api/status)

La cámara sigue además conectada directamente a Node.js (src/services/camera.js)
para el relay MJPEG original (/api/camera/frame, /api/camera/stream), sin cambios.
```

Todavía NO implementado: Operational Intelligence, razonamiento contextual, LLM,
dashboard avanzado, notificaciones externas, licenciamiento.

## Variables de entorno

Copia `.env.example` a `.env` y complétalo:

- `CAMERA_PASSWORD` — contraseña de la cámara (usuario fijo `elith1`).
- `MQTT_URL` — URL del broker MQTT (por defecto `mqtt://localhost:1883`).
- `FRIGATE_TOPIC_PREFIX` — prefijo de topics de Frigate (por defecto `frigate`).

`.env` nunca debe subirse a Git (ya está en `.gitignore`).

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
- `GET /api/events/health` — si MQTT está conectado, si Frigate está enviando
  eventos, y cuándo llegó el último.

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
