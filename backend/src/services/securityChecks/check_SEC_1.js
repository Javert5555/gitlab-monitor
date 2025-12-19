const yaml = require('js-yaml');

/**
 * Проверяет наличие автоматического деплоя на production в .gitlab-ci.yml
 */
function checkAutoDeploy(raw) {
  try {
    const parsedGitlabCI = yaml.load(raw);
    const { stages } = parsedGitlabCI;
    let autoDeploy = false;
    let detectedJobs = [];

    for (const key in parsedGitlabCI) {
      if (!parsedGitlabCI.hasOwnProperty(key)) continue;

      const item = parsedGitlabCI[key];
      if (typeof item !== 'object' || item === null) continue;

      // Пропускаем служебные поля и шаблоны
      if (key.startsWith('.') || ['include', 'variables', 'stages', 'workflow', 'default'].includes(key)) {
        continue;
      }

      // Проверяем, что stage объекта есть в основном списке stages
      if (item.stage && stages && stages.includes(item.stage)) {
        const detectionResult = detectProdJob(key, item);
        
        if (detectionResult.isProdJob && detectionResult.isAutoRun) {
          autoDeploy = true;
          detectedJobs.push({
            job: key,
            details: detectionResult.jobDetails
          });
        }
      }
    }

    return formatAutoDeployResult(autoDeploy, detectedJobs);
  } catch (error) {
    return {
      item: "Автоматический деплой на production",
      status: "WARN",
      details: `Ошибка парсинга .gitlab-ci.yml: ${error.message}`,
      detectedJobs: []
    };
  }
}

/**
 * Детектирует production job и проверяет его настройки запуска
 */
function detectProdJob(jobKey, jobConfig) {
  let isProdJob = false;
  let isAutoRun = false;
  let jobDetails = {};

  // Детектирование PRODUCTION джоба
  if (checkProdByEnvironment(jobConfig)) {
    isProdJob = true;
    jobDetails.environment = typeof jobConfig.environment === 'string' 
      ? jobConfig.environment 
      : jobConfig.environment.name;
  }

  if (!isProdJob && /deploy.*prod|prod.*deploy|release.*prod|prod.*release|live.*deploy|production/i.test(jobKey)) {
    isProdJob = true;
    jobDetails.jobName = jobKey;
  }

  if (!isProdJob && /deploy|release|prod/i.test(jobConfig.stage)) {
    isProdJob = true;
    jobDetails.stage = jobConfig.stage;
  }

  if (!isProdJob && checkProdByTags(jobConfig)) {
    isProdJob = true;
    const tags = Array.isArray(jobConfig.tags) ? jobConfig.tags : [jobConfig.tags];
    const prodTags = ['production', 'prod', 'live', 'release', 'k8s-prod', 'aws-prod'];
    jobDetails.prodTags = tags.filter(tag => 
      prodTags.includes(tag) || (typeof tag === 'string' && /prod|production|live/i.test(tag))
    );
  }

  // Детектирование автоматического запуска
  if (isProdJob) {
    isAutoRun = checkAutoRunConditions(jobConfig, jobDetails);
  }

  return { isProdJob, isAutoRun, jobDetails };
}

/**
 * Проверяет, является ли job production по environment
 */
function checkProdByEnvironment(jobConfig) {
  if (!jobConfig.environment) return false;
  
  const envName = typeof jobConfig.environment === 'string' 
    ? jobConfig.environment 
    : jobConfig.environment.name;
  
  return envName && /prod|production|live|release/i.test(envName);
}

/**
 * Проверяет, является ли job production по тегам
 */
function checkProdByTags(jobConfig) {
  if (!jobConfig.tags) return false;
  
  const tags = Array.isArray(jobConfig.tags) ? jobConfig.tags : [jobConfig.tags];
  const prodTags = ['production', 'prod', 'live', 'release', 'k8s-prod', 'aws-prod'];
  
  return tags.some(tag => 
    prodTags.includes(tag) || (typeof tag === 'string' && /prod|production|live/i.test(tag))
  );
}

