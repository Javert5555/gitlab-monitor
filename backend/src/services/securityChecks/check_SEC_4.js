// src/services/securityChecks/check_SEC_4.js
module.exports = async function checkSEC4(projectId, project, gitlab) {
  const {
    repoTree = [],
    branches = [],
    protectedBranches = [],
    gitlabCIRaw,
    projectVariables = [],
    pipelines = [],
    projectRunners = [],
    projectHooks = [],
    projectMembers = [],
    projectEnvironments = [],
    projectDetails = {}
  } = project;

  const results = [];

  try {
    // 1. Проверка наличия CI/CD конфигурационных файлов
    const ciConfigs = repoTree.filter(file => 
      file.name === '.gitlab-ci.yml' ||
      file.name === 'Jenkinsfile' ||
      file.name.includes('azure-pipelines.yml')
    );
    
    const hasCiConfigs = ciConfigs.length > 0;
    
    results.push({
      item: "Наличие CI/CD конфигураций",
      status: hasCiConfigs ? "OK" : "INFO",
      details: hasCiConfigs
        ? `Обнаружены файлы CI/CD: ${ciConfigs.map(f => f.name).join(', ')}`
        : "Файлы CI/CD не обнаружены. Проверка PPE не применима.",
      severity: "low"
    });
    
    if (!hasCiConfigs) {
      return {
        id: "SEC-CICD-4",
        name: "Poisoned Pipeline Execution (PPE) / Выполнение «отравленного» pipeline",
        results
      };
    }

    // === ОСНОВНЫЕ ПРОВЕРКИ PPE ===

    // A. ПРЯМОЙ PPE (D-PPE) - защита от изменения файлов конфигурации
    checkDirectPPE(results, branches, protectedBranches, gitlabCIRaw, repoTree, ciConfigs);

    // B. КОСВЕННЫЙ PPE (I-PPE) - защита от изменения зависимых файлов
    checkIndirectPPE(results, gitlabCIRaw, repoTree, projectId, gitlab);

    // C. ПУБЛИЧНЫЙ PPE (3PE) - защита публичных проектов
    checkPublicPPE(results, projectDetails, gitlabCIRaw);

    // D. СПОСОБЫ ЗАЩИТЫ
    checkProtectionMeasures(results, {
      projectRunners,
      projectEnvironments,
      projectVariables,
      projectHooks,
      pipelines,
      gitlabCIRaw
    });

  } catch (error) {
    console.error(`Error in SEC-4 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка Poisoned Pipeline Execution (PPE)",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }

  return {
    id: "SEC-CICD-4",
    name: "Poisoned Pipeline Execution (PPE) / Выполнение «отравленного» pipeline",
    results
  };
};

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

/**
 * Проверка Direct PPE - защита от изменения файлов конфигурации
 */
function checkDirectPPE(results, branches, protectedBranches, gitlabCIRaw, repoTree, ciConfigs) {
  // 1. Защита веток с CI файлами
  const mainBranches = branches.filter(b => 
    b.name === 'main' || b.name === 'master' || b.name === 'develop'
  );
  
  const unprotectedMainBranches = mainBranches.filter(branch => {
    const protectedBranch = protectedBranches.find(pb => pb.name === branch.name);
    return !protectedBranch || 
           (protectedBranch.push_access_levels && 
            protectedBranch.push_access_levels.some(access => access.access_level <= 30));
  });
  
  if (unprotectedMainBranches.length > 0) {
    results.push({
      item: "[D-PPE] Защита основных веток с CI файлами",
      status: "FAIL",
      details: `Основные ветки не защищены от прямого изменения: ${unprotectedMainBranches.map(b => b.name).join(', ')}. Разработчики могут напрямую изменять CI конфигурации.`,
      severity: "critical"
    });
  }

  // 2. Раздельные репозитории / submodules / includes
  if (gitlabCIRaw) {
    const lines = gitlabCIRaw.split('\n');
    
    // Проверка на использование include с внешними источниками
    const externalIncludes = lines.filter(line => 
      line.includes('include:') && 
      (line.includes('http://') || line.includes('https://') || line.includes('git@'))
    );
    
    if (externalIncludes.length > 0) {
      results.push({
        item: "[D-PPE] Внешние include в CI/CD",
        status: "WARN",
        details: `Обнаружены include из внешних источников (${externalIncludes.length} шт.). Это вектор для D-PPE атак.`,
        severity: "high"
      });
    }
  }

  // 3. Наличие CODEOWNERS для CI файлов
  const codeownersFiles = repoTree.filter(file => 
    file.name === 'CODEOWNERS' || 
    file.name === '.github/CODEOWNERS'
  );
  
  const hasCodeowners = codeownersFiles.length > 0;
  
  if (!hasCodeowners) {
    results.push({
      item: "[D-PPE] CODEOWNERS для CI файлов",
      status: "WARN",
      details: "Не обнаружен файл CODEOWNERS. Рекомендуется назначить ответственных за CI файлы.",
      severity: "medium"
    });
  }
}

/**
 * Проверка Indirect PPE - защита от изменения зависимых файлов
 */
async function checkIndirectPPE(results, gitlabCIRaw, repoTree, projectId, gitlab) {
  if (!gitlabCIRaw) return;
  
  const lines = gitlabCIRaw.split('\n');
  
  // 1. Поиск исполняемых скриптов, на которые ссылается CI
  const scriptPatterns = [
    /\.sh$/i,
    /\.bash$/i,
    /Makefile/i,
    /Dockerfile/i,
    /\.ps1$/i,
    /\.py$/i,
    /\.js$/i
  ];
  
  const referencedScripts = [];
  lines.forEach(line => {
    scriptPatterns.forEach(pattern => {
      if (pattern.test(line)) {
        const match = line.match(/([\w\.\/-]+\.(sh|bash|py|js|ps1))/i);
        if (match) {
          referencedScripts.push(match[1]);
        }
      }
    });
  });
  
  // 2. Проверка защиты этих скриптов (поиск в репозитории)
  const foundScripts = [];
  for (const script of referencedScripts.slice(0, 10)) {
    const scriptFile = repoTree.find(file => file.path && file.path.includes(script));
    if (scriptFile) {
      foundScripts.push(script);
    }
  }
  
  if (foundScripts.length > 0) {
    results.push({
      item: "[I-PPE] Исполняемые скрипты, на которые ссылается CI",
      status: "WARN",
      details: `CI ссылается на ${foundScripts.length} скриптов: ${foundScripts.slice(0, 5).join(', ')}${foundScripts.length > 5 ? '...' : ''}. Их изменение может привести к I-PPE.`,
      severity: "high"
    });
  }

  // 3. Проверка на динамическое исполнение кода
  const dangerousPatterns = [
    { pattern: /curl.*\|.*(bash|sh)/i, description: "Загрузка и исполнение скриптов из интернета" },
    { pattern: /wget.*-O.*\|.*(bash|sh)/i, description: "Скачивание и исполнение файлов" },
    { pattern: /eval.*(curl|wget)/i, description: "Динамическое исполнение загруженного кода" },
    { pattern: /sh.*<.*(curl|wget)/i, description: "Прямое исполнение из сети" },
    { pattern: /python.*<.*(curl|wget)/i, description: "Исполнение Python кода из сети" }
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
      item: "[I-PPE] Динамическое исполнение кода",
      status: "FAIL",
      details: `Обнаружены опасные паттерны I-PPE:\n${foundPatterns.map(p => `Строка ${p.line}: ${p.pattern}`).slice(0, 3).join('\n')}`,
      severity: "critical"
    });
  }

  // 4. Проверка на использование небезопасных команд
  const unsafeCommands = lines.filter(line => 
    (line.includes('curl') || line.includes('wget')) &&
    (line.includes('|') || line.includes('>') || line.includes('<')) &&
    !line.includes('#')
  );

  if (unsafeCommands.length > 0) {
    results.push({
      item: "[I-PPE] Небезопасные команды загрузки",
      status: "WARN",
      details: `Обнаружены потенциально опасные команды загрузки: ${unsafeCommands.length} шт.`,
      severity: "high"
    });
  }
}

/**
 * Проверка Public PPE - защита публичных проектов
 */
function checkPublicPPE(results, projectDetails, gitlabCIRaw) {
  // Проверка, является ли проект публичным
  const isPublicProject = projectDetails.visibility === 'public' || 
                         projectDetails.visibility === 'internal';
  
  if (isPublicProject) {
    results.push({
      item: "[3PE] Публичный проект",
      status: "WARN",
      details: "Проект является публичным. Повышен риск Public PPE атак через fork и PR.",
      severity: "high"
    });
    
    // Проверка настройки pipeline для PR
    if (gitlabCIRaw) {
      const lines = gitlabCIRaw.split('\n');
      const hasPRPipeline = lines.some(line => 
        (line.includes('only:') && line.includes('merge_requests')) ||
        (line.includes('rules:') && line.includes('$CI_PIPELINE_SOURCE') && line.includes('merge_request'))
      );
      
      if (hasPRPipeline) {
        results.push({
          item: "[3PE] Pipeline для Pull Requests",
          status: "INFO",
          details: "Настроен pipeline для выполнения при создании PR. Убедитесь в строгих проверках для PR.",
          severity: "medium"
        });
      }
    }
  }
}

/**
 * Проверка способов защиты от PPE
 */
function checkProtectionMeasures(results, data) {
  const { 
    projectRunners = [], 
    projectEnvironments = [], 
    projectVariables = [],
    projectHooks = [],
    pipelines = [],
    gitlabCIRaw 
  } = data;
  
  // 1. Сегментированная инфраструктура dev/prod
  const sharedRunners = projectRunners.filter(r => r.is_shared);
  const projectSpecificRunners = projectRunners.filter(r => !r.is_shared);
  
  if (sharedRunners.length > 0 && projectSpecificRunners.length === 0) {
    results.push({
      item: "Защита: Сегментация runners",
      status: "WARN",
      details: `Используются только shared runners (${sharedRunners.length} шт.). Нет сегментации между окружениями.`,
      severity: "high"
    });
  } else if (projectSpecificRunners.length > 0) {
    results.push({
      item: "Защита: Сегментация runners",
      status: "OK",
      details: `Используются project-specific runners (${projectSpecificRunners.length} шт.). Возможна сегментация окружений.`,
      severity: "low"
    });
  }
  
  // 2. Разделение секретов по окружениям
  const secretVariables = projectVariables.filter(v =>
    v.key && (
      v.key.toLowerCase().includes('token') ||
      v.key.toLowerCase().includes('secret') ||
      v.key.toLowerCase().includes('password') ||
      v.key.toLowerCase().includes('key')
    )
  );
  
  const globalSecrets = secretVariables.filter(v => 
    !v.environment_scope || v.environment_scope === '*'
  );
  
  if (globalSecrets.length > 0) {
    results.push({
      item: "Защита: Разделение секретов",
      status: "INFO",
      details: `${globalSecrets.length} секретов доступны во всех окружениях. Рекомендуется использовать environment-scoped переменные.`,
      severity: "medium"
    });
  }
  
  // 3. Проверка на наличие dev/prod окружений
  const prodEnvironments = projectEnvironments.filter(env =>
    env.name && (
      env.name.toLowerCase().includes('prod') ||
      env.name.toLowerCase().includes('production')
    )
  );
  
  const devEnvironments = projectEnvironments.filter(env =>
    env.name && (
      env.name.toLowerCase().includes('dev') ||
      env.name.toLowerCase().includes('staging') ||
      env.name.toLowerCase().includes('test')
    )
  );
  
  if (prodEnvironments.length > 0 && devEnvironments.length > 0) {
    results.push({
      item: "Защита: Разделение окружений",
      status: "OK",
      details: `Обнаружены отдельные окружения: prod (${prodEnvironments.length}), dev (${devEnvironments.length}).`,
      severity: "low"
    });
  }
  
  // 4. Проверка на привилегированные раннеры
  const privilegedRunners = projectRunners.filter(r => 
    r.tag_list && r.tag_list.includes('privileged')
  );
  
  if (privilegedRunners.length > 0) {
    results.push({
      item: "Защита: Привилегированные раннеры",
      status: "WARN",
      details: `Обнаружены ${privilegedRunners.length} привилегированных раннеров. Они могут быть мишенью для PPE атак.`,
      severity: "medium"
    });
  }
  
  // 5. Проверка вебхуков на безопасность
  const insecureHooks = projectHooks.filter(hook => 
    hook && (
      !hook.enable_ssl_verification || 
      (hook.url && hook.url.startsWith('http://'))
    )
  );
  
  if (insecureHooks.length > 0) {
    results.push({
      item: "Защита: Безопасность вебхуков",
      status: "FAIL",
      details: `Обнаружены небезопасные вебхуки: ${insecureHooks.length} шт. без SSL или использующие HTTP.`,
      severity: "high"
    });
  }
  
  // 6. Проверка на стабильность сборок
  if (pipelines && pipelines.length > 0) {
    const recentPipelines = pipelines.slice(0, 10);
    const failedPipelines = recentPipelines.filter(p => p.status === 'failed');
    const successRate = recentPipelines.length > 0 ? 
      ((recentPipelines.length - failedPipelines.length) / recentPipelines.length) * 100 : 100;
    
    if (successRate < 80 && recentPipelines.length >= 3) {
      results.push({
        item: "Защита: Стабильность сборок",
        status: "WARN",
        details: `Низкая стабильность сборок: ${successRate.toFixed(1)}% успешных. Частые сбои могут маскировать PPE атаки.`,
        severity: "medium"
      });
    }
  }
  
  // 7. Проверка на использование Docker образов с фиксированными версиями
  if (gitlabCIRaw) {
    const lines = gitlabCIRaw.split('\n');
    const imageLines = lines.filter(line => line.includes('image:'));
    const latestImages = imageLines.filter(line => 
      line.includes(':latest') || 
      (line.includes('image:') && !line.includes(':'))
    );
    
    if (latestImages.length > 0) {
      results.push({
        item: "Защита: Docker образы",
        status: "WARN",
        details: `Обнаружены образы с тегом latest или без тега (${latestImages.length} шт.). Используйте фиксированные версии.`,
        severity: "medium"
      });
    }
  }
}