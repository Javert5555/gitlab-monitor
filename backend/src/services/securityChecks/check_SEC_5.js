// module.exports = async function checkSEC5(projectId, gitlab) {
//   const runners = await gitlab.getProjectRunners(projectId);

//   const results = [];

//   // Проверка на привилегированные runner'ы
//   const privileged = runners.filter(r => r.is_shared || r.tag_list.includes("privileged"));

//   results.push({
//     item: "Привилегированные Runner'ы",
//     status: privileged.length ? "WARN" : "OK",
//     details: privileged.length
//       ? `Найдены привилегированные Runner'ы: ${privileged.map(r => r.description).join(", ")}`
//       : "Все Runner'ы корректны"
//   });

//   return {
//     id: "CICD-SEC-5",
//     name: "Недостаточный контроль доступа конвейера",
//     results
//   };
// };

module.exports = async function checkSEC5(projectId, gitlab) {
  const results = [];
  
  try {
    // 1. Проверка раннеров и их конфигурации
    const runners = await gitlab.getProjectRunners(projectId);
    const pipelines = await gitlab.getProjectPipelines(projectId, { per_page: 5 });
    const projectVariables = await gitlab.getProjectVariables(projectId);
    const environments = await gitlab.getProjectEnvironments(projectId);
    
    // Проверка 1: Привилегированные раннеры
    const privilegedRunners = runners.filter(r => 
      r.tag_list && (
        r.tag_list.includes('privileged') ||
        r.tag_list.includes('docker') ||
        r.tag_list.includes('root')
      )
    );
    
    if (privilegedRunners.length > 0) {
      results.push({
        item: "Привилегированные раннеры",
        status: "FAIL",
        details: `Обнаружены ${privilegedRunners.length} раннеров с привилегированными тегами (privileged, docker, root). Это позволяет контейнерам получать root-доступ к хосту.`,
        severity: "critical"
      });
    }
    
    // Проверка 2: Shared раннеры с доступом к секретам
    const sharedRunners = runners.filter(r => r.is_shared);
    
    if (sharedRunners.length > 0) {
      // Проверяем, используются ли shared runners для production
      let sharedUsedForProd = false;
      try {
        const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
        if (gitlabCI) {
          const prodPatterns = [/stage:\s*prod/i, /environment:\s*prod/i, /tags:\s*.*prod/i];
          const hasProdStages = prodPatterns.some(pattern => pattern.test(gitlabCI));
          
          if (hasProdStages) {
            // Проверяем теги раннеров для prod stages
            const runnerTagsMatch = gitlabCI.match(/tags:\s*\[?(.*?)\]?$/gm);
            if (runnerTagsMatch) {
              const allTags = runnerTagsMatch.map(tags => tags.replace(/tags:\s*\[?|\]?$/g, '').split(',').map(t => t.trim()));
              const flatTags = allTags.flat();
              sharedUsedForProd = flatTags.some(tag => sharedRunners.some(r => r.tag_list && r.tag_list.includes(tag)));
            }
          }
        }
      } catch (error) {
        // Не удалось проанализировать конфигурацию
      }
      
      if (sharedUsedForProd) {
        results.push({
          item: "Shared runners для production",
          status: "FAIL",
          details: "Shared runners используются для production stages. Это небезопасно, так как shared runners могут быть скомпрометированы другими проектами.",
          severity: "critical"
        });
      } else {
        results.push({
          item: "Shared runners",
          status: "WARN",
          details: `Используются ${sharedRunners.length} shared runners. Убедитесь, что они не имеют доступа к чувствительным данным.`,
          severity: "medium"
        });
      }
    }
    
    // Проверка 3: Раннеры без ограничений по тегам
    const untaggedRunners = runners.filter(r => 
      !r.tag_list || r.tag_list.length === 0
    );
    
    if (untaggedRunners.length > 0) {
      results.push({
        item: "Раннеры без тегов",
        status: "WARN",
        details: `Обнаружено ${untaggedRunners.length} раннеров без тегов. Это может привести к неконтролируемому выполнению jobs на неподходящих раннерах.`,
        severity: "medium"
      });
    }
    
    // 2. Анализ доступа к переменным окружения
    // Проверка: переменные с секретами, доступные всем веткам
    const secretVariables = projectVariables.filter(v => 
      v.key.toLowerCase().includes('token') ||
      v.key.toLowerCase().includes('secret') ||
      v.key.toLowerCase().includes('password') ||
      v.key.toLowerCase().includes('key') ||
      v.key.toLowerCase().includes('credential') ||
      v.key.toLowerCase().includes('_key') ||
      v.key.toLowerCase().includes('_secret')
    );
    
    // Переменные, доступные для всех веток (environment_scope === '*')
    const globalSecretVars = secretVariables.filter(v => 
      v.environment_scope === '*' || !v.environment_scope
    );
    
    if (globalSecretVars.length > 0) {
      results.push({
        item: "Секретные переменные доступные всем веткам",
        status: "FAIL",
        details: `Обнаружено ${globalSecretVars.length} секретных переменных, доступных для всех веток: ${globalSecretVars.map(v => v.key).join(', ')}. Ограничьте область видимости.`,
        severity: "critical"
      });
    }
    
    // 3. Анализ доступа к артефактам
    try {
      const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
      if (gitlabCI) {
        // Проверка: артефакты, доступные между stages без ограничений
        const artifactPatterns = [
          /artifacts:/g,
          /cache:/g,
          /dependencies:/g
        ];
        
        const hasArtifacts = artifactPatterns.some(pattern => pattern.test(gitlabCI));
        
        if (hasArtifacts) {
          // Проверяем пути артефактов на наличие чувствительных данных
          const sensitivePaths = [
            '*.pem', '*.key', '*.crt', '*.pfx', // SSL сертификаты
            '*.env', '.env*', // Файлы окружения
            '**/secrets/**', '**/credentials/**', // Директории с секретами
            '*.json', '*.yaml', '*.yml' // Конфигурационные файлы
          ];
          
          const lines = gitlabCI.split('\n');
          let foundSensitiveArtifacts = false;
          let artifactDetails = [];
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('paths:') || lines[i].includes('-')) {
              for (const path of sensitivePaths) {
                const pathPattern = path.replace('*', '.*').replace('**', '.*');
                const regex = new RegExp(pathPattern, 'i');
                if (regex.test(lines[i])) {
                  foundSensitiveArtifacts = true;
                  artifactDetails.push(`Строка ${i + 1}: "${lines[i].trim()}"`);
                  break;
                }
              }
            }
          }
          
          if (foundSensitiveArtifacts) {
            results.push({
              item: "Чувствительные данные в артефактах",
              status: "FAIL",
              details: `Обнаружены чувствительные данные, сохраняемые как артефакты:\n${artifactDetails.join('\n')}`,
              severity: "high"
            });
          }
        }
        
        // Проверка: when: manual для production stages
        const prodStagesWithAuto = [];
        const stageRegex = /(\w+):\s*\n\s*stage:\s*(prod|production|release|deploy)/gi;
        let match;
        
        while ((match = stageRegex.exec(gitlabCI)) !== null) {
          const stageName = match[1];
          const stageContent = gitlabCI.substring(match.index);
          const endOfStage = stageContent.indexOf('\n\n') > 0 ? stageContent.indexOf('\n\n') : stageContent.length;
          const stageBlock = stageContent.substring(0, endOfStage);
          
          if (!stageBlock.includes('when: manual') && 
              !stageBlock.includes('rules:') && 
              !stageBlock.includes('only:') && 
              !stageBlock.includes('except:')) {
            prodStagesWithAuto.push(stageName);
          }
        }
        
        if (prodStagesWithAuto.length > 0) {
          results.push({
            item: "Production stages без ручного подтверждения",
            status: "FAIL",
            details: `Обнаружены production stages без when: manual или правил подтверждения: ${prodStagesWithAuto.join(', ')}`,
            severity: "critical"
          });
        }
      }
    } catch (error) {
      // Не удалось проанализировать конфигурацию
    }
    
    // 4. Анализ окружений (environments)
    const prodEnvironments = environments.filter(env => 
      env.name.toLowerCase().includes('prod') ||
      env.name.toLowerCase().includes('production') ||
      env.name.toLowerCase().includes('live')
    );
    
    for (const env of prodEnvironments) {
      // Проверка защиты окружений
      if (!env.protected) {
        results.push({
          item: `Незащищённое production окружение: ${env.name}`,
          status: "FAIL",
          details: `Production окружение "${env.name}" не защищено (protected: false). Разрешите доступ только защищённым веткам.`,
          severity: "high"
        });
      }
    }
    
    // 5. Анализ последних пайплайнов на предмет подозрительной активности
    if (pipelines.length > 0) {
      const suspiciousPipelines = [];
      
      for (const pipeline of pipelines.slice(0, 3)) {
        try {
          const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
          
          // Проверка jobs с повышенными привилегиями
          const privilegedJobs = jobs.filter(job => 
            job.name && (
              job.name.toLowerCase().includes('privileged') ||
              job.name.toLowerCase().includes('root') ||
              job.name.toLowerCase().includes('docker') && job.name.toLowerCase().includes('build')
            )
          );
          
          if (privilegedJobs.length > 0) {
            suspiciousPipelines.push({
              pipelineId: pipeline.id,
              reason: `Привилегированные jobs: ${privilegedJobs.map(j => j.name).join(', ')}`,
              status: pipeline.status
            });
          }
          
          // Проверка jobs с доступом к секретам
          const jobsWithSecrets = jobs.filter(job => 
            job.name && (
              job.name.toLowerCase().includes('secret') ||
              job.name.toLowerCase().includes('deploy') ||
              job.name.toLowerCase().includes('release')
            )
          );
          
          if (jobsWithSecrets.length > 0 && pipeline.source === 'push') {
            suspiciousPipelines.push({
              pipelineId: pipeline.id,
              reason: `Jobs с доступом к секретам запущены по прямому push: ${jobsWithSecrets.map(j => j.name).join(', ')}`,
              status: pipeline.status
            });
          }
          
        } catch (error) {
          continue;
        }
      }
      
      if (suspiciousPipelines.length > 0) {
        results.push({
          item: "Подозрительные пайплайны",
          status: "WARN",
          details: `Обнаружены подозрительные пайплайны:\n${suspiciousPipelines.map(p => `#${p.pipelineId}: ${p.reason} (статус: ${p.status})`).join('\n')}`,
          severity: "medium"
        });
      }
    }
    
    // 6. Проверка доступа к реестру контейнеров
    try {
      const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
      if (gitlabCI) {
        // Проверка на использование docker-in-docker (dind)
        if (gitlabCI.includes('docker:dind') || gitlabCI.includes('docker-in-docker')) {
          results.push({
            item: "Использование Docker-in-Docker",
            status: "WARN",
            details: "Обнаружено использование docker-in-docker. Это может представлять угрозу безопасности, если не настроено должным образом.",
            severity: "medium"
          });
        }
        
        // Проверка на загрузку образов из непроверенных источников
        const externalImagePatterns = [
          /docker pull.*(http|https):\/\//i,
          /image:.*docker\.io/i,
          /image:.*index\.docker\.io/i,
          /from.*:latest/i
        ];
        
        const externalImages = [];
        const lines = gitlabCI.split('\n');
        
        lines.forEach((line, index) => {
          externalImagePatterns.forEach(pattern => {
            if (pattern.test(line)) {
              externalImages.push(`Строка ${index + 1}: "${line.trim()}"`);
            }
          });
        });
        
        if (externalImages.length > 0) {
          results.push({
            item: "Загрузка Docker образов из внешних источников",
            status: "WARN",
            details: `Обнаружена загрузка Docker образов из внешних источников:\n${externalImages.join('\n')}`,
            severity: "medium"
          });
        }
      }
    } catch (error) {
      // Не удалось проанализировать конфигурацию
    }
    
    // 7. Проверка настройки resource limits
    try {
      const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
      if (gitlabCI) {
        const hasResourceLimits = gitlabCI.includes('services:') || 
                                  gitlabCI.includes('resources:') ||
                                  gitlabCI.includes('limits:');
        
        if (!hasResourceLimits) {
          results.push({
            item: "Отсутствие лимитов ресурсов",
            status: "INFO",
            details: "Не обнаружены лимиты ресурсов для контейнеров. Рекомендуется установить limits на CPU и memory.",
            severity: "low"
          });
        }
      }
    } catch (error) {
      // Не удалось проанализировать конфигурацию
    }
    
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
    id: "CICD-SEC-5",
    name: "Недостаточный контроль доступа конвейера (PBAC)",
    results
  };
};