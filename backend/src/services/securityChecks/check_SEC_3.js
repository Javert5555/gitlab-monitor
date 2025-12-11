// module.exports = async function checkSEC3(projectId, gitlab) {
//   const repoTree = await gitlab.getRepositoryTree(projectId);
//   const packageFiles = repoTree.filter(f =>
//     ["package.json", "requirements.txt", "go.mod"].includes(f.name)
//   );

//   const results = [];

//   results.push({
//     item: "Наличие файлов зависимостей",
//     status: packageFiles.length ? "OK" : "WARN",
//     details: packageFiles.length ? packageFiles.map(f => f.name).join(", ") : "Файлы зависимостей не обнаружены"
//   });

//   results.push({
//     item: "Использование публичных репозиториев зависимостей",
//     status: "WARN",
//     details: "Получить невозможно без локального SCA, выставляем WARN"
//   });

//   return {
//     id: "CICD-SEC-3",
//     name: "Злоупотребление цепочкой зависимостей",
//     results
//   };
// };

const axios = require('axios');

module.exports = async function checkSEC3(projectId, project, gitlab) {
  // const repoTree = await gitlab.getRepositoryTree(projectId, { recursive: true });
  // const gitlabCIRaw = await gitlab.getGitLabCIFile(projectId);

  const {
    repoTree,
    gitlabCIRaw,
  } = project



  const results = [];
  
  try {
    // 1. Проверяем наличие файлов зависимостей
    
    const dependencyFiles = {
      'package.json': { manager: 'npm', found: false },
      'package-lock.json': { manager: 'npm', found: false },
      'yarn.lock': { manager: 'yarn', found: false },
      'requirements.txt': { manager: 'pip', found: false },
      'Pipfile': { manager: 'pipenv', found: false },
      'Pipfile.lock': { manager: 'pipenv', found: false },
      'go.mod': { manager: 'go', found: false },
      'go.sum': { manager: 'go', found: false },
      'Gemfile': { manager: 'rubygems', found: false },
      'Gemfile.lock': { manager: 'rubygems', found: false },
      'pom.xml': { manager: 'maven', found: false },
      'build.gradle': { manager: 'gradle', found: false },
      'build.gradle.kts': { manager: 'gradle', found: false },
      'Cargo.toml': { manager: 'cargo', found: false },
      'Cargo.lock': { manager: 'cargo', found: false },
      'composer.json': { manager: 'composer', found: false },
      'composer.lock': { manager: 'composer', found: false }
    };
    
    const foundFiles = [];
    
    for (const file of repoTree) {
      if (dependencyFiles[file.name]) {
        dependencyFiles[file.name].found = true;
        foundFiles.push(file.name);
      }
    }
    
    results.push({
      item: "Файлы зависимостей",
      status: foundFiles.length > 0 ? "OK" : "INFO",
      details: foundFiles.length > 0
        ? `Обнаружены файлы зависимостей: ${foundFiles.join(', ')}`
        : "Файлы зависимостей не обнаружены. Если проект использует зависимости, убедитесь, что они задокументированы.",
      severity: "low"
    });
    
    // 2. Проверяем наличие lock-файлов
    const lockFiles = ['package-lock.json', 'yarn.lock', 'Pipfile.lock', 'Gemfile.lock', 'Cargo.lock', 'composer.lock', 'go.sum'];
    const hasLockFiles = lockFiles.some(file => dependencyFiles[file]?.found);
    
    results.push({
      item: "Lock-файлы для фиксации версий",
      status: hasLockFiles ? "OK" : "WARN",
      details: hasLockFiles
        ? "Обнаружены lock-файлы, что помогает предотвратить dependency confusion атаки."
        : "Lock-файлы не обнаружены. Рекомендуется использовать lock-файлы для фиксации версий зависимостей.",
      severity: "medium"
    });
    
    // 3. Анализируем package.json если он есть
    if (dependencyFiles['package.json'].found) {
      try {
        // const packageJsonContent = await gitlab.getRawFile(projectId, 'package.json');
        // const packageJson = JSON.parse(packageJsonContent);
        const packageJson = await gitlab.getRawFile(projectId, 'package.json');
        
        // console.log('packageJsonContent', packageJsonContent)
        console.log('packageJson', packageJson)

        // Проверка на использование публичных реестров
        const registries = [];
        
        // Проверка .npmrc
        const hasNpmrc = repoTree.some(file => file.name === '.npmrc');
        if (hasNpmrc) {
          try {
            const npmrcContent = await gitlab.getRawFile(projectId, '.npmrc');
            if (npmrcContent.includes('registry=')) {
              const registryMatch = npmrcContent.match(/registry=(https?:\/\/[^\s]+)/);
              if (registryMatch) {
                registries.push(`npm: ${registryMatch[1]}`);
              }
            }
          } catch (e) {
            // .npmrc не найден или ошибка чтения
          }
        }
        
        // Проверка зависимостей с версиями
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {})
        };
        
        const depsWithVersions = Object.entries(allDeps).map(([name, version]) => ({
          name,
          version,
          hasExactVersion: !version.includes('^') && !version.includes('~') && !version.includes('>') && !version.includes('<'),
          isGitUrl: version.includes('git+') || version.startsWith('git://') || version.startsWith('git+ssh://'),
          isFileUrl: version.startsWith('file:'),
          isPrivateRegistry: version.includes('@') && version.includes('/') && !version.startsWith('@')
        }));
        
        const exactVersionDeps = depsWithVersions.filter(dep => dep.hasExactVersion);
        const gitDeps = depsWithVersions.filter(dep => dep.isGitUrl);
        const fileDeps = depsWithVersions.filter(dep => dep.isFileUrl);
        
        results.push({
          item: "Анализ зависимостей npm",
          status: "INFO",
          details: `Всего зависимостей: ${depsWithVersions.length}. Точные версии: ${exactVersionDeps.length}. Git-зависимости: ${gitDeps.length}. Локальные зависимости: ${fileDeps.length}.`,
          severity: "low"
        });
        
        // Проверка на использование git-зависимостей (более безопасно)
        if (gitDeps.length > 0) {
          results.push({
            item: "Git-зависимости",
            status: "OK",
            details: `Используются git-зависимости (${gitDeps.length}), что снижает риск dependency confusion.`,
            severity: "low"
          });
        }
        
        // Проверка на использование wildcard версий
        const wildcardVersions = depsWithVersions.filter(dep => 
          dep.version === '*' || 
          dep.version === 'latest' ||
          dep.version.includes('x') ||
          dep.version === ''
        );
        
        if (wildcardVersions.length > 0) {
          results.push({
            item: "Wildcard версии зависимостей",
            status: "FAIL",
            details: `Обнаружены зависимости с wildcard версиями: ${wildcardVersions.map(d => d.name).join(', ')}. Это опасно для dependency confusion атак.`,
            severity: "high"
          });
        }
        
      } catch (error) {
        results.push({
          item: "Анализ package.json",
          status: "WARN",
          details: `Не удалось проанализировать package.json: ${error.message}`,
          severity: "low"
        });
      }
    }
    
    // 4. Проверяем наличие CI-конфигураций для сканирования зависимостей
    const ciConfigs = repoTree.filter(file => 
      file.name === '.gitlab-ci.yml' || 
      file.name === '.github/workflows/' || 
      file.name.includes('Jenkinsfile')
    );
    
    if (ciConfigs.length > 0) {
      // Проверяем наличие стадий сканирования зависимостей
      try {
        const hasDependencyCheck = gitlabCIRaw.includes('dependency') || 
                                   gitlabCIRaw.includes('snyk') || 
                                   gitlabCIRaw.includes('trivy') || 
                                   gitlabCIRaw.includes('owasp') ||
                                   gitlabCIRaw.includes('scan') && gitlabCIRaw.includes('dependencies');
        
        results.push({
          item: "Сканирование зависимостей в CI/CD",
          status: hasDependencyCheck ? "OK" : "WARN",
          details: hasDependencyCheck
            ? "В CI/CD настроено сканирование зависимостей."
            : "В CI/CD не обнаружено сканирование зависимостей. Рекомендуется добавить этап security scanning.",
          severity: "medium"
        });
      } catch (error) {
        // Не удалось прочитать CI-конфиг
      }
    }
    
    // 5. Проверка на использование внутренних реестров
    const internalRegistryPatterns = [
      'nexus.internal',
      'artifactory.internal',
      'registry.internal',
      'packages.company.com',
      'npm.private',
      'pypi.private'
    ];
    
    let hasInternalRegistry = false;
    for (const file of repoTree) {
      if (file.name === '.npmrc' || file.name === '.pypirc' || file.name === '.yarnrc') {
        try {
          const content = await gitlab.getRawFile(projectId, file.name);
          if (internalRegistryPatterns.some(pattern => content.includes(pattern))) {
            hasInternalRegistry = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    results.push({
      item: "Использование внутренних реестров",
      status: hasInternalRegistry ? "OK" : "WARN",
      details: hasInternalRegistry
        ? "Обнаружено использование внутреннего реестра пакетов, что снижает риск dependency confusion."
        : "Не обнаружено использование внутреннего реестра пакетов. Рекомендуется настроить proxy-реестр.",
      severity: "medium"
    });
    
    // 6. Проверка Dockerfile на сканирование образов
    const dockerFiles = repoTree.filter(file => file.name === 'Dockerfile' || file.name.endsWith('.Dockerfile'));
    
    if (dockerFiles.length > 0) {
      results.push({
        item: "Docker образы",
        status: "INFO",
        details: `Обнаружено ${dockerFiles.length} Dockerfile. Рекомендуется добавить сканирование образов на уязвимости в CI/CD.`,
        severity: "low"
      });
    }
    
  } catch (error) {
    console.error(`Error in SEC-3 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка цепочки зависимостей",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }
  
  return {
    id: "CICD-SEC-3",
    name: "Злоупотребление цепочкой зависимостей",
    results
  };
};