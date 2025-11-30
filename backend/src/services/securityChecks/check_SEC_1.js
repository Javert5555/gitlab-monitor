const yaml = require('js-yaml');

const findDeployStages = (obj) => {
  const deployStages = [];
  const targetStages = ['deploy', 'deployment', 'prod', 'production', 'deploy_prod']; // добавьте нужные значения
  
  for (const key in obj) {
    const item = obj[key];
    if (item && typeof item === 'object' && item.stage) {
      if (targetStages.includes(item.stage)) {
        deployStages.push({ key, ...item });
      }
    }
  }
  
  return deployStages;
}

// function checkStagesByList(ciConfig) {
//   const { stages } = ciConfig;
//   let autoDeploy = false;

//   for (const key in ciConfig) {
//     if (!ciConfig.hasOwnProperty(key)) continue;

//     const job = ciConfig[key];

//     // Пропускаем верхнеуровневые служебные ключи
//     if (["stages", "variables", "workflow", "default"].includes(key)) continue;

//     if (typeof job !== "object" || job === null) continue;

//     const jobStage = job.stage;
//     const env = job.environment;
//     const when = job.when;

//     const isProdEnv =
//       env &&
//       (
//         env === "production" ||
//         env?.name === "production" ||
//         env?.name?.toLowerCase().includes("prod")
//       );

//     // Если вообще нет stage — пропускаем
//     if (!jobStage || !stages.includes(jobStage)) continue;

//     // -------- логирование ----------
//     // console.log(`Job: ${key}`);
//     // console.log(`  Stage: ${jobStage}`);
//     // if (job.only) console.log(`  Only:`, job.only);
//     // if (job.when) console.log(`  When:`, job.when);
//     // if (job.environment) console.log(`  Environment:`, job.environment);
//     // if (job.tags) console.log(`  Tags:`, job.tags);
//     // if (job.rules) console.log(`  Rules:`, job.rules);
//     // if (job.needs) console.log(`  Needs:`, job.needs);
//     // if (job.dependencies) console.log(`  Dependencies:`, job.dependencies);
//     // console.log('---');

//     // ---------- ЛОГИКА ОПРЕДЕЛЕНИЯ AUTO DEPLOY ----------
//     // Prod env, но when = manual → безопасно
//     if (isProdEnv && when === "manual") continue;

//     // Prod env + when отсутствует → авто-деплой
//     if (isProdEnv && !when) {
//       autoDeploy = true;
//       continue;
//     }

//     // Явные авто-триггеры
//     if (isProdEnv && ["on_success", "always", "delayed"].includes(when)) {
//       autoDeploy = true;
//       continue;
//     }

//     // Если stage = deploy и environment = production → почти наверняка авто-деплой
//     if (isProdEnv && ['deploy', 'deployment', 'prod', 'production', 'deploy_prod'].includes(jobStage)) {
//       autoDeploy = true;
//       continue;
//     }

//     // Rules: если в rules нет manual — это авто-деплой
//     if (isProdEnv && job.rules) {
//       const hasManualRule = job.rules.some(r => r.when === "manual");

//       if (!hasManualRule) {
//         autoDeploy = true;
//         continue;
//       }
//     }
//   }
//
//   return {
//     item: "Автоматический деплой на production",
//     status: autoDeploy ? "WARN" : "OK",
//     details: autoDeploy
//       ? "В gitlab-ci обнаружен auto-deploy на PROD"
//       : "Автодеплой на PROD не найден",
//   };
// }


// function checkStagesByList(obj) {
//   const { stages } = obj;
//   let autoDeploy = false;
//   let detectedJobs = [];
  
//   for (const key in obj) {
//     if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && obj[key] !== null) {
//       const item = obj[key];
      
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
//           if (envName && /prod|deployment|production|live|release/i.test(envName)) {
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
//         if (/deploy|deployment|release|prod/i.test(item.stage)) {
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
        
