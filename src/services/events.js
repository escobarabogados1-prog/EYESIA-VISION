// Servicio de eventos EYESIA.
//
// Responsabilidad ÚNICA en esta fase: recibir eventos ya normalizados
// (por ejemplo desde mqtt.js) y mantener el último en memoria para que
// la API pueda consultarlo. Deliberadamente NO toma decisiones, NO
// genera alertas y NO usa IA: eso corresponde a la fase de EYESIA
// Operational Intelligence, todavía no implementada.

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

module.exports = {
  recordEvent,
  getLatestEvent
};
