// src/routes/project.routes.js
const router = require('express').Router();
const projectCtrl = require('../controllers/project.controller');

// GET /api/projects  => list from DB
router.get('/', projectCtrl.getProjectsList);

// GET /api/projects/:projectId => details from DB
router.get('/:projectId', projectCtrl.getProjectDetails);

module.exports = router;