//         // ДЕТЕКТИРОВАНИЕ АВТОМАТИЧЕСКОГО ЗАПУСКА
//         if (isProdJob) {
//           // 1. Проверка rules (новый синтаксис)
//           if (item.rules && Array.isArray(item.rules)) {
//             const hasAutoRule = item.rules.some(rule => {
//               // Если правило разрешает автоматический запуск
//               // return !rule.when || (rule.when !== 'manual' && rule.when !== 'never');
//               return (rule.when !== 'manual' && rule.when !== 'never');
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
//             if (ifConditions.length > 0 && item.when !== 'manual') {
//               isAutoRun = true;
//               jobDetails.autoReason = 'if conditions without manual when';
//             }
//           }
          
//           // 6. Проверка tags (если tags не требуют ручного запуска)
//           if (item.tags && !isAutoRun) {
//             // tags сами по себе не указывают на автоматический запуск,
//             // но если есть tags и нет when: manual, считаем автоматическим
//             if (!item.when || item.when !== 'manual') {
//               isAutoRun = true;
//               jobDetails.autoReason = 'tags without manual when';
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
//         console.log(`Job: ${key}`);
//         console.log(`  Stage: ${item.stage}`);
//         console.log(`  Is Production: ${isProdJob}`);
//         console.log(`  Is Auto-run: ${isAutoRun}`);
//         if (item.only) console.log(`  Only:`, item.only);
//         if (item.when) console.log(`  When:`, item.when);
//         if (item.environment) console.log(`  Environment:`, item.environment);
//         if (item.tags) console.log(`  Tags:`, item.tags);
//         if (item.rules) console.log(`  Rules:`, item.rules);
//         if (item.if) console.log(`  If:`, item.if);
//         console.log('---');
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

