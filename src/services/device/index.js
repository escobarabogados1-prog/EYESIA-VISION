const os = require('os');
const identityService = require('../identity');
const installationService = require('../installation');

const device = {
  device_id: identityService.getIdentity().device_id,
  hostname: os.hostname(),
  installation_id: installationService.getInstallation().installation_id,
  product: 'EYESIA VISION',
  platform: 'EYESIA EDGE',
  status: 'active'
};

function getDevice() {
  return {
    ...device
  };
}

module.exports = {
  getDevice
};
