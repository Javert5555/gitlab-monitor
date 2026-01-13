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
    // ============ ПРОВЕРКИ PBAC ============
    
    // 1. Проверка shared runners и их использования
    checkSharedRunnersSecurity(results, projectRunners, gitlabCIRaw);
    
    // 2. Разделение секретов dev/prod и их ротация
    checkSecretsSeparation(results, projectVariables, gitlabCIRaw);
    
    // 3. Разделение инфраструктуры dev/prod
    checkInfrastructureSeparation(results, projectRunners, gitlabCIRaw, projectEnvironments);
    
    // 4. Доступ разработчиков только к dev
    // checkDeveloperAccessLimitations(results, branches, protectedBranches, projectMembers, gitlabCIRaw);
    
    // 5. Сброс в «чистое» состояние после сборки
    // checkCleanStateAfterBuild(results, gitlabCIRaw);
    
    // 6. Доступ только к необходимым ресурсам (сетевая сегментация)
    checkNetworkSegmentation(results, gitlabCIRaw);
    
    // 7. Проверка лимитов ресурсов
    checkResourceLimits(results, gitlabCIRaw);
    
    // 8. Анализ пайплайнов на подозрительную активность
    await checkPipelineActivity(results, pipelines, projectId, gitlab);
    
  } catch (error) {
    console.error(`Error in SEC-5 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка контроля доступа конвейера (PBAC)",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }

  return {
    id: "SEC-CICD-5",
    name: "Недостаточный контроль доступа конвейера (PBAC)",
    results
  };
};

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

/**
 * 1. Проверка shared runners и их безопасности
 */
function checkSharedRunnersSecurity(results, projectRunners, gitlabCIRaw) {
  if (projectRunners.length === 0) {
    results.push({
      item: "Настройки раннеров",
      status: "INFO",
      details: "Раннеры не обнаружены.",
      severity: "low"
    });
    return;
  }
  
  // Проверяем shared runners
  const sharedRunners = projectRunners.filter(r => r.is_shared);
  const projectSpecificRunners = projectRunners.filter(r => !r.is_shared);
  
  if (sharedRunners.length > 0) {
    // Проверка 1: Привилегированные раннеры
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
        severity: "critical"
      });
    }
    
    // Проверка 2: Shared runners без тегов
    const untaggedSharedRunners = sharedRunners.filter(r => 
      !r.tag_list || r.tag_list.length === 0
    );
    
    if (untaggedSharedRunners.length > 0) {
      results.push({
        item: "Shared runners без тегов",
        status: "WARN",
        details: `Обнаружено ${untaggedSharedRunners.length} shared runners без тегов. Это может привести к неконтролируемому выполнению jobs.`,
        severity: "medium"
      });
    }
    
    // // Проверка 3: Использование shared runners для production
    // let sharedUsedForProd = false;
    // let prodStagesWithShared = [];
    
    // if (gitlabCIRaw) {
    //   const lines = gitlabCIRaw.split('\n');
    //   const prodStageRegex = /stage:\s*(prod|production|deploy)/i;
      
    //   lines.forEach((line, index) => {
    //     if (prodStageRegex.test(line)) {
    //       // Ищем теги для этого stage
    //       for (let i = Math.max(0, index - 5); i < Math.min(lines.length, index + 5); i++) {
    //         if (lines[i].includes('tags:')) {
    //           const tagsMatch = lines[i].match(/tags:\s*\[?(.*?)\]?/i);
    //           if (tagsMatch) {
    //             const tags = tagsMatch[1].split(',').map(t => t.trim());
    //             const usesSharedRunner = tags.some(tag => 
    //               sharedRunners.some(r => r.tag_list && r.tag_list.includes(tag))
    //             );
                
    //             if (usesSharedRunner) {
    //               sharedUsedForProd = true;
    //               prodStagesWithShared.push(`Строка ${index + 1}: ${line.trim()}`);
    //               break;
    //             }
    //           }
    //         }
    //       }
    //     }
    //   });
    // }
    
    // if (sharedUsedForProd) {
    //   results.push({
    //     item: "Shared runners для production stages",
    //     status: "FAIL",
    //     details: `Shared runners используются для production stages:\n${prodStagesWithShared.slice(0, 3).join('\n')}${prodStagesWithShared.length > 3 ? '\n...' : ''}`,
    //     severity: "critical"
    //   });
    // } else if (sharedRunners.length > 0) {
    //   results.push({
    //     item: "Shared runners",
    //     status: "WARN",
    //     details: `Используются ${sharedRunners.length} shared runners. Убедитесь, что они не имеют доступа к production секретам.`,
    //     severity: "medium"
    //   });
    // }
  }
  
  // Общая статистика по раннерам
  results.push({
    item: "Общая статистика раннеров",
    status: "INFO",
    details: `Всего раннеров: ${projectRunners.length} (shared: ${sharedRunners.length}, project-specific: ${projectSpecificRunners.length})`,
    severity: "info"
  });
}

/**
 * 2. Разделение секретов dev/prod и их ротация
 */
function checkSecretsSeparation(results, projectVariables, gitlabCIRaw) {
  // Фильтруем секретные переменные
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
      severity: "low"
    });
    return;
  }
  
  // Группируем по окружениям
  const devSecrets = secretVariables.filter(v => 
    v.environment_scope && v.environment_scope.toLowerCase().includes('dev')
  );
  
  const prodSecrets = secretVariables.filter(v => 
    v.environment_scope && v.environment_scope.toLowerCase().includes('prod')
  );
  
  const globalSecrets = secretVariables.filter(v => 
    !v.environment_scope || v.environment_scope === '*'
  );
  
  // Проверка разделения dev/prod секретов
  if (devSecrets.length > 0 && prodSecrets.length > 0) {
    results.push({
      item: "Разделение секретов dev/prod",
      status: "OK",
      details: `Секреты разделены: dev (${devSecrets.length}), prod (${prodSecrets.length}).`,
      severity: "low"
    });
  } else if (globalSecrets.length > 0) {
    results.push({
      item: "Разделение секретов dev/prod",
      status: "FAIL",
      details: `${globalSecrets.length} секретов доступны во всех окружениях. Разделите секреты dev и prod.`,
      severity: "critical"
    });
  }
  
  // Проверка ротации секретов (по дате создания)
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
      severity: "medium"
    });
  }
}

/**
 * 3. Разделение инфраструктуры dev/prod
 */
function checkInfrastructureSeparation(results, projectRunners, gitlabCIRaw, projectEnvironments) {
  // Проверка разделения окружений
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
      severity: "low"
    });
  } else if (prodEnvironments.length > 0) {
    results.push({
      item: "Разделение окружений dev/prod",
      status: "WARN",
      details: `Обнаружены только prod окружения (${prodEnvironments.length} шт.). Добавьте dev окружения для разделения.`,
      severity: "medium"
    });
  }
}

/**
 * 4. Доступ разработчиков только к dev
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
      status: "FAIL",
      details: `Разработчики могут влиять на production ветки: ${unprotectedProdBranches.join(', ')}.`,
      severity: "critical"
    });
  } else if (developers.length > 0) {
    results.push({
      item: "Доступ разработчиков к production",
      status: "OK",
      details: `Доступ ${developers.length} разработчиков к production веткам ограничен.`,
      severity: "low"
    });
  }
}

/**
 * 5. Сброс в «чистое» состояние после сборки
 */
function checkCleanStateAfterBuild(results, gitlabCIRaw) {
  if (!gitlabCIRaw) return;
  
  const lines = gitlabCIRaw.split('\n');
  
  // Ищем признаки очистки после сборки
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
      severity: "low"
    });
  } else {
    results.push({
      item: "Сброс в чистое состояние после сборки",
      status: "INFO",
      details: "Не обнаружены явные шаги очистки. Рекомендуется очищать временные файлы и кеши.",
      severity: "low"
    });
  }
}

/**
 * 6. Доступ только к необходимым ресурсам (сетевая сегментация)
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
      severity: "medium"
    });
  }
}

/**
 * 7. Проверка лимитов ресурсов
 */
function checkResourceLimits(results, gitlabCIRaw) {
  if (!gitlabCIRaw) return;
  
  const lines = gitlabCIRaw.split('\n');
  
  // Ищем настройки ресурсов
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
      status: "INFO",
      details: "Не обнаружены лимиты ресурсов. Рекомендуется установить limits на CPU и memory.",
      severity: "low"
    });
  }
}

/**
 * 8. Анализ пайплайнов на подозрительную активность
 */
async function checkPipelineActivity(results, pipelines, projectId, gitlab) {
  if (pipelines.length === 0) return;
  
  const recentPipelines = pipelines.slice(0, 3);
  
  // Анализ стабильности сборок
  const failedPipelines = recentPipelines.filter(p => p.status === 'failed');
  const successRate = ((recentPipelines.length - failedPipelines.length) / recentPipelines.length) * 100;
  
  if (successRate < 70 && recentPipelines.length >= 2) {
    results.push({
      item: "Стабильность сборок",
      status: "WARN",
      details: `Низкая стабильность сборок: ${successRate.toFixed(1)}% успешных. Частые сбои могут маскировать атаки.`,
      severity: "medium"
    });
  }
}


// module.exports = async function checkSEC5(projectId, projectData, gitlab) {
//   const {
//     projectRunners = [],
//     pipelines = [],
//     projectVariables = [],
//     projectEnvironments = [],
//     gitlabCIRaw = null,
//     pipelineJobs,
//     branches = [],
//     protectedBranches = [],
//     projectMembers = []
//   } = projectData;

//   const results = [];

//   try {
//     // ============ ПРОВЕРКИ PBAC ============
    
//     // 1. Разделение секретов dev/prod и их ротация
//     checkSecretsSeparation(results, projectVariables, gitlabCIRaw);
    
//     // 2. Разделение инфраструктуры dev/prod
//     // checkInfrastructureSeparation(results, projectRunners, gitlabCIRaw, projectEnvironments);
    
//     // 3. Доступ разработчиков только к dev
//     // checkDeveloperAccessLimitations(results, branches, protectedBranches, projectMembers, gitlabCIRaw);
    
//     // 4. Сброс в «чистое» состояние после сборки
//     // checkCleanStateAfterBuild(results, gitlabCIRaw);
    
//     // 5. Доступ только к необходимым ресурсам (сетевая сегментация)
//     checkNetworkSegmentation(results, gitlabCIRaw);
    
//     // 6. Проверка лимитов ресурсов
//     checkResourceLimits(results, gitlabCIRaw);
    
//     // 7. Анализ пайплайнов на подозрительную активность
//     await checkPipelineActivity(results, pipelines, pipelineJobs, projectId);
    
//   } catch (error) {
//     console.error(`Error in SEC-5 check for project ${projectId}:`, error);
//     results.push({
//       item: "Проверка контроля доступа конвейера (PBAC)",
//       status: "FAIL",
//       details: `Ошибка при выполнении проверки: ${error.message}`,
//       severity: "info"
//     });
//   }

//   return {
//     id: "SEC-CICD-5",
//     name: "Недостаточный контроль доступа конвейера (PBAC)",
//     results
//   };
// };

// // ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

// /**
//  * 1. Разделение секретов dev/prod и их ротация
//  */
// function checkSecretsSeparation(results, projectVariables, gitlabCIRaw) {
//   // Фильтруем секретные переменные
//   const secretVariables = projectVariables.filter(v => 
//     v.key && (
//       v.key.toLowerCase().includes('token') ||
//       v.key.toLowerCase().includes('secret') ||
//       v.key.toLowerCase().includes('password') ||
//       v.key.toLowerCase().includes('key') ||
//       v.key.toLowerCase().includes('credential')
//     )
//   );
  
//   if (secretVariables.length === 0) {
//     results.push({
//       item: "Разделение секретов",
//       status: "INFO",
//       details: "Секретные переменные не обнаружены.",
//       severity: "low"
//     });
//     return;
//   }
  
//   // Группируем по окружениям
//   const devSecrets = secretVariables.filter(v => 
//     v.environment_scope && v.environment_scope.toLowerCase().includes('dev')
//   );
  
//   const prodSecrets = secretVariables.filter(v => 
//     v.environment_scope && v.environment_scope.toLowerCase().includes('prod')
//   );
  
//   const globalSecrets = secretVariables.filter(v => 
//     !v.environment_scope || v.environment_scope === '*'
//   );
  
//   // Проверка разделения dev/prod секретов
//   if (devSecrets.length > 0 && prodSecrets.length > 0) {
//     results.push({
//       item: "Разделение секретов dev/prod",
//       status: "OK",
//       details: `Секреты разделены: dev (${devSecrets.length}), prod (${prodSecrets.length}).`,
//       severity: "low"
//     });
//   } else if (globalSecrets.length > 0) {
//     results.push({
//       item: "Разделение секретов dev/prod",
//       status: "FAIL",
//       details: `${globalSecrets.length} секретов доступны во всех окружениях. Разделите секреты dev и prod.`,
//       severity: "critical"
//     });
//   }
  
//   // Проверка ротации секретов (по дате создания)
//   const now = new Date();
//   const rotationThreshold = 90 * 24 * 60 * 60 * 1000; // 90 дней
  
//   const oldSecrets = secretVariables.filter(v => {
//     if (!v.created_at) return false;
//     const created = new Date(v.created_at);
//     return (now - created) > rotationThreshold;
//   });
  
//   if (oldSecrets.length > 0) {
//     results.push({
//       item: "Ротация секретов",
//       status: "WARN",
//       details: `${oldSecrets.length} секретов созданы более 90 дней назад. Рекомендуется регулярная ротация.`,
//       severity: "medium"
//     });
//   }
// }

// /**
//  * 2. Разделение инфраструктуры dev/prod
//  */
// function checkInfrastructureSeparation(results, projectRunners, gitlabCIRaw, projectEnvironments) {
//   if (projectRunners.length === 0) {
//     results.push({
//       item: "Разделение инфраструктуры",
//       status: "INFO",
//       details: "Раннеры не обнаружены.",
//       severity: "low"
//     });
//     return;
//   }
  
//   // Проверяем shared runners
//   const sharedRunners = projectRunners.filter(r => r.is_shared);
//   const projectSpecificRunners = projectRunners.filter(r => !r.is_shared);
  
//   if (sharedRunners.length > 0) {
//     // Проверяем, используются ли shared runners для production
//     let sharedUsedForProd = false;
    
//     if (gitlabCIRaw) {
//       // Ищем упоминания production в CI конфигурации
//       const prodPatterns = [/stage:\s*prod/i, /environment:\s*prod/i, /tags:\s*.*prod/i];
//       const hasProdStages = prodPatterns.some(pattern => pattern.test(gitlabCIRaw));
      
//       if (hasProdStages) {
//         // Проверяем теги раннеров для prod stages
//         const runnerTagsMatch = gitlabCIRaw.match(/tags:\s*\[?(.*?)\]?/gmi);
//         if (runnerTagsMatch) {
//           const allTags = runnerTagsMatch.map(tags => 
//             tags.replace(/tags:\s*\[?|\]?/gi, '').split(',').map(t => t.trim())
//           );
//           const flatTags = allTags.flat();
          
//           sharedUsedForProd = flatTags.some(tag => 
//             sharedRunners.some(r => r.tag_list && r.tag_list.includes(tag))
//           );
//         }
//       }
//     }
    
//     if (sharedUsedForProd) {
//       results.push({
//         item: "Разделение инфраструктуры dev/prod",
//         status: "FAIL",
//         details: "Shared runners используются для production stages. Используйте отдельные раннеры для dev и prod.",
//         severity: "critical"
//       });
//     } else if (projectSpecificRunners.length > 0) {
//       results.push({
//         item: "Разделение инфраструктуры dev/prod",
//         status: "OK",
//         details: `Используются project-specific runners (${projectSpecificRunners.length} шт.). Возможно разделение dev/prod.`,
//         severity: "low"
//       });
//     }
//   }
  
//   // Проверка разделения окружений
//   const devEnvironments = projectEnvironments.filter(env =>
//     env.name && env.name.toLowerCase().includes('dev')
//   );
  
//   const prodEnvironments = projectEnvironments.filter(env =>
//     env.name && (
//       env.name.toLowerCase().includes('prod') ||
//       env.name.toLowerCase().includes('production') ||
//       env.name.toLowerCase().includes('live')
//     )
//   );
  
//   if (devEnvironments.length > 0 && prodEnvironments.length > 0) {
//     results.push({
//       item: "Разделение окружений dev/prod",
//       status: "OK",
//       details: `Обнаружены отдельные окружения: dev (${devEnvironments.length}), prod (${prodEnvironments.length}).`,
//       severity: "low"
//     });
//   } else if (prodEnvironments.length > 0) {
//     results.push({
//       item: "Разделение окружений dev/prod",
//       status: "WARN",
//       details: `Обнаружены только prod окружения (${prodEnvironments.length} шт.). Добавьте dev окружения для разделения.`,
//       severity: "medium"
//     });
//   }
// }

// /**
//  * 3. Доступ разработчиков только к dev
//  */
// function checkDeveloperAccessLimitations(results, branches, protectedBranches, projectMembers, gitlabCIRaw) {
//   // Проверяем, защищены ли production ветки от разработчиков
//   const prodBranches = ['main', 'master', 'prod', 'production', 'release'];
//   const developers = projectMembers.filter(m => m.access_level === 30); // Developer level
  
//   const unprotectedProdBranches = [];
  
//   for (const branchName of prodBranches) {
//     const branch = branches.find(b => b.name === branchName);
//     const protectedBranch = protectedBranches.find(pb => pb.name === branchName);
    
//     if (branch && protectedBranch) {
//       // Проверяем, могут ли разработчики пушить в защищенную ветку
//       const developerCanPush = protectedBranch.push_access_levels && 
//                               protectedBranch.push_access_levels.some(access => 
//                                 access.access_level === 30
//                               );
      
//       if (developerCanPush) {
//         unprotectedProdBranches.push(branchName);
//       }
//     } else if (branch && !protectedBranch) {
//       unprotectedProdBranches.push(branchName);
//     }
//   }
  
//   if (unprotectedProdBranches.length > 0) {
//     results.push({
//       item: "Доступ разработчиков к production",
//       status: "FAIL",
//       details: `Разработчики могут влиять на production ветки: ${unprotectedProdBranches.join(', ')}.`,
//       severity: "critical"
//     });
//   } else if (developers.length > 0) {
//     results.push({
//       item: "Доступ разработчиков к production",
//       status: "OK",
//       details: `Доступ ${developers.length} разработчиков к production веткам ограничен.`,
//       severity: "low"
//     });
//   }
  
//   // Проверка автоматического деплоя из dev в prod
//   if (gitlabCIRaw && gitlabCIRaw.includes('deploy') && gitlabCIRaw.includes('prod')) {
//     const lines = gitlabCIRaw.split('\n');
//     const autoDeployLines = lines.filter(line => 
//       line.includes('deploy') && 
//       line.includes('prod') && 
//       !line.includes('manual') &&
//       !line.includes('#')
//     );
    
//     if (autoDeployLines.length > 0) {
//       results.push({
//         item: "Автоматический деплой dev → prod",
//         status: "WARN",
//         details: "Обнаружены возможные автоматические деплои из dev в prod. Ограничьте автоматический доступ.",
//         severity: "medium"
//       });
//     }
//   }
// }

// /**
//  * 4. Сброс в «чистое» состояние после сборки
//  */
// function checkCleanStateAfterBuild(results, gitlabCIRaw) {
//   if (!gitlabCIRaw) return;
  
//   const lines = gitlabCIRaw.split('\n');
  
//   // Ищем признаки очистки после сборки
//   const cleanupPatterns = [
//     /cleanup|clean\s+up/i,
//     /rm\s+-rf/i,
//     /docker\s+(rmi|prune)/i,
//     /cache\s*:/i,
//     /artifacts\s*:/i
//   ];
  
//   const hasCleanupSteps = lines.some(line => 
//     cleanupPatterns.some(pattern => pattern.test(line))
//   );
  
//   if (hasCleanupSteps) {
//     results.push({
//       item: "Сброс в чистое состояние после сборки",
//       status: "OK",
//       details: "Обнаружены шаги очистки после сборки.",
//       severity: "low"
//     });
//   } else {
//     results.push({
//       item: "Сброс в чистое состояние после сборки",
//       status: "INFO",
//       details: "Не обнаружены явные шаги очистки. Рекомендуется очищать временные файлы и кеши.",
//       severity: "low"
//     });
//   }
  
//   // Проверка на наличие привилегированных контейнеров
//   const privilegedPatterns = [
//     /privileged:\s*true/i,
//     /docker:dind/i,
//     /docker-in-docker/i
//   ];
  
//   const hasPrivilegedContainers = lines.some(line => 
//     privilegedPatterns.some(pattern => pattern.test(line))
//   );
  
//   if (hasPrivilegedContainers) {
//     results.push({
//       item: "Привилегированные контейнеры",
//       status: "WARN",
//       details: "Обнаружены привилегированные контейнеры. Это может представлять угрозу безопасности.",
//       severity: "medium"
//     });
//   }
// }

// /**
//  * 5. Доступ только к необходимым ресурсам (сетевая сегментация)
//  */
// function checkNetworkSegmentation(results, gitlabCIRaw) {
//   if (!gitlabCIRaw) return;
  
//   const lines = gitlabCIRaw.split('\n');
  
//   // Ищем потенциально опасные сетевые операции
//   const dangerousNetworkPatterns = [
//     { pattern: /curl.*(http|https):\/\//i, desc: "Внешние HTTP запросы" },
//     { pattern: /wget.*(http|https):\/\//i, desc: "Внешние загрузки" },
//     { pattern: /apt-get\s+(install|update)/i, desc: "Установка пакетов из интернета" },
//     { pattern: /npm\s+install/i, desc: "Установка npm пакетов" },
//     { pattern: /pip\s+install/i, desc: "Установка Python пакетов" },
//     { pattern: /docker\s+pull/i, desc: "Загрузка Docker образов" }
//   ];
  
//   const foundPatterns = [];
//   lines.forEach((line, index) => {
//     dangerousNetworkPatterns.forEach(pattern => {
//       if (pattern.pattern.test(line)) {
//         foundPatterns.push({
//           line: index + 1,
//           desc: pattern.desc,
//           content: line.trim()
//         });
//       }
//     });
//   });
  
//   if (foundPatterns.length > 0) {
//     results.push({
//       item: "Сетевая сегментация и доступ к ресурсам",
//       status: "WARN",
//       details: `Обнаружен доступ к внешним ресурсам (${foundPatterns.length} шт.). Ограничьте сетевой доступ.\n${foundPatterns.slice(0, 3).map(p => `Строка ${p.line}: ${p.desc}`).join('\n')}`,
//       severity: "medium"
//     });
//   }
  
//   // Проверка на использование внутренних реестров
//   const internalRegistryPatterns = [
//     /registry\.internal/i,
//     /nexus\.internal/i,
//     /artifactory\.internal/i,
//     /packages\.company/i
//   ];
  
//   const usesInternalRegistry = lines.some(line => 
//     internalRegistryPatterns.some(pattern => pattern.test(line))
//   );
  
//   if (usesInternalRegistry) {
//     results.push({
//       item: "Использование внутренних реестров",
//       status: "OK",
//       details: "Используются внутренние реестры. Это улучшает безопасность.",
//       severity: "low"
//     });
//   }
// }

// /**
//  * 6. Проверка лимитов ресурсов
//  */
// function checkResourceLimits(results, gitlabCIRaw) {
//   if (!gitlabCIRaw) return;
  
//   const lines = gitlabCIRaw.split('\n');
  
//   // Ищем настройки ресурсов
//   const resourcePatterns = [
//     /services:/i,
//     /resources:/i,
//     /limits:/i,
//     /cpu_quota:/i,
//     /mem_limit:/i
//   ];
  
//   const hasResourceLimits = lines.some(line => 
//     resourcePatterns.some(pattern => pattern.test(line))
//   );
  
//   if (hasResourceLimits) {
//     results.push({
//       item: "Лимиты ресурсов",
//       status: "OK",
//       details: "Обнаружены настройки лимитов ресурсов.",
//       severity: "low"
//     });
//   } else {
//     results.push({
//       item: "Лимиты ресурсов",
//       status: "INFO",
//       details: "Не обнаружены лимиты ресурсов. Рекомендуется установить limits на CPU и memory.",
//       severity: "low"
//     });
//   }
// }

// /**
//  * 7. Анализ пайплайнов на подозрительную активность
//  */
// async function checkPipelineActivity(results, pipelines, pipelineJobs, projectId) {
//   if (pipelines.length === 0) return;
  
//   const recentPipelines = pipelines.slice(0, 5);
//   const suspiciousActivities = [];
  
//   for (const pipeline of recentPipelines) {
//     try {
//       const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
      
//       // Проверка на привилегированные jobs
//       const privilegedJobs = jobs.filter(job => 
//         job.name && (
//           job.name.toLowerCase().includes('privileged') ||
//           job.name.toLowerCase().includes('root') ||
//           job.name.toLowerCase().includes('docker') && job.name.toLowerCase().includes('build')
//         )
//       );
      
//       if (privilegedJobs.length > 0) {
//         suspiciousActivities.push({
//           pipelineId: pipeline.id,
//           reason: `Привилегированные jobs: ${privilegedJobs.map(j => j.name).join(', ')}`,
//           status: pipeline.status
//         });
//       }
      
//       // Проверка на jobs с доступом к секретам, запущенные по push
//       const secretJobs = jobs.filter(job => 
//         job.name && (
//           job.name.toLowerCase().includes('secret') ||
//           job.name.toLowerCase().includes('deploy') ||
//           job.name.toLowerCase().includes('release')
//         )
//       );
      
//       if (secretJobs.length > 0 && pipeline.source === 'push') {
//         suspiciousActivities.push({
//           pipelineId: pipeline.id,
//           reason: `Jobs с доступом к секретам запущены по push: ${secretJobs.map(j => j.name).join(', ')}`,
//           status: pipeline.status
//         });
//       }
      
//     } catch (error) {
//       continue;
//     }
//   }
  
//   if (suspiciousActivities.length > 0) {
//     results.push({
//       item: "Подозрительная активность в пайплайнах",
//       status: "WARN",
//       details: `Обнаружена подозрительная активность:\n${suspiciousActivities.map(p => `#${p.pipelineId}: ${p.reason}`).join('\n')}`,
//       severity: "medium"
//     });
//   }
  
//   // Анализ стабильности сборок
//   const failedPipelines = recentPipelines.filter(p => p.status === 'failed');
//   const successRate = ((recentPipelines.length - failedPipelines.length) / recentPipelines.length) * 100;
  
//   if (successRate < 70 && recentPipelines.length >= 3) {
//     results.push({
//       item: "Стабильность сборок",
//       status: "WARN",
//       details: `Низкая стабильность сборок: ${successRate.toFixed(1)}% успешных. Частые сбои могут маскировать атаки.`,
//       severity: "medium"
//     });
//   }
// }