/**
 * Проверяет условия автоматического запуска job
 */
function checkAutoRunConditions(jobConfig, jobDetails) {
  // 1. Проверка rules (новый синтаксис)
  if (jobConfig.rules && Array.isArray(jobConfig.rules)) {
    const hasAutoRule = jobConfig.rules.some(rule => {
      const hasManualWhen = rule.when === 'manual' || rule.when === 'never';
      const hasAutoWhen = !rule.when || (rule.when && !hasManualWhen);
      
      let hasProdCondition = false;
      if (rule.if) {
        const ifConditions = Array.isArray(rule.if) ? rule.if : [rule.if];
        hasProdCondition = ifConditions.some(condition => 
          condition && (
            condition.includes('main') || 
            condition.includes('master') || 
            condition.includes('production') ||
            condition.includes('prod') ||
            /CI_COMMIT_BRANCH.*main|CI_COMMIT_BRANCH.*master/i.test(condition)
          )
        );
      }
      
      return hasAutoWhen && (hasProdCondition || !rule.if);
    });
    
    if (hasAutoRule) {
      jobDetails.autoReason = 'rules allow auto-run';
      return true;
    }
  }
  
  // 2. Проверка except (отсутствие manual)
  if (jobConfig.except) {
    const exceptValues = Array.isArray(jobConfig.except) ? jobConfig.except : [jobConfig.except];
    const hasManualExcept = exceptValues.includes('manual');
    if (!hasManualExcept) {
      jobDetails.autoReason = 'except does not exclude manual';
      return true;
    }
  }
  
  // 3. Проверка when
  if (!jobConfig.when || (jobConfig.when && jobConfig.when !== 'manual')) {
    jobDetails.autoReason = 'when not set to manual';
    return true;
  }
  
  // 4. Проверка if условий
  if (jobConfig.if) {
    const ifConditions = Array.isArray(jobConfig.if) ? jobConfig.if : [jobConfig.if];
    const hasProdCondition = ifConditions.some(condition => 
      condition && (
        condition.includes('main') || 
        condition.includes('master') || 
        condition.includes('production') ||
        condition.includes('prod') ||
        /CI_COMMIT_BRANCH.*main|CI_COMMIT_BRANCH.*master/i.test(condition)
      )
    );
    if (hasProdCondition && jobConfig.when !== 'manual') {
      jobDetails.autoReason = 'if conditions without manual when';
      return true;
    }
  }
  
  // 5. Проверка tags на автоматический запуск
  if (jobConfig.tags) {
    const tags = Array.isArray(jobConfig.tags) ? jobConfig.tags : [jobConfig.tags];
    const hasProdTag = tags.some(tag => 
      typeof tag === 'string' && /prod|production|live/i.test(tag)
    );
    if (hasProdTag && (!jobConfig.when || jobConfig.when !== 'manual')) {
      jobDetails.autoReason = 'production tags without manual when';
      return true;
    }
    
    const prodRunnerTags = ['k8s-prod', 'aws-prod', 'gcp-prod', 'prod-runner'];
    const hasProdRunnerTag = tags.some(tag => 
      prodRunnerTags.includes(tag) || (typeof tag === 'string' && /.*prod.*runner|runner.*prod/i.test(tag))
    );
    if (hasProdRunnerTag && (!jobConfig.when || jobConfig.when !== 'manual')) {
      jobDetails.autoReason = 'production runner tags without manual when';
      return true;
    }
  }
  
  // 6. Если нет никаких ограничений
  if (!jobConfig.rules && !jobConfig.only && !jobConfig.except && !jobConfig.when && !jobConfig.if) {
    jobDetails.autoReason = 'no restrictions found';
    return true;
  }
  
  return false;
}

/**
 * Форматирует результат проверки автодеплоя
 */
