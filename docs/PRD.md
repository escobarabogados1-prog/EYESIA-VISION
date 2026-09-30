# PRD - EYESIA VISION / ELITH SECURITYCAM

## Estado del documento

- Version: 0.1
- Fase: 1 - base modular y alineacion con la arquitectura EYESIA
- Estado: provisional
- Ultima actualizacion: 2026-09-30

Los requisitos marcados como pendientes no deben convertirse en decisiones
irreversibles hasta que el propietario del producto los confirme.

## Arquitectura de producto

EYESIA VISION es una plataforma de Intelligence Spine con OIV (Operational
Intelligence Visual) como producto transversal B2B.

La arquitectura oficial objetivo es:

- EDGE: Go 1.22+.
- Motor de razonamiento: Ollama con Qwen2-VL.
- Cloud: Supabase con PostgreSQL 16.
- Licenciamiento: Keygen CE.
- Bus de eventos: MQTT y NATS.

Pipeline oficial:

```text
Frigate -> MQTT -> EDGE -> Context -> Ollama -> Guardrails -> Executor -> Memoria
```

Estado de producto declarado: Capa 3 ACTIVA, Operational Intelligence +
Ollama. Gate 3 abierto, con 10 criterios pendientes de cierre.

Regla suprema:

> El calendario es una aspiracion. El gate es la realidad.

Ninguna capa avanza sin cerrar el gate anterior.

## Objetivo

Construir EYESIA VISION como un núcleo de Operational Intelligence transversal:
recibir señales de distintos dominios, convertirlas en contexto verificable,
razonar sobre ellas y producir decisiones que puedan pasar por políticas,
autorizaciones y ejecución controlada. Vigilancia es el primer adaptador
operativo; analítica de tráfico comercial e inventario son dominios posibles,
no funcionalidades implementadas ni requisitos detallados todavía.

El núcleo no debe depender de un modelo concreto ni de un dominio. Cada dominio
define sus adaptadores de entrada, semántica, políticas y acciones permitidas.
Una respuesta de IA es una propuesta no confiable: no puede ejecutar una acción
sin política aprobada, autorización y registro auditable.

## Usuarios

- Operador que consulta el estado de la camara y los eventos recientes.
- Administrador que configura camara, broker, Frigate y el proveedor de IA.
- Integraciones internas que consumen la API de estado y eventos.

## Alcance de la Fase 1

- Recibir video de la camara IP.
- Mantener el relay MJPEG existente.
- Recibir eventos de Frigate mediante MQTT.
- Normalizar eventos a un contrato interno estable.
- Exponer estado del sistema y el ultimo evento por REST.
- Definir el punto de integracion con Operational Intelligence/Ollama.
- Registrar la brecha entre el prototipo Node.js actual y EDGE en Go 1.22+.
- Preparar el cierre verificable de Gate 3.
- Mantener la configuracion fuera del codigo fuente.
- Dejar documentadas las decisiones y los pendientes.

## Fuera de alcance provisional

- Dashboard web avanzado.
- Notificaciones externas.
- Reconocimiento facial o identificacion de personas.
- Persistencia historica definitiva.
- Multiusuario y licenciamiento.
- Politica final de riesgo y alertas.
- Seleccion definitiva del modelo de IA.

## Requisitos funcionales

### RF-01. Video

El sistema debe exponer el ultimo frame y un stream MJPEG de la camara
configurada.

### RF-02. Eventos

El sistema debe suscribirse a `frigate/events`, validar JSON y normalizar los
mensajes `new`, `update` y `end`.

### RF-03. Contrato

Cada evento normalizado debe incluir como minimo `event_id`, `timestamp`,
`device.camera_id`, `detection.object` y `detection.confidence`. El formato
publico existente debe conservarse mientras no se apruebe una migracion.

### RF-04. API

La API debe informar el estado de camara, MQTT, Frigate y el ultimo evento.
Los recursos actuales deben seguir siendo compatibles.

### RF-05. Analisis

Operational Intelligence debe poder analizar un evento mediante un proveedor
configurable. Ollama es el proveedor local inicial, pero no debe ser una
dependencia del dominio.

### RF-06. Contexto transversal

El núcleo debe recibir un contrato de contexto independiente del transporte y
del dominio. Los adaptadores verticales transforman sus fuentes a ese contrato
y minimizan los datos antes de enviarlos al proveedor de razonamiento. El
adaptador Frigate es la primera implementacion; otros dominios requieren
contratos semanticos y pruebas propios antes de habilitarse.

### RF-07. Decision y ejecucion controladas

El razonamiento puede proponer resultados, pero su salida no autoriza por si
misma una accion. La ejecucion queda bloqueada por defecto hasta contar con
politica del dominio aprobada, autorizacion y evidencia auditable. No se
definen acciones ni umbrales de riesgo en este PRD provisional.

## Requisitos no funcionales

- Configuracion mediante variables de entorno.
- Errores de servicios externos visibles en health checks y logs.
- Timeouts para llamadas HTTP al proveedor de IA.
- Validacion estricta de respuestas del proveedor.
- Validacion de estructura y tipos en contextos; no reenviar payloads fuente
	completos cuando un adaptador pueda extraer la evidencia necesaria.
- Tratar contexto y salida del modelo como datos no confiables; nunca ejecutar
	instrucciones contenidas en esos datos.
- Denegar por defecto acciones sin una politica de dominio aprobada y una
	autorizacion verificable.
- Pruebas para normalizacion, contrato y errores de integracion.
- No registrar contrasenas, tokens ni contenido sensible innecesario.

## Criterios de aceptacion de la Fase 1

- Un evento MQTT valido se transforma en un evento interno valido.
- Un evento invalido no detiene el proceso Node.js.
- La API devuelve el ultimo evento sin depender de Ollama.
- Ollama puede sustituirse mediante configuracion o un adaptador.
- El sistema indica cuando MQTT, Frigate u Ollama no estan disponibles.
- Los requisitos cambiantes pueden actualizarse sin reescribir toda la arquitectura.

## Gate 3: criterios pendientes

El gate permanece abierto hasta registrar y verificar los 10 criterios
definitivos. La lista debe completarse con el propietario del producto y no se
debe inventar en la implementacion.

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Pendiente de definir | ABIERTO | - |
| 2 | Pendiente de definir | ABIERTO | - |
| 3 | Pendiente de definir | ABIERTO | - |
| 4 | Pendiente de definir | ABIERTO | - |
| 5 | Pendiente de definir | ABIERTO | - |
| 6 | Pendiente de definir | ABIERTO | - |
| 7 | Pendiente de definir | ABIERTO | - |
| 8 | Pendiente de definir | ABIERTO | - |
| 9 | Pendiente de definir | ABIERTO | - |
| 10 | Pendiente de definir | ABIERTO | - |

## Pendientes de confirmacion

- Modelo final de Ollama.
- Clasificaciones y niveles de riesgo definitivos.
- Retencion y base de datos de eventos.
- Politica para analizar `new`, `update` y `end`.
- Acciones posteriores a una alerta.
- Autenticacion de la API.
- Despliegue final de Node.js y Ollama.
- Criterios exactos para cerrar Gate 3.