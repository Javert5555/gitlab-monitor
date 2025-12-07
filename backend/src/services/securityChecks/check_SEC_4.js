// module.exports = async function checkSEC4(projectId, gitlab) {
//   const branches = await gitlab.getBranches(projectId);
//   const protectedBranches = await gitlab.getProtectedBranches(projectId);
//   const repoTree = await gitlab.getRepositoryTree(projectId);
//   const variables = await gitlab.getProjectVariables(projectId);

//   const results = [];

//   // 1. Наличие защищённых веток для CI/CD файлов
//   const ciFiles = [".gitlab-ci.yml", "Jenkinsfile"];
//   const ciFilesExist = repoTree.filter(f => ciFiles.includes(f.name));

//   results.push({
//     item: "CI/CD конфигурационные файлы",
//     status: ciFilesExist.length ? "OK" : "WARN",
//     details: ciFilesExist.length
//       ? "Файлы CI/CD найдены"
//       : "Файлы CI/CD отсутствуют"
//   });

//   // 2. Защищённые ветки
//   const unprotectedBranches = branches.filter(
//     b => !protectedBranches.some(pb => pb.name === b.name)
//   );

//   results.push({
//     item: "Незащищённые ветки",
//     status: unprotectedBranches.length ? "WARN" : "OK",
//     details: unprotectedBranches.length
//       ? `Незащищённые ветки: ${unprotectedBranches.map(b => b.name).join(", ")}`
//       : "Все ветки защищены"
//   });

//   // 3. Секреты проекта
//   results.push({
//     item: "Наличие переменных CI/CD (секреты)",
//     status: variables.length ? "OK" : "WARN",
//     details: variables.length ? variables.map(v => v.key).join(", ") : "Нет"
//   });

//   return {
//     id: "CICD-SEC-4",
//     name: "Poisoned Pipeline Execution",
//     results
//   };
// };

