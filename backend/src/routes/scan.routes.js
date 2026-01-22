const router = require('express').Router();
const scanCtrl = require('../controllers/scan.controller');

// POST /api/scan/full ручной запуск сканирования
router.post('/full', scanCtrl.triggerFullScan);

// POST /api/scan/:projectId скинирование одного проекта
router.post('/:projectId', scanCtrl.scanOneProject);

module.exports = router;
