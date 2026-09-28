const mqtt = require('mqtt');
const crypto = require('crypto');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const FRIGATE_TOPIC_PREFIX = process.env.FRIGATE_TOPIC_PREFIX || 'frigate';
const EVENTS_TOPIC = `${FRIGATE_TOPIC_PREFIX}/events`;

let client = null;

const state = {
  connected: false,
  lastError: null,
  lastMessageAt: null
};

/**
 * Normaliza un mensaje de evento de Frigate (topic "frigate/events")
 * a la estructura interna estándar de EYESIA.
 *
 * Frigate publica en frigate/events un JSON con forma:
 *   { type: "new" | "update" | "end", before: {...}, after: {...} }
 * donde before/after son objetos "event" de Frigate con campos como
 * id, camera, label, top_score/score, start_time, end_time, zones, etc.
 *
 * Referencia de campos: https://docs.frigate.video/integrations/mqtt/
 */
function normalizeFrigateEvent(payload) {
  const frigateEvent = payload.after || payload.before;

  if (!frigateEvent) {
    return null;
  }

  const confidenceRaw =
    typeof frigateEvent.top_score === 'number'
      ? frigateEvent.top_score
      : typeof frigateEvent.score === 'number'
        ? frigateEvent.score
        : 0;

  const timestampSeconds =
    typeof frigateEvent.start_time === 'number'
      ? frigateEvent.start_time
      : Date.now() / 1000;

  return {
    event_id: frigateEvent.id || crypto.randomUUID(),
    source: 'frigate',
    camera_id: frigateEvent.camera || 'desconocida',
    event_type: payload.type || 'unknown',
    object: frigateEvent.label || 'unknown',
    confidence: Number(confidenceRaw.toFixed ? confidenceRaw.toFixed(4) : confidenceRaw),
    timestamp: new Date(timestampSeconds * 1000).toISOString(),
    zone: Array.isArray(frigateEvent.current_zones) && frigateEvent.current_zones.length > 0
      ? frigateEvent.current_zones[0]
      : null,
    status: payload.type === 'end' ? 'closed' : 'open',
    raw_event: payload
  };
}

/**
 * Conecta al broker MQTT y se suscribe a los eventos de Frigate.
 * onEvent(normalizedEvent) se invoca por cada evento válido recibido.
 */
function connectMqtt(onEvent) {
  client = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 5000,
    connectTimeout: 10000
  });

  client.on('connect', () => {
    state.connected = true;
    state.lastError = null;
    console.log(`MQTT conectado a ${MQTT_URL}`);

    client.subscribe(EVENTS_TOPIC, (err) => {
      if (err) {
        console.error('Error suscribiendo a', EVENTS_TOPIC, err.message);
      } else {
        console.log('Suscrito a', EVENTS_TOPIC);
      }
    });
  });

  client.on('reconnect', () => {
    console.log('MQTT reconectando...');
  });

  client.on('close', () => {
    state.connected = false;
  });

  client.on('error', (error) => {
    state.connected = false;
    state.lastError = error.message;
    console.error('Error MQTT:', error.message);
  });

  client.on('message', (topic, messageBuffer) => {
    if (topic !== EVENTS_TOPIC) return;

    let payload;
    try {
      payload = JSON.parse(messageBuffer.toString('utf8'));
    } catch (error) {
      console.error('Mensaje MQTT no es JSON válido:', error.message);
      return;
    }

    const normalized = normalizeFrigateEvent(payload);

    if (!normalized) {
      console.error('Evento de Frigate sin datos usables (sin before/after).');
      return;
    }

    state.lastMessageAt = new Date().toISOString();

    if (typeof onEvent === 'function') {
      onEvent(normalized);
    }
  });

  return client;
}

function getMqttState() {
  return { ...state };
}

module.exports = {
  connectMqtt,
  getMqttState
};
