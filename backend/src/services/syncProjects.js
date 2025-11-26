const gitlab = require('./gitlabService');
const { Project } = require('../models/index.model');

module.exports = async function syncProjects() {
  console.log("🔄 Синхронизация проектов GitLab...");

  const gitlabProjects = await gitlab.getAllProjects();

  for (const p of gitlabProjects) {
    const exist = await Project.findOne({ where: { gitlabProjectId: p.id } });

    if (!exist) {
      await Project.create({
        gitlabProjectId: p.id,
        name: p.name,
        url: p.web_url
      });

      console.log(`➕ Добавлен проект: ${p.name}`);
    }
  }

  console.log("✅ Синхронизация проектов завершена");
};
