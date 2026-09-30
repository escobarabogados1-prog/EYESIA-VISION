const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { normalizeFrigateEvent } = require('../src/services/mqtt');
const contract = require('../src/services/operational-intelligence/contract');
const analyzer = require('../src/services/operational-intelligence/analyzer');
const { buildEventContext } = require('../src/services/operational-intelligence/context');
const { createContext } = require('../src/services/operational-intelligence/context-contract');
const { evaluateDecision } = require('../src/services/operational-intelligence/decision-gate');
const { createAnalyzer } = require('../src/services/operational-intelligence/analyzer');
const { createProvider } = require('../src/services/operational-intelligence/providers');
const { createOpenAICompatibleProvider } = require('../src/services/operational-intelligence/providers/openai-compatible');
const { createDecisionJournal } = require('../src/services/operational-intelligence/decision-journal');
const { createAnalysisQueue } = require('../src/services/operational-intelligence/analysis-queue');
const eventsService = require('../src/services/events');
const statusRouter = require('../src/routes/status');

const validEvent = {
  event_id: 'event-1',
  timestamp: '2026-09-30T12:00:00.000Z',
  device: { camera_id: 'front_door' },
  detection: { object: 'person', confidence: 0.95 }
};

test('exposes analysis failure in /api/status without changing existing fields', async () => {
  const app = express();
  app.locals.camera = { connected: false };
  app.locals.analysisQueue = {
    getState: () => ({
      received: 1,
      completed: 0,
      failed: 1,
      coalesced: 0,
      staleResults: 0,
      lastError: 'fetch failed',
      lastDurationMs: 41,
      active: false,
      pending: 0
    })
  };
  app.locals.aiProvider = { id: 'ollama', model: 'qwen2.5:3b' };
  app.use('/api', statusRouter);

  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/status`);
    const status = await response.json();

    assert.equal(response.status, 200);
    assert.equal(status.estado, 'operativo');
    assert.equal(status.camara.conectada, false);
    assert.equal(typeof status.mqtt.conectado, 'boolean');
    assert.equal(status.cola_analisis.failed, 1);
    assert.equal(status.cola_analisis.lastError, 'fetch failed');
    assert.deepEqual(status.motor_ia, { id: 'ollama', model: 'qwen2.5:3b' });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test('normalizes a Frigate after event into the internal event shape', () => {
  const normalized = normalizeFrigateEvent({
    type: 'new',
    after: {
      id: 'frigate-1',
      camera: 'front_door',
      label: 'person',
      top_score: 0.95678,
      start_time: 1790770000,
      current_zones: ['porch']
    }
  });

  assert.equal(normalized.event_id, 'frigate-1');
  assert.equal(normalized.event_type, 'new');
  assert.equal(normalized.timestamp, new Date(1790770000 * 1000).toISOString());
  assert.equal(normalized.device.camera_id, 'front_door');
  assert.equal(normalized.detection.object, 'person');
  assert.equal(normalized.detection.confidence, 0.9568);
  assert.equal(normalized.zone, 'porch');
  assert.equal(normalized.status, 'open');
  assert.equal(contract.validateInput(normalized), true);
});

test('normalizes an end event from before when after is absent', () => {
  const normalized = normalizeFrigateEvent({
    type: 'end',
    before: {
      id: 'frigate-2',
      camera: 'garage',
      label: 'car',
      score: 0.81,
      start_time: 1790770000
    }
  });

  assert.equal(normalized.event_id, 'frigate-2');
  assert.equal(normalized.event_type, 'end');
  assert.equal(normalized.detection.confidence, 0.81);
  assert.equal(normalized.status, 'closed');
  assert.equal(normalized.zone, null);
});

test('adapts a Frigate update into the canonical OIV context', () => {
  const event = normalizeFrigateEvent({
    type: 'update',
    before: {
      id: 'frigate-context-1',
      camera: 'front_door',
      label: 'person',
      top_score: 0.72,
      current_zones: ['sidewalk']
    },
    after: {
      id: 'frigate-context-1',
      camera: 'front_door',
      label: 'person',
      top_score: 0.91,
      current_zones: ['porch']
    }
  });

  assert.deepEqual(buildEventContext(event), {
    context_id: 'frigate-context-1',
    domain: 'surveillance',
    source: 'frigate',
    occurred_at: event.timestamp,
    subject: { type: 'camera', id: 'front_door' },
    lifecycle: { type: 'update', status: 'open' },
    observations: [
      {
        type: 'detection',
        phase: 'before',
        values: {
          object: 'person',
          detection_confidence: 0.72,
          zone: 'sidewalk'
        }
      },
      {
        type: 'detection',
        phase: 'current',
        values: {
          object: 'person',
          detection_confidence: 0.91,
          zone: 'porch'
        }
      }
    ],
    changes: [
      { name: 'detection_confidence', before: 0.72, after: 0.91 },
      { name: 'zone', before: 'sidewalk', after: 'porch' }
    ]
  });
});

test('accepts a synthetic retail context without Frigate-specific fields', () => {
  const context = createContext({
    context_id: 'retail-window-1',
    domain: 'retail_analytics',
    source: 'synthetic',
    occurred_at: '2026-09-30T12:15:00.000Z',
    subject: { type: 'store', id: 'market-1' },
    lifecycle: null,
    observations: [
      {
        type: 'footfall',
        values: { people_count: 24, window_minutes: 15 }
      },
      {
        type: 'inventory',
        values: { sku: 'SKU-42', in_stock: false }
      }
    ],
    changes: []
  });

  assert.equal(context.domain, 'retail_analytics');
  assert.equal(context.subject.type, 'store');
  assert.equal(context.observations[0].values.people_count, 24);
  assert.equal(context.observations[1].values.in_stock, false);
  assert.throws(
    () => createContext({
      ...context,
      observations: [{ type: 'footfall', values: { raw: { nested: true } } }]
    }),
    /debe ser un escalar finito/
  );
  assert.throws(
    () => createContext({ ...context, context_id: 'x'.repeat(129) }),
    /Falta context_id/
  );
  assert.throws(
    () => createContext({
      ...context,
      observations: Array(33).fill(context.observations[0])
    }),
    /observations debe contener evidencia/
  );
  assert.throws(
    () => createContext({
      ...context,
      observations: [{
        type: 'inventory',
        values: { sku: 'SKU-42', detail: 'x'.repeat(513) }
      }]
    }),
    /debe ser un escalar finito/
  );
  assert.throws(
    () => createContext({
      ...context,
      observations: Array(32).fill({
        type: 'inventory',
        values: { detail: 'x'.repeat(512) }
      })
    }),
    /context excede el tamano maximo/
  );
});

test('blocks model proposals when no domain policy is configured', () => {
  const decision = evaluateDecision({
    context: buildEventContext(normalizeFrigateEvent({
      type: 'new',
      after: {
        id: 'gate-event-1',
        camera: 'front_door',
        label: 'person',
        top_score: 0.98
      }
    })),
    proposal: {
      classification: 'ALERTA',
      risk: 'ALTO',
      recommended_action: 'REVISAR'
    }
  });

  assert.equal(decision.status, 'BLOCKED');
  assert.equal(decision.reason_code, 'POLICY_MISSING');
  assert.equal(decision.execution.mode, 'dry_run');
  assert.equal(decision.execution.attempted, false);
  assert.equal(decision.action_preview, null);
});

test('simulates only an exact proposal allowed by an approved matching policy', () => {
  const context = buildEventContext(normalizeFrigateEvent({
    type: 'new',
    after: {
      id: 'gate-event-2',
      camera: 'front_door',
      label: 'person',
      top_score: 0.8
    }
  }));
  const policy = {
    policy_id: 'surveillance-review-v1',
    version: '1',
    domain: 'surveillance',
    approval_status: 'approved',
    approved_by: 'synthetic-test-owner',
    approved_at: '2026-09-30T12:00:00.000Z',
    allowed_proposals: [{
      classification: 'DETECCION',
      risk: 'BAJO',
      recommended_action: 'REVISAR',
      action: 'queue_operator_review'
    }]
  };

  const simulated = evaluateDecision({
    context,
    proposal: {
      classification: 'DETECCION',
      risk: 'BAJO',
      recommended_action: 'REVISAR'
    },
    policy
  });
  const denied = evaluateDecision({
    context,
    proposal: {
      classification: 'ALERTA',
      risk: 'ALTO',
      recommended_action: 'OPEN_DOOR'
    },
    policy
  });

  assert.equal(simulated.status, 'SIMULATED');
  assert.deepEqual(simulated.action_preview, { action: 'queue_operator_review' });
  assert.equal(simulated.execution.attempted, false);
  assert.equal(denied.status, 'BLOCKED');
  assert.equal(denied.reason_code, 'PROPOSAL_NOT_ALLOWED');
  assert.equal(denied.action_preview, null);
});

test('blocks invalid, unapproved, and cross-domain policies', () => {
  const context = buildEventContext(normalizeFrigateEvent({
    type: 'new',
    after: {
      id: 'gate-event-3',
      camera: 'front_door',
      label: 'person',
      top_score: 0.8
    }
  }));
  const proposal = {
    classification: 'DETECCION',
    risk: 'BAJO',
    recommended_action: 'REVISAR'
  };
  const policy = {
    policy_id: 'surveillance-review-v1',
    version: '1',
    domain: 'surveillance',
    approval_status: 'approved',
    approved_by: 'synthetic-test-owner',
    approved_at: '2026-09-30T12:00:00.000Z',
    allowed_proposals: [{
      ...proposal,
      action: 'queue_operator_review'
    }]
  };

  assert.equal(evaluateDecision({
    context,
    proposal: { ...proposal, recommended_action: '' },
    policy
  }).reason_code, 'INVALID_PROPOSAL');
  assert.equal(evaluateDecision({
    context,
    proposal,
    policy: { ...policy, approval_status: 'pending' }
  }).reason_code, 'POLICY_NOT_APPROVED');
  assert.equal(evaluateDecision({
    context,
    proposal,
    policy: { ...policy, domain: 'retail_analytics' }
  }).reason_code, 'POLICY_DOMAIN_MISMATCH');
  assert.equal(evaluateDecision({
    context,
    proposal,
    policy: { ...policy, allowed_proposals: [] }
  }).reason_code, 'POLICY_INVALID');
});

test('stores the gate result alongside the current event analysis', () => {
  const originalLog = console.log;
  console.log = () => {};

  try {
    eventsService.recordEvent({ ...validEvent });
    const decision = {
      status: 'BLOCKED',
      reason_code: 'POLICY_MISSING',
      execution: { mode: 'dry_run', attempted: false },
      action_preview: null
    };

    assert.equal(eventsService.recordAnalysis(
      validEvent.event_id,
      { classification: 'DETECCION' },
      decision
    ), true);
    assert.equal(eventsService.getLatestEvent().decision_status, 'BLOCKED');
    assert.deepEqual(eventsService.getLatestEvent().decision, decision);
    assert.equal(eventsService.recordAnalysis('stale-event', {}, decision), false);
  } finally {
    console.log = originalLog;
  }
});

test('ignores JSON values that are not Frigate event objects', () => {
  for (const payload of [null, [], {}, { after: null }, { after: [] }]) {
    assert.equal(normalizeFrigateEvent(payload), null);
  }
});

test('validates required event fields and confidence bounds', () => {
  assert.equal(contract.validateInput(validEvent), true);

  for (const confidence of [-0.01, 1.01, Number.NaN, '0.5']) {
    assert.throws(
      () => contract.validateInput({
        ...validEvent,
        detection: { object: 'person', confidence }
      }),
      /detection\.confidence/
    );
  }

  assert.throws(
    () => contract.validateInput({ ...validEvent, event_id: '' }),
    /event_id/
  );
});

test('creates valid analysis results and rejects invalid classifications', () => {
  const validResult = {
    classification: 'DETECCION',
    risk: 'BAJO',
    confidence: 0.8,
    factors: [],
    reason: 'Persona detectada',
    missingData: [],
    recommendedAction: 'REVISAR'
  };

  assert.deepEqual(contract.createResult(validResult), {
    classification: 'DETECCION',
    risk: 'BAJO',
    confidence: 0.8,
    factors: [],
    reason: 'Persona detectada',
    missing_data: [],
    recommended_action: 'REVISAR'
  });
  assert.equal(
    contract.createResult({ ...validResult, confidence: 0 }).confidence,
    0
  );
  assert.throws(
    () => contract.createResult({ ...validResult, classification: 'UNKNOWN' }),
    /Clasificación inválida/
  );
  assert.throws(
    () => contract.createResult({ ...validResult, risk: 'CRITICO' }),
    /Riesgo inválido/
  );

  for (const confidence of [Number.NaN, -0.01, 1.01, '0.5']) {
    assert.throws(
      () => contract.createResult({ ...validResult, confidence }),
      /Confianza de análisis inválida/
    );
  }
  assert.throws(
    () => contract.createResult({ ...validResult, factors: null }),
    /Factores inválidos/
  );
  assert.throws(
    () => contract.createResult({ ...validResult, reason: undefined }),
    /Razón inválida/
  );
  assert.throws(
    () => contract.createResult({ ...validResult, missingData: null }),
    /Datos faltantes inválidos/
  );
  assert.throws(
    () => contract.createResult({ ...validResult, recommendedAction: '' }),
    /Acción recomendada inválida/
  );
});

test('analyzes through an injected provider without changing the OIV result contract', async () => {
  let submittedPrompt = '';
  const provider = {
    id: 'synthetic-provider',
    model: 'fixture-model',
    async generate({ prompt }) {
      submittedPrompt = prompt;
      return JSON.stringify({
        classification: 'DETECCION',
        risk: 'BAJO',
        confidence: 0.61,
        factors: [],
        reason: 'Resultado sintetico para probar el puerto.',
        missing_data: [],
        recommended_action: 'REVISAR'
      });
    }
  };
  const injectedAnalyzer = createAnalyzer({ provider });
  const result = await injectedAnalyzer.analyze(validEvent);

  assert.equal(result.classification, 'DETECCION');
  assert.equal(result.risk, 'BAJO');
  assert.equal(result.recommended_action, 'REVISAR');
  assert.match(submittedPrompt, /CONTEXTO OBSERVABLE DEL EVENTO/);
  assert.deepEqual(injectedAnalyzer.getProviderInfo(), {
    id: 'synthetic-provider',
    model: 'fixture-model'
  });
});

test('selects Ollama by default and supports the OpenAI-compatible adapter', () => {
  const ollama = createProvider('ollama');
  const compatible = createProvider('openai-compatible');

  assert.equal(ollama.id, 'ollama');
  assert.equal(ollama.model, 'qwen2.5:3b');
  assert.equal(compatible.id, 'openai-compatible');
  assert.throws(() => createProvider('unknown-engine'), /no soportado/);
});

test('sends JSON-mode chat requests through the OpenAI-compatible adapter', async () => {
  const originalFetch = global.fetch;
  let requestUrl;
  let requestOptions;
  global.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: '{"classification":"DETECCION"}' }
        }]
      })
    };
  };

  try {
    const provider = createOpenAICompatibleProvider({
      baseUrl: 'http://127.0.0.1:8080/v1/',
      model: 'local-instruct',
      apiKey: 'synthetic-test-key',
      seed: 17
    });
    const response = await provider.generate({ prompt: 'Analiza datos.', timeoutMs: 1000 });
    const body = JSON.parse(requestOptions.body);

    assert.equal(requestUrl, 'http://127.0.0.1:8080/v1/chat/completions');
    assert.equal(requestOptions.headers.Authorization, 'Bearer synthetic-test-key');
    assert.equal(body.model, 'local-instruct');
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.seed, 17);
    assert.equal(response, '{"classification":"DETECCION"}');
  } finally {
    global.fetch = originalFetch;
  }
});

test('applies the shared timeout to the OpenAI-compatible provider', async () => {
  const originalFetch = global.fetch;
  const originalTimeout = process.env.AI_TIMEOUT_MS;
  process.env.AI_TIMEOUT_MS = '10';
  global.fetch = (_url, options) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => {}, 1000);
    options.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive);
      reject(options.signal.reason);
    }, { once: true });
  });

  try {
    const compatibleAnalyzer = createAnalyzer({
      provider: createOpenAICompatibleProvider({
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'local-instruct'
      })
    });

    await assert.rejects(
      compatibleAnalyzer.analyze(validEvent),
      /Timeout esperando respuesta de OpenAI-compatible \(10 ms\)/
    );
  } finally {
    global.fetch = originalFetch;
    if (originalTimeout === undefined) {
      delete process.env.AI_TIMEOUT_MS;
    } else {
      process.env.AI_TIMEOUT_MS = originalTimeout;
    }
  }
});

test('aborts Ollama requests after the configured timeout', async () => {
  const originalFetch = global.fetch;
  const originalTimeout = process.env.OLLAMA_TIMEOUT_MS;
  process.env.OLLAMA_TIMEOUT_MS = '10';
  global.fetch = (_url, options) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => {}, 1000);
    options.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive);
      reject(options.signal.reason);
    }, { once: true });
  });

  try {
    await assert.rejects(
      analyzer.analyze(validEvent),
      /Timeout esperando respuesta de Ollama \(10 ms\)/
    );
  } finally {
    global.fetch = originalFetch;
    if (originalTimeout === undefined) {
      delete process.env.OLLAMA_TIMEOUT_MS;
    } else {
      process.env.OLLAMA_TIMEOUT_MS = originalTimeout;
    }
  }
});

test('sends Ollama a calibrated prompt and deterministic generation settings', async () => {
  const originalFetch = global.fetch;
  const event = {
    ...validEvent,
    raw_event: {
      type: 'update',
      before: { label: 'person', top_score: 0.7, current_zones: ['street'] },
      after: { label: 'person', top_score: 0.9, current_zones: ['porch'] },
      diagnostic_token: 'must-not-reach-model'
    }
  };
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          classification: 'DETECCION',
          risk: 'BAJO',
          confidence: 0.74,
          factors: [],
          reason: 'No hay evidencia adicional de amenaza.',
          missing_data: ['Contexto del evento'],
          recommended_action: 'REVISAR'
        })
      })
    };
  };

  try {
    const result = await analyzer.analyze(event);
    assert.equal(result.confidence, 0.74);
    assert.equal(requestBody.options.temperature, 0);
    assert.equal(requestBody.options.seed, 42);
    assert.match(requestBody.prompt, /no la confianza\s+de detección de Frigate/i);
    assert.match(requestBody.prompt, /reason: explicación breve y no vacía/i);
    assert.match(requestBody.prompt, /"phase": "before"/);
    assert.match(requestBody.prompt, /changes/);
    assert.doesNotMatch(requestBody.prompt, /diagnostic_token|must-not-reach-model/);
    assert.doesNotMatch(requestBody.prompt, /"confidence":\s*0\.0/);
    assert.doesNotMatch(requestBody.prompt, /"reason":\s*""/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('keeps one active and the newest pending analysis under burst load', async () => {
  const releases = [];
  const analyzed = [];
  let latestEventId = null;
  const queue = createAnalysisQueue({
    analyze: (event) => new Promise((resolve) => {
      analyzed.push(event.event_id);
      releases.push(() => resolve({ event_id: event.event_id }));
    }),
    onResult: (event, result) => event.event_id === latestEventId &&
      result.event_id === latestEventId
  });

  for (let index = 0; index < 100; index += 1) {
    const event = { event_id: `burst-${index}` };
    latestEventId = event.event_id;
    queue.enqueue(event);
  }

  assert.deepEqual(queue.getState(), {
    received: 100,
    completed: 0,
    failed: 0,
    coalesced: 98,
    staleResults: 0,
    lastError: null,
    lastDurationMs: null,
    active: true,
    pending: 1
  });

  const idle = queue.waitForIdle();
  await new Promise(setImmediate);
  assert.deepEqual(analyzed, ['burst-0']);
  releases[0]();
  await new Promise(setImmediate);
  assert.deepEqual(analyzed, ['burst-0', 'burst-99']);
  releases[1]();
  await idle;

  assert.equal(queue.getState().completed, 2);
  assert.equal(queue.getState().staleResults, 1);
  assert.equal(queue.getState().coalesced, 98);
  assert.equal(queue.getState().active, false);
  assert.equal(queue.getState().pending, 0);
});

test('records analysis failures and continues with the newest pending event', async () => {
  const analyzed = [];
  const originalError = console.error;
  const queue = createAnalysisQueue({
    analyze: async (event) => {
      analyzed.push(event.event_id);
      if (event.event_id === 'failure') throw new Error('Ollama unavailable');
      return { event_id: event.event_id };
    }
  });

  console.error = () => {};
  try {
    queue.enqueue({ event_id: 'failure' });
    queue.enqueue({ event_id: 'after-failure' });
    await queue.waitForIdle();
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(analyzed, ['failure', 'after-failure']);
  assert.equal(queue.getState().failed, 1);
  assert.equal(queue.getState().completed, 1);
  assert.equal(queue.getState().pending, 0);
});

test('journals redacted decision metadata in a bounded model-neutral buffer', () => {
  const journal = createDecisionJournal({ capacity: 2 });
  const context = {
    context_id: 'journal-event-1',
    domain: 'surveillance',
    raw_event: { private_payload: 'not stored' }
  };
  const provider = { id: 'openai-compatible', model: 'local-instruct' };
  const analysis = {
    classification: 'DETECCION',
    risk: 'BAJO',
    reason: 'private model rationale'
  };
  const decision = {
    status: 'BLOCKED',
    reason_code: 'POLICY_MISSING',
    policy_id: null,
    policy_version: null,
    execution: { mode: 'dry_run', attempted: false }
  };

  journal.record({ context, provider, analysis, decision });
  journal.record({
    context: { ...context, context_id: 'journal-event-2' },
    provider: { id: 'ollama', model: 'qwen2.5:3b' },
    analysis,
    decision,
    recordedAt: '2026-09-30T13:00:00.000Z'
  });
  const latest = journal.record({
    context: { ...context, context_id: 'journal-event-3' },
    provider,
    analysis,
    decision,
    recordedAt: '2026-09-30T13:01:00.000Z'
  });

  assert.equal(latest.context_id, 'journal-event-3');
  assert.equal('raw_event' in latest, false);
  assert.equal('reason' in latest, false);
  assert.deepEqual(journal.getState(), {
    entries: 2,
    capacity: 2,
    overwritten: 1,
    lastRecordedAt: '2026-09-30T13:01:00.000Z'
  });
  assert.deepEqual(journal.getRecent(1).map(({ context_id }) => context_id), [
    'journal-event-3'
  ]);
  assert.deepEqual(journal.getRecent(0), []);
});