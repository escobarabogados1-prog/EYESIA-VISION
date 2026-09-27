const http = require('http');

const CAMERA_HOST = '192.168.5.107';
const CAMERA_PORT = 4444;
const CAMERA_USER = 'elith1';
const CAMERA_PASSWORD = process.env.CAMERA_PASSWORD;

function connectCamera(onFrame) {
  if (!CAMERA_PASSWORD) {
    console.error('ERROR: CAMERA_PASSWORD no está configurada.');
    return;
  }

  const auth = Buffer.from(
    `${CAMERA_USER}:${CAMERA_PASSWORD}`
  ).toString('base64');

  const options = {
    hostname: CAMERA_HOST,
    port: CAMERA_PORT,
    path: '/video/mjpeg',
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: '*/*',
      'User-Agent': 'Mozilla/5.0'
    }
  };

  console.log('Conectando a ELITH SECURITYCAM...');

  const req = http.request(options, (res) => {
    console.log(`Cámara HTTP: ${res.statusCode}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);

    if (res.statusCode !== 200) {
      console.error('La cámara no aceptó la conexión.');
      res.resume();
      return;
    }

    console.log('Flujo MJPEG conectado.');

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

        onFrame(frame);
      }
    });

    res.on('end', () => {
      console.log('Flujo de cámara cerrado.');
    });

    res.on('error', (error) => {
      console.error('Error en flujo:', error.message);
    });
  });

  req.on('error', (error) => {
    console.error('Error conectando cámara:', error.message);
  });

  req.end();
}

module.exports = {
  connectCamera
};
