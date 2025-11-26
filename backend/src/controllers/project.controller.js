const { Project } = require("../models/index.model");
const checks = require("../services/securityChecks");
const gitlab = require("../services/gitlabService");

module.exports = {
  // Returns list of projects + aggregated risk count
  getProjectsWithRiskCounts: async (req, res) => {
    try {
      const projects = await Project.findAll();
      const results = [];

      for (const project of projects) {
        let riskCount = 0;

        const sec1 = await checks.checkSEC1(project.gitlabProjectId, gitlab);
        const sec2 = await checks.checkSEC2(project.gitlabProjectId, gitlab);
        const sec3 = await checks.checkSEC3(project.gitlabProjectId, gitlab);
        const sec4 = await checks.checkSEC4(project.gitlabProjectId, gitlab);
        const sec5 = await checks.checkSEC5(project.gitlabProjectId, gitlab);
        const sec6 = await checks.checkSEC6(project.gitlabProjectId, gitlab);
        const sec7 = await checks.checkSEC7(project.gitlabProjectId, gitlab);
        const sec8 = await checks.checkSEC8(project.gitlabProjectId, gitlab);
        const sec9 = await checks.checkSEC9(project.gitlabProjectId, gitlab);
        const sec10 = await checks.checkSEC10(project.gitlabProjectId, gitlab);

        const all = [
          sec1,
          sec2,
          sec3,
          sec4,
          sec5,
          sec6,
          sec7,
          sec8,
          sec9,
          sec10,
        ];

        all.forEach((sec) => {
          sec.results.forEach((r) => {
            if (r.status === "WARN" || r.status === "FAIL") riskCount++;
          });
        });

        results.push({
          id: project.id,
          gitlabProjectId: project.gitlabProjectId,
          name: project.name,
          url: project.url,
          riskCount,
        });
      }

      res.json(results);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Unable to fetch projects" });
    }
  },
};
