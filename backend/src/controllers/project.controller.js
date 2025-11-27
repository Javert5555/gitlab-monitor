// src/controllers/project.controller.js
const { Project, ScanResult } = require('../models/index.model');
const gitlab = require('../services/gitlabService');
const scanService = require('../services/scanService');

module.exports = {
  // GET /api/projects
  // Возвращает все проекты из БД, и поле latestRiskCount (из последнего scan_result)
  getProjectsList: async (req, res) => {
    try {
      const projects = await Project.findAll({ order: [['id', 'ASC']] });
      // Для каждого проекта получить последний scan_result.summary и посчитать риски
      const out = await Promise.all(projects.map(async p => {
        const last = await ScanResult.findOne({
          where: { projectId: p.id },
          order: [['scannedAt', 'DESC']]
        });
        const latestRiskCount = last?.summary?.totalRisks ?? 0;
        return {
          id: p.id,
          gitlabProjectId: p.gitlabProjectId,
          name: p.name,
          url: p.url,
          latestRiskCount,
          updatedAt: last ? last.scannedAt : null
        };
      }));
      res.json(out);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to list projects' });
    }
  },

  // helper: upsert projects list from GitLab
  syncProjectsFromGitlab: async () => {
    const external = await gitlab.getAllProjects();
    if (!Array.isArray(external)) return { added: 0, updated: 0, total: 0 };

    let added = 0, updated = 0;
    for (const p of external) {
      const [row, created] = await Project.upsert({
        gitlabProjectId: p.id,
        name: p.name,
        url: p.web_url,
        raw: p
      }, { returning: true });
      if (created) added++; else updated++;
    }
    return { added, updated, total: external.length };
  },

  // Full scan flow (used by cron and POST /api/scan/full)
  fullScan: async (req, res) => {
    try {
      // 1) sync projects
      const syncRes = await module.exports.syncProjectsFromGitlab();
      // 2) get all projects from DB
      const projects = await Project.findAll();
      // 3) scan each project and write ScanResult
      for (const p of projects) {
        const results = await scanService.scanProject(p);
        const summary = scanService.buildSummary(results);
        await ScanResult.create({
          projectId: p.id,
          results,
          summary,
          scannedAt: new Date()
        });
      }
      const reply = { ok: true, sync: syncRes, scanned: projects.length };
      if (res) return res.json(reply);
      return reply;
    } catch (err) {
      console.error('fullScan error:', err);
      if (res) return res.status(500).json({ error: 'Full scan failed' });
      throw err;
    }
  },

  // GET /api/projects/:projectId -> details from DB
  getProjectDetails: async (req, res) => {
    try {
      const id = req.params.projectId;
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const recentResults = await ScanResult.findAll({
        where: { projectId: project.id },
        order: [['scannedAt', 'DESC']],
        limit: 20
      });

      res.json({
        project: {
          id: project.id,
          gitlabProjectId: project.gitlabProjectId,
          name: project.name,
          url: project.url,
          raw: project.raw
        },
        scans: recentResults
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to get project details' });
    }
  }
};
