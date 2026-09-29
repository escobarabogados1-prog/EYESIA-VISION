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
  factors = [],
  reason = '',
  missingData = [],
  recommendedAction = 'REVISAR'
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
