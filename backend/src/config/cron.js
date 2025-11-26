const cron = require('cron');
const { Project } = require('../models/index.model');
const scanService = require('../services/scanService');
const { ScanResult } = require('../models/index.model');

const job = new cron.CronJob(
  '0 */30 * * * *', // каждые 30 минут
  async () => {
    console.log('⏳ Running scheduled CI/CD security scan...');

    const projects = await Project.findAll();

    for (const project of projects) {
      const result = await scanService.scanProject(project);

      await ScanResult.create({
        projectId: project.id,
        results: result,
        summary: scanService.buildSummary(result)
      });
    }

    console.log('✅ Scheduled scan completed.');
  },
  null,
  true,
  'UTC'
);

module.exports = job;