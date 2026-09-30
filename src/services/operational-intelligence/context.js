const { createContext } = require('./context-contract');

function getConfidence(snapshot) {
  if (typeof snapshot.top_score === 'number') return snapshot.top_score;
  if (typeof snapshot.score === 'number') return snapshot.score;
  return null;
}

function getZone(snapshot) {
  const zones = Array.isArray(snapshot.current_zones)
    ? snapshot.current_zones
    : snapshot.zones;

  return Array.isArray(zones) && typeof zones[0] === 'string'
    ? zones[0]
    : null;
}

function summarizeObservation(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  return {
    object: typeof snapshot.label === 'string' ? snapshot.label : null,
    confidence: getConfidence(snapshot),
    zone: getZone(snapshot)
  };
}

function getChanges(previous, current) {
  if (!previous || !current) return [];

  return ['object', 'confidence', 'zone']
    .filter((field) =>
      previous[field] !== null &&
      current[field] !== null &&
      previous[field] !== current[field]
    )
    .map((field) => ({
      name: field === 'confidence' ? 'detection_confidence' : field,
      before: previous[field],
      after: current[field]
    }));
}

function createObservation(phase, observation) {
  return {
    type: 'detection',
    phase,
    values: {
      object: observation.object,
      detection_confidence: observation.confidence,
      zone: observation.zone
    }
  };
}

function buildEventContext(event) {
  const rawEvent = event.raw_event && typeof event.raw_event === 'object'
    ? event.raw_event
    : {};
  const previousObservation = summarizeObservation(rawEvent.before);
  const currentObservation = summarizeObservation(rawEvent.after) || {
    object: event.detection.object,
    confidence: event.detection.confidence,
    zone: event.zone || null
  };
  const observations = [];

  if (previousObservation) {
    observations.push(createObservation('before', previousObservation));
  }

  observations.push(createObservation('current', currentObservation));

  return createContext({
    context_id: event.event_id,
    domain: 'surveillance',
    source: event.source || 'frigate',
    occurred_at: event.timestamp,
    subject: {
      type: 'camera',
      id: event.device.camera_id
    },
    lifecycle: {
      type: event.event_type || 'unknown',
      status: event.status || 'unknown'
    },
    observations,
    changes: getChanges(previousObservation, currentObservation)
  });
}

module.exports = {
  buildEventContext
};