function formatAutoDeployResult(autoDeploy, detectedJobs) {
  let details = '';
  if (autoDeploy) {
    const jobList = detectedJobs.map(j => `${j.job} (${j.details.autoReason})`).join(', ');
    details = `Обнаружен автоматический деплой на PROD в джобах: ${jobList}`;
  } else {
    details = 'Автодеплой на PROD не найден';
  }
  
  return {
    item: "Автоматический деплой на production",
    status: autoDeploy ? "WARN" : "OK",
    details: details,
    detectedJobs: detectedJobs,
    severity: autoDeploy ? "high" : "low"
  };
}

/**
 * Проверяет защиту от force push в production ветках
 */
function checkForcePushProtection(protectedBranches, branches) {
  const prodBranches = ['main', 'master', 'prod', 'production', 'release'];
  let forcePushDetected = false;
  let unprotectedBranches = [];
  let forcePushAllowedBranches = [];

  // Проверяем основные prod ветки
  for (const branchName of prodBranches) {
    const branch = branches.find(b => b.name === branchName);
    const protectedBranch = protectedBranches.find(b => b.name === branchName);
    
    if (branch) {
      const branchIssues = checkBranchProtectionIssues(branchName, protectedBranch);
      
      if (branchIssues.unprotected) {
        unprotectedBranches.push(`${branchName} (не защищена)`);
        forcePushDetected = true;
      }
      
      if (branchIssues.forcePushAllowed) {
        forcePushAllowedBranches.push(`${branchName} (force push разрешен)`);
        forcePushDetected = true;
      }
      
      if (branchIssues.developerCanPush) {
        forcePushAllowedBranches.push(`${branchName} (push разрешен для разработчиков)`);
        forcePushDetected = true;
      }
    }
  }

  // Проверяем все защищенные ветки на наличие force push
  protectedBranches.forEach(protectedBranch => {
    const isProdBranch = prodBranches.includes(protectedBranch.name) || 
                        /prod|production|release|main|master/i.test(protectedBranch.name);
    
    if (isProdBranch) {
      const allowsForcePush = protectedBranch.allow_force_push || 
                             (protectedBranch.push_access_levels && 
                              protectedBranch.push_access_levels.some(access => 
                                access.access_level >= 30
                              ));
      
      if (allowsForcePush && !forcePushAllowedBranches.includes(`${protectedBranch.name} (force push разрешен)`)) {
        forcePushAllowedBranches.push(`${protectedBranch.name} (force push разрешен)`);
        forcePushDetected = true;
      }
    }
  });

  return formatForcePushResult(forcePushDetected, unprotectedBranches, forcePushAllowedBranches);
}

/**
 * Проверяет проблемы защиты конкретной ветки
 */
function checkBranchProtectionIssues(branchName, protectedBranch) {
  const issues = {
    unprotected: false,
    forcePushAllowed: false,
    developerCanPush: false
  };

  if (!protectedBranch) {
    issues.unprotected = true;
    return issues;
  }

  // Проверяем настройки защищенной ветки
  const allowsForcePush = protectedBranch.allow_force_push || 
                         (protectedBranch.push_access_levels && 
                          protectedBranch.push_access_levels.some(access => 
                            access.access_level >= 30
                          ));
  
  if (allowsForcePush) {
    issues.forcePushAllowed = true;
  }
  
  // Дополнительная проверка: если разрешен push для разработчиков
  const developerCanPush = protectedBranch.push_access_levels && 
                          protectedBranch.push_access_levels.some(access => 
                            access.access_level === 30
                          );
  
  if (developerCanPush) {
    issues.developerCanPush = true;
  }

  return issues;
}

/**
 * Форматирует результат проверки force push
 */
