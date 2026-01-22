const { Project, ScanResult } = require('../models/index.model');
const scanService = require('../services/scanService');
const emailService = require('../services/emailService');

module.exports = {
    scanOneProject: async (req, res) => {
        try {
            const id = req.params.projectId;
            const project = await Project.findByPk(id);
            if (!project) return res.status(404).json({ error: 'Project not found' });

            const results = await scanService.scanProject(project);
            const summary = scanService.buildSummary(results);

            const record = await ScanResult.create({
                projectId: project.id,
                results,
                summary,
                scannedAt: new Date()
            });
            
            // Отправляем email уведомление
            emailService.sendSingleProjectNotification(project, record)
                .catch(err => {
                    console.error('Ошибка при отправке email уведомления:', err);
                });

            res.json({ 
                ok: true, 
                projectId: project.id, 
                scanId: record.id, 
                summary,
                message: 'Scan completed. Email notification sent.'
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Scan failed' });
        }
    },

    // POST /api/scan/full ручной запуск полного сканирования
    triggerFullScan: async (req, res) => {
        const projectCtrl = require('./project.controller');
        return projectCtrl.fullScan(req, res);
    }
};