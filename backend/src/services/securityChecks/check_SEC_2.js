module.exports = async function checkSEC2(projectId, gitlab) {
  const members = await gitlab.getProjectMembers(projectId);

  const results = [];

  // 1. Избыточные права
  const dangerousRoles = members.filter(m => m.access_level >= 40); // Maintainer/Owner

  results.push({
    item: "Пользователи с правами Maintainer/Owner",
    status: dangerousRoles.length > 2 ? "WARN" : "OK",
    details: dangerousRoles.map(u => u.username).join(", ") || "Нет избыточных ролей"
  });

  // 2. Общие аккаунты
  const shared = members.filter(u => u.username.includes("service") || u.username.includes("shared"));

  results.push({
    item: "Наличие общих/технических аккаунтов",
    status: shared.length ? "WARN" : "OK",
    details: shared.length ? shared.map(s => s.username).join(", ") : "Нет"
  });

  // 3. Заброшенные аккаунты
  const stale = members.filter(u => !u.last_login);

  results.push({
    item: "Заброшенные аккаунты",
    status: stale.length ? "WARN" : "OK",
    details: stale.length ? stale.map(s => s.username).join(", ") : "Нет"
  });

  return {
    id: "CICD-SEC-2",
    name: "Неадекватное управление IAM",
    results
  };
};