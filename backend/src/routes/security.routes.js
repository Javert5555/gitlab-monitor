const secRouter = require('express').Router();
const securityCtrl2 = require('../controllers/security.controller');


secRouter.get('/:projectId', securityCtrl2.getProjectSecurityDetails);


module.exports = secRouter; // for /api/projects and /api/projects/:projectId


// src/routes/project.routes.js
const router = require('express').Router();
const projectCtrl = require('../controllers/project.controller');
const securityCtrl = require('../controllers/security.controller');


// GET /api/projects — list with risk counts
router.get('/', projectCtrl.getProjectsWithRiskCounts);


// GET /api/projects/:projectId — detailed security results
router.get('/:projectId', securityCtrl.getProjectSecurityDetails);


module.exports = router;