// const yaml = require('js-yaml');

// // const findDeployStages = (obj) => {
// //   const deployStages = [];
// //   const targetStages = ['deploy', 'deployment', 'prod', 'production', 'deploy_prod']; // добавьте нужные значения
  
// //   for (const key in obj) {
// //     const item = obj[key];
// //     if (item && typeof item === 'object' && item.stage) {
// //       if (targetStages.includes(item.stage)) {
// //         deployStages.push({ key, ...item });
// //       }
// //     }
// //   }
  
// //   return deployStages;
// // }

// // function checkForcePush(protectedBranches) {
// //   const prodBranches = ['main', 'master', 'prod', 'production', 'release'];
// //   let forcePushAllowed = false;
// //   let vulnerableBranches = [];
  
// //   for (const branch of protectedBranches) {
// //     if (prodBranches.includes(branch.name)) {
// //       // Проверяем настройки force push
// //       const allowsForcePush = branch.allow_force_push || 
// //                              branch.push_access_levels?.some(access => 
// //                                access.allow_force_push === true
// //                              );
      
// //       if (allowsForcePush) {
// //         forcePushAllowed = true;
// //         vulnerableBranches.push({
// //           branch: branch.name,
// //           details: 'Force push разрешен'
// //         });
// //       }
      
// //       // Дополнительная проверка: если ветка защищена, но push разрешен для maintainers/developers
// //       // и при этом force push не запрещен явно
// //       if (branch.push_access_levels && branch.push_access_levels.length > 0) {
// //         const hasPushAccess = branch.push_access_levels.some(access => 
// //           access.access_level >= 30 // 30 = developer, 40 = maintainer
// //         );
        
// //         if (hasPushAccess && !branch.allow_force_push === false) {
// //           // Force push не запрещен явно, что может быть опасно
// //           vulnerableBranches.push({
// //             branch: branch.name,
// //             details: 'Push разрешен для разработчиков, force push не запрещен явно'
// //           });
// //         }
// //       }
// //     }
// //   }
  
// //   // Формируем результат
// //   let details = '';
// //   if (forcePushAllowed || vulnerableBranches.length > 0) {
// //     const branchList = vulnerableBranches.map(b => `${b.branch} (${b.details})`).join(', ');
// //     details = `Force push разрешен или потенциально возможен в ветках: ${branchList}`;
// //   } else {
// //     details = 'Force push запрещен во всех production ветках';
// //   }
  
// //   return {
// //     item: "Force push в production ветках",
// //     status: forcePushAllowed ? "FAIL" : (vulnerableBranches.length > 0 ? "WARN" : "OK"),
// //     details: details,
// //     vulnerableBranches: vulnerableBranches
// //   };
// // }

// // /**
// //  * Проверяет настройки защиты веток для production
// //  */
// // function checkBranchProtection(protectedBranches, branches) {
// //   const prodBranches = ['main', 'master', 'prod', 'production', 'release'];
// //   let unprotectedBranches = [];
// //   let weakProtectedBranches = [];
  
// //   // Проверяем основные production ветки
// //   for (const branchName of prodBranches) {
// //     const branch = protectedBranches.find(b => b.name === branchName);
// //     const branchExists = branches.some(b => b.name === branchName);
    
// //     if (branchExists && !branch) {
// //       // Ветка существует, но не защищена
// //       unprotectedBranches.push(branchName);
// //     } else if (branch) {
// //       // Ветка защищена, но проверяем настройки защиты
// //       const protectionIssues = [];
      
// //       // Проверяем минимальные требования к защите
// //       if (!branch.merge_access_levels || branch.merge_access_levels.length === 0) {
// //         protectionIssues.push('нет ограничений на мерж');
// //       }
      
// //       if (branch.allow_force_push) {
// //         protectionIssues.push('разрешен force push');
// //       }
      
// //       // Проверяем уровень доступа для push
// //       if (branch.push_access_levels && branch.push_access_levels.length > 0) {
// //         const hasLowLevelPush = branch.push_access_levels.some(access => 
// //           access.access_level <= 40 // 40 = maintainer, 30 = developer
// //         );
// //         if (hasLowLevelPush) {
// //           protectionIssues.push('push разрешен для разработчиков');
// //         }
// //       }
      
// //       if (protectionIssues.length > 0) {
// //         weakProtectedBranches.push({
// //           branch: branchName,
// //           issues: protectionIssues
// //         });
// //       }
// //     }
// //   }
  
