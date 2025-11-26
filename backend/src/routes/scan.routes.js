const router = require('express').Router();
const ctrl = require('../controllers/scan.controller');

router.post('/:projectId', ctrl.scanProject);
router.get('/:projectId/history', ctrl.getScanHistory);

module.exports = router;