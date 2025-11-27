// src/routes/scan.routes.js
const router = require('express').Router();
const scanCtrl = require('../controllers/scan.controller');

// POST /api/scan/full  -> manual full scan
router.post('/full', scanCtrl.triggerFullScan);

// POST /api/scan/:projectId -> scan single project
router.post('/:projectId', scanCtrl.scanOneProject);

module.exports = router;
