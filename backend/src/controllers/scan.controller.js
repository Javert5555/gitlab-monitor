const { ScanResult, Project } = require('../models/index.model');
const scanService = require('../services/scanService');

module.exports = {
  scanProject: async (req, res) => {
    const { projectId } = req.params;

    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const result = await scanService.scanProject(project);

    await ScanResult.create({
      projectId,
      results: result,
      summary: scanService.buildSummary(result)
    });

    res.json(result);
  },

  getScanHistory: async (req, res) => {
    const { projectId } = req.params;
    const items = await ScanResult.findAll({
      where: { projectId },
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    res.json(items);
  }
};