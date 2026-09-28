require('dotenv').config();
const express = require('express');
const statusRouter = require('./routes/status');
const camera = require('./services/camera');
const mqttService = require('./services/mqtt');
const eventsService = require('./services/events');
const identityService = require('./services/identity');

const app = express();
const PORT = 3001;

let latestFrame = null;
let clients = [];

app.locals.camera = { connected: false };

app.use('/api', statusRouter);

app.get('/api/system/identity', (req, res) => {
  res.json(identityService.getIdentity());
});

app.get('/', (req, res) => {
  res.json({
    sistema: 'ELITH SECURITYCAM',
    estado: 'online',
    camara: latestFrame ? 'recibiendo video' : 'esperando video'
  });
});

app.get('/api/camera/frame', (req, res) => {
  if (!latestFrame) {
    return res.status(503).json({
      estado: 'esperando frame de la cámara'
    });
  }

  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'no-store');
  res.send(latestFrame);
});

app.get('/api/camera/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive'
  });

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// --- Eventos EYESIA (Frigate → MQTT → Node.js) -----------------------------
// Nuevo en esta fase. No toma decisiones, solo expone lo que llega.

app.get('/api/events/latest', (req, res) => {
  const latestEvent = eventsService.getLatestEvent();

  if (!latestEvent) {
    return res.status(204).end();
  }

  res.json(latestEvent);
});

app.get('/api/events/health', (req, res) => {
  const mqttState = mqttService.getMqttState();
  const latestEvent = eventsService.getLatestEvent();

  res.json({
    mqtt_conectado: mqttState.connected,
    mqtt_ultimo_error: mqttState.lastError,
    frigate_recibiendo_eventos: Boolean(mqttState.lastMessageAt),
    ultimo_mensaje_mqtt: mqttState.lastMessageAt,
    ultimo_evento_en: latestEvent ? latestEvent.timestamp : null
  });
});

// --- Arranque de conexiones externas ---------------------------------------

camera.connectCamera((frame) => {
  latestFrame = frame;
  app.locals.camera.connected = true;

  const header = Buffer.from(
    '--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ' +
    frame.length +
    '\r\n\r\n'
  );

  const footer = Buffer.from('\r\n');

  for (const client of clients) {
    try {
      client.write(header);
      client.write(frame);
      client.write(footer);
    } catch (error) {
      clients = clients.filter(item => item !== client);
    }
  }
});

mqttService.connectMqtt((normalizedEvent) => {
  eventsService.recordEvent(normalizedEvent);
});

app.listen(PORT, () => {
  console.log(`ELITH SECURITYCAM funcionando en http://localhost:${PORT}`);
});
