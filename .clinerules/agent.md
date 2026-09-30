# Reglas del agente del proyecto

- Leer `docs/PRD.md`, `docs/DESIGN.md` y `memory-bank/` antes de modificar codigo.
- Tratar la arquitectura EYESIA VISION y el pipeline oficial como fuente de
	verdad del producto.
- No declarar una capa completada mientras su gate tenga criterios abiertos.
- Separar siempre arquitectura objetivo, prototipo actual y evidencia verificada.
- Tratar los requisitos marcados como pendientes como decisiones no confirmadas.
- Usar la aplicacion raiz como implementacion principal.
- No modificar `eyesia/` salvo solicitud explicita.
- Mantener compatibilidad con las APIs existentes.
- Preferir cambios pequenos, modulares y reversibles.
- No guardar secretos en codigo, documentacion ni logs.
- Validar sintaxis, pruebas o el flujo afectado despues de cada cambio.
- Actualizar `memory-bank/` cuando cambien decisiones, riesgos o progreso.