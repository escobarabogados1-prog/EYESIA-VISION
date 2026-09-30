// Servicio de eventos EYESIA.

// El análisis se asocia al evento solo si sigue siendo el último recibido.
// Así una respuesta lenta de Ollama no pisa un evento más reciente.

let latestEvent = null;

function recordEvent(event) {
  latestEvent = event;
  console.log(
    `EVENTO EYESIA: ${event.event_type} / ${event.object} ` +
    `(cámara: ${event.camera_id}, confianza: ${event.confidence})`
  );
}

function getLatestEvent() {
  return latestEvent;
}

function recordAnalysis(eventId, analysis) {
  if (!latestEvent || latestEvent.event_id !== eventId) {
    return false;
  }

  latestEvent = {
    ...latestEvent,
    analysis,
    analysis_status: 'completed',
    analyzed_at: new Date().toISOString()
  };

  return true;
}

module.exports = {
  recordEvent,
  getLatestEvent,
  recordAnalysis
};
