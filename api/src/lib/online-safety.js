const { findNewOnlineAnomalies } = require('../../../js/online-safety');

function validateRolesOnlineTransition(beforeRoles, afterRoles) {
  const anomalies = findNewOnlineAnomalies(beforeRoles, afterRoles);
  if (anomalies.length > 0) {
    const details = anomalies
      .map(item => `#${item.standKey}st: ${item.onlineLabel} (online=${item.onlineCount})`)
      .join(', ');
    const error = new Error(`Online assignment validation failed: ${details}`);
    error.code = 'ONLINE_ASSIGNMENT_INVALID';
    error.anomalies = anomalies;
    throw error;
  }
  return afterRoles;
}

module.exports = { validateRolesOnlineTransition };
