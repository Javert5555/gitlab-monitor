const checks = [
  require('./securityChecks/check_SEC_1'),
  require('./securityChecks/check_SEC_2'),
  require('./securityChecks/check_SEC_3'),
  require('./securityChecks/check_SEC_4'),
  require('./securityChecks/check_SEC_5'),
  require('./securityChecks/check_SEC_6'),
  require('./securityChecks/check_SEC_7'),
  require('./securityChecks/check_SEC_8'),
  require('./securityChecks/check_SEC_9'),
  require('./securityChecks/check_SEC_10')
];

module.exports = {
  scanProject: async (project) => {
    const results = {};

    for (const check of checks) {
      const r = await check(project.gitlabProjectId);
      results[check.id] = r;
    }

    return results;
  },

  buildSummary: (results) => {
    const summary = {
      totalRisks: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const key of Object.keys(results)) {
      if (results[key].riskDetected) summary.totalRisks++;
    }

    return summary;
  }
};