module.exports = async function checkSEC10(projectId, gitlab) {
  const pipelines = await gitlab.getProjectPipelines(projectId);

  const results = [];

  results.push({
    item: "Логирование критичных событий",
    status: pipelines.length ? "WARN" : "OK",
    details: "Проверка логирования на продакшн пайплайнах вручную"
  });

  return {
    id: "CICD-SEC-10",
    name: "Недостаточное логирование и мониторинг",
    results
  };
};