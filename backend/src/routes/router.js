const express = require('express');
const router = express.Router();

router.use('/projects', require('./project.routes'));
router.use('/scan', require('./scan.routes'));
router.use('/schedule', require('./schedule.routes'));

module.exports = router;
