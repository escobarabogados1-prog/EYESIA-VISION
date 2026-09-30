const express = require('express');
const router = express.Router();
const mqttService = require('../services/mqtt');
const eventsService = require('../services/events');

router.get('/status', (req, res) => {
  const camera = req.app.locals.camera || { connected: false };
  const mqttState = mqttService.getMqttState();
  const latestEvent = eventsService.getLatestEvent();
  const analysis = latestEvent && latestEvent.analysis;

  res.json({
    sistema: 'ELITH SECURITYCAM',
    estado: 'operativo',
    ia: analysis ? 'operativa' : 'esperando análisis',
    motor_ia: req.app.locals.aiProvider || null,
    camaras: camera.connected ? 1 : 0,
    camara: {
      conectada: camera.connected,
      recibiendo_video: camera.connected,
      reconectando: Boolean(camera.reconnecting),
      ultimo_frame: camera.lastFrameAt || null,
      ultimo_error: camera.lastError || null
    },
    mqtt: {
      conectado: mqttState.connected,
      suscrito_frigate: mqttState.subscribed,
      ultima_suscripcion: mqttState.lastSubscribedAt,
      ultimo_mensaje: mqttState.lastMessageAt,
      ultimo_error: mqttState.lastError
    },
    cola_analisis: req.app.locals.analysisQueue
      ? req.app.locals.analysisQueue.getState()
      : null,
    ultimo_evento: latestEvent
      ? {
          object: latestEvent.object,
          camera_id: latestEvent.camera_id,
          timestamp: latestEvent.timestamp,
          analisis: analysis || null
        }
      : null
  });
});

module.exports = router;
