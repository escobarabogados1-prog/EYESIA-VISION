# Progreso

## 2026-09-30

- Creada la base PRD, diseño tecnico y memoria del proyecto.
- Documentada la separacion entre aplicacion raiz y `eyesia/`.
- Documentada la integracion prevista con Ollama.
- Incorporada la arquitectura oficial de EYESIA VISION y su pipeline.
- Registrada la brecha entre el prototipo Node.js y EDGE Go 1.22+.
- Registrado Gate 3 como abierto con 10 criterios pendientes.
- Pendiente validar ejecucion y completar los criterios oficiales de Gate 3.

## Endurecimiento del prototipo Node.js

### Fase 1: linea base automatizada

- Activado `node:test` mediante `npm test` sin agregar dependencias.
- Agregadas pruebas para normalizacion Frigate, payloads invalidos y contratos
	de eventos/resultados de Operational Intelligence.
- Corregida la validacion de confianza para rechazar `NaN`.
- Resultado: 5 pruebas iniciales aprobadas.

### Fase 2: resiliencia y salud

- Agregada reconexion de camara cada 5 segundos, timeout de conexion de 10
	segundos y estado del ultimo frame/error.
- Agregado estado de conexion y suscripcion MQTT a los endpoints de salud.
- Agregado timeout configurable de Ollama con `OLLAMA_TIMEOUT_MS` (30 segundos
	por defecto) y prueba automatizada.
- Resultado: 6 pruebas aprobadas; sin validacion fisica de reconexion en ese
	momento.

### Fase 3: carga acotada

- Una prueba simulada de 100 eventos y 50 ms de demora por analisis observo 100
	solicitudes concurrentes y 99 resultados que ya no correspondian al evento
	mas reciente.
- Implementada cola en memoria latest-wins: maximo un analisis activo y uno
	pendiente; eventos pendientes reemplazados se cuentan como `coalesced`.
- `/api/events/health` expone estado y contadores de la cola.
- En la comparacion simulada posterior, la concurrencia maxima fue 1; se
	completaron 2 analisis, se coalescieron 98 eventos y 1 resultado fue obsoleto.
- La demora fue simulada; no representa rendimiento real de Ollama.
- Decision registrada en `docs/adr/0001-bounded-analysis-queue.md`.

### Fase 4: integracion parcial

- Frigate recibio video de `elith_cam_1`; durante la prueba reporto
	`camera_fps=5`, `process_fps=2.1`, `detection_fps=0.16` y `skipped_fps=3.9`.
- Con Mosquitto real se publico un evento sintetico en `frigate/events`; Node lo
	recibio, normalizo y expuso por la API. Un stub local compatible con Ollama
	devolvio un analisis y la cola termino con 1 completado y 0 fallos.
- El analisis se valido con un stub, no con una instancia real de Ollama; no se
	pudo cerrar la prueba integral real del modelo.
- Inicialmente el relay directo de Node solicito
	`http://192.168.5.108:8080/video/mjpeg` y recibio HTTP 404. Se cambio el origen
	del relay al stream MJPEG de Frigate, con `FRIGATE_URL` y `FRIGATE_CAMERA`.
- Con Frigate/camara reales, `/api/camera/frame` devolvio HTTP 200 y 4309 bytes;
	`/api/camera/stream` devolvio HTTP 200 multipart y un primer chunk de 4370
	bytes. Se verifico estado de camara conectado en Node.
- Tras el cambio, un evento MQTT sintetico real volvio por `/api/events/latest`
	y recibio analisis del stub; la cola registro 1 completado y 0 fallos.
- La verificacion de analisis uso un stub compatible con Ollama; no se valido
	una instancia/modelo Ollama real. Frigate y Mosquitto estaban saludables para
	la prueba y se detuvieron junto con Node y el stub al terminar.

## Estado al 2026-09-30

- `npm test`: 8 pruebas aprobadas; sintaxis y `git diff --check` aprobados.
- Gate 3 sigue abierto: los 10 criterios oficiales y sus umbrales no estan
	definidos.
- Node.js sigue siendo el runtime actual; no hay codigo Go ni migracion aprobada.
- Recomendacion vigente: validar con Ollama real y acordar los criterios de
	Gate 3 antes de evaluar una migracion.

