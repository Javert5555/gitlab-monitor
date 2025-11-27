// src/routes/router.js
const express = require('express');
const router = express.Router();

router.use('/projects', require('./project.routes'));
router.use('/scan', require('./scan.routes'));

// auth/routes or other routes can be added as needed
module.exports = router;
