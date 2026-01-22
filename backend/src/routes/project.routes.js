const router = require('express').Router();
const projectCtrl = require('../controllers/project.controller');

// GET /api/projects список из БД
router.get('/', projectCtrl.getProjectsList);

// GET /api/projects/:projectId детали из БД
router.get('/:projectId', projectCtrl.getProjectDetails);

module.exports = router;
