# Gate 3 - Matriz preliminar de evidencia

- Estado: borrador de preparacion; no aprobado como criterio oficial.
- Fecha de revision: 2026-09-30.
- Estado del gate: ABIERTO. El PRD mantiene diez criterios pendientes de
  definicion y aprobacion por el propietario del producto.

Esta matriz organiza candidatos para facilitar esa definicion. No cambia el
PRD, no establece umbrales oficiales y no declara Gate 3 cerrado. Frigate,
camara, MQTT y una inferencia de Ollama se observaron localmente con un evento
sintetico; el benchmark de carga y el stub anterior fueron simulados.

| # | Candidato de criterio | Evidencia disponible | Estado preliminar | Evidencia pendiente para evaluarlo |
|---|---|---|---|---|
| 1 | Normalizacion correcta de eventos Frigate `new`, `update` y `end` | Pruebas cubren `new` y `end`; evento `new` sintetico paso por MQTT real y Node. | PARCIAL | Agregar caso `update` y acordar los campos/variantes admitidos. |
| 2 | Payload MQTT invalido no detiene el proceso | Pruebas unitarias descartan valores que no son objetos y validan el contrato. | PARCIAL | Enviar JSON roto y payloads invalidos por el broker mientras se comprueba que el proceso sigue vivo. |
| 3 | Conexion MQTT y suscripcion verificables; recuperacion tras desconexion | Prueba local: al detener Mosquitto, Node reporto `mqtt_conectado=false` y `mqtt_suscrito_frigate=false`; al iniciar el broker, volvio a conectar y suscribirse, con timestamp nuevo. | VERIFICADO EN PRUEBA LOCAL | Medir el tiempo de reconexion, acordar el comportamiento esperado ante mensajes durante la caida y aprobar umbrales. |
| 4 | Video disponible por el relay/API de Node | El origen inicial `/video/mjpeg` devolvio HTTP 404. Node ahora consume el stream multipart documentado de Frigate en `/api/elith_cam_1`; con camara y Frigate reales, `/api/camera/frame` devolvio HTTP 200 y 4309 bytes, y `/api/camera/stream` devolvio HTTP 200 multipart con un primer chunk de 4370 bytes. | VERIFICADO EN PRUEBA LOCAL | Repetir durante una ventana acordada y aprobar los umbrales de disponibilidad/FPS. |
| 5 | Evento normalizado consultable por la API sin depender del analisis | Evento sintetico publicado en MQTT aparecio en `/api/events/latest` con los campos normalizados esperados. | PARCIAL | Repetir con eventos reales de Frigate y comprobar compatibilidad de todos los endpoints existentes. |
| 6 | Analisis Operational Intelligence con proveedor real y resultado valido | `npm run eval:ollama` comparo dos eventos minimos que solo difieren en detector confidence. Ollama `qwen2.5:3b`, prompt calibrado, temp 0, seed 42: confidence 0.1 dio `DETECCION/BAJO` en 42.2 s; confidence 0.99 dio `ALERTA/MEDIO` en 40.1 s y el reason afirmo que la alta confidence sin contexto adicional justificaba alerta. Ambas salidas copiaron exactamente detector confidence. | FALLA OBSERVADA CONTRA INVARIANTE DEL PROMPT; NO ES CRITERIO OFICIAL | El propietario debe definir politica de riesgo/confidence; despues ajustar y evaluar con casos etiquetados aprobados. |
| 7 | Timeouts y fallos de analisis controlados y observables | Con Ollama inaccesible, evento MQTT quedo en `/api/events/latest`, `/api/events/latest/analysis` devolvio 204, la cola marco `failed=1`/`lastError=fetch failed` y Node siguio respondiendo. | VERIFICADO EN FALLO INYECTADO LOCAL | Probar demora real y acordar limite de latencia; definir si el fallo debe reflejarse tambien en `GET /api/status`. |
| 8 | Carga de analisis acotada y comportamiento bajo rafaga observable | Con 100 eventos y 50 ms simulados: antes, 100 solicitudes concurrentes y 99 resultados obsoletos; despues, concurrencia maxima 1, 2 analisis, 98 eventos coalescidos y 1 resultado obsoleto. | VERIFICADO EN SIMULACION | Repetir con Ollama real y carga representativa; aprobar tasa, latencia, coalescencia y umbrales aceptables. |
| 9 | Retencion y comportamiento ante reinicio definidos | El ultimo evento y la cola son solo memoria; un reinicio pierde el evento y el analisis pendiente. | PENDIENTE DE DECISION | El propietario debe definir si Gate 3 exige historial/recuperacion. Si lo exige, especificar retencion y durabilidad antes de seleccionar almacenamiento. |
| 10 | Estado operativo refleja salud de camara, MQTT, Frigate, analisis y cola | `/api/status` y `/api/events/health` exponen la cola. Con Ollama caido, ambos devolvieron HTTP 200 y `failed=1`/`lastError=fetch failed`; `/api/status` mantuvo `estado=operativo`. | PARCIAL; SEMANTICA GLOBAL PENDIENTE | Acordar si `estado=operativo` significa API disponible o pipeline completo saludable; definir frescura/umbrales. |

## Decisiones que no se deben inferir de esta matriz

- Los diez candidatos no son los diez criterios oficiales de Gate 3 hasta que
  el propietario los apruebe.
- Las medidas con stub no representan rendimiento de Ollama.
- Supabase/Cloud, persistencia, Go, contrato Node-Go y JSON Schema versionado no
  se consideran requisitos de Gate 3 en ausencia de aprobacion explicita.
- La migracion a Go sigue sin aprobarse. Esta matriz evalua la evidencia del
  prototipo Node.js actual.

## Recomendacion para el cierre

El relay, la recuperacion MQTT y el analisis Ollama real se verificaron
localmente; tambien se reforzo la validacion estructural de salida. Prompt sin
placeholders, `temperature=0` y `seed=42` no impidieron que Ollama elevara
`DETECCION/BAJO` a `ALERTA/MEDIO` por detector confidence 0.99 sin contexto
adicional. El runner `npm run eval:ollama` reproduce el par y declara que no es
aprobacion del propietario. Definir politica de riesgo/confidence y casos
etiquetados antes de guardrails; probar Ollama inaccesible y medir reconexion
antes de aprobar criterios y umbrales de Gate 3.