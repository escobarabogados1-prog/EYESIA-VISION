const http = require('http');

const USER = 'elith1';
const PASSWORD = process.env.CAMERA_PASSWORD;

const auth = Buffer.from(`${USER}:${PASSWORD}`).toString('base64');

const options = {
  hostname: '192.168.5.107',
  port: 4444,
  path: '/video/mjpeg',
  method: 'GET',
  headers: {
    Authorization: `Basic ${auth}`,
    Accept: '*/*',
    'User-Agent': 'Mozilla/5.0'
  }
};

console.log('Conectando a la cámara...');

const req = http.request(options, (res) => {
  console.log('HTTP:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);

  let total = 0;

  res.on('data', (chunk) => {
    total += chunk.length;
    console.log('DATOS RECIBIDOS:', chunk.length, 'bytes | TOTAL:', total);
  });

  res.on('end', () => {
    console.log('Flujo terminado. Total:', total, 'bytes');
  });
});

req.on('error', (err) => {
  console.error('ERROR:', err.message);
});

req.end();
