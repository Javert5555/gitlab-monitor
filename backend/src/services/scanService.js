// src/services/scanService.js
const checks = require('./securityChecks');
const gitlab = require('./gitlabService');

const checkList = [
  checks.checkSEC1,
  checks.checkSEC2,
  checks.checkSEC3,
  checks.checkSEC4,
  checks.checkSEC5,
  checks.checkSEC6,
  checks.checkSEC7,
  checks.checkSEC8,
  checks.checkSEC9,
  checks.checkSEC10
];

async function scanProject(project) {
  // project: object from DB (contains gitlabProjectId)
  const projectId = project.gitlabProjectId;
  const results = [];
  for (const checkFn of checkList) {
    try {
      const r = await checkFn(projectId, gitlab);
      results.push(r);
    } catch (err) {
      console.error(`Check ${checkFn.name} failed for project ${projectId}:`, err.message || err);
      // push an error result so user sees missing check
      results.push({
        id: checkFn.name || 'unknown',
        name: checkFn.name || 'unknown',
        results: [{ item: 'internal', status: 'FAIL', details: 'Check execution failed' }]
      });
    }
  }
  return results;
}

function buildSummary(results) {
  const summary = { totalRisks: 0, critical: 0, high: 0, medium: 0, low: 0 };
  for (const sec of results) {
    for (const r of (sec.results || [])) {
      if (r.status === 'FAIL' || r.status === 'WARN') summary.totalRisks++;
      // если в результатах есть уровень, подсчитать — иначе игнорируем
      if (r.severity && typeof r.severity === 'string') {
        const s = r.severity.toLowerCase();
        if (s === 'critical') summary.critical++;
        if (s === 'high') summary.high++;
        if (s === 'medium') summary.medium++;
        if (s === 'low') summary.low++;
      }
    }
  }
  return summary;
}

module.exports = { scanProject, buildSummary };
