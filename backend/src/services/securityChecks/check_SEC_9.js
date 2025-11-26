module.exports = async function checkSEC9(projectId, gitlab) {
  const pipelines = await gitlab.getProjectPipelines(projectId);

  const results = [];

  results.push({
    item: "Проверка целостности артефактов",
    status: pipelines.length ? "WARN" : "OK",
    details: "Для проверки целостности артефактов требуется SCA/CI scan, выставляем WARN"
  });

  return {
    id: "CICD-SEC-9",
    name: "Некорректная валидация артефактов",
    results
  };
};