function checkStagesByList(obj) {
  const { stages } = obj;
  let autoDeploy = false;
  let detectedJobs = [];
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && obj[key] !== null) {
      const item = obj[key];
      
      // Пропускаем служебные поля и шаблоны
      if (key.startsWith('.') || ['include', 'variables', 'stages', 'workflow', 'default'].includes(key)) {
        continue;
      }
      
      // Проверяем, что stage объекта есть в основном списке stages
      if (item.stage && stages && stages.includes(item.stage)) {
        let isProdJob = false;
        let isAutoRun = false;
        let jobDetails = {};
        
        // ДЕТЕКТИРОВАНИЕ PRODUCTION ДЖОБА
        // 1. По environment
        if (item.environment) {
          const envName = typeof item.environment === 'string' 
            ? item.environment 
            : item.environment.name;
          if (envName && /prod|production|live|release/i.test(envName)) {
            isProdJob = true;
            jobDetails.environment = envName;
          }
        }
        
        // 2. По названию джоба
        if (/deploy.*prod|prod.*deploy|release.*prod|prod.*release|live.*deploy|production/i.test(key)) {
          isProdJob = true;
          jobDetails.jobName = key;
        }
        
        // 3. По stage
        if (/deploy|release|prod/i.test(item.stage)) {
          isProdJob = true;
          jobDetails.stage = item.stage;
        }
        
        // 4. По скриптам (если есть команды деплоя)
        // if (item.script) {
        //   const scripts = Array.isArray(item.script) ? item.script : [item.script];
        //   const deployCommands = ['deploy', 'kubectl', 'helm', 'docker push', 'rsync', 'scp', 'capistrano'];
        //   const hasDeployCommand = scripts.some(script => 
        //     script && deployCommands.some(cmd => script.toString().toLowerCase().includes(cmd))
        //   );
        //   if (hasDeployCommand) {
        //     isProdJob = true;
        //     jobDetails.hasDeployCommands = true;
        //   }
        // }

        // 5. По tags (продакшен теги)
        if (item.tags) {
          const tags = Array.isArray(item.tags) ? item.tags : [item.tags];
          const prodTags = ['production', 'prod', 'live', 'release', 'k8s-prod', 'aws-prod'];
          const hasProdTag = tags.some(tag => 
            prodTags.includes(tag) || (typeof tag === 'string' && /prod|production|live/i.test(tag))
          );
          if (hasProdTag) {
            isProdJob = true;
            jobDetails.prodTags = tags.filter(tag => 
              prodTags.includes(tag) || (typeof tag === 'string' && /prod|production|live/i.test(tag))
            );
          }
        }
        
        // ДЕТЕКТИРОВАНИЕ АВТОМАТИЧЕСКОГО ЗАПУСКА
        if (isProdJob) {
          // 1. Проверка rules (новый синтаксис)
          if (item.rules && Array.isArray(item.rules)) {
            const hasAutoRule = item.rules.some(rule => {
              // Если правило разрешает автоматический запуск
              const hasManualWhen = rule.when === 'manual' || rule.when === 'never';
              const hasAutoWhen = !rule.when || (rule.when && !hasManualWhen);
              
              // Проверяем условия в if (если есть)
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
              isAutoRun = true;
              jobDetails.autoReason = 'rules allow auto-run';
            }
          }
          
          // 2. Проверка only (старый синтаксис)
          // if (item.only && !isAutoRun) {
          //   const onlyValues = Array.isArray(item.only) ? item.only : [item.only];
          //   const prodBranches = ['main', 'master', 'production', 'prod'];
          //   const hasProdOnly = onlyValues.some(val => 
          //     prodBranches.includes(val) || (typeof val === 'string' && /prod/i.test(val))
          //   );
          //   if (hasProdOnly) {
          //     isAutoRun = true;
          //     jobDetails.autoReason = 'only includes production branches';
          //   }
          // }
          
          // 3. Проверка except (отсутствие manual)
          if (item.except && !isAutoRun) {
            const exceptValues = Array.isArray(item.except) ? item.except : [item.except];
            const hasManualExcept = exceptValues.includes('manual');
            if (!hasManualExcept) {
              isAutoRun = true;
              jobDetails.autoReason = 'except does not exclude manual';
            }
          }
          
          // 4. Проверка when
          if (!item.when || (item.when && item.when !== 'manual')) {
            if (!isAutoRun) {
              isAutoRun = true;
              jobDetails.autoReason = 'when not set to manual';
            }
          }
          
          // 5. Проверка if условий
          if (item.if && !isAutoRun) {
            // Если есть if условия без when: manual, считаем автоматическим
            const ifConditions = Array.isArray(item.if) ? item.if : [item.if];
            const hasProdCondition = ifConditions.some(condition => 
              condition && (
                condition.includes('main') || 
                condition.includes('master') || 
                condition.includes('production') ||
                condition.includes('prod') ||
                /CI_COMMIT_BRANCH.*main|CI_COMMIT_BRANCH.*master/i.test(condition)
              )
            );
            if (hasProdCondition && item.when !== 'manual') {
              isAutoRun = true;
              jobDetails.autoReason = 'if conditions without manual when';
            }
          }
          
          // 6. Проверка tags на автоматический запуск
          if (item.tags && !isAutoRun) {
            // Если есть продакшен теги и нет when: manual, считаем автоматическим
            const tags = Array.isArray(item.tags) ? item.tags : [item.tags];
            const hasProdTag = tags.some(tag => 
              typeof tag === 'string' && /prod|production|live/i.test(tag)
            );
            if (hasProdTag && (!item.when || item.when !== 'manual')) {
              isAutoRun = true;
              jobDetails.autoReason = 'production tags without manual when';
            }
            
            // Если теги указывают на runner'ы для продакшена
            const prodRunnerTags = ['k8s-prod', 'aws-prod', 'gcp-prod', 'prod-runner'];
            const hasProdRunnerTag = tags.some(tag => 
              prodRunnerTags.includes(tag) || (typeof tag === 'string' && /.*prod.*runner|runner.*prod/i.test(tag))
            );
            if (hasProdRunnerTag && (!item.when || item.when !== 'manual')) {
              isAutoRun = true;
              jobDetails.autoReason = 'production runner tags without manual when';
            }
          }
          
          // 7. Если нет никаких ограничений - считаем автоматическим
          if (!item.rules && !item.only && !item.except && !item.when && !item.if && !isAutoRun) {
            isAutoRun = true;
            jobDetails.autoReason = 'no restrictions found';
          }
        }
        
        // ФИНАЛЬНАЯ ПРОВЕРКА
        if (isProdJob && isAutoRun) {
          autoDeploy = true;
          detectedJobs.push({
            job: key,
            details: jobDetails
          });
        }
        
        // Логирование для отладки
        // console.log(`Job: ${key}`);
        // console.log(`  Stage: ${item.stage}`);
        // console.log(`  Is Production: ${isProdJob}`);
        // console.log(`  Is Auto-run: ${isAutoRun}`);
        // if (item.only) console.log(`  Only:`, item.only);
        // if (item.when) console.log(`  When:`, item.when);
        // if (item.environment) console.log(`  Environment:`, item.environment);
        // if (item.tags) console.log(`  Tags:`, item.tags);
        // if (item.rules) console.log(`  Rules:`, item.rules);
        // if (item.if) console.log(`  If:`, item.if);
        // console.log('---');
      }
    }
  }
  
  // Формируем детальное сообщение
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


