module.exports = async function checkSEC4(projectId, gitlab) {
  const branches = await gitlab.getBranches(projectId);
  const protectedBranches = await gitlab.getProtectedBranches(projectId);
  const repoTree = await gitlab.getRepositoryTree(projectId);
  const variables = await gitlab.getProjectVariables(projectId);

  const results = [];

  // 1. Наличие защищённых веток для CI/CD файлов
  const ciFiles = [".gitlab-ci.yml", "Jenkinsfile"];
  const ciFilesExist = repoTree.filter(f => ciFiles.includes(f.name));

  results.push({
    item: "CI/CD конфигурационные файлы",
    status: ciFilesExist.length ? "OK" : "WARN",
    details: ciFilesExist.length
      ? "Файлы CI/CD найдены"
      : "Файлы CI/CD отсутствуют"
  });

  // 2. Защищённые ветки
  const unprotectedBranches = branches.filter(
    b => !protectedBranches.some(pb => pb.name === b.name)
  );

  results.push({
    item: "Незащищённые ветки",
    status: unprotectedBranches.length ? "WARN" : "OK",
    details: unprotectedBranches.length
      ? `Незащищённые ветки: ${unprotectedBranches.map(b => b.name).join(", ")}`
      : "Все ветки защищены"
  });

  // 3. Секреты проекта
  results.push({
    item: "Наличие переменных CI/CD (секреты)",
    status: variables.length ? "OK" : "WARN",
    details: variables.length ? variables.map(v => v.key).join(", ") : "Нет"
  });

  return {
    id: "CICD-SEC-4",
    name: "Poisoned Pipeline Execution",
    results
  };
};