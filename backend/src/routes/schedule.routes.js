const router = require('express').Router();
const scheduleCtrl = require('../controllers/schedule.controller');

// GET /api/schedule получить текущее расписание
router.get('/', scheduleCtrl.getSchedule);

// POST /api/schedule обновить расписание
router.post('/', scheduleCtrl.updateSchedule);

// GET /api/schedule/available получить все доступные расписания
router.get('/available', scheduleCtrl.getAvailableSchedules);

module.exports = router;