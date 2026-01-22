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
      status: "DANGER",
      details: `Ошибка парсинга .gitlab-ci.yml: ${error.message}`,
      detectedJobs: [],
      severity: 'critical'
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
  
  // Проверка except (отсутствие manual)
  if (jobConfig.except) {
    const exceptValues = Array.isArray(jobConfig.except) ? jobConfig.except : [jobConfig.except];
    const hasManualExcept = exceptValues.includes('manual');
    if (!hasManualExcept) {
      jobDetails.autoReason = 'except does not exclude manual';
      return true;
    }
  }
  
  // Проверка when
  if (!jobConfig.when || (jobConfig.when && jobConfig.when !== 'manual')) {
    jobDetails.autoReason = 'when not set to manual';
    return true;
  }
  
  // Проверка if условий
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
  
  // проверка tags на автоматический запуск
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
  
  // Если нет никаких ограничений
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
    status: autoDeploy ? "DANGER" : "OK",
    details: details,
    detectedJobs: detectedJobs,
    severity: "critical"
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
    status: forcePushDetected ? "DANGER" : "OK",
    details: details,
    unprotectedBranches: unprotectedBranches,
    forcePushAllowedBranches: forcePushAllowedBranches,
    severity: "critical"
  };
}

/**
 * Проверка MR без ревью
 */
function checkAutoMR(mergeRequests) {
  // console.log(mergeRequests)
  const autoMerges = mergeRequests.filter(
    (mr) => mr.merge_when_pipeline_succeeds
  );

  return {
    item: "Обнаружено злоупотребление правилом автослияния в CI",
    status: autoMerges.length > 0 ? "WARN" : "OK",
    details: autoMerges.length
      // ? `${autoMerges.length} слияний выполнено без ревью`
      ? `Правило merge_when_pipeline_succeeds, установленое в true, обнаружены в MR c id: ${autoMerges.map((mr) => String(mr.id)).join(', ')}`
      : "Злоупотребление правилом автослияния в CI не обнаружены",
    severity: "high"
  };
}

function checkPipelinesWithoutChecks(pipelines, gitLabCIRaw) {
    const suspiciousPipelines = [];
    
    // проверяем наличие пайплайнов, запущенных по push
    if (pipelines && pipelines.length > 0) {
        const pushPipelines = pipelines.filter(
            (p) => p.status === "success" && 
                   (p.source === "push" || 
                    p.source === "web" || 
                    p.source === "api")
        );
        
        if (pushPipelines.length > 0) {
            suspiciousPipelines.push(...pushPipelines.slice(0, 3)); // берем первые 3 для примера
        }
    }
    
    // анализируем workflow.rules в .gitlab-ci.yml
    let workflowAllowsPush = true; // По умолчанию push разрешен, если нет workflow.rules
    let workflowRuleDetails = '';
    
    if (gitLabCIRaw) {
        try {
            const parsed = yaml.load(gitLabCIRaw);
            
            if (parsed.workflow && parsed.workflow.rules) {
                const workflowRules = parsed.workflow.rules;
                
                // Проверяем, есть ли правило, которое блокирует push
                const hasPushBlockRule = workflowRules.some(rule => {
                    if (rule.if) {
                        const ifCondition = Array.isArray(rule.if) ? rule.if : [rule.if];
                        return ifCondition.some(condition => 
                            condition && condition.includes('$CI_PIPELINE_SOURCE') && 
                            condition.includes('push') &&
                            (condition.includes('!=') || condition.includes('== "merge_request"'))
                        );
                    }
                    return false;
                });
                
                // Проверяем, есть ли правило, которое разрешает только merge_request
                const hasOnlyMergeRequestRule = workflowRules.some(rule => {
                    if (rule.if) {
                        const ifCondition = Array.isArray(rule.if) ? rule.if : [rule.if];
                        return ifCondition.some(condition => 
                            condition && (
                                condition === '$CI_PIPELINE_SOURCE == "merge_request"' ||
                                condition === '$CI_PIPELINE_SOURCE == "merge_request_event"'
                            )
                        );
                    }
                    return false;
                });
                
                // Проверяем конкретно правило запрещен ли запус пайплайна через пуш
                const hasNotPushRule = workflowRules.some(rule => {
                    if (rule.if) {
                        const ifCondition = Array.isArray(rule.if) ? rule.if : [rule.if];
                        return ifCondition.some(condition => 
                            condition && (
                                condition.trim() === '$CI_PIPELINE_SOURCE != "push"' ||
                                condition.trim() === '$CI_PIPELINE_SOURCE != "push"'
                            )
                        );
                    }
                    return false;
                });
                
                if (hasNotPushRule) {
                    workflowAllowsPush = false;
                    workflowRuleDetails = 'workflow.rules содержит правило: $CI_PIPELINE_SOURCE != "push"';
                } else if (hasPushBlockRule || hasOnlyMergeRequestRule) {
                    workflowAllowsPush = false;
                    workflowRuleDetails = 'workflow.rules ограничивает запуск по push';
                } else {
                    workflowRuleDetails = 'workflow.rules не ограничивает запуск по push';
                }
            } else {
                workflowRuleDetails = 'workflow.rules не настроен (push разрешен по умолчанию)';
            }
        } catch (error) {
            workflowRuleDetails = `Ошибка парсинга workflow.rules: ${error.message}`;
        }
    }
    
    // Формируем результат
    let status = "OK";
    let details = "";
    
    if (suspiciousPipelines.length > 0 && workflowAllowsPush) {
        status = "WARN";
        details = `Обнаружены успешные пайплайны, запущенные по push (${suspiciousPipelines.length} шт.). workflow.rules не ограничивает push.`;
    } else if (suspiciousPipelines.length > 0 && !workflowAllowsPush) {
        status = "OK";
        details = `Обнаружены пайплайны по push, но workflow.rules настроен корректно.`;
    } else if (!workflowAllowsPush) {
        status = "OK";
        details = `workflow.rules настроен корректно и ограничивает запуск по push. ${workflowRuleDetails}`;
    } else {
        status = "WARN";
        details = `workflow.rules не настроен или не ограничивает запуск по push. ${workflowRuleDetails}`;
    }
    
    return {
        item: "Запуск пайплайна по push (без MR/Review)",
        status: status,
        details: details,
        severity: "critical"
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
    // Проверка автоматического деплоя
    results.push(gitlabCIRaw ? checkAutoDeploy(gitlabCIRaw) : {
      item: "Автоматический деплой на production",
      status: "INFO",
      details: ".gitlab-ci.yml не найден",
      severity: "critical"
    });

    // Проверка force push защиты
    results.push(checkForcePushProtection(protectedBranches, branches));

    // Проверка злоупотребления auto-MR
    results.push(checkAutoMR(mergeRequests));

    // Проверка пайплайнов без проверок
    // results.push(checkPipelinesWithoutChecks(pipelines));
    results.push(checkPipelinesWithoutChecks(pipelines, gitlabCIRaw));

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