function formatForcePushResult(forcePushDetected, unprotectedBranches, forcePushAllowedBranches) {
  let details = '';
  if (forcePushDetected) {
    const issues = [...unprotectedBranches, ...forcePushAllowedBranches];
    details = `Обнаружены проблемы с защитой веток: ${issues.join(', ')}`;
  } else {
    details = 'Все основные ветки защищены от force push';
  }

  return {
    item: "Force push защита в production ветках",
    status: forcePushDetected ? "WARN" : "OK",
    details: details,
    unprotectedBranches: unprotectedBranches,
    forcePushAllowedBranches: forcePushAllowedBranches,
    severity: forcePushDetected ? "high" : "low"
  };
}

/**
 * Проверка защиты основной ветки
 */
function checkMainBranchProtection(protectedBranches) {
  const hasProtectedMain = protectedBranches.some(
    (b) => b.name === "main" || b.name === "master"
  );

  return {
    item: "Защищена ли основная ветка (main/master)",
    status: hasProtectedMain ? "OK" : "FAIL",
    details: hasProtectedMain
      ? "Основная ветка защищена, действия разработчиков контролируются."
      : "Main/master не защищена — любой разработчик может деплоить на прод.",
    severity: hasProtectedMain ? "low" : "critical"
  };
}

/**
 * Проверка production-веток без защиты
 */
function checkProdBranchesProtection(branches) {
  const dangerousBranches = branches.filter((b) =>
    ["prod", "production", "release"].includes(b.name)
  );

  return {
    item: "Наличие production-веток без защиты",
    status: dangerousBranches.length ? "FAIL" : "OK",
    details: dangerousBranches.length
      ? `Незащищённые prod-ветки: ${dangerousBranches.map((b) => b.name).join(", ")}`
      : "Production-ветки защищены или отсутствуют.",
    severity: dangerousBranches.length ? "high" : "low"
  };
}

/**
 * Проверка MR без ревью
 */
function checkMRWithoutReview(mergeRequests) {
  const noReview = mergeRequests.filter(
    (mr) => mr.approvals_before_merge === 0
  );

  return {
    item: "MR без ревью",
    status: noReview.length > 0 ? "WARN" : "OK",
    details: noReview.length
      ? `${noReview.length} слияний выполнено без ревью`
      : "Все слияния проходят ревью.",
    severity: noReview.length > 0 ? "medium" : "info"
  };
}

/**
 * Проверка пайплайнов без проверок
 */
function checkPipelinesWithoutChecks(pipelines) {
  const suspiciousPipelines = pipelines.filter(
    (p) => p.status === "success" && p.source === "push"
  );

  return {
    item: "Запуск прод-пайплайна по push (без MR/Review)",
    status: suspiciousPipelines.length > 0 ? "WARN" : "OK",
    details: suspiciousPipelines.length
      ? "Прод-пайплайн можно запустить обычным пушем."
      : "Прод-пайплайн запускается корректно.",
    severity: suspiciousPipelines.length > 0 ? "medium" : "low"
  };
}

/**
 * Основная функция проверки
 */
