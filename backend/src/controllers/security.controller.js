const { Project, ScanResult } = require('../models/index.model');

/**
 * GET /api/projects/:projectId
 * Return project info + latest scan_result (from DB only)
 */
module.exports = {
  getProjectSecurityDetails: async (req, res) => {
    const { projectId } = req.params;
    try {
      const project = await Project.findByPk(projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const latest = await ScanResult.findOne({
        where: { projectId: project.id },
        order: [['createdAt', 'DESC']]
      });

      res.json({
        project: {
          id: project.id,
          gitlabProjectId: project.gitlabProjectId,
          name: project.name,
          url: project.url
        },
        lastScan: latest ? {
          id: latest.id,
          createdAt: latest.createdAt,
          results: latest.results,
          summary: latest.summary
        } : null
      });
    } catch (err) {
      console.error('getProjectSecurityDetails error:', err);
      res.status(500).json({ error: 'Unable to fetch details' });
    }
  }
};
