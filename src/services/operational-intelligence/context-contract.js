const SLUG_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const FIELD_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateScalar(value, fieldName) {
  const valid =
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.length <= 512);

  if (!valid) {
    throw new Error(`${fieldName} debe ser un escalar finito`);
  }
}

function validateValues(values, fieldName) {
  if (!isPlainObject(values) || Object.keys(values).length === 0) {
    throw new Error(`${fieldName} debe ser un objeto no vacio`);
  }

  for (const [key, value] of Object.entries(values)) {
    if (!FIELD_PATTERN.test(key)) {
      throw new Error(`${fieldName} contiene un nombre de campo invalido`);
    }

    validateScalar(value, `${fieldName}.${key}`);
  }
}

function validateContext({
  context_id: contextId,
  domain,
  source,
  occurred_at: occurredAt,
  subject,
  lifecycle,
  observations,
  changes
}) {
  if (typeof contextId !== 'string' || !contextId.trim()) {
    throw new Error('Falta context_id');
  }

  if (typeof domain !== 'string' || !SLUG_PATTERN.test(domain)) {
    throw new Error('domain invalido');
  }

  if (typeof source !== 'string' || !SLUG_PATTERN.test(source)) {
    throw new Error('source invalido');
  }

  if (
    typeof occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(occurredAt))
  ) {
    throw new Error('occurred_at invalido');
  }

  if (
    !isPlainObject(subject) ||
    typeof subject.type !== 'string' ||
    !SLUG_PATTERN.test(subject.type) ||
    typeof subject.id !== 'string' ||
    !subject.id.trim() ||
    subject.id.length > 128
  ) {
    throw new Error('subject invalido');
  }

  if (
    lifecycle !== null &&
    (!isPlainObject(lifecycle) ||
      typeof lifecycle.type !== 'string' ||
      !SLUG_PATTERN.test(lifecycle.type) ||
      typeof lifecycle.status !== 'string' ||
      !SLUG_PATTERN.test(lifecycle.status))
  ) {
    throw new Error('lifecycle invalido');
  }

  if (!Array.isArray(observations) || observations.length === 0) {
    throw new Error('observations debe contener evidencia');
  }

  for (const observation of observations) {
    if (
      !isPlainObject(observation) ||
      typeof observation.type !== 'string' ||
      !SLUG_PATTERN.test(observation.type)
    ) {
      throw new Error('observation invalida');
    }

    if (
      observation.phase !== undefined &&
      (typeof observation.phase !== 'string' ||
        !SLUG_PATTERN.test(observation.phase))
    ) {
      throw new Error('observation.phase invalida');
    }

    validateValues(observation.values, 'observation.values');
  }

  if (!Array.isArray(changes)) {
    throw new Error('changes debe ser un arreglo');
  }

  for (const change of changes) {
    if (!isPlainObject(change) || typeof change.name !== 'string' ||
      !FIELD_PATTERN.test(change.name)) {
      throw new Error('change invalido');
    }

    validateScalar(change.before, 'change.before');
    validateScalar(change.after, 'change.after');
  }

  return true;
}

function createContext(context) {
  validateContext(context);

  return {
    context_id: context.context_id,
    domain: context.domain,
    source: context.source,
    occurred_at: context.occurred_at,
    subject: {
      type: context.subject.type,
      id: context.subject.id
    },
    lifecycle: context.lifecycle
      ? { type: context.lifecycle.type, status: context.lifecycle.status }
      : null,
    observations: context.observations.map((observation) => ({
      type: observation.type,
      ...(observation.phase ? { phase: observation.phase } : {}),
      values: { ...observation.values }
    })),
    changes: context.changes.map((change) => ({
      name: change.name,
      before: change.before,
      after: change.after
    }))
  };
}

module.exports = {
  createContext,
  validateContext
};