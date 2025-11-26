const checks2 = require("../services/securityChecks");
const gitlab2 = require("../services/gitlabService");
const { Project: Project2 } = require("../models/index.model");

module.exports = {
  // Returns full security details per project
  getProjectSecurityDetails: async (req, res) => {
    const { projectId } = req.params;

    try {
      const project = await Project2.findByPk(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const sec1 = await checks2.checkSEC1(project.gitlabProjectId, gitlab2);
      const sec2 = await checks2.checkSEC2(project.gitlabProjectId, gitlab2);
      const sec3 = await checks2.checkSEC3(project.gitlabProjectId, gitlab2);
      const sec4 = await checks2.checkSEC4(project.gitlabProjectId, gitlab2);
      const sec5 = await checks2.checkSEC5(project.gitlabProjectId, gitlab2);
      const sec6 = await checks2.checkSEC6(project.gitlabProjectId, gitlab2);
      const sec7 = await checks2.checkSEC7(project.gitlabProjectId, gitlab2);
      const sec8 = await checks2.checkSEC8(project.gitlabProjectId, gitlab2);
      const sec9 = await checks2.checkSEC9(project.gitlabProjectId, gitlab2);
      const sec10 = await checks2.checkSEC10(project.gitlabProjectId, gitlab2);

      res.json({
        project: {
          id: project.id,
          gitlabProjectId: project.gitlabProjectId,
          name: project.name,
          url: project.url,
        },
        security: [sec1, sec2, sec3, sec4, sec5, sec6, sec7, sec8, sec9, sec10],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Unable to run security checks" });
    }
  },
};
