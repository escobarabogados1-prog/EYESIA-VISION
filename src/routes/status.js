const express = require('express');
const router = express.Router();
const mqttService = require('../services/mqtt');
const eventsService = require('../services/events');

router.get('/status', (req, res) => {
  const camera = req.app.locals.camera || { connected: false };
  const mqttState = mqttService.getMqttState();
  const latestEvent = eventsService.getLatestEvent();

  res.json({
    sistema: 'ELITH SECURITYCAM',
    estado: 'operativo',
    ia: 'pendiente de conectar',
    camaras: camera.connected ? 1 : 0,
    camara: {
      conectada: camera.connected,
      recibiendo_video: camera.connected
    },
    mqtt: {
      conectado: mqttState.connected,
      ultimo_mensaje: mqttState.lastMessageAt,
      ultimo_error: mqttState.lastError
    },
    ultimo_evento: latestEvent
      ? { object: latestEvent.object, camera_id: latestEvent.camera_id, timestamp: latestEvent.timestamp }
      : null
  });
});

module.exports = router;