// //   // Формируем результат
// //   let details = '';
// //   if (unprotectedBranches.length > 0) {
// //     details = `Незащищенные production ветки: ${unprotectedBranches.join(', ')}`;
// //   } else if (weakProtectedBranches.length > 0) {
// //     const weakList = weakProtectedBranches.map(b => 
// //       `${b.branch} (${b.issues.join(', ')})`
// //     ).join('; ');
// //     details = `Слабая защита production веток: ${weakList}`;
// //   } else {
// //     details = 'Все production ветки надежно защищены';
// //   }
  
// //   const status = unprotectedBranches.length > 0 ? "FAIL" : 
// //                 weakProtectedBranches.length > 0 ? "WARN" : "OK";
  
// //   return {
// //     item: "Защита production веток",
// //     status: status,
// //     details: details,
// //     unprotectedBranches: unprotectedBranches,
// //     weakProtectedBranches: weakProtectedBranches
// //   };
// // }


// function checkAutoDeploy(raw) {
//   const parsedGitlabCI = yaml.load(raw);
//   const { stages } = parsedGitlabCI;
//   let autoDeploy = false;
//   let detectedJobs = [];
  
//   for (const key in parsedGitlabCI) {
//     if (parsedGitlabCI.hasOwnProperty(key) && typeof parsedGitlabCI[key] === 'object' && parsedGitlabCI[key] !== null) {
//       const item = parsedGitlabCI[key];
      
//       // Пропускаем служебные поля и шаблоны
//       if (key.startsWith('.') || ['include', 'variables', 'stages', 'workflow', 'default'].includes(key)) {
//         continue;
//       }
      
//       // Проверяем, что stage объекта есть в основном списке stages
//       if (item.stage && stages && stages.includes(item.stage)) {
//         let isProdJob = false;
//         let isAutoRun = false;
//         let jobDetails = {};
        
//         // ДЕТЕКТИРОВАНИЕ PRODUCTION ДЖОБА
//         // 1. По environment
//         if (item.environment) {
//           const envName = typeof item.environment === 'string' 
//             ? item.environment 
//             : item.environment.name;
//           if (envName && /prod|production|live|release/i.test(envName)) {
//             isProdJob = true;
//             jobDetails.environment = envName;
//           }
//         }
        
//         // 2. По названию джоба
//         if (/deploy.*prod|prod.*deploy|release.*prod|prod.*release|live.*deploy|production/i.test(key)) {
//           isProdJob = true;
//           jobDetails.jobName = key;
//         }
        
//         // 3. По stage
//         if (/deploy|release|prod/i.test(item.stage)) {
//           isProdJob = true;
//           jobDetails.stage = item.stage;
//         }
        
//         // 4. По скриптам (если есть команды деплоя)
//         // if (item.script) {
//         //   const scripts = Array.isArray(item.script) ? item.script : [item.script];
//         //   const deployCommands = ['deploy', 'kubectl', 'helm', 'docker push', 'rsync', 'scp', 'capistrano'];
//         //   const hasDeployCommand = scripts.some(script => 
//         //     script && deployCommands.some(cmd => script.toString().toLowerCase().includes(cmd))
//         //   );
//         //   if (hasDeployCommand) {
//         //     isProdJob = true;
//         //     jobDetails.hasDeployCommands = true;
//         //   }
//         // }

//         // 5. По tags (продакшен теги)
//         if (item.tags) {
//           const tags = Array.isArray(item.tags) ? item.tags : [item.tags];
//           const prodTags = ['production', 'prod', 'live', 'release', 'k8s-prod', 'aws-prod'];
//           const hasProdTag = tags.some(tag => 
//             prodTags.includes(tag) || (typeof tag === 'string' && /prod|production|live/i.test(tag))
//           );
//           if (hasProdTag) {
//             isProdJob = true;
//             jobDetails.prodTags = tags.filter(tag => 
//               prodTags.includes(tag) || (typeof tag === 'string' && /prod|production|live/i.test(tag))
//             );
//           }
//         }
        
//         // ДЕТЕКТИРОВАНИЕ АВТОМАТИЧЕСКОГО ЗАПУСКА
//         if (isProdJob) {
//           // 1. Проверка rules (новый синтаксис)
//           if (item.rules && Array.isArray(item.rules)) {
//             const hasAutoRule = item.rules.some(rule => {
//               // Если правило разрешает автоматический запуск
//               const hasManualWhen = rule.when === 'manual' || rule.when === 'never';
//               const hasAutoWhen = !rule.when || (rule.when && !hasManualWhen);
              
