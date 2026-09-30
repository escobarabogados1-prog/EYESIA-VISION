# Registro de decisiones

## 2026-09-30 - Arquitectura oficial EYESIA VISION

La fuente de verdad de producto define EYESIA VISION como Intelligence Spine
con OIV transversal B2B. El pipeline oficial es Frigate -> MQTT -> EDGE ->
Context -> Ollama -> Guardrails -> Executor -> Memoria. El stack objetivo es
Go 1.22+, Ollama + Qwen2-VL, Supabase + PostgreSQL 16, Keygen CE y MQTT + NATS.

La implementacion Node.js actual se considera prototipo o capa de transicion
hasta que se decida y evidencie la migracion a EDGE.

## 2026-09-30 - Gate 3 como control de avance

La Capa 3 esta declarada activa, pero Gate 3 permanece abierto con 10 criterios
pendientes. No se debe marcar una capa como terminada ni avanzar por calendario;
solo por criterios cerrados con evidencia.

## 2026-09-30 - Separar requisitos, diseño y memoria

El PRD define que construir, DESIGN.md define como se conecta y memory-bank
conserva contexto y decisiones. Esto permite cambiar requisitos sin perder el
historial tecnico.

## 2026-09-30 - Mantener la raiz como implementacion principal

Se usa la aplicacion de la raiz como fuente activa. `eyesia/` se conserva como
referencia hasta decidir si se elimina, se migra o se mantiene.

## 2026-09-30 - Ollama como adaptador reemplazable

Ollama se consume por HTTP desde Operational Intelligence. El dominio no debe
depender de detalles especificos de Ollama ni de un modelo concreto.

## 2026-09-30 - OIV transversal con contexto canonico

Operational Intelligence es el nucleo compartido; vigilancia, afluencia
comercial e inventario son dominios verticales con adaptadores, semanticas y
politicas propios. Se adopta un sobre de contexto neutral por dominio. Frigate
es el unico adaptador operativo actual; el caso retail sintetico solo verifica
el contrato y no constituye una integracion de producto.

La salida del modelo no ejecuta acciones. El comportamiento tecnico por
defecto es denegar ejecucion hasta que existan politica de dominio aprobada,
autorizacion y trazabilidad. Esto no define umbrales ni acciones de producto.

El prototipo implementa una evaluacion fail-closed: sin politica o sin
coincidencia exacta la propuesta queda bloqueada; una coincidencia en pruebas
solo puede producir `dry_run`. Los metadatos sinteticos de aprobacion no son
una verificacion de identidad ni una aprobacion confiable de producto.

## 2026-09-30 - Puerto de proveedor de IA

El analyzer depende de `provider.generate({prompt, timeoutMs})` y conserva un
solo contrato de resultado OIV. `ollama` con `qwen2.5:3b` permanece como motor
experimental predeterminado. `openai-compatible` permite integrar `llama.cpp
server` u otro runtime compatible sin alterar el analyzer.

No hay runtime alternativo instalado en el entorno, asi que la integracion se
prepara y se valida tecnicamente con mocks; no se declara inferencia ni calidad
real. `npm test` es la suite tecnica; `npm run eval:model` y `eval:ollama` son
evaluaciones de calidad provisionales y separadas.

## 2026-09-30 - Journal OIV volatil

Se agrega un journal acotado a 100 decisiones para diagnostico independiente
del proveedor. Conserva solo metadata minima; no almacena contexto crudo, imagen,
razonamiento ni payload de origen. Se pierde al reiniciar y no sustituye un
backend de auditoria durable ni establece retencion historica de producto.