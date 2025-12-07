// module.exports = async function checkSEC7(projectId, gitlab) {
//   const runners = await gitlab.getProjectRunners(projectId);

//   const results = [];

//   const shared = runners.filter(r => r.is_shared);

//   results.push({
//     item: "Shared Runner'ы (может быть небезопасно)",
//     status: shared.length ? "WARN" : "OK",
//     details: shared.length ? shared.map(r => r.description).join(", ") : "Все Runner'ы приватные"
//   });

//   return {
//     id: "CICD-SEC-7",
//     name: "Небезопасная конфигурация",
//     results
//   };
// };

module.exports = async function checkSEC7(projectId, gitlab) {
  const results = [];
  
  try {
    // 1. Проверка конфигурации раннеров
    const runners = await gitlab.getProjectRunners(projectId);
    const projectDetails = await gitlab.getProjectDetails(projectId);
    const projectVariables = await gitlab.getProjectVariables(projectId);
    
    // Проверка: Раннеры с устаревшей конфигурацией
    const outdatedRunners = runners.filter(r => {
      // Проверяем версию gitlab-runner (если доступна через API)
      // В реальном сценарии нужен доступ к административному API
      return r.status === 'offline' || r.status === 'not_connected';
    });
    
    if (outdatedRunners.length > 0) {
      results.push({
        item: "Неактивные или отключенные раннеры",
        status: "WARN",
        details: `Обнаружено ${outdatedRunners.length} неактивных или отключенных раннеров. Рекомендуется удалить неиспользуемые раннеры.`,
        severity: "medium"
      });
    }
    
    // Проверка: Раннеры без ограничений по тегам
    const runnersWithoutTags = runners.filter(r => 
      !r.tag_list || r.tag_list.length === 0
    );
    
    if (runnersWithoutTags.length > 0) {
      results.push({
        item: "Раннеры без тегов",
        status: "FAIL",
        details: `Обнаружено ${runnersWithoutTags.length} раннеров без тегов. Это может привести к выполнению jobs на неподходящих раннерах.`,
        severity: "high"
      });
    }
    
    // 2. Проверка настроек проекта
    const projectSettings = projectDetails;
    
    // Проверка: Разрешение force push
    if (projectSettings.allow_merge_on_skipped_pipeline) {
      results.push({
        item: "Разрешение мержа при пропущенном пайплайне",
        status: "WARN",
        details: "В проекте разрешён мерж при пропущенном пайплайне. Это может обойти проверки безопасности.",
        severity: "medium"
      });
    }
    
    // Проверка: Настройки shared runners
    if (projectSettings.shared_runners_enabled) {
      results.push({
        item: "Включены shared runners",
        status: "INFO",
        details: "В проекте включены shared runners. Убедитесь в их безопасности.",
        severity: "low"
      });
    }
    
    // 3. Анализ CI/CD конфигурации на небезопасные настройки
    try {
      const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
      if (gitlabCI) {
        const lines = gitlabCI.split('\n');
        
        // Проверка: Использование небезопасных образов
        const unsafeImages = [];
        const imagePatterns = [
          { pattern: /image:\s*["']?alpine:latest["']?/, description: "Образ alpine:latest (плавающий тег)" },
          { pattern: /image:\s*["']?node:latest["']?/, description: "Образ node:latest (плавающий тег)" },
          { pattern: /image:\s*["']?python:latest["']?/, description: "Образ python:latest (плавающий тег)" },
          { pattern: /image:\s*["']?ubuntu:latest["']?/, description: "Образ ubuntu:latest (плавающий тег)" },
          { pattern: /image:\s*["']?docker:latest["']?/, description: "Образ docker:latest (плавающий тег)" }
        ];
        
        lines.forEach((line, index) => {
          imagePatterns.forEach(pattern => {
            if (pattern.pattern.test(line)) {
              unsafeImages.push({
                line: index + 1,
                description: pattern.description,
                content: line.trim()
              });
            }
          });
        });
        
        if (unsafeImages.length > 0) {
          results.push({
            item: "Небезопасные Docker образы (плавающие теги)",
            status: "FAIL",
            details: `Обнаружены образы с тегом latest:\n${unsafeImages.map(img => `Строка ${img.line}: ${img.description} - "${img.content}"`).join('\n')}`,
            severity: "high"
          });
        }
        
        // Проверка: Отсутствие ресурсных ограничений
        let hasResourceLimits = false;
        lines.forEach(line => {
          if (line.includes('services:') || 
              line.includes('resources:') || 
              line.includes('limits:') ||
              line.includes('cpu_quota:') ||
              line.includes('mem_limit:')) {
            hasResourceLimits = true;
          }
        });
        
        if (!hasResourceLimits) {
          results.push({
            item: "Отсутствие ограничений ресурсов",
            status: "WARN",
            details: "В конфигурации не установлены ограничения на CPU и memory. Это может привести к исчерпанию ресурсов.",
            severity: "medium"
          });
        }
        
        // Проверка: Использование небезопасных volume mounts
        const unsafeVolumes = [];
        const volumePattern = /-\s*["']?\/.*:.*["']?/g;
        
        lines.forEach((line, index) => {
          if (volumePattern.test(line) && 
              (line.includes('/var/run/docker.sock') || 
               line.includes('/etc/passwd') ||
               line.includes('/etc/shadow') ||
               line.includes('/root') ||
               line.includes('/home'))) {
            unsafeVolumes.push({
              line: index + 1,
              content: line.trim(),
              risk: line.includes('/var/run/docker.sock') ? "Docker socket exposure" : 
                    line.includes('/etc/passwd') ? "System password file exposure" :
                    line.includes('/etc/shadow') ? "System shadow file exposure" : "Sensitive directory exposure"
            });
          }
        });
        
        if (unsafeVolumes.length > 0) {
          results.push({
            item: "Небезопасные volume mounts",
            status: "FAIL",
            details: `Обнаружены небезопасные volume mounts:\n${unsafeVolumes.map(v => `Строка ${v.line}: ${v.risk} - "${v.content}"`).join('\n')}`,
            severity: "critical"
          });
        }
        
        // Проверка: Использование привилегированных контейнеров
        const privilegedContainers = [];
        lines.forEach((line, index) => {
          if (line.includes('privileged: true') || line.includes('privileged: yes')) {
            privilegedContainers.push({
              line: index + 1,
              content: line.trim()
            });
          }
        });
        
        if (privilegedContainers.length > 0) {
          results.push({
            item: "Привилегированные контейнеры",
            status: "FAIL",
            details: `Обнаружены привилегированные контейнеры:\n${privilegedContainers.map(c => `Строка ${c.line}: "${c.content}"`).join('\n')}`,
            severity: "critical"
          });
        }
      }
    } catch (error) {
      // Не удалось проанализировать конфигурацию
    }
    
    // 4. Проверка настроек окружений
    const environments = await gitlab.getProjectEnvironments(projectId);
    
    // Проверка: Окружения с внешними URL
    const externalEnvironments = environments.filter(env => 
      env.external_url && 
      (env.external_url.startsWith('http://') || 
       !env.external_url.includes('.internal') && 
       !env.external_url.includes('.local'))
    );
    
    if (externalEnvironments.length > 0) {
      results.push({
        item: "Окружения с публичными URL",
        status: "WARN",
        details: `Обнаружены окружения с публичными URL: ${externalEnvironments.map(e => `${e.name}: ${e.external_url}`).join(', ')}`,
        severity: "medium"
      });
    }
    
    // 5. Проверка настроек webhooks
    const hooks = await gitlab.getProjectHooks(projectId);
    
    // Проверка: Webhooks без SSL verification
    const insecureHooks = hooks.filter(hook => !hook.enable_ssl_verification);
    
    if (insecureHooks.length > 0) {
      results.push({
        item: "Webhooks без SSL verification",
        status: "FAIL",
        details: `Обнаружены webhooks без SSL verification: ${insecureHooks.map(h => h.url).join(', ')}`,
        severity: "high"
      });
    }
    
    // Проверка: Webhooks с секретами в URL
    const hooksWithSecrets = hooks.filter(hook => {
      const url = hook.url || '';
      return url.includes('token=') || 
             url.includes('secret=') || 
             url.includes('key=') ||
             url.includes('password=');
    });
    
    if (hooksWithSecrets.length > 0) {
      results.push({
        item: "Webhooks с секретами в URL",
        status: "FAIL",
        details: `Обнаружены webhooks с секретами в URL: ${hooksWithSecrets.map(h => h.url.substring(0, 50) + '...').join(', ')}`,
        severity: "critical"
      });
    }
    
    // 6. Проверка настроек интеграций
    const integrations = []; // GitLab API не предоставляет прямой endpoint для интеграций
    
    // 7. Проверка настроек безопасности проекта
    const securitySettings = {
      container_scanning_enabled: projectDetails.container_registry_enabled,
      secret_detection_enabled: projectDetails.requirements_enabled,
      sast_enabled: projectDetails.analytics_enabled
    };
    
    // В реальном сценарии нужно проверять через API настроек безопасности
    results.push({
      item: "Настройки сканирования безопасности",
      status: "INFO",
      details: "Для полной проверки настроек безопасности рекомендуется проверить: Container Scanning, Secret Detection, SAST, DAST в настройках проекта.",
      severity: "low"
    });
    
    // 8. Проверка на использование устаревших сервисов
    try {
      const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
      if (gitlabCI) {
        const deprecatedServices = [];
        const servicePatterns = [
          { pattern: /mysql:5\.6/, description: "MySQL 5.6 (EOL)" },
          { pattern: /postgres:9\.6/, description: "PostgreSQL 9.6 (EOL)" },
          { pattern: /redis:3\.2/, description: "Redis 3.2 (старая версия)" },
          { pattern: /node:8/, description: "Node.js 8 (EOL)" },
          { pattern: /python:2\.7/, description: "Python 2.7 (EOL)" },
          { pattern: /ruby:2\.3/, description: "Ruby 2.3 (EOL)" }
        ];
        
        const lines = gitlabCI.split('\n');
        lines.forEach((line, index) => {
          servicePatterns.forEach(service => {
            if (service.pattern.test(line)) {
              deprecatedServices.push({
                line: index + 1,
                description: service.description,
                content: line.trim()
              });
            }
          });
        });
        
        if (deprecatedServices.length > 0) {
          results.push({
            item: "Устаревшие сервисы в конфигурации",
            status: "FAIL",
            details: `Обнаружены устаревшие сервисы:\n${deprecatedServices.map(s => `Строка ${s.line}: ${s.description} - "${s.content}"`).join('\n')}`,
            severity: "high"
          });
        }
      }
    } catch (error) {
      // Не удалось проанализировать конфигурацию
    }
    
    // 9. Проверка настройки кеширования
    try {
      const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
      if (gitlabCI) {
        const hasCacheConfig = gitlabCI.includes('cache:') || gitlabCI.includes('.cache');
        
        if (hasCacheConfig) {
          // Проверяем, не кешируются ли чувствительные данные
          const lines = gitlabCI.split('\n');
          let cachesSensitiveData = false;
          let cacheDetails = [];
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('paths:') || lines[i].includes('-')) {
              const sensitivePaths = ['node_modules', '.npm', '.gradle', '.m2', 'vendor/bundle'];
              for (const path of sensitivePaths) {
                if (lines[i].includes(path)) {
                  cachesSensitiveData = true;
                  cacheDetails.push(`Строка ${i + 1}: "${lines[i].trim()}"`);
                  break;
                }
              }
            }
          }
          
          if (cachesSensitiveData) {
            results.push({
              item: "Кеширование чувствительных данных",
              status: "WARN",
              details: `Обнаружено кеширование чувствительных данных:\n${cacheDetails.join('\n')}`,
              severity: "medium"
            });
          }
        }
      }
    } catch (error) {
      // Не удалось проанализировать конфигурацию
    }
    
    // 10. Проверка настройки network security
    try {
      const gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
      if (gitlabCI) {
        const hasNetworkPolicy = gitlabCI.includes('network_mode:') || 
                                 gitlabCI.includes('dns:') ||
                                 gitlabCI.includes('extra_hosts:');
        
        if (!hasNetworkPolicy) {
          results.push({
            item: "Отсутствие сетевой политики",
            status: "INFO",
            details: "Не обнаружена сетевая политика для контейнеров. Рекомендуется ограничить сетевой доступ.",
            severity: "low"
          });
        }
      }
    } catch (error) {
      // Не удалось проанализировать конфигурацию
    }
    
  } catch (error) {
    console.error(`Error in SEC-7 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка небезопасной конфигурации системы",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }
  
  return {
    id: "CICD-SEC-7",
    name: "Небезопасная конфигурация системы",
    results
  };
};