module.exports = async function checkSEC1(projectId, projectData, gitlab) {
  const {
    protectedBranches = [],
    branches = [],
    mergeRequests = [],
    pipelines = [],
    gitlabCIRaw = null
  } = projectData;

  const results = [];

  try {
    // 1. Проверка автоматического деплоя
    results.push(gitlabCIRaw ? checkAutoDeploy(gitlabCIRaw) : {
      item: "Автоматический деплой на production",
      status: "INFO",
      details: ".gitlab-ci.yml не найден",
      severity: "low"
    });

    // 2. Проверка force push защиты
    results.push(checkForcePushProtection(protectedBranches, branches));

    // 3. Проверка защиты основной ветки
    // results.push(checkMainBranchProtection(protectedBranches));

    // 4. Проверка production-веток без защиты
    // results.push(checkProdBranchesProtection(branches));

    // 5. Проверка MR без ревью
    results.push(checkMRWithoutReview(mergeRequests));

    // 6. Проверка пайплайнов без проверок
    results.push(checkPipelinesWithoutChecks(pipelines));

  } catch (error) {
    console.error(`Error in SEC-1 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка механизмов управления потоком",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }

  return {
    id: "SEC-CICD-1",
    name: "Недостаточные механизмы управления потоком",
    results,
  };
};



// const yaml = require('js-yaml');

// /**
//  * Проверяет наличие автоматического деплоя на production в .gitlab-ci.yml
//  */
// function checkAutoDeploy(raw) {
//   const parsedGitlabCI = yaml.load(raw);
//   const { stages } = parsedGitlabCI;
//   let autoDeploy = false;
//   let detectedJobs = [];

//   for (const key in parsedGitlabCI) {
//     if (!parsedGitlabCI.hasOwnProperty(key)) continue;

//     const item = parsedGitlabCI[key];
//     if (typeof item !== 'object' || item === null) continue;

//     // Пропускаем служебные поля и шаблоны
//     if (key.startsWith('.') || ['include', 'variables', 'stages', 'workflow', 'default'].includes(key)) {
//       continue;
//     }

//     // Проверяем, что stage объекта есть в основном списке stages
//     if (item.stage && stages && stages.includes(item.stage)) {
//       const detectionResult = detectProdJob(key, item);
      
//       if (detectionResult.isProdJob && detectionResult.isAutoRun) {
//         autoDeploy = true;
//         detectedJobs.push({
//           job: key,
//           details: detectionResult.jobDetails
//         });
//       }
//     }
//   }

//   return formatAutoDeployResult(autoDeploy, detectedJobs);
// }

// /**
//  * Детектирует production job и проверяет его настройки запуска
//  */
// function detectProdJob(jobKey, jobConfig) {
//   let isProdJob = false;
//   let isAutoRun = false;
//   let jobDetails = {};

//   // Детектирование PRODUCTION джоба
//   if (checkProdByEnvironment(jobConfig)) {
//     isProdJob = true;
//     jobDetails.environment = typeof jobConfig.environment === 'string' 
//       ? jobConfig.environment 
//       : jobConfig.environment.name;
//   }

//   if (!isProdJob && /deploy.*prod|prod.*deploy|release.*prod|prod.*release|live.*deploy|production/i.test(jobKey)) {
//     isProdJob = true;
//     jobDetails.jobName = jobKey;
//   }

//   if (!isProdJob && /deploy|release|prod/i.test(jobConfig.stage)) {
//     isProdJob = true;
//     jobDetails.stage = jobConfig.stage;
//   }

//   if (!isProdJob && checkProdByTags(jobConfig)) {
//     isProdJob = true;
//     const tags = Array.isArray(jobConfig.tags) ? jobConfig.tags : [jobConfig.tags];
//     const prodTags = ['production', 'prod', 'live', 'release', 'k8s-prod', 'aws-prod'];
//     jobDetails.prodTags = tags.filter(tag => 
//       prodTags.includes(tag) || (typeof tag === 'string' && /prod|production|live/i.test(tag))
//     );
//   }

//   // Детектирование автоматического запуска
//   if (isProdJob) {
//     isAutoRun = checkAutoRunConditions(jobConfig, jobDetails);
//   }

//   return { isProdJob, isAutoRun, jobDetails };
// }

// /**
//  * Проверяет, является ли job production по environment
//  */
// function checkProdByEnvironment(jobConfig) {
//   if (!jobConfig.environment) return false;
  
//   const envName = typeof jobConfig.environment === 'string' 
//     ? jobConfig.environment 
//     : jobConfig.environment.name;
  
//   return envName && /prod|production|live|release/i.test(envName);
// }

// /**
//  * Проверяет, является ли job production по тегам
//  */
// function checkProdByTags(jobConfig) {
//   if (!jobConfig.tags) return false;
  
//   const tags = Array.isArray(jobConfig.tags) ? jobConfig.tags : [jobConfig.tags];
//   const prodTags = ['production', 'prod', 'live', 'release', 'k8s-prod', 'aws-prod'];
  
//   return tags.some(tag => 
//     prodTags.includes(tag) || (typeof tag === 'string' && /prod|production|live/i.test(tag))
//   );
// }

// /**
//  * Проверяет условия автоматического запуска job
//  */
// function checkAutoRunConditions(jobConfig, jobDetails) {
//   // 1. Проверка rules (новый синтаксис)
//   if (jobConfig.rules && Array.isArray(jobConfig.rules)) {
//     const hasAutoRule = jobConfig.rules.some(rule => {
//       const hasManualWhen = rule.when === 'manual' || rule.when === 'never';
//       const hasAutoWhen = !rule.when || (rule.when && !hasManualWhen);
      
//       let hasProdCondition = false;
//       if (rule.if) {
//         const ifConditions = Array.isArray(rule.if) ? rule.if : [rule.if];
//         hasProdCondition = ifConditions.some(condition => 
//           condition && (
//             condition.includes('main') || 
//             condition.includes('master') || 
//             condition.includes('production') ||
//             condition.includes('prod') ||
//             /CI_COMMIT_BRANCH.*main|CI_COMMIT_BRANCH.*master/i.test(condition)
//           )
//         );
//       }
      
//       return hasAutoWhen && (hasProdCondition || !rule.if);
//     });
    
//     if (hasAutoRule) {
//       jobDetails.autoReason = 'rules allow auto-run';
//       return true;
//     }
//   }
  
//   // 2. Проверка except (отсутствие manual)
//   if (jobConfig.except) {
//     const exceptValues = Array.isArray(jobConfig.except) ? jobConfig.except : [jobConfig.except];
//     const hasManualExcept = exceptValues.includes('manual');
//     if (!hasManualExcept) {
//       jobDetails.autoReason = 'except does not exclude manual';
//       return true;
//     }
//   }
  
//   // 3. Проверка when
//   if (!jobConfig.when || (jobConfig.when && jobConfig.when !== 'manual')) {
//     jobDetails.autoReason = 'when not set to manual';
//     return true;
//   }
  
//   // 4. Проверка if условий
//   if (jobConfig.if) {
//     const ifConditions = Array.isArray(jobConfig.if) ? jobConfig.if : [jobConfig.if];
//     const hasProdCondition = ifConditions.some(condition => 
//       condition && (
//         condition.includes('main') || 
//         condition.includes('master') || 
//         condition.includes('production') ||
//         condition.includes('prod') ||
//         /CI_COMMIT_BRANCH.*main|CI_COMMIT_BRANCH.*master/i.test(condition)
//       )
//     );
//     if (hasProdCondition && jobConfig.when !== 'manual') {
//       jobDetails.autoReason = 'if conditions without manual when';
//       return true;
//     }
//   }
  
//   // 5. Проверка tags на автоматический запуск
//   if (jobConfig.tags) {
//     const tags = Array.isArray(jobConfig.tags) ? jobConfig.tags : [jobConfig.tags];
//     const hasProdTag = tags.some(tag => 
//       typeof tag === 'string' && /prod|production|live/i.test(tag)
//     );
//     if (hasProdTag && (!jobConfig.when || jobConfig.when !== 'manual')) {
//       jobDetails.autoReason = 'production tags without manual when';
//       return true;
//     }
    
//     const prodRunnerTags = ['k8s-prod', 'aws-prod', 'gcp-prod', 'prod-runner'];
//     const hasProdRunnerTag = tags.some(tag => 
//       prodRunnerTags.includes(tag) || (typeof tag === 'string' && /.*prod.*runner|runner.*prod/i.test(tag))
//     );
//     if (hasProdRunnerTag && (!jobConfig.when || jobConfig.when !== 'manual')) {
//       jobDetails.autoReason = 'production runner tags without manual when';
//       return true;
//     }
//   }
  
//   // 6. Если нет никаких ограничений
//   if (!jobConfig.rules && !jobConfig.only && !jobConfig.except && !jobConfig.when && !jobConfig.if) {
//     jobDetails.autoReason = 'no restrictions found';
//     return true;
//   }
  
//   return false;
// }

// /**
//  * Форматирует результат проверки автодеплоя
//  */
// function formatAutoDeployResult(autoDeploy, detectedJobs) {
//   let details = '';
//   if (autoDeploy) {
//     const jobList = detectedJobs.map(j => `${j.job} (${j.details.autoReason})`).join(', ');
//     details = `Обнаружен автоматический деплой на PROD в джобах: ${jobList}`;
//   } else {
//     details = 'Автодеплой на PROD не найден';
//   }
  
//   return {
//     item: "Автоматический деплой на production",
//     status: autoDeploy ? "WARN" : "OK",
//     details: details,
//     detectedJobs: detectedJobs
//   };
// }

// /**
//  * Проверяет защиту от force push в production ветках
//  */
// function checkForcePushProtection(protectedBranches, branches) {
//   const prodBranches = ['main', 'master', 'prod', 'production', 'release'];
//   let forcePushDetected = false;
//   let unprotectedBranches = [];
//   let forcePushAllowedBranches = [];

//   // Проверяем основные prod ветки
//   for (const branchName of prodBranches) {
//     const branch = branches.find(b => b.name === branchName);
//     const protectedBranch = protectedBranches.find(b => b.name === branchName);
    
//     if (branch) {
//       const branchIssues = checkBranchProtectionIssues(branchName, protectedBranch);
      
//       if (branchIssues.unprotected) {
//         unprotectedBranches.push(`${branchName} (не защищена)`);
//         forcePushDetected = true;
//       }
      
//       if (branchIssues.forcePushAllowed) {
//         forcePushAllowedBranches.push(`${branchName} (force push разрешен)`);
//         forcePushDetected = true;
//       }
      
//       if (branchIssues.developerCanPush) {
//         forcePushAllowedBranches.push(`${branchName} (push разрешен для разработчиков)`);
//         forcePushDetected = true;
//       }
//     }
//   }

//   // Проверяем все защищенные ветки на наличие force push
//   protectedBranches.forEach(protectedBranch => {
//     const isProdBranch = prodBranches.includes(protectedBranch.name) || 
//                         /prod|production|release|main|master/i.test(protectedBranch.name);
    
//     if (isProdBranch) {
//       const allowsForcePush = protectedBranch.allow_force_push || 
//                              (protectedBranch.push_access_levels && 
//                               protectedBranch.push_access_levels.some(access => 
//                                 access.access_level >= 30
//                               ));
      
//       if (allowsForcePush && !forcePushAllowedBranches.includes(`${protectedBranch.name} (force push разрешен)`)) {
//         forcePushAllowedBranches.push(`${protectedBranch.name} (force push разрешен)`);
//         forcePushDetected = true;
//       }
//     }
//   });

//   return formatForcePushResult(forcePushDetected, unprotectedBranches, forcePushAllowedBranches);
// }

// /**
//  * Проверяет проблемы защиты конкретной ветки
//  */
// function checkBranchProtectionIssues(branchName, protectedBranch) {
//   const issues = {
//     unprotected: false,
//     forcePushAllowed: false,
//     developerCanPush: false
//   };

//   if (!protectedBranch) {
//     issues.unprotected = true;
//     return issues;
//   }

//   // Проверяем настройки защищенной ветки
//   const allowsForcePush = protectedBranch.allow_force_push || 
//                          (protectedBranch.push_access_levels && 
//                           protectedBranch.push_access_levels.some(access => 
//                             access.access_level >= 30
//                           ));
  
//   if (allowsForcePush) {
//     issues.forcePushAllowed = true;
//   }
  
//   // Дополнительная проверка: если разрешен push для разработчиков
//   const developerCanPush = protectedBranch.push_access_levels && 
//                           protectedBranch.push_access_levels.some(access => 
//                             access.access_level === 30
//                           );
  
//   if (developerCanPush) {
//     issues.developerCanPush = true;
//   }

//   return issues;
// }

// /**
//  * Форматирует результат проверки force push
//  */
// function formatForcePushResult(forcePushDetected, unprotectedBranches, forcePushAllowedBranches) {
//   let details = '';
//   if (forcePushDetected) {
//     const issues = [...unprotectedBranches, ...forcePushAllowedBranches];
//     details = `Обнаружены проблемы с защитой веток: ${issues.join(', ')}`;
//   } else {
//     details = 'Все основные ветки защищены от force push';
//   }

//   return {
//     item: "Force push защита в production ветках",
//     status: forcePushDetected ? "WARN" : "OK",
//     details: details,
//     unprotectedBranches: unprotectedBranches,
//     forcePushAllowedBranches: forcePushAllowedBranches
//   };
// }

// /**
//  * Основная функция проверки
//  */
// module.exports = async function checkSEC1(projectId, projectData, gitlab) {
//   // const protectedBranches = await gitlab.getProtectedBranches(projectId);
//   // const branches = await gitlab.getBranches(projectId);
//   // const mergeRequests = await gitlab.getMergeRequests(projectId, "merged");
//   // const pipelines = await gitlab.getProjectPipelines(projectId);
//   // const gitlabCIRaw = await gitlab.getGitlabCIFile(projectId);

//   const {
//     protectedBranches,
//     branches,
//     mergeRequests,
//     pipelines,
//     gitlabCIRaw,
//   } = projectData

//   const results = [];

//   // 1. Проверка автоматического деплоя
//   results.push(checkAutoDeploy(gitlabCIRaw));

//   // 2. Проверка force push защиты
//   results.push(checkForcePushProtection(protectedBranches, branches));

//   // 3. Проверка защиты основной ветки
//   const hasProtectedMain = protectedBranches.some(
//     (b) => b.name === "main" || b.name === "master"
//   );

//   results.push({
//     item: "Защищена ли основная ветка (main/master)",
//     status: hasProtectedMain ? "OK" : "FAIL",
//     details: hasProtectedMain
//       ? "Основная ветка защищена, действия разработчиков контролируются."
//       : "Main/master не защищена — любой разработчик может деплоить на прод.",
//   });

//   // 4. Проверка production-веток без защиты
//   const dangerousBranches = branches.filter((b) =>
//     ["prod", "production", "release"].includes(b.name)
//   );

//   results.push({
//     item: "Наличие production-веток без защиты",
//     status: dangerousBranches.length ? "FAIL" : "OK",
//     details: dangerousBranches.length
//       ? `Незащищённые prod-ветки: ${dangerousBranches
//           .map((b) => b.name)
//           .join(", ")}`
//       : "Production-ветки защищены или отсутствуют.",
//   });

//   // 5. Проверка MR без ревью
//   const noReview = mergeRequests.filter(
//     (mr) => mr.approvals_before_merge === 0
//   );

//   results.push({
//     item: "MR без ревью",
//     status: noReview.length > 0 ? "WARN" : "OK",
//     details: noReview.length
//       ? `${noReview.length} слияний выполнено без ревью`
//       : "Все слияния проходят ревью.",
//   });

//   // 6. Проверка пайплайнов без проверок
//   const suspiciousPipelines = pipelines.filter(
//     (p) => p.status === "success" && p.source === "push"
//   );

//   results.push({
//     item: "Запуск прод-пайплайна по push (без MR/Review)",
//     status: suspiciousPipelines.length > 0 ? "WARN" : "OK",
//     details: suspiciousPipelines.length
//       ? "Прод-пайплайн можно запустить обычным пушем."
//       : "Прод-пайплайн запускается корректно.",
//   });

//   return {
//     id: "SEC-CICD-1",
//     name: "Недостаточные механизмы управления потоком",
//     results,
//   };
// };