module.exports = async function checkSEC4(projectId, gitlab) {
  const results = [];
  
  try {
    // 1. Проверка наличия CI/CD конфигурационных файлов
    const repoTree = await gitlab.getRepositoryTree(projectId, { recursive: true });
    const ciConfigs = repoTree.filter(file => 
      file.name === '.gitlab-ci.yml' ||
      file.name === '.github/workflows/' ||
      file.name === 'Jenkinsfile' ||
      file.name.includes('azure-pipelines.yml') ||
      file.name.includes('circle.yml')
    );
    
    const hasCiConfigs = ciConfigs.length > 0;
    
    results.push({
      item: "CI/CD конфигурационные файлы",
      status: hasCiConfigs ? "OK" : "INFO",
      details: hasCiConfigs
        ? `Обнаружены CI/CD конфигурации: ${ciConfigs.map(f => f.name).join(', ')}`
        : "CI/CD конфигурации не обнаружены.",
      severity: "low"
    });
    
    // Если CI/CD конфигураций нет - пропускаем остальные проверки
    if (!hasCiConfigs) {
      return {
        id: "CICD-SEC-4",
        name: "Poisoned Pipeline Execution (PPE)",
        results
      };
    }
    
    // 2. Проверка защиты веток с CI/CD файлами (только если есть конфигурации)
    const branches = await gitlab.getBranches(projectId);
    const protectedBranches = await gitlab.getProtectedBranches(projectId);
    
    // Основные ветки, которые должны быть защищены
    const mainBranches = branches.filter(b => 
      b.name === 'main' || b.name === 'master' || b.name === 'develop'
    );
    
    const unprotectedMainBranches = mainBranches.filter(branch => {
      const protectedBranch = protectedBranches.find(pb => pb.name === branch.name);
      return !protectedBranch || 
             (protectedBranch.push_access_levels && 
              protectedBranch.push_access_levels.some(access => access.access_level <= 30)); // Developer can push
    });
    
    if (unprotectedMainBranches.length > 0) {
      results.push({
        item: "Защита основных веток",
        status: "FAIL",
        details: `Основные ветки не защищены или разработчики могут в них пушить: ${unprotectedMainBranches.map(b => b.name).join(', ')}`,
        severity: "critical"
      });
    }
    
    // 3. Анализ .gitlab-ci.yml на опасные паттерны (только если есть конфигурации)
    try {
      const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
      
      if (gitlabCI) {
        const lines = gitlabCI.split('\n');
        
        // Опасные паттерны
        const dangerousPatterns = [
          { pattern: /curl.*(http|https):\/\//i, description: "Прямая загрузка скриптов из интернета" },
          { pattern: /wget.*(http|https):\/\//i, description: "Прямая загрузка файлов из интернета" },
          { pattern: /bash.*<(curl|wget)/i, description: "Исполнение скриптов напрямую из интернета" },
          { pattern: /chmod\s+[0-9]{3,4}\s+.*\.(sh|py|js)/i, description: "Изменение прав на исполняемые файлы" },
          { pattern: /eval\s+.*(`|\$\().*(curl|wget)/i, description: "Динамическое исполнение загруженного кода" },
          { pattern: /secret.*=.*["'].*["']/i, description: "Хардкод секретов в конфигурации" },
          { pattern: /password.*=.*["'].*["']/i, description: "Хардкод паролей в конфигурации" },
          { pattern: /token.*=.*["'].*["']/i, description: "Хардкод токенов в конфигурации" }
        ];
        
        const foundPatterns = [];
        
        lines.forEach((line, index) => {
          dangerousPatterns.forEach(pattern => {
            if (pattern.pattern.test(line)) {
              foundPatterns.push({
                line: index + 1,
                pattern: pattern.description,
                content: line.trim()
              });
            }
          });
        });
        
        if (foundPatterns.length > 0) {
          results.push({
            item: "Опасные паттерны в CI/CD конфигурации",
            status: "FAIL",
            details: `Обнаружены опасные паттерны:\n${foundPatterns.map(p => `Строка ${p.line}: ${p.pattern} - "${p.content}"`).join('\n')}`,
            severity: "high"
          });
        }
        
        // 4. Проверка на использование include с внешними источниками
        const externalIncludes = lines.filter(line => 
          line.includes('include:') && 
          (line.includes('http://') || line.includes('https://') || line.includes('git@'))
        );
        
        if (externalIncludes.length > 0) {
          results.push({
            item: "Внешние include в CI/CD",
            status: "WARN",
            details: `Обнаружены include из внешних источников. Это может быть вектором PPE атаки.`,
            severity: "high"
          });
        }
        
        // 5. Проверка на использование динамических переменных в опасных контекстах
        const dynamicScriptPattern = /\$\{?[A-Z_][A-Z0-9_]*\}?\s*[|&]\s*(bash|sh|python)/i;
        const hasDynamicScript = lines.some(line => dynamicScriptPattern.test(line));
        
        if (hasDynamicScript) {
          results.push({
            item: "Динамическое исполнение скриптов",
            status: "WARN",
            details: "Обнаружено динамическое исполнение скриптов с использованием переменных окружения.",
            severity: "medium"
          });
        }
        
        // 10. Проверка использования внешних сервисов в CI/CD
        const externalServices = [];
        
        // Проверка на наличие популярных внешних сервисов в конфигурации
        const externalServicePatterns = [
          { pattern: /snyk/i, name: "Snyk" },
          { pattern: /sonarqube/i, name: "SonarQube" },
          { pattern: /jenkins/i, name: "Jenkins" },
          { pattern: /circleci/i, name: "CircleCI" },
          { pattern: /travis/i, name: "Travis CI" },
          { pattern: /aws/i, name: "AWS" },
          { pattern: /azure/i, name: "Azure" },
          { pattern: /gcp|google/i, name: "Google Cloud" }
        ];
        
        externalServicePatterns.forEach(service => {
          if (service.pattern.test(gitlabCI)) {
            externalServices.push(service.name);
          }
        });
        
        if (externalServices.length > 0) {
          results.push({
            item: "Внешние сервисы в CI/CD",
            status: "INFO",
            details: `Обнаружены ссылки на внешние сервисы: ${externalServices.join(', ')}. Убедитесь в безопасности интеграций.`,
            severity: "low"
          });
        }
      }
    } catch (error) {
      // .gitlab-ci.yml не найден или ошибка чтения
      results.push({
        item: "Анализ CI/CD конфигурации",
        status: "WARN",
        details: `Не удалось проанализировать CI/CD конфигурацию: ${error.message}`,
        severity: "low"
      });
    }
    
    // 6. Проверка переменных окружения проекта (только если есть CI/CD)
    const variables = await gitlab.getProjectVariables(projectId);
    
    // Переменные с типом "file" могут содержать секреты
    const fileVariables = variables.filter(v => v.variable_type === 'file');
    
    if (fileVariables.length > 0) {
      results.push({
        item: "Файловые переменные окружения",
        status: "INFO",
        details: `Обнаружено ${fileVariables.length} файловых переменных. Убедитесь, что они защищены.`,
        severity: "low"
      });
    }
    
    // 7. Проверка на использование непроверенных артефактов (только если есть CI/CD)
    const pipelines = await gitlab.getProjectPipelines(projectId, { per_page: 10 });
    
    if (pipelines.length > 0) {
      // Анализируем последние пайплайны
      const recentPipelines = pipelines.slice(0, 5);
      let hasExternalArtifacts = false;
      
      for (const pipeline of recentPipelines) {
        try {
          const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
          const externalJob = jobs.find(job => 
            job.name && (
              job.name.includes('download') ||
              job.name.includes('external') ||
              job.name.includes('fetch')
            )
          );
          
          if (externalJob) {
            hasExternalArtifacts = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (hasExternalArtifacts) {
        results.push({
          item: "Использование внешних артефактов",
          status: "WARN",
          details: "Обнаружены джобы, загружающие артефакты из внешних источников.",
          severity: "medium"
        });
      }
    }
    
    // 8. Проверка раннеров (только если есть CI/CD конфигурации)
    const runners = await gitlab.getProjectRunners(projectId);
    const sharedRunners = runners.filter(r => r.is_shared);
    
    if (sharedRunners.length > 0) {
      results.push({
        item: "Shared runners",
        status: "WARN",
        details: `Используются ${sharedRunners.length} shared runners. Они могут быть менее безопасными, чем project-specific runners.`,
        severity: "medium"
      });
    }
    
    // Проверка раннеров с тегами "privileged"
    const privilegedRunners = runners.filter(r => 
      r.tag_list && r.tag_list.includes('privileged')
    );
    
    if (privilegedRunners.length > 0) {
      results.push({
        item: "Privileged runners",
        status: "FAIL",
        details: `Обнаружены ${privilegedRunners.length} раннеров с тегом 'privileged'. Это может представлять угрозу безопасности.`,
        severity: "critical"
      });
    }
    
    // 9. Проверка вебхуков (внешние интеграции) (только если есть CI/CD)
    const hooks = await gitlab.getProjectHooks(projectId);
    const insecureHooks = hooks.filter(hook => 
      !hook.enable_ssl_verification || 
      hook.url.startsWith('http://') // Не HTTPS
    );
    
    if (insecureHooks.length > 0) {
      results.push({
        item: "Небезопасные вебхуки",
        status: "FAIL",
        details: `Обнаружены вебхуки без SSL верификации или использующие HTTP: ${insecureHooks.map(h => h.url).join(', ')}`,
        severity: "high"
      });
    }
    
  } catch (error) {
    console.error(`Error in SEC-4 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка Poisoned Pipeline Execution",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }
  
  return {
    id: "CICD-SEC-4",
    name: "Poisoned Pipeline Execution (PPE)",
    results
  };
};