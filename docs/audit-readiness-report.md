# Informe de estado y preparacion para auditoria

- Producto: EYESIA VISION / ELITH SECURITYCAM
- Fecha de corte: 2026-09-30
- Estado del informe: borrador factual para revision; no es certificacion ni cierre de Gate 3.
- Implementacion evaluada: aplicacion Node.js de la raiz del repositorio.

## 1. Resumen ejecutivo

El prototipo local ejecuta y prueba el flujo de video Frigate, eventos MQTT, normalizacion, API y analisis Ollama. La suite automatizada actual pasa 12 de 12 pruebas. Se verificaron reconexion MQTT, relay de video desde Frigate, funcionamiento de la cola acotada y continuidad de la API ante la indisponibilidad de Ollama.

**El sistema no esta listo para declararse conforme ni para cerrar Gate 3.** La matriz oficial del PRD aun contiene diez criterios sin definicion. Ademas, Ollama `qwen2.5:3b` produjo una alerta de riesgo medio basandose unicamente en una confidence detectora alta, en contra de las instrucciones del prompt. Los resultados de carga y del modelo son evidencia local exploratoria, no una evaluacion contra un conjunto de verdad-terreno aprobado.

Al corte, Ollama responde desde el host con el modelo `qwen2.5:3b`; Mosquitto y Frigate no estan activos. El repositorio contiene cambios locales y archivos no seguidos; este informe no certifica su autoria, revision o integracion.

## 2. Alcance y arquitectura observada

- Runtime operativo del prototipo: Node.js/CommonJS y Express.
- Flujo implementado: camara -> Frigate -> MQTT/Mosquitto -> normalizacion Node -> ultimo evento en memoria -> cola latest-wins -> adaptador Ollama -> API REST.
- El relay MJPEG de Node consume el endpoint multipart de Frigate.
- La arquitectura destino documentada es EDGE en Go, pero no hay implementacion Go ni plan de migracion aprobado.
- Supabase/PostgreSQL, NATS y Keygen CE no estan integrados como componentes verificables del prototipo.
- No se comprobo despliegue cloud, autenticacion de API, almacenamiento durable ni recuperacion tras reinicio.

## 3. Controles y evidencia favorable

| Area | Estado y evidencia | Limite |
|---|---|---|
| Pruebas automatizadas | `npm test`: 12 aprobadas, 0 fallidas en la ejecucion de esta fecha. | No equivale a pruebas de produccion ni a cierre de Gate 3. |
| Normalizacion | Pruebas de eventos `new`, `update` y `end`, y evento sintetico recibido por MQTT real. | Falta cobertura de payload MQTT malformado en proceso vivo. |
| Contexto OIV | Frigate se adapta al contrato neutral; fixture sintetica valida estructura de afluencia e inventario. | No hay adaptador, analisis ni ejecucion retail implementados. |
| Video | Frigate recibio la camara; `/api/camera/frame` y `/api/camera/stream` devolvieron imagen/stream durante una prueba local. | Observacion puntual; no hay SLO ni ventana de disponibilidad aprobada. |
| MQTT | Se comprobo suscripcion y reconexion/resuscripcion al detener y reiniciar Mosquitto. | No se establecio tiempo limite de recuperacion ni se midieron mensajes perdidos durante la caida. |
| Ollama inaccesible | El evento permanece consultable; el analisis retorna 204; la cola reporta `failed=1` y `lastError`; Node continua respondiendo. | El comportamiento es volatil y no hay reintento/durabilidad. |
| Cola de analisis | Concurrencia maxima de 1, un pendiente latest-wins; contadores visibles por health. | Se coalescen eventos intermedios por diseno y se pierden al reiniciar. No se ha aprobado que esa politica sea aceptable para el producto. |
| Salida Ollama | Contrato valida enums, confidence numerica finita en `[0,1]`, arreglos y tipos basicos. | `reason` vacio aun se acepta porque solo se valida que sea string. |

## 4. Hallazgos y riesgos

### F-01 - Riesgo de clasificacion basado solo en confidence detectora

**Severidad propuesta: Alta; requiere confirmacion del propietario.** En una comparacion con dos eventos minimos que solo variaban detector confidence, el modelo produjo `DETECCION/BAJO` con `0.1` y `ALERTA/MEDIO` con `0.99`. Para el segundo caso, la explicacion afirmo que la confidence alta por si sola justificaba la alerta. Ambas respuestas copiaron detector confidence en la confidence de salida.

