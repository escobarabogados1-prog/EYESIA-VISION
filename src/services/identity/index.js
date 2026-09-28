const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const identityFile = path.join(
  __dirname,
  '../../../data/identity/installation.json'
);

function loadInstallationId() {
  try {
    if (fs.existsSync(identityFile)) {
      const data = JSON.parse(fs.readFileSync(identityFile, 'utf8'));

      if (data.installation_id) {
        return data.installation_id;
      }
    }
  } catch (error) {
    console.error('Error leyendo identidad de instalación:', error.message);
  }

  const installationId = crypto.randomUUID();

  try {
    fs.writeFileSync(
      identityFile,
      JSON.stringify(
        {
          installation_id: installationId,
          created_at: new Date().toISOString()
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Error guardando identidad de instalación:', error.message);
  }

  return installationId;
}

const identity = {
  product: 'EYESIA VISION',
  platform: 'EYESIA EDGE',
  version: '0.1.0',
  device_id: os.hostname(),
  installation_id: loadInstallationId()
};

function getIdentity() {
  return {
    ...identity,
    hostname: os.hostname(),
    platform_os: process.platform,
    architecture: process.arch
  };
}

module.exports = {
  getIdentity
};
