// src/controllers/schedule.controller.js
const cronManager = require('../config/cron');
const cronHelper = require('../utils/cronHelper');

module.exports = {
    // получить текущее расписание
    getSchedule: async (req, res) => {
        try {
            const currentSchedule = cronManager.getCurrentSchedule();
            const nextRun = cronHelper.getNextRunTime(currentSchedule);
            
            res.json({
                schedule: currentSchedule,
                formatted: cronHelper.formatSchedule(currentSchedule),
                nextRun: nextRun ? nextRun.toISOString() : null,
                nextRunFormatted: nextRun ? nextRun.toLocaleString('ru-RU') : null,
                availableSchedules: Object.keys(cronManager.SCHEDULES)
            });
        } catch (err) {
            console.error('Error getting schedule:', err);
            res.status(500).json({ error: 'Failed to get schedule' });
        }
    },
    
    // обновить расписание
    updateSchedule: async (req, res) => {
        try {
            const { schedule } = req.body;
            
            if (!schedule) {
                return res.status(400).json({ error: 'Schedule is required' });
            }
            
            // проверяем, что расписание доступно
            if (!cronManager.SCHEDULES[schedule] && schedule !== 'disabled') {
                return res.status(400).json({ 
                    error: 'Invalid schedule',
                    availableSchedules: Object.keys(cronManager.SCHEDULES)
                });
            }
            
            // обновляем расписание
            cronManager.updateSchedule(schedule);
            
            // получаем обновлённую информацию
            const nextRun = cronHelper.getNextRunTime(schedule);
            
            res.json({
                success: true,
                message: `Статус планирования обновлен: ${cronHelper.formatSchedule(schedule)}`,
                schedule: schedule,
                formatted: cronHelper.formatSchedule(schedule),
                nextRun: nextRun ? nextRun.toISOString() : null,
                nextRunFormatted: nextRun ? nextRun.toLocaleString('ru-RU') : null
            });
            
        } catch (err) {
            console.error('Error updating schedule:', err);
            res.status(500).json({ error: 'Failed to update schedule' });
        }
    },
    
    // получить все доступные расписания
    getAvailableSchedules: async (req, res) => {
        try {
            const schedules = Object.keys(cronManager.SCHEDULES).map(key => ({
                key,
                cron: cronManager.SCHEDULES[key],
                formatted: cronHelper.formatSchedule(key)
            }));
            
            res.json({ schedules });
        } catch (err) {
            console.error('Error getting available schedules:', err);
            res.status(500).json({ error: 'Failed to get schedules' });
        }
    }
};