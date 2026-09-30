require('dotenv').config();

const { performance } = require('node:perf_hooks');
const analyzer = require('../src/services/operational-intelligence/analyzer');

const baseEvent = {
  event_id: 'ollama-eval-fixed',
  timestamp: '2026-09-30T09:00:00.000Z',
  source: 'frigate',
  event_type: 'new',
  device: { camera_id: 'elith_cam_1' },
  detection: { object: 'person', confidence: 0.1 },
  context: 'No se proporciona evidencia adicional de amenaza, intrusión o emergencia.'
};

const cases = [0.1, 0.99].map((confidence) => ({
  ...baseEvent,
  confidence,
  detection: { ...baseEvent.detection, confidence }
}));

async function analyzeCase(event) {
  const startedAt = performance.now();

  try {
    const result = await analyzer.analyze(event);
    return {
      detectionConfidence: event.detection.confidence,
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      result
    };
  } catch (error) {
    return {
      detectionConfidence: event.detection.confidence,
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      error: error.message
    };
  }
}

async function main() {
  const results = [];

  for (const event of cases) {
    results.push(await analyzeCase(event));
  }

  const successful = results.filter((result) => result.result);
  const classifications = new Set(successful.map(({ result }) => result.classification));
  const risks = new Set(successful.map(({ result }) => result.risk));
  const allRequestsCompleted = successful.length === cases.length;

  const report = {
    evaluationType: 'provisional prompt-invariant diagnostic',
    ownerApproved: false,
    model: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
    temperature: 0,
    seed: Number(process.env.OLLAMA_SEED) || 42,
    checks: {
      allRequestsCompleted,
      classificationUnchangedAcrossDetectorConfidence: allRequestsCompleted && classifications.size === 1,
      riskUnchangedAcrossDetectorConfidence: allRequestsCompleted && risks.size === 1,
      noAutomaticAlertForPersonOnly: allRequestsCompleted && successful.every(
        ({ result }) => !['ALERTA', 'INCIDENTE'].includes(result.classification)
      ),
      outputConfidenceEqualsDetectorConfidence: successful.map(
        ({ detectionConfidence, result }) => result.confidence === detectionConfidence
      )
    },
    results
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.checks.allRequestsCompleted) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});