//               // Проверяем условия в if (если есть)
//               let hasProdCondition = false;
//               if (rule.if) {
//                 const ifConditions = Array.isArray(rule.if) ? rule.if : [rule.if];
//                 hasProdCondition = ifConditions.some(condition => 
//                   condition && (
//                     condition.includes('main') || 
//                     condition.includes('master') || 
//                     condition.includes('production') ||
//                     condition.includes('prod') ||
//                     /CI_COMMIT_BRANCH.*main|CI_COMMIT_BRANCH.*master/i.test(condition)
//                   )
//                 );
//               }
              
//               return hasAutoWhen && (hasProdCondition || !rule.if);
//             });
//             if (hasAutoRule) {
//               isAutoRun = true;
//               jobDetails.autoReason = 'rules allow auto-run';
//             }
//           }
          
//           // 2. Проверка only (старый синтаксис)
//           // if (item.only && !isAutoRun) {
//           //   const onlyValues = Array.isArray(item.only) ? item.only : [item.only];
//           //   const prodBranches = ['main', 'master', 'production', 'prod'];
//           //   const hasProdOnly = onlyValues.some(val => 
//           //     prodBranches.includes(val) || (typeof val === 'string' && /prod/i.test(val))
//           //   );
//           //   if (hasProdOnly) {
//           //     isAutoRun = true;
//           //     jobDetails.autoReason = 'only includes production branches';
//           //   }
//           // }
          
//           // 3. Проверка except (отсутствие manual)
//           if (item.except && !isAutoRun) {
//             const exceptValues = Array.isArray(item.except) ? item.except : [item.except];
//             const hasManualExcept = exceptValues.includes('manual');
//             if (!hasManualExcept) {
//               isAutoRun = true;
//               jobDetails.autoReason = 'except does not exclude manual';
//             }
//           }
          
//           // 4. Проверка when
//           if (!item.when || (item.when && item.when !== 'manual')) {
//             if (!isAutoRun) {
//               isAutoRun = true;
//               jobDetails.autoReason = 'when not set to manual';
//             }
//           }
          
//           // 5. Проверка if условий
//           if (item.if && !isAutoRun) {
//             // Если есть if условия без when: manual, считаем автоматическим
//             const ifConditions = Array.isArray(item.if) ? item.if : [item.if];
//             const hasProdCondition = ifConditions.some(condition => 
//               condition && (
//                 condition.includes('main') || 
//                 condition.includes('master') || 
//                 condition.includes('production') ||
//                 condition.includes('prod') ||
//                 /CI_COMMIT_BRANCH.*main|CI_COMMIT_BRANCH.*master/i.test(condition)
//               )
//             );
//             if (hasProdCondition && item.when !== 'manual') {
//               isAutoRun = true;
//               jobDetails.autoReason = 'if conditions without manual when';
//             }
//           }
          
//           // 6. Проверка tags на автоматический запуск
//           if (item.tags && !isAutoRun) {
//             // Если есть продакшен теги и нет when: manual, считаем автоматическим
//             const tags = Array.isArray(item.tags) ? item.tags : [item.tags];
//             const hasProdTag = tags.some(tag => 
//               typeof tag === 'string' && /prod|production|live/i.test(tag)
//             );
//             if (hasProdTag && (!item.when || item.when !== 'manual')) {
//               isAutoRun = true;
//               jobDetails.autoReason = 'production tags without manual when';
//             }
            
//             // Если теги указывают на runner'ы для продакшена
//             const prodRunnerTags = ['k8s-prod', 'aws-prod', 'gcp-prod', 'prod-runner'];
//             const hasProdRunnerTag = tags.some(tag => 
//               prodRunnerTags.includes(tag) || (typeof tag === 'string' && /.*prod.*runner|runner.*prod/i.test(tag))
//             );
//             if (hasProdRunnerTag && (!item.when || item.when !== 'manual')) {
//               isAutoRun = true;
//               jobDetails.autoReason = 'production runner tags without manual when';
//             }
//           }
          
