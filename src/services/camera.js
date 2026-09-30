const http = require('http');
const https = require('https');
const FRIGATE_URL = process.env.FRIGATE_URL || 'http://localhost:5000';
const FRIGATE_CAMERA = process.env.FRIGATE_CAMERA || 'elith_cam_1';
const CAMERA_RECONNECT_DELAY_MS = 5000;
const CAMERA_REQUEST_TIMEOUT_MS = 10000;

let reconnectTimer = null;
let onFrameCallback = null;
let onStateChange = null;

const state = {
  connected: false,
  reconnecting: false,
  lastError: null,
  lastFrameAt: null
};

function updateState(changes) {
  Object.assign(state, changes);

  if (typeof onStateChange === 'function') {
    onStateChange({ ...state });
  }
}

function scheduleReconnect(errorMessage) {
  updateState({
    connected: false,
    reconnecting: true,
    lastError: errorMessage
  });

  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    updateState({ reconnecting: false });
    openCameraConnection();
  }, CAMERA_RECONNECT_DELAY_MS);
  reconnectTimer.unref();
}

function openCameraConnection() {
  const streamUrl = new URL(
    `/api/${encodeURIComponent(FRIGATE_CAMERA)}`,
    FRIGATE_URL
  );
  const requestOptions = {
    hostname: streamUrl.hostname,
    port: streamUrl.port || (streamUrl.protocol === 'https:' ? 443 : 80),
    path: `${streamUrl.pathname}${streamUrl.search}`,
    method: 'GET',
    headers: {
      Accept: 'multipart/x-mixed-replace',
      'User-Agent': 'Mozilla/5.0'
    }
  };
  const httpClient = streamUrl.protocol === 'https:' ? https : http;

  console.log(`Conectando al stream Frigate de ${FRIGATE_CAMERA}...`);

  const req = httpClient.request(requestOptions, (res) => {
    console.log(`Frigate HTTP: ${res.statusCode}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);

    if (res.statusCode !== 200) {
      console.error('Frigate no aceptó la conexión de video.');
      scheduleReconnect(`Frigate respondió HTTP ${res.statusCode}`);
      res.resume();
      return;
    }

    updateState({ reconnecting: false, lastError: null });
    console.log('Flujo MJPEG de Frigate conectado.');

    let buffer = Buffer.alloc(0);

    res.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (true) {
        const start = buffer.indexOf(Buffer.from([0xff, 0xd8]));

        if (start === -1) break;

        const end = buffer.indexOf(
          Buffer.from([0xff, 0xd9]),
          start + 2
        );

        if (end === -1) break;

        const frame = buffer.subarray(start, end + 2);

        buffer = buffer.subarray(end + 2);

        console.log('FRAME RECIBIDO:', frame.length, 'bytes');

        updateState({
          connected: true,
          reconnecting: false,
          lastError: null,
          lastFrameAt: new Date().toISOString()
        });
        onFrameCallback(frame);
      }
    });

    res.on('end', () => {
      console.log('Flujo de cámara cerrado.');
      scheduleReconnect('Flujo de cámara cerrado');
    });

    res.on('error', (error) => {
      console.error('Error en flujo:', error.message);
      scheduleReconnect(error.message);
    });
  });

  req.on('error', (error) => {
    console.error('Error conectando al stream Frigate:', error.message);
    scheduleReconnect(error.message);
  });

  req.setTimeout(CAMERA_REQUEST_TIMEOUT_MS, () => {
    req.destroy(new Error('Timeout conectando a la cámara'));
  });
  req.end();
}

function connectCamera(onFrame, stateChangeCallback) {
  onFrameCallback = onFrame;
  onStateChange = stateChangeCallback;
  openCameraConnection();
}

function getCameraState() {
  return { ...state };
}

module.exports = {
  connectCamera,
  getCameraState
};
