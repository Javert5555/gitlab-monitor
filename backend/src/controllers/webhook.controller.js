const { Project, ScanResult } = require('../models/index.model');
const scanService = require('../services/scanService');
const emailService = require('../services/emailService');

module.exports = {
  handleGitLabWebhook: async (req, res) => {
    try {
      const eventType = req.headers['x-gitlab-event'];
      const eventObject = req.body?.object_kind || req.body?.event_name || 'unknown';
      const projectId = req.body?.project?.id || req.body?.project_id;
      
      if (!projectId) {
        return res.status(400).json({ 
          error: 'Project ID not found in webhook payload' 
        });
      }

      console.log(`GitLab webhook received: ${eventType}/${eventObject} for project ${projectId}`);

      const project = await Project.findOne({ 
        where: { gitlabProjectId: projectId } 
      });

      if (!project) {
        const gitlab = require('../services/gitlabService');
        const projectDetails = await gitlab.getProjectDetails(projectId);
        
        if (!projectDetails) {
          return res.status(404).json({ 
            error: `Project ${projectId} not found in GitLab or database` 
          });
        }

        const newProject = await Project.create({
          gitlabProjectId: projectId,
          name: projectDetails.name || `Project ${projectId}`,
          url: projectDetails.web_url || projectDetails.http_url_to_repo,
          raw: projectDetails
        });

        await processProjectScan(newProject, res);
      } else {
        await processProjectScan(project, res);
      }

    } catch (error) {
      console.error('Webhook processing error:', error);
      if (res.headersSent) return;
      res.status(500).json({ 
        error: 'Webhook processing failed', 
        details: error.message 
      });
    }
  }
};

async function processProjectScan(project, res) {
  try {
    const results = await scanService.scanProject(project);
    const summary = scanService.buildSummary(results);
    
    const scanRecord = await ScanResult.create({
      projectId: project.id,
      results,
      summary,
      scannedAt: new Date(),
      triggeredBy: 'webhook'
    });

    const scanResult = scanRecord.toJSON();
    await emailService.sendSingleProjectNotification(project, scanResult);
    
    res.json({
      ok: true,
      message: `Scan initiated for project ${project.name}`,
      projectId: project.gitlabProjectId,
      scanId: scanRecord.id,
      timestamp: new Date().toISOString()
    });

  } catch (scanError) {
    console.error(`Scan failed for project ${project.gitlabProjectId}:`, scanError);
    throw scanError;
  }
}