//           // 7. Если нет никаких ограничений - считаем автоматическим
//           if (!item.rules && !item.only && !item.except && !item.when && !item.if && !isAutoRun) {
//             isAutoRun = true;
//             jobDetails.autoReason = 'no restrictions found';
//           }
//         }
        
//         // ФИНАЛЬНАЯ ПРОВЕРКА
//         if (isProdJob && isAutoRun) {
//           autoDeploy = true;
//           detectedJobs.push({
//             job: key,
//             details: jobDetails
//           });
//         }
        
//         // Логирование для отладки
//         // console.log(`Job: ${key}`);
//         // console.log(`  Stage: ${item.stage}`);
//         // console.log(`  Is Production: ${isProdJob}`);
//         // console.log(`  Is Auto-run: ${isAutoRun}`);
//         // if (item.only) console.log(`  Only:`, item.only);
//         // if (item.when) console.log(`  When:`, item.when);
//         // if (item.environment) console.log(`  Environment:`, item.environment);
//         // if (item.tags) console.log(`  Tags:`, item.tags);
//         // if (item.rules) console.log(`  Rules:`, item.rules);
//         // if (item.if) console.log(`  If:`, item.if);
//         // console.log('---');
//       }
//     }
//   }
  
//   // Формируем детальное сообщение
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


// // Новая функция для проверки force push в prod ветки
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
//       // Если ветка существует
//       if (!protectedBranch) {
//         // Ветка не защищена вообще
//         unprotectedBranches.push(`${branchName} (не защищена)`);
//         forcePushDetected = true;
//       } else {
//         // Проверяем настройки защищенной ветки
//         const allowsForcePush = protectedBranch.allow_force_push || 
//                                (protectedBranch.push_access_levels && 
//                                 protectedBranch.push_access_levels.some(access => 
//                                   access.access_level >= 30 // Maintainer или выше
//                                 ));
        
//         if (allowsForcePush) {
//           forcePushAllowedBranches.push(`${branchName} (force push разрешен)`);
//           forcePushDetected = true;
//         }
        
//         // Дополнительная проверка: если разрешен push для разработчиков
//         const developerCanPush = protectedBranch.push_access_levels && 
//                                 protectedBranch.push_access_levels.some(access => 
//                                   access.access_level === 30 // Developer level
//                                 );
        
//         if (developerCanPush) {
//           forcePushAllowedBranches.push(`${branchName} (push разрешен для разработчиков)`);
//           forcePushDetected = true;
//         }
//       }
//     }
//   }

//   // Проверяем все защищенные ветки на наличие force push
//   protectedBranches.forEach(protectedBranch => {
//     // Проверяем, является ли ветка продакшен-веткой по имени
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

//   // Формируем детали
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



// // check_SEC_1.js
// module.exports = async function checkSEC1(projectId, gitlab) {
//   const protectedBranches = await gitlab.getProtectedBranches(projectId);
//   const branches = await gitlab.getBranches(projectId);
//   const mergeRequests = await gitlab.getMergeRequests(projectId, "merged");
//   const pipelines = await gitlab.getProjectPipelines(projectId);
//   const raw = await gitlab.getGitlabCIFile(projectId);

//   const results = [];

//   // // 1. Детектирования автодеплоя на прод


//   results.push(checkAutoDeploy(raw))

//   results.push(checkForcePushProtection(protectedBranches, branches));

//   // 2. Проверка force push в production ветках
    
//   // results.push(checkForcePush(protectedBranches));

//   // // 3. Проверка защиты production веток
//   // results.push(checkBranchProtection(protectedBranches, branches));
//   // let autoDeploy = false;

//   // const parsed = yaml.load(raw);
//   // console.log(parsed)

//   // const deployStages = findDeployStages(parsed)
//   // console.log(deployStages)

//   // deployStages.forEach(deployStage => {
//   //   if (deployStage?.when && deployStage?.when !== 'manual') {
//   //     autoDeploy = !autoDeploy
//   //   }
//   // });

//   // results.push({
//   //   item: "Автоматический деплой на production",
//   //   status: autoDeploy ? "WARN" : "OK",
//   //   details: autoDeploy
//   //     ? "В gitlab-ci обнаружен auto-deploy на PROD"
//   //     : "Автодеплой на PROD не найден",
//   // });

//   // let autoDeploy = false;

//   // if (raw) {
//   //   try {
//   //     const parsed = yaml.load(raw);

//   //     console.log(parsed)