### Fase 5: evidencia de recuperacion MQTT

- Con Mosquitto detenido, `/api/events/health` reporto
	`mqtt_conectado=false` y `mqtt_suscrito_frigate=false`.
- Al reiniciar Mosquitto, Node reconecto y confirmo una nueva suscripcion a
	`frigate/events` mediante timestamp actualizado.
- No se midio el tiempo exacto de reconexion ni la continuidad/perdida de
	mensajes durante la caida; esos umbrales siguen pendientes de aprobacion.
- Ollama corre en el host Windows y es accesible desde este entorno por
	`host.docker.internal`; el modelo instalado es `qwen2.5:3b`.
- El timeout de 30 s produjo timeout real. Una inferencia de diagnostico
	completo en 32.9 s con 90 s; el predeterminado se subio a 60 s y se probo una
	inferencia por MQTT real -> Node -> Ollama real -> API, completada en 43.1 s
	con `completed=1` y `failed=0`.
- La respuesta E2E fue `DETECCION/BAJO/REVISAR` con `confidence=0`. Una
	comparacion de dos eventos que solo variaban la confianza de entrada (0.95 y
	0.35) mantuvo `DETECCION/BAJO` en ambos casos; el modelo devolvio `confidence=0`
	para ambos. Otra inferencia produjo `reason` vacio. Es evidencia exploratoria,
	no evaluacion de calidad con verdad terreno.
- `contract.createResult` ahora valida classification/risk, confidence numerica
	finita en `[0,1]`, arrays, reason string y recommended_action no vacia. Se
	conserva `confidence=0` como valor valido; no se le atribuye semantica aprobada.
- Una inferencia Ollama real completo el contrato reforzado en 33.9 s.
- Barrido real con confidence de entrada 0.1/0.5/0.99 completo en 32.4/34.1/25.4
	s. Classification/risk permanecieron `DETECCION/BAJO`; la confidence de salida
	fue 0.1/0/0. En el caso 0.1, el razonamiento justifico riesgo bajo por la
	confidence baja, contradiciendo la instruccion del prompt de no inferir riesgo
	solo por confidence. Hallazgo exploratorio; requiere casos etiquetados y
	politica de riesgo aprobada antes de introducir guardrails.
- La matriz `docs/gate3-readiness.md` registra la recuperacion como verificada
	en prueba local, no como criterio oficial aprobado.
- Siguiente diagnostico: ejecutar tres veces el mismo evento sintetico contra
	Ollama para medir estabilidad de classification, risk, confidence de salida y
	latencia. El resultado sera exploratorio; no reemplaza casos etiquetados ni
	umbrales aprobados por el propietario.
- Repeticion ejecutada con el mismo evento tres veces: classification, risk y
	confidence de salida fueron estables (`DETECCION`, `BAJO`, `0`); `reason` tuvo
	tres variantes, una gramaticalmente incoherente. Latencias: 36.5, 18.9 y 18.9 s.
- La matriz registra esta estabilidad estructural y variabilidad narrativa como
	evidencia exploratoria; la calidad del razonamiento sigue sin aprobarse.
- Se retiro el ejemplo JSON con `confidence: 0.0` y `reason: ""`; el prompt
	define campos y separa confidence de modelo de la deteccion Frigate. Se fijo
	`temperature=0` y se agrego `OLLAMA_SEED=42`; la suite quedo en 9 pruebas.
- Tres inferencias reales con la configuracion calibrada mantuvieron
	classification/risk/confidence/action; confidence de salida fue `0.5`, igual
	a la confidence detectora, pese a la instruccion de no copiarla. `reason` tuvo
	dos variantes. Latencias: 56.6, 23.1 y 25.0 s. La confianza de modelo sigue
	sin semantica fiable; decidir si se elimina o calibra externamente.
- Agregado el comando opt-in `npm run eval:ollama`; compara eventos minimos
	identicos salvo detector confidence 0.1/0.99. El ensayo usa 90 s por solicitud
	solo como timeout diagnostico; el predeterminado de producto sigue en 60 s.
- Ollama real: 0.1 -> `DETECCION/BAJO` en 42.2 s; 0.99 -> `ALERTA/MEDIO` en
	40.1 s. El reason afirmo que confidence alta sin contexto adicional justificaba
	alerta, en contradiccion directa con el prompt. Ambas salidas copiaron la
	confidence detectora. No se agrego guardrail: requiere politica aprobada.
