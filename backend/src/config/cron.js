// src/config/cron.js
const CronJob = require('cron').CronJob;
const projectCtrl = require('../controllers/project.controller');

// Cron expression: every 30 minutes -> '0 */30 * * * *' (second, minute, hour...)
// const job = new CronJob('0 */30 * * * *', async () => {
const job = new CronJob('0 */10 * * * *', async () => {
  console.log('Cron: starting scheduled full scan (every 30 minutes)');
  try {
    await projectCtrl.fullScan(); // fullScan вернёт объект, но тут без res
    console.log('Cron: full scan finished');
  } catch (err) {
    console.error('Cron: full scan failed', err);
  }
}, null, false, 'UTC'); // do not auto-start; start explicitly in server.js

// Выполнить initial full scan сразу при старте (не блокируя сервер)
(async () => {
  try {
    console.log('Initial sync + scan on startup');
    // uncomment later
    // await projectCtrl.fullScan();
    console.log('Initial sync + scan completed');
  } catch (err) {
    console.error('Initial sync + scan failed', err);
  }
})();

module.exports = job;