Esto contradice las instrucciones actuales del prompt. Aun no existe una politica de riesgo aprobada ni un corpus de casos etiquetados. No se ha implementado un guardrail de riesgo para evitar convertir una inferencia no aprobada en comportamiento de producto.

### F-02 - Gate 3 sin criterios aprobados

**Severidad propuesta: Bloqueante para cierre del gate.** El PRD lista diez criterios como pendientes. `docs/gate3-readiness.md` contiene candidatos/evidencias preliminares, expresamente no aprobados. No se puede afirmar cumplimiento formal de Gate 3 hasta que el propietario apruebe criterios, escenarios y umbrales.

### F-03 - Significado ambiguo del estado global

**Severidad propuesta: Media.** Con Ollama caido, `/api/status` responde HTTP 200, informa la cola con un fallo y conserva `estado="operativo"`. Esto es consistente si significa que la API esta disponible, pero podria ser engañoso si significa que todo el pipeline esta saludable. La semantica no esta decidida.

### F-04 - Confianza del modelo no calibrada

**Severidad propuesta: Media.** Con prompt sin placeholders, `temperature=0` y `seed=42`, el modelo siguio copiando el score detector a su propia confidence. Ese campo no debe interpretarse como probabilidad calibrada ni usarse para decisiones automaticas sin definicion y evaluacion.

### F-05 - Cola y estado son volatiles

**Severidad propuesta: Media; impacto sujeto a requisitos de retencion.** Solo se conserva el ultimo evento y la cola latest-wins es en memoria. Eventos intermedios pueden coalescerse; reiniciar Node pierde el evento y analisis pendientes. No hay persistencia historica.

### F-06 - Seguridad/despliegue local no equivale a entorno comercial

La configuracion local de Mosquitto permite acceso anonimo y desactiva persistencia. No se verificaron autenticacion/autorizacion de API, TLS, gestion de credenciales de produccion, hardening de red ni estrategia de actualizacion del dispositivo. No se afirma que estos elementos sean requisitos de Gate 3 hasta su aprobacion, pero deben revisarse antes de un despliegue comercial expuesto.

## 5. Estado de Gate 3

**ABIERTO.** La matriz preliminar clasifica candidatos como verificados localmente, parciales, fallidos o pendientes de decision. Estos estados describen evidencia tecnica, no criterios oficiales. Ningun candidato debe trasladarse al PRD como criterio aprobado sin confirmacion del propietario.

## 6. Acciones recomendadas antes de cierre

1. Aprobar politica de riesgo con casos etiquetados, incluida la regla para una persona detectada sin evidencia contextual adicional.
2. Decidir si la confidence de salida se elimina, se mantiene como dato no confiable o se calcula/calibra fuera del modelo.
3. Definir si `estado="operativo"` representa disponibilidad de API o salud integral del pipeline.
4. Aprobar los diez criterios de Gate 3, condiciones de prueba, umbrales, responsables y evidencia exigida.
5. Ejecutar la evaluacion `npm run eval:ollama` contra el conjunto aprobado y registrar resultados, latencia, consistencia y salidas invalidas.
6. Definir requisitos de durabilidad/retencion antes de seleccionar almacenamiento o afirmar recuperacion de eventos.
7. Revisar seguridad y despliegue objetivo antes de exponer el sistema a clientes.
8. Evaluar migracion a Go solo despues de Gate 3 y de demostrar un requisito comercial/tecnico que la justifique.

## 7. Comandos de reproduccion

- `npm test` - suite unitaria/integracion aislada; no requiere camara.
- `npm run eval:ollama` - llama al modelo Ollama configurado y puede tardar varias decenas de segundos por caso.
- La prueba del relay real requiere Frigate y la camara; la prueba MQTT requiere Mosquitto. Estos servicios estaban detenidos al corte de este informe.

## 8. Fuentes internas

- `docs/PRD.md` - requisitos provisionales y diez criterios Gate 3 pendientes.
- `docs/gate3-readiness.md` - matriz preliminar de evidencia.
- `docs/adr/0001-bounded-analysis-queue.md` - decision de cola acotada en memoria.
- `memory-bank/project-status.md` - snapshot de revision.
- `memory-bank/progress.md` - historial detallado de pruebas y cambios.