- Fallo inyectado Ollama inaccesible: evento MQTT permanecio en
	`/api/events/latest`; `/api/events/latest/analysis` devolvio 204; cola reporto
	`failed=1`, `lastError=fetch failed`; Node y API siguieron respondiendo.
- Discrepancia: `/api/events/health` expone el fallo de analisis, pero
	`/api/status` conserva `estado=operativo`. Definir con producto si el estado
	global debe degradarse antes de cambiar su semantica.
- `/api/status` ahora incluye `cola_analisis` de forma aditiva. Verificacion con
	Ollama inaccesible: endpoint HTTP 200, `failed=1` y `lastError=fetch failed`,
	mientras `estado=operativo` se preserva. Esto hace visible la degradacion sin
	decidir aun si el estado global significa API disponible o pipeline saludable.
- Agregada prueba HTTP aislada de `/api/status`: confirma `cola_analisis.failed`
	y `lastError` sin romper `estado`, campos de camara o MQTT. `npm test`: 10
	pruebas aprobadas; no requiere camara ni broker.

### Fase 6: contexto factual para Operational Intelligence

- Agregado `context.js` entre el evento normalizado y el analyzer. Construye un
	contexto acotado con ciclo, camara, observacion previa/actual y cambios
	verificables de objeto, confianza detectora y zona desde `before`/`after`.
- El analyzer ya no envia `raw_event` completo a Ollama; conserva solo los
	campos allowlisted del contexto. No agrega politica de riesgo ni decide
	cuales tipos de ciclo deben analizarse.
- Prueba sintetica `update` valida cambios de confianza y zona; prueba del
	prompt comprueba que el contexto llega a Ollama y que campos ajenos al
	allowlist no se transmiten.
- `npm test`: 11 pruebas aprobadas. Sin hardware, broker ni Ollama real.
- Siguiente: definir con producto la politica para `new`/`update`/`end` y la
	semantica de confianza/riesgo antes de guardrails o acciones automáticas.

### Fase 7: contrato transversal de contexto OIV

- Se actualizo PRD y diseño para registrar Operational Intelligence como nucleo
	transversal y separar el core de adaptadores, semantica y politicas verticales.
- Agregado `context-contract.js`: sobre neutral con dominio, fuente, sujeto,
	instante, observaciones y cambios escalares validados.
- El adaptador Frigate conserva evidencia `before`/`after` y la transforma al
	sobre canonico; `raw_event` completo no llega al modelo.
- Fixture retail sintetica representa afluencia e inventario y verifica que el
	contrato no dependa de campos de vigilancia. No existe integracion retail.
- El prompt trata el contexto externo como dato no confiable. No hay executor ni
	acciones automaticas; faltan politicas aprobadas por dominio.
- `npm test`: 12 pruebas aprobadas. Gate 3 sigue abierto.

### Fase 8: Decision Gate seguro

- Agregado `decision-gate.js`: exige contexto valido, propuesta valida y una
	politica con dominio/version/reglas exactas. Sin politica, con politica no
	aprobada/invalida, mismatch de dominio o propuesta distinta, devuelve
	`BLOCKED` y no crea vista previa de accion.
- La coincidencia exacta devuelve `SIMULATED`, `execution.attempted=false` y
	una accion allowlisted solo como preview; no existe executor externo.
- Runtime no configura politicas: el resultado vigente es `POLICY_MISSING`.
	La prueba de coincidencia usa metadatos sintéticos y no prueba aprobacion real.
- `/api/events/latest/decision` expone el gate asociado al evento actual; la API
	existente permanece compatible.
- Se limitaron IDs, numero de observaciones/cambios/campos y el tamano del
	contexto OIV para acotar recursos.
- `npm test`: 16 pruebas aprobadas. Gate 3 sigue abierto.
- `93b4bcd` y `f86b0d6` permanecen en `main` local; `origin/main` sigue en
	`4b9618a`. El push no concluyo en 20 s (`124`), por lo que la publicacion
	sigue pendiente de conectividad/autenticacion de escritura. No se reescribio
	historia ni se modifico `eyesia/`.