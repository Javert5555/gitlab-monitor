module.exports = async function checkSEC7(projectId, gitlab) {
  const runners = await gitlab.getProjectRunners(projectId);

  const results = [];

  const shared = runners.filter(r => r.is_shared);

  results.push({
    item: "Shared Runner'ы (может быть небезопасно)",
    status: shared.length ? "WARN" : "OK",
    details: shared.length ? shared.map(r => r.description).join(", ") : "Все Runner'ы приватные"
  });

  return {
    id: "CICD-SEC-7",
    name: "Небезопасная конфигурация",
    results
  };
};