module.exports = async function checkSEC5(projectId, projectData, gitlab) {
  const {
    projectRunners = [],
    pipelines = [],
    projectVariables = [],
    projectEnvironments = [],
    gitlabCIRaw = null,
    branches = [],
    protectedBranches = [],
    projectMembers = []
  } = projectData;

  const results = [];

  try {    
    checkSharedRunnersSecurity(results, projectRunners, gitlabCIRaw);
    checkSecretsSeparation(results, projectVariables, gitlabCIRaw);
    checkInfrastructureSeparation(results, projectRunners, gitlabCIRaw, projectEnvironments);
    checkNetworkSegmentation(results, gitlabCIRaw);
    checkResourceLimits(results, gitlabCIRaw);
    await checkPipelineActivity(results, pipelines, projectId, gitlab);
    
  } catch (error) {
    console.error(`Error in SEC-5 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка контроля доступа конвейера (PBAC)",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
    });
  }

  return {
    id: "SEC-CICD-5",
    name: "Недостаточный контроль доступа конвейера (PBAC)",
    results
  };
};

/**
 * проверка shared runners и их безопасности
 */
function checkSharedRunnersSecurity(results, projectRunners, gitlabCIRaw) {
  if (projectRunners.length === 0) {
    results.push({
      item: "Настройки раннеров",
      status: "INFO",
      details: "Раннеры не обнаружены.",
    });
    return;
  }
  
  // Проверяем shared runners
  const sharedRunners = projectRunners.filter(r => r.is_shared);
  const projectSpecificRunners = projectRunners.filter(r => !r.is_shared);
  
  if (sharedRunners.length > 0) {
    // привилегированные раннеры
    const privilegedRunners = sharedRunners.filter(r => 
      r.tag_list && (
        r.tag_list.includes('privileged') ||
        r.tag_list.includes('docker') ||
        r.tag_list.includes('root')
      )
    );
    
    if (privilegedRunners.length > 0) {
      results.push({
        item: "Привилегированные shared runners",
        status: "FAIL",
        details: `Обнаружены ${privilegedRunners.length} shared runners с привилегированными тегами (privileged, docker, root). Это позволяет контейнерам получать root-доступ к хосту.`,
      });
    }
    
    // shared runners без тегов
    const untaggedSharedRunners = sharedRunners.filter(r => 
      !r.tag_list || r.tag_list.length === 0
    );
    
    if (untaggedSharedRunners.length > 0) {
      results.push({
        item: "Shared runners без тегов",
        status: "WARN",
        details: `Обнаружено ${untaggedSharedRunners.length} shared runners без тегов. Это может привести к неконтролируемому выполнению jobs.`,
      });
    }
  }
  
  // Общая статистика по раннерам
  results.push({
    item: "Общая статистика раннеров",
    status: "INFO",
    details: `Всего раннеров: ${projectRunners.length} (shared: ${sharedRunners.length}, project-specific: ${projectSpecificRunners.length})`,
  });
}

/**
 * разделение секретов dev/prod и их ротация
 */
function checkSecretsSeparation(results, projectVariables, gitlabCIRaw) {
  // фильтруем секретные переменные
  const secretVariables = projectVariables.filter(v => 
    v.key && (
      v.key.toLowerCase().includes('token') ||
      v.key.toLowerCase().includes('secret') ||
      v.key.toLowerCase().includes('password') ||
      v.key.toLowerCase().includes('key') ||
      v.key.toLowerCase().includes('credential')
    )
  );
  
  if (secretVariables.length === 0) {
    results.push({
      item: "Разделение секретов",
      status: "INFO",
      details: "Секретные переменные не обнаружены.",
    });
    return;
  }
  
  // группируем по окружениям
  const devSecrets = secretVariables.filter(v => 
    v.environment_scope && v.environment_scope.toLowerCase().includes('dev')
  );
  
  const prodSecrets = secretVariables.filter(v => 
    v.environment_scope && v.environment_scope.toLowerCase().includes('prod')
  );
  
  const globalSecrets = secretVariables.filter(v => 
    !v.environment_scope || v.environment_scope === '*'
  );
  
  // проверка разделения dev/prod секретов
  if (devSecrets.length > 0 && prodSecrets.length > 0) {
    results.push({
      item: "Разделение секретов dev/prod",
      status: "OK",
      details: `Секреты разделены: dev (${devSecrets.length}), prod (${prodSecrets.length}).`,
    });
  } else if (globalSecrets.length > 0) {
    results.push({
      item: "Разделение секретов dev/prod",
      status: "WARN",
      details: `${globalSecrets.length} секретов доступны во всех окружениях. Разделите секреты dev и prod.`,
    });
  }
  
  // проверка ротации секретов (по дате создания)
  const now = new Date();
  const rotationThreshold = 90 * 24 * 60 * 60 * 1000; // 90 дней
  
  const oldSecrets = secretVariables.filter(v => {
    if (!v.created_at) return false;
    const created = new Date(v.created_at);
    return (now - created) > rotationThreshold;
  });
  
  if (oldSecrets.length > 0) {
    results.push({
      item: "Ротация секретов",
      status: "WARN",
      details: `${oldSecrets.length} секретов созданы более 90 дней назад. Рекомендуется регулярная ротация.`,
    });
  }
}

/**
 * разделение инфраструктуры dev/prod
 */
function checkInfrastructureSeparation(results, projectRunners, gitlabCIRaw, projectEnvironments) {
  // проверка разделения окружений
  const devEnvironments = projectEnvironments.filter(env =>
    env.name && env.name.toLowerCase().includes('dev')
  );
  
  const prodEnvironments = projectEnvironments.filter(env =>
    env.name && (
      env.name.toLowerCase().includes('prod') ||
      env.name.toLowerCase().includes('production') ||
      env.name.toLowerCase().includes('live')
    )
  );
  
  if (devEnvironments.length > 0 && prodEnvironments.length > 0) {
    results.push({
      item: "Разделение окружений dev/prod",
      status: "OK",
      details: `Обнаружены отдельные окружения: dev (${devEnvironments.length}), prod (${prodEnvironments.length}).`,
    });
  } else if (prodEnvironments.length > 0) {
    results.push({
      item: "Разделение окружений dev/prod",
      status: "WARN",
      details: `Обнаружены только prod окружения (${prodEnvironments.length} шт.). Добавьте dev окружения для разделения.`,
    });
  }
}

/**
 * доступ разработчиков только к dev
 */
function checkDeveloperAccessLimitations(results, branches, protectedBranches, projectMembers, gitlabCIRaw) {
  // Проверяем, защищены ли production ветки от разработчиков
  const prodBranches = ['main', 'master', 'prod', 'production', 'release'];
  const developers = projectMembers.filter(m => m.access_level === 30); // Developer level
  
  const unprotectedProdBranches = [];
  
  for (const branchName of prodBranches) {
    const branch = branches.find(b => b.name === branchName);
    const protectedBranch = protectedBranches.find(pb => pb.name === branchName);
    
    if (branch && protectedBranch) {
      // Проверяем, могут ли разработчики пушить в защищенную ветку
      const developerCanPush = protectedBranch.push_access_levels && 
                              protectedBranch.push_access_levels.some(access => 
                                access.access_level === 30
                              );
      
      if (developerCanPush) {
        unprotectedProdBranches.push(branchName);
      }
    } else if (branch && !protectedBranch) {
      unprotectedProdBranches.push(branchName);
    }
  }
  
  if (unprotectedProdBranches.length > 0) {
    results.push({
      item: "Доступ разработчиков к production",
      status: "WARN",
      details: `Разработчики могут влиять на production ветки: ${unprotectedProdBranches.join(', ')}.`,
    });
  } else if (developers.length > 0) {
    results.push({
      item: "Доступ разработчиков к production",
      status: "OK",
      details: `Доступ ${developers.length} разработчиков к production веткам ограничен.`,
    });
  }
}

/**
 * сброс в «чистое» состояние после сборки
 */
function checkCleanStateAfterBuild(results, gitlabCIRaw) {
  if (!gitlabCIRaw) return;
  
  const lines = gitlabCIRaw.split('\n');
  
  // ищем признаки очистки после сборки
  const cleanupPatterns = [
    /cleanup|clean\s+up/i,
    /rm\s+-rf/i,
    /docker\s+(rmi|prune)/i,
    /cache\s*:/i,
    /artifacts\s*:/i
  ];
  
  const hasCleanupSteps = lines.some(line => 
    cleanupPatterns.some(pattern => pattern.test(line))
  );
  
  if (hasCleanupSteps) {
    results.push({
      item: "Сброс в чистое состояние после сборки",
      status: "OK",
      details: "Обнаружены шаги очистки после сборки.",
    });
  } else {
    results.push({
      item: "Сброс в чистое состояние после сборки",
      status: "WARN",
      details: "Не обнаружены явные шаги очистки. Рекомендуется очищать временные файлы и кеши.",
    });
  }
}

/**
 * 
 * доступ только к необходимым ресурсам (сетевая сегментация)
 */
function checkNetworkSegmentation(results, gitlabCIRaw) {
  if (!gitlabCIRaw) return;
  
  const lines = gitlabCIRaw.split('\n');
  
  // Ищем потенциально опасные сетевые операции
  const dangerousNetworkPatterns = [
    { pattern: /curl.*(http|https):\/\//i, desc: "Внешние HTTP запросы" },
    { pattern: /wget.*(http|https):\/\//i, desc: "Внешние загрузки" },
    { pattern: /docker\s+pull/i, desc: "Загрузка Docker образов" }
  ];
  
  const foundPatterns = [];
  lines.forEach((line, index) => {
    dangerousNetworkPatterns.forEach(pattern => {
      if (pattern.pattern.test(line)) {
        foundPatterns.push({
          line: index + 1,
          desc: pattern.desc,
          content: line.trim()
        });
      }
    });
  });
  
  if (foundPatterns.length > 0) {
    results.push({
      item: "Сетевая сегментация и доступ к ресурсам",
      status: "WARN",
      details: `Обнаружен доступ к внешним ресурсам (${foundPatterns.length} шт.). Ограничьте сетевой доступ.`,
    });
  }
}

/**
 * проверка лимитов ресурсов
 */
function checkResourceLimits(results, gitlabCIRaw) {
  if (!gitlabCIRaw) return;
  
  const lines = gitlabCIRaw.split('\n');
  
  // ищем настройки ресурсов
  const resourcePatterns = [
    /services:/i,
    /resources:/i,
    /limits:/i
  ];
  
  const hasResourceLimits = lines.some(line => 
    resourcePatterns.some(pattern => pattern.test(line))
  );
  
  if (!hasResourceLimits) {
    results.push({
      item: "Лимиты ресурсов",
      status: "WARN",
      details: "Не обнаружены лимиты ресурсов. Рекомендуется установить limits на CPU и memory.",
    });
  }
}

/**
 * анализ пайплайнов на подозрительную активность
 */
async function checkPipelineActivity(results, pipelines, projectId, gitlab) {
  if (pipelines.length === 0) return;
  
  const recentPipelines = pipelines.slice(0, 3);
  
  // анализ стабильности сборок
  const failedPipelines = recentPipelines.filter(p => p.status === 'failed');
  const successRate = ((recentPipelines.length - failedPipelines.length) / recentPipelines.length) * 100;
  
  if (successRate < 70 && recentPipelines.length >= 2) {
    results.push({
      item: "Стабильность сборок",
      status: "WARN",
      details: `Низкая стабильность сборок: ${successRate.toFixed(1)}% успешных. Частые сбои могут маскировать атаки.`,
    });
  }
}
