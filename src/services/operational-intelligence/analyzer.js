require('dotenv').config();
/**
 * EYESIA VISION
 * Operational Intelligence
 *
 * Capa de abstracción entre EYESIA y Ollama.
 * El modelo puede cambiar sin modificar el resto de EYESIA.
 */

const contract = require('./contract');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

async function analyze(event) {
  contract.validateInput(event);

  const prompt = `
Eres el módulo Operational Intelligence de EYESIA VISION.

Analiza únicamente los datos proporcionados.
NO inventes información.
NO conviertas una detección de persona en alerta automáticamente.
NO determines riesgo únicamente por duración o confianza.

EVENTO:
${JSON.stringify(event, null, 2)}

Clasificación permitida:
DETECCION
ALERTA
INCIDENTE

Riesgo permitido:
BAJO
MEDIO
ALTO

Responde únicamente con JSON válido usando esta estructura:

{
  "classification": "DETECCION",
  "risk": "BAJO",
  "confidence": 0.0,
  "factors": [],
  "reason": "",
  "missing_data": [],
  "recommended_action": "REVISAR"
}
`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: 'json'
    })
  });

  if (!response.ok) {
    throw new Error(`Error Ollama: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.response) {
    throw new Error('Ollama no devolvió respuesta');
  }

  let result;

  try {
    result = JSON.parse(data.response);
  } catch {
    throw new Error('La respuesta de Ollama no contiene JSON válido');
  }

  return contract.createResult({
    classification: result.classification,
    risk: result.risk,
    confidence: result.confidence,
    factors: result.factors,
    reason: result.reason,
    missingData: result.missing_data,
    recommendedAction: result.recommended_action
  });
}

module.exports = {
  analyze
};
