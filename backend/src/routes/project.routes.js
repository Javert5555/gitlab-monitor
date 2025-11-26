const projectRouter = require('express').Router();
const projectCtrl = require('../controllers/project.controller');
const securityCtrl = require('../controllers/security.controller');


// Returns all projects with aggregated risk counts
projectRouter.get('/', projectCtrl.getProjectsWithRiskCounts);


// Returns full detail for a specific project
projectRouter.get('/:projectId', securityCtrl.getProjectSecurityDetails);


module.exports = projectRouter;