// check_SEC_1.js
module.exports = async function checkSEC1(projectId, gitlab) {
  const protectedBranches = await gitlab.getProtectedBranches(projectId);
  const branches = await gitlab.getBranches(projectId);
  const mergeRequests = await gitlab.getMergeRequests(projectId, "merged");
  const pipelines = await gitlab.getProjectPipelines(projectId);

  const results = [];

  // // 1. Получаем .gitlab-ci.yml
  const raw = await gitlab.getGitlabCIFile(projectId);
  let autoDeploy = false;

  const parsed = yaml.load(raw);

  console.log(parsed)

  results.push(checkStagesByList(parsed))
  

  // const deployStages = findDeployStages(parsed)
  // console.log(deployStages)

  // deployStages.forEach(deployStage => {
  //   if (deployStage?.when && deployStage?.when !== 'manual') {
  //     autoDeploy = !autoDeploy
  //   }
  // });

  // results.push({
  //   item: "Автоматический деплой на production",
  //   status: autoDeploy ? "WARN" : "OK",
  //   details: autoDeploy
  //     ? "В gitlab-ci обнаружен auto-deploy на PROD"
  //     : "Автодеплой на PROD не найден",
  // });

  // let autoDeploy = false;

  // if (raw) {
  //   try {
  //     const parsed = yaml.load(raw);

  //     console.log(parsed)

  //     // Ищем job'ы, у которых:
  //     // - stage = deploy
  //     // - environment.name содержит 'prod'
  //     // - rules/only: ['main'] или вообще auto-run

  //     for (const [jobName, job] of Object.entries(parsed)) {
  //       if (job && (job.stage === "deploy") && job.environment) {
  //         const env =
  //           typeof job.environment === "string"
  //             ? job.environment
  //             : job.environment.name;

  //         if (env && /prod/i.test(env)) {
  //           // Проверяем auto-run (rules/only)
  //           if (job.only || job.rules) {
  //             autoDeploy = true;
  //             break;
  //           }
  //         }
  //       }
  //     }
  //   } catch (e) {
  //     console.error("YAML parse error:", e.message);
  //   }
  // }

  // results.push({
  //   item: "Автоматический деплой на production",
  //   status: autoDeploy ? "WARN" : "OK",
  //   details: autoDeploy
  //     ? "В .gitlab-ci.yml обнаружен auto-deploy на PROD"
  //     : "Автодеплой на PROD не найден",
  // });

  // 1. Бесконтрольный деплой на прод
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

  // 2. Могут ли разработчики пушить в production ветку
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

  // 3. MR без ревью
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

  // 4. Пайплайны без проверок
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
