const express = require('express');
const router = express.Router();


router.use('/auth', require('./auth.routes'));
router.use('/projects', require('./project.routes'));
router.use('/security', require('./security.routes'));


module.exports = router;