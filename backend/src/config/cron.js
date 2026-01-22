const CronJob = require('cron').CronJob;
const projectCtrl = require('../controllers/project.controller');
const { getCronSchedule } = require('../utils/cronHelper');

// Текущий активный job
let activeJob = null;

// Доступные расписания
const SCHEDULES = {
    'every-10-minutes': '*/10 * * * *',
    'hourly': '0 * * * *',
    'every-2-hours': '0 */2 * * *',
    'every-3-hours': '0 */3 * * *',
    'every-4-hours': '0 */4 * * *',
    'every-6-hours': '0 */6 * * *',
    'every-12-hours': '0 */12 * * *',
    'daily': '0 0 * * *',
    'every-2-days': '0 0 */2 * *',
    'every-3-days': '0 0 */3 * *',
    'weekly': '0 0 * * 0',
    'disabled': null
};

// Функция для выполнения сканирования
const executeScan = async () => {
    console.log('Cron: starting scheduled full scan');
    try {
        await projectCtrl.fullScan();
        console.log('Cron: full scan finished');
    } catch (err) {
        console.error('Cron: full scan failed', err);
    }
};

// Создаём или обновляем cron job
function updateSchedule(scheduleKey) {
    // Останавливаем текущий job, если он существует
    if (activeJob) {
        activeJob.stop();
        activeJob = null;
        console.log('Previous cron job stopped');
    }

    // Если расписание отключено - выходим
    if (scheduleKey === 'disabled' || !SCHEDULES[scheduleKey]) {
        console.log('Cron scheduling disabled');
        return;
    }

    const cronExpression = SCHEDULES[scheduleKey];
    
    // Создаём новый job
    activeJob = new CronJob(
        cronExpression,
        executeScan,
        null,
        true, // auto-start
        'UTC'
    );

    console.log(`Cron job scheduled: ${scheduleKey} (${cronExpression})`);
}

// Получаем текущее расписание
function getCurrentSchedule() {
    if (!activeJob) return 'disabled';
    
    const cronTime = activeJob.cronTime.source;
    
    // Находим ключ расписания по cron выражению
    for (const [key, value] of Object.entries(SCHEDULES)) {
        if (value === cronTime) {
            return key;
        }
    }
    
    return 'custom';
}

module.exports = {
    updateSchedule,
    getCurrentSchedule,
    SCHEDULES,
    executeScan
};