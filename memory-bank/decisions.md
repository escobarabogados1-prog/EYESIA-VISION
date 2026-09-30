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