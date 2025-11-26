module.exports = async function checkSEC6(projectId, gitlab) {
  const variables = await gitlab.getProjectVariables(projectId);

  const results = [];

  // Секреты в коде и слабые пароли
  const insecureVars = variables.filter(v => /password|token|secret/i.test(v.key));

  results.push({
    item: "Проверка секретов",
    status: insecureVars.length ? "WARN" : "OK",
    details: insecureVars.length
      ? `Возможные небезопасные переменные: ${insecureVars.map(v => v.key).join(", ")}`
      : "Нет явных проблем с секретами"
  });

  return {
    id: "CICD-SEC-6",
    name: "Недостаточная гигиена секретов",
    results
  };
};