const { Project, ScanResult } = require('../models/index.model');
const gitlab = require('../services/gitlabService');
const scanService = require('../services/scanService');
const emailService = require('../services/emailService');

module.exports = {
    // GET /api/projects
    getProjectsList: async (req, res) => {
        try {
            const projects = await Project.findAll({ order: [['id', 'ASC']] });
            
            const out = await Promise.all(projects.map(async p => {
                const last = await ScanResult.findOne({
                    where: { projectId: p.id },
                    order: [['scannedAt', 'DESC']]
                });
                const latestRiskCount = last?.summary?.totalRisks ?? 0;
                return {
                    id: p.id,
                    gitLabProjectId: p.gitLabProjectId,
                    name: p.name,
                    url: p.url,
                    latestRiskCount,
                    latestScanSummary: last?.summary, // Добавляем сводку
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
    syncProjectsFromGitLab: async () => {
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
            const syncRes = await module.exports.syncProjectsFromGitLab();
            
            // 2) get all projects from DB
            const projects = await Project.findAll();
            
            // 3) scan each project and write ScanResult
            const scanResults = [];
            
            for (const p of projects) {
                const results = await scanService.scanProject(p);
                const summary = scanService.buildSummary(results);
                
                const scanRecord = await ScanResult.create({
                    projectId: p.id,
                    results,
                    summary,
                    scannedAt: new Date()
                });
                
                scanResults.push({
                    project: p,
                    scanResult: scanRecord
                });
            }
            
            // 4) Получаем актуальные данные для email уведомления
            const projectsWithScans = await Promise.all(projects.map(async p => {
                const lastScan = await ScanResult.findOne({
                    where: { projectId: p.id },
                    order: [['scannedAt', 'DESC']]
                });
                return {
                    ...p.toJSON(),
                    scans: lastScan ? [lastScan] : []
                };
            }));
            
            // 5) Отправляем email уведомление (асинхронно, не блокируем ответ)
            emailService.sendFullScanNotification(projectsWithScans, {
                totalProjects: projects.length,
                scannedAt: new Date()
            }).catch(err => {
                console.error('Ошибка при отправке email уведомления:', err);
            });
            
            const reply = { 
                ok: true, 
                sync: syncRes, 
                scanned: projects.length,
                message: 'Full scan completed. Email notification sent.'
            };
            
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
                    gitLabProjectId: project.gitLabProjectId,
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