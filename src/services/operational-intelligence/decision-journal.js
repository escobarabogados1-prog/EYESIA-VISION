const DOMAIN_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const DEFAULT_CAPACITY = 100;
const MAX_CAPACITY = 10000;

function cloneRecord(record) {
  return {
    ...record,
    provider: { ...record.provider }
  };
}

function createDecisionJournal({ capacity = DEFAULT_CAPACITY } = {}) {
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > MAX_CAPACITY
  ) {
    throw new Error(`La capacidad del journal debe estar entre 1 y ${MAX_CAPACITY}`);
  }

  const records = [];
  let overwritten = 0;

  function record({ context, provider, analysis, decision, recordedAt = new Date().toISOString() }) {
    if (
      !context ||
      typeof context.context_id !== 'string' ||
      context.context_id.length > 128 ||
      typeof context.domain !== 'string' ||
      !DOMAIN_PATTERN.test(context.domain) ||
      !provider ||
      typeof provider.id !== 'string' ||
      provider.id.length > 64 ||
      typeof provider.model !== 'string' ||
      provider.model.length > 128 ||
      !analysis ||
      typeof analysis.classification !== 'string' ||
      typeof analysis.risk !== 'string' ||
      !decision ||
      !['BLOCKED', 'SIMULATED'].includes(decision.status) ||
      typeof decision.reason_code !== 'string' ||
      !decision.execution ||
      typeof decision.execution.attempted !== 'boolean' ||
      typeof recordedAt !== 'string' ||
      !Number.isFinite(Date.parse(recordedAt))
    ) {
      throw new Error('Registro de decision invalido');
    }

    const entry = {
      context_id: context.context_id,
      domain: context.domain,
      provider: {
        id: provider.id,
        model: provider.model
      },
      classification: analysis.classification,
      risk: analysis.risk,
      decision_status: decision.status,
      reason_code: decision.reason_code,
      policy_id: decision.policy_id || null,
      policy_version: decision.policy_version || null,
      execution_mode: decision.execution.mode,
      action_attempted: decision.execution.attempted,
      recorded_at: recordedAt
    };

    if (records.length === capacity) {
      records.shift();
      overwritten += 1;
    }

    records.push(entry);
    return cloneRecord(entry);
  }

  function getRecent(limit = 10) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('El limite del journal debe ser un entero no negativo');
    }

    if (limit === 0) return [];

    return records.slice(-Math.min(limit, capacity)).reverse().map(cloneRecord);
  }

  function getState() {
    return {
      entries: records.length,
      capacity,
      overwritten,
      lastRecordedAt: records.length > 0
        ? records[records.length - 1].recorded_at
        : null
    };
  }

  return {
    record,
    getRecent,
    getState
  };
}

module.exports = {
  createDecisionJournal
};