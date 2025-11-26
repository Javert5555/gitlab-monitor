module.exports = async function checkSEC8(projectId, gitlab) {
  const hooks = await gitlab.getProjectHooks(projectId);

  const results = [];

  results.push({
    item: "Внешние интеграции / вебхуки",
    status: hooks.length ? "WARN" : "OK",
    details: hooks.length ? hooks.map(h => h.url).join(", ") : "Внешних вебхуков нет"
  });

  return {
    id: "CICD-SEC-8",
    name: "Неконтролируемое использование сторонних сервисов",
    results
  };
};