const express = require('express');
const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    sistema: 'ELITH SECURITYCAM',
    estado: 'operativo',
    ia: 'pendiente de conectar',
    camaras: 0
  });
});

module.exports = router;
