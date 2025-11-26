// check_SEC_1.js
module.exports = async function checkSEC1(projectId, gitlab) {
  const protectedBranches = await gitlab.getProtectedBranches(projectId);
  const branches = await gitlab.getBranches(projectId);
  const mergeRequests = await gitlab.getMergeRequests(projectId, "merged");
  const pipelines = await gitlab.getProjectPipelines(projectId);

  const results = [];

  // 1. Бесконтрольный деплой на прод
  const hasProtectedMain = protectedBranches.some(b => b.name === "main" || b.name === "master");

  results.push({
    item: "Защищена ли основная ветка (main/master)",
    status: hasProtectedMain ? "OK" : "FAIL",
    details: hasProtectedMain
      ? "Основная ветка защищена, действия разработчиков контролируются."
      : "Main/master не защищена — любой разработчик может деплоить на прод."
  });

  // 2. Могут ли разработчики пушить в production ветку
  const dangerousBranches = branches.filter(b =>
    ["prod", "production", "release"].includes(b.name)
  );

  results.push({
    item: "Наличие production-веток без защиты",
    status: dangerousBranches.length ? "FAIL" : "OK",
    details:
      dangerousBranches.length
        ? `Незащищённые prod-ветки: ${dangerousBranches.map(b => b.name).join(", ")}`
        : "Production-ветки защищены или отсутствуют."
  });

  // 3. MR без ревью
  const noReview = mergeRequests.filter(mr => mr.approvals_before_merge === 0);

  results.push({
    item: "MR без ревью",
    status: noReview.length > 0 ? "WARN" : "OK",
    details:
      noReview.length
        ? `${noReview.length} слияний выполнено без ревью`
        : "Все слияния проходят ревью."
  });

  // 4. Пайплайны без проверок
  const suspiciousPipelines = pipelines.filter(p => p.status === "success" && p.source === "push");

  results.push({
    item: "Запуск прод-пайплайна по push (без MR/Review)",
    status: suspiciousPipelines.length > 0 ? "WARN" : "OK",
    details:
      suspiciousPipelines.length
        ? "Прод-пайплайн можно запустить обычным пушем."
        : "Прод-пайплайн запускается корректно."
  });

  return {
    id: "CICD-SEC-1",
    name: "Недостаточные механизмы управления потоком",
    results
  };
};