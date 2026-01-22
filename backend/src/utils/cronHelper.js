// преобразуем человекочитаемое расписание в cron выражение
function getCronSchedule(schedule) {
    const schedules = {
        'every-10-minutes': '*/10 * * * *',
        'hourly': '0 * * * *',
        'every-2-hours': '0 */2 * * *',
        'every-3-hours': '0 */3 * * *',
        'every-4-hours': '0 */4 * * *',
        'every-6-hours': '0 */6 * * *',
        'every-8-hours': '0 */8 * * *',
        'every-12-hours': '0 */12 * * *',
        'daily': '0 0 * * *',
        'every-2-days': '0 0 */2 * *',
        'every-3-days': '0 0 */3 * *',
        'every-4-days': '0 0 */4 * *',
        'weekly': '0 0 * * 0',
        'disabled': null
    };
    
    return schedules[schedule] || '0 0 * * *';
}

// форматируем расписание для отображения
function formatSchedule(schedule) {
    const formatMap = {
        'every-10-minutes': 'Каждые 10 минут',
        'hourly': 'Каждый час',
        'every-2-hours': 'Каждые 2 часа',
        'every-3-hours': 'Каждые 3 часа',
        'every-4-hours': 'Каждые 4 часа',
        'every-6-hours': 'Каждые 6 часов',
        'every-8-hours': 'Каждые 8 часов',
        'every-12-hours': 'Каждые 12 часов',
        'daily': 'Ежедневно',
        'every-2-days': 'Каждые 2 дня',
        'every-3-days': 'Каждые 3 дня',
        'every-4-days': 'Каждые 4 дня',
        'weekly': 'Еженедельно',
        'disabled': 'Отключено'
    };
    
    return formatMap[schedule] || schedule;
}

// получаем следующее время запуска
function getNextRunTime(schedule) {
    if (schedule === 'disabled') return null;
    
    const cronExpression = getCronSchedule(schedule);
    if (!cronExpression) return null;
    
    const CronJob = require('cron').CronJob;
    try {
        const job = new CronJob(cronExpression);
        const nextDate = job.nextDate();
        return nextDate.toDate();
    } catch (err) {
        console.error('Error calculating next run time:', err);
        return null;
    }
}

module.exports = {
    getCronSchedule,
    formatSchedule,
    getNextRunTime
};