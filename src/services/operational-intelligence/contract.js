/**
 * EYESIA VISION
 * Operational Intelligence
 *
 * Contrato técnico entre EYESIA EDGE y Operational Intelligence.
 */

function validateInput(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('Evento inválido');
  }

  if (!event.event_id) {
    throw new Error('Falta event_id');
  }

  if (!event.timestamp) {
    throw new Error('Falta timestamp');
  }

  if (!event.device || !event.device.camera_id) {
    throw new Error('Falta device.camera_id');
  }

  if (!event.detection || !event.detection.object) {
    throw new Error('Falta detection.object');
  }

  if (
    typeof event.detection.confidence !== 'number' ||
    !Number.isFinite(event.detection.confidence) ||
    event.detection.confidence < 0 ||
    event.detection.confidence > 1
  ) {
    throw new Error('detection.confidence debe estar entre 0 y 1');
  }

  return true;
}

function createResult({
  classification,
  risk,
  confidence,
  factors,
  reason,
  missingData,
  recommendedAction
}) {
  const validClassifications = [
    'DETECCION',
    'ALERTA',
    'INCIDENTE'
  ];

  const validRisks = [
    'BAJO',
    'MEDIO',
    'ALTO'
  ];

  if (!validClassifications.includes(classification)) {
    throw new Error('Clasificación inválida');
  }

  if (!validRisks.includes(risk)) {
    throw new Error('Riesgo inválido');
  }

  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new Error('Confianza de análisis inválida');
  }

  if (!Array.isArray(factors)) {
    throw new Error('Factores inválidos');
  }

  if (typeof reason !== 'string') {
    throw new Error('Razón inválida');
  }

  if (!Array.isArray(missingData)) {
    throw new Error('Datos faltantes inválidos');
  }

  if (typeof recommendedAction !== 'string' || !recommendedAction.trim()) {
    throw new Error('Acción recomendada inválida');
  }

  return {
    classification,
    risk,
    confidence,
    factors,
    reason,
    missing_data: missingData,
    recommended_action: recommendedAction
  };
}

module.exports = {
  validateInput,
  createResult
};
