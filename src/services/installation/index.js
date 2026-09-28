const identityService = require('../identity');

const installation = {
  installation_id: identityService.getIdentity().installation_id,
  product: 'EYESIA VISION',
  platform: 'EYESIA EDGE',
  status: 'active'
};

function getInstallation() {
  return {
    ...installation
  };
}

module.exports = {
  getInstallation
};
