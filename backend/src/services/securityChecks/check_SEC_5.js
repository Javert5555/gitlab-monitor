module.exports = async function checkSEC5(projectId, gitlab) {
  const runners = await gitlab.getProjectRunners(projectId);

  const results = [];

  // Проверка на привилегированные runner'ы
  const privileged = runners.filter(r => r.is_shared || r.tag_list.includes("privileged"));

  results.push({
    item: "Привилегированные Runner'ы",
    status: privileged.length ? "WARN" : "OK",
    details: privileged.length
      ? `Найдены привилегированные Runner'ы: ${privileged.map(r => r.description).join(", ")}`
      : "Все Runner'ы корректны"
  });

  return {
    id: "CICD-SEC-5",
    name: "Недостаточный контроль доступа конвейера",
    results
  };
};