//   //     // Ищем job'ы, у которых:
//   //     // - stage = deploy
//   //     // - environment.name содержит 'prod'
//   //     // - rules/only: ['main'] или вообще auto-run

//   //     for (const [jobName, job] of Object.entries(parsed)) {
//   //       if (job && (job.stage === "deploy") && job.environment) {
//   //         const env =
//   //           typeof job.environment === "string"
//   //             ? job.environment
//   //             : job.environment.name;

//   //         if (env && /prod/i.test(env)) {
//   //           // Проверяем auto-run (rules/only)
//   //           if (job.only || job.rules) {
//   //             autoDeploy = true;
//   //             break;
//   //           }
//   //         }
//   //       }
//   //     }
//   //   } catch (e) {
//   //     console.error("YAML parse error:", e.message);
//   //   }
//   // }

//   // results.push({
//   //   item: "Автоматический деплой на production",
//   //   status: autoDeploy ? "WARN" : "OK",
//   //   details: autoDeploy
//   //     ? "В .gitlab-ci.yml обнаружен auto-deploy на PROD"
//   //     : "Автодеплой на PROD не найден",
//   // });

//   // 1. Бесконтрольный деплой на прод
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

//   // 2. Могут ли разработчики пушить в production ветку
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

//   // 3. MR без ревью
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

//   // 4. Пайплайны без проверок
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
//     id: "CICD-SEC-1",
//     name: "Недостаточные механизмы управления потоком",
//     results,
//   };
// };

const yaml = require('js-yaml');

/**
 * Проверяет наличие автоматического деплоя на production в .gitlab-ci.yml
 */
function checkAutoDeploy(raw) {
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
    detectedJobs: detectedJobs
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
    forcePushAllowedBranches: forcePushAllowedBranches
  };
}

/**
 * Основная функция проверки
 */
module.exports = async function checkSEC1(projectId, gitlab) {
  const protectedBranches = await gitlab.getProtectedBranches(projectId);
  const branches = await gitlab.getBranches(projectId);
  const mergeRequests = await gitlab.getMergeRequests(projectId, "merged");
  const pipelines = await gitlab.getProjectPipelines(projectId);
  const raw = await gitlab.getGitlabCIFile(projectId);

  const results = [];

  // 1. Проверка автоматического деплоя
  results.push(checkAutoDeploy(raw));

  // 2. Проверка force push защиты
  results.push(checkForcePushProtection(protectedBranches, branches));

  // 3. Проверка защиты основной ветки
  const hasProtectedMain = protectedBranches.some(
    (b) => b.name === "main" || b.name === "master"
  );

  results.push({
    item: "Защищена ли основная ветка (main/master)",
    status: hasProtectedMain ? "OK" : "FAIL",
    details: hasProtectedMain
      ? "Основная ветка защищена, действия разработчиков контролируются."
      : "Main/master не защищена — любой разработчик может деплоить на прод.",
  });

  // 4. Проверка production-веток без защиты
  const dangerousBranches = branches.filter((b) =>
    ["prod", "production", "release"].includes(b.name)
  );

  results.push({
    item: "Наличие production-веток без защиты",
    status: dangerousBranches.length ? "FAIL" : "OK",
    details: dangerousBranches.length
      ? `Незащищённые prod-ветки: ${dangerousBranches
          .map((b) => b.name)
          .join(", ")}`
      : "Production-ветки защищены или отсутствуют.",
  });

  // 5. Проверка MR без ревью
  const noReview = mergeRequests.filter(
    (mr) => mr.approvals_before_merge === 0
  );

  results.push({
    item: "MR без ревью",
    status: noReview.length > 0 ? "WARN" : "OK",
    details: noReview.length
      ? `${noReview.length} слияний выполнено без ревью`
      : "Все слияния проходят ревью.",
  });

  // 6. Проверка пайплайнов без проверок
  const suspiciousPipelines = pipelines.filter(
    (p) => p.status === "success" && p.source === "push"
  );

  results.push({
    item: "Запуск прод-пайплайна по push (без MR/Review)",
    status: suspiciousPipelines.length > 0 ? "WARN" : "OK",
    details: suspiciousPipelines.length
      ? "Прод-пайплайн можно запустить обычным пушем."
      : "Прод-пайплайн запускается корректно.",
  });

  return {
    id: "CICD-SEC-1",
    name: "Недостаточные механизмы управления потоком",
    results,
  };
};