module.exports = async function checkSEC3(projectId, gitlab) {
  const repoTree = await gitlab.getRepositoryTree(projectId);
  const packageFiles = repoTree.filter(f =>
    ["package.json", "requirements.txt", "go.mod"].includes(f.name)
  );

  const results = [];

  results.push({
    item: "Наличие файлов зависимостей",
    status: packageFiles.length ? "OK" : "WARN",
    details: packageFiles.length ? packageFiles.map(f => f.name).join(", ") : "Файлы зависимостей не обнаружены"
  });

  results.push({
    item: "Использование публичных репозиториев зависимостей",
    status: "WARN",
    details: "Получить невозможно без локального SCA, выставляем WARN"
  });

  return {
    id: "CICD-SEC-3",
    name: "Злоупотребление цепочкой зависимостей",
    results
  };
};