// // module.exports = async function checkSEC8(projectId, gitlab) {
// //   const hooks = await gitlab.getProjectHooks(projectId);

// //   const results = [];

// //   results.push({
// //     item: "Внешние интеграции / вебхуки",
// //     status: hooks.length ? "WARN" : "OK",
// //     details: hooks.length ? hooks.map(h => h.url).join(", ") : "Внешних вебхуков нет"
// //   });

// //   return {
// //     id: "SEC-CICD-8",
// //     name: "Неконтролируемое использование сторонних сервисов",
// //     results
// //   };
// // };

// module.exports = async function checkSEC8(projectId, project, gitlab) {
//   const results = [];
  
//   try {
//     // 1. Проверка webhooks (внешние интеграции)
//     const hooks = await gitlab.getProjectHooks(projectId);
//     const projectVariables = await gitlab.getProjectVariables(projectId);
//     let gitlabCI = null;
    
//     // Категоризация webhooks
//     const webhookCategories = {
//       chat: [],      // Slack, Teams, Discord
//       ciCd: [],      // Jenkins, CircleCI, Travis
//       monitoring: [], // Datadog, New Relic, Sentry
//       deployment: [], // AWS, Azure, GCP
//       other: []
//     };
    
//     hooks.forEach(hook => {
//       const url = hook.url.toLowerCase();
      
//       if (url.includes('slack') || url.includes('teams') || url.includes('discord')) {
//         webhookCategories.chat.push(hook);
//       } else if (url.includes('jenkins') || url.includes('circleci') || url.includes('travis')) {
//         webhookCategories.ciCd.push(hook);
//       } else if (url.includes('datadog') || url.includes('newrelic') || url.includes('sentry')) {
//         webhookCategories.monitoring.push(hook);
//       } else if (url.includes('aws') || url.includes('azure') || url.includes('gcp') || url.includes('cloud')) {
//         webhookCategories.deployment.push(hook);
//       } else {
//         webhookCategories.other.push(hook);
//       }
//     });
    
//     const totalWebhooks = Object.values(webhookCategories).reduce((sum, arr) => sum + arr.length, 0);
    
//     results.push({
//       item: "Внешние интеграции (webhooks)",
//       status: totalWebhooks > 0 ? "INFO" : "OK",
//       details: totalWebhooks > 0
//         ? `Обнаружено webhooks: Чат (${webhookCategories.chat.length}), CI/CD (${webhookCategories.ciCd.length}), Мониторинг (${webhookCategories.monitoring.length}), Деплой (${webhookCategories.deployment.length}), Другие (${webhookCategories.other.length})`
//         : "Внешние интеграции не обнаружены.",
//       severity: "low"
//     });
    
//     // 2. Проверка безопасности webhooks
//     const securityIssues = [];
    
//     hooks.forEach(hook => {
//       const issues = [];
      
//       // Проверка SSL verification
//       if (!hook.enable_ssl_verification) {
//         issues.push("SSL verification отключена");
//       }
      
//       // Проверка использования HTTP
//       if (hook.url.startsWith('http://')) {
//         issues.push("Используется HTTP вместо HTTPS");
//       }
      
//       // Проверка на наличие секретов в URL
//       const url = hook.url;
//       if (url.includes('token=') || url.includes('secret=') || url.includes('key=')) {
//         issues.push("Секреты в URL");
//       }
      
//       if (issues.length > 0) {
//         securityIssues.push({
//           url: hook.url,
//           issues: issues
//         });
//       }
//     });
    
//     if (securityIssues.length > 0) {
//       const issuesDetails = securityIssues.map(issue => 
//         `${issue.url}: ${issue.issues.join(', ')}`
//       ).join('\n');
      
//       results.push({
//         item: "Небезопасные webhooks",
//         status: "DANGER",
//         details: `Обнаружены проблемы безопасности в webhooks:\n${issuesDetails}`,
//         severity: "high"
//       });
//     }
    
//     // 3. Проверка переменных с внешними API ключами
//     const externalApiKeys = projectVariables.filter(v => {
//       const key = v.key.toLowerCase();
//       const value = v.value || '';
      
//       return (
//         key.includes('api_key') ||
//         key.includes('_token') ||
//         key.includes('access_key') ||
//         key.includes('secret_key') ||
//         (value.length > 20 && /^[a-zA-Z0-9]{20,}$/.test(value)) // Длинные алфавитно-цифровые строки
//       );
//     });
    
//     if (externalApiKeys.length > 0) {
//       // Группировка по сервисам
//       const serviceGroups = {
//         cloud: [],
//         monitoring: [],
//         communication: [],
//         other: []
//       };
      
//       externalApiKeys.forEach(variable => {
//         const key = variable.key.toLowerCase();
        
//         if (key.includes('aws') || key.includes('azure') || key.includes('gcp')) {
//           serviceGroups.cloud.push(variable);
//         } else if (key.includes('datadog') || key.includes('newrelic') || key.includes('sentry')) {
//           serviceGroups.monitoring.push(variable);
//         } else if (key.includes('slack') || key.includes('teams') || key.includes('discord')) {
//           serviceGroups.communication.push(variable);
//         } else {
//           serviceGroups.other.push(variable);
//         }
//       });
      
//       const details = [];
//       if (serviceGroups.cloud.length > 0) details.push(`Облако: ${serviceGroups.cloud.length}`);
//       if (serviceGroups.monitoring.length > 0) details.push(`Мониторинг: ${serviceGroups.monitoring.length}`);
//       if (serviceGroups.communication.length > 0) details.push(`Коммуникация: ${serviceGroups.communication.length}`);
//       if (serviceGroups.other.length > 0) details.push(`Другие: ${serviceGroups.other.length}`);
      
//       results.push({
//         item: "API ключи внешних сервисов",
//         status: "INFO",
//         details: `Обнаружены API ключи внешних сервисов: ${details.join(', ')}`,
//         severity: "low"
//       });
//     }
    
//     // 4. Анализ CI/CD конфигурации на использование внешних сервисов
//     try {
//       gitlabCI = await gitlab.getRawFile(projectId, '.gitlab-ci.yml');
//       if (gitlabCI) {
//         const externalServices = [];
//         const servicePatterns = [
//           { pattern: /snyk/i, name: "Snyk", category: "security" },
//           { pattern: /sonarqube/i, name: "SonarQube", category: "code quality" },
//           { pattern: /jenkins/i, name: "Jenkins", category: "ci/cd" },
//           { pattern: /circleci/i, name: "CircleCI", category: "ci/cd" },
//           { pattern: /travis/i, name: "Travis CI", category: "ci/cd" },
//           { pattern: /aws/i, name: "AWS", category: "cloud" },
//           { pattern: /azure/i, name: "Azure", category: "cloud" },
//           { pattern: /gcp|google/i, name: "Google Cloud", category: "cloud" },
//           { pattern: /datadog/i, name: "Datadog", category: "monitoring" },
//           { pattern: /newrelic/i, name: "New Relic", category: "monitoring" },
//           { pattern: /sentry/i, name: "Sentry", category: "monitoring" },
//           { pattern: /slack/i, name: "Slack", category: "communication" },
//           { pattern: /teams/i, name: "Microsoft Teams", category: "communication" },
//           { pattern: /docker\.io/i, name: "Docker Hub", category: "registry" },
//           { pattern: /npmjs\.org/i, name: "npm Registry", category: "package manager" },
//           { pattern: /pypi\.org/i, name: "PyPI", category: "package manager" }
//         ];
        
//         servicePatterns.forEach(service => {
//           if (service.pattern.test(gitlabCI)) {
//             if (!externalServices.some(s => s.name === service.name)) {
//               externalServices.push({
//                 name: service.name,
//                 category: service.category
//               });
//             }
//           }
//         });
        
//         if (externalServices.length > 0) {
//           // Группируем по категориям
//           const byCategory = {};
//           externalServices.forEach(service => {
//             if (!byCategory[service.category]) {
//               byCategory[service.category] = [];
//             }
//             byCategory[service.category].push(service.name);
//           });
          
//           const categoryDetails = Object.entries(byCategory)
//             .map(([category, services]) => `${category}: ${services.join(', ')}`)
//             .join('\n');
          
//           results.push({
//             item: "Внешние сервисы в CI/CD конфигурации",
//             status: "INFO",
//             details: `Обнаружены ссылки на внешние сервисы:\n${categoryDetails}`,
//             severity: "low"
//           });
          
//           // Проверка на небезопасное использование внешних сервисов
//           const lines = gitlabCI.split('\n');
//           const insecureUsage = [];
          
//           lines.forEach((line, index) => {
//             // Проверка на хардкод секретов для внешних сервисов
//             if (line.includes('curl') || line.includes('wget')) {
//               servicePatterns.forEach(service => {
//                 if (service.pattern.test(line)) {
//                   // Проверяем, нет ли в строке секретов
//                   if (line.includes('token=') || line.includes('key=') || line.includes('secret=')) {
//                     insecureUsage.push({
//                       line: index + 1,
//                       service: service.name,
//                       content: line.trim().substring(0, 100) + (line.length > 100 ? '...' : '')
//                     });
//                   }
//                 }
//               });
//             }
//           });
          
//           if (insecureUsage.length > 0) {
//             results.push({
//               item: "Небезопасное использование внешних сервисов",
//               status: "DANGER",
//               details: `Обнаружено небезопасное использование внешних сервисов:\n${insecureUsage.map(u => `Строка ${u.line}: ${u.service} - "${u.content}"`).join('\n')}`,
//               severity: "critical"
//             });
//           }
//         }
//       }
//     } catch (error) {
//       // Не удалось проанализировать конфигурацию
//       results.push({
//         item: "Анализ CI/CD конфигурации",
//         status: "INFO",
//         details: "Не удалось проанализировать CI/CD конфигурацию для проверки внешних сервисов.",
//         severity: "low"
//       });
//     }
    
//     // 5. Проверка зависимостей на внешние пакеты
//     try {
//       const repoTree = await gitlab.getRepositoryTree(projectId, { recursive: true });
//       const packageFiles = repoTree.filter(file => 
//         file.name === 'package.json' || 
//         file.name === 'requirements.txt' ||
//         file.name === 'Pipfile' ||
//         file.name === 'go.mod' ||
//         file.name === 'Gemfile' ||
//         file.name === 'pom.xml' ||
//         file.name === 'build.gradle'
//       );
      
//       if (packageFiles.length > 0) {
//         results.push({
//           item: "Зависимости от внешних пакетов",
//           status: "INFO",
//           details: `Обнаружены файлы зависимостей: ${packageFiles.map(f => f.name).join(', ')}. Зависимости загружаются из внешних реестров.`,
//           severity: "low"
//         });
//       }
//     } catch (error) {
//       // Не удалось получить список файлов
//     }
    
//     // 6. Проверка на использование CDN и внешних ресурсов
//     try {
//       const repoTree = await gitlab.getRepositoryTree(projectId, { recursive: true });
//       const webFiles = repoTree.filter(file => 
//         file.name.endsWith('.html') || 
//         file.name.endsWith('.js') || 
//         file.name.endsWith('.css')
//       ).slice(0, 10); // Ограничиваем количество проверяемых файлов
      
//       let foundExternalResources = false;
//       let resourceDetails = [];
      
//       for (const file of webFiles) {
//         try {
//           const content = await gitlab.getRawFile(projectId, file.path);
          
//           // Паттерны внешних ресурсов
//           const externalPatterns = [
//             /https?:\/\/cdn\./i,
//             /https?:\/\/ajax\.googleapis\.com/i,
//             /https?:\/\/code\.jquery\.com/i,
//             /https?:\/\/maxcdn\.bootstrapcdn\.com/i,
//             /https?:\/\/stackpath\.bootstrapcdn\.com/i,
//             /https?:\/\/unpkg\.com/i,
//             /<script.*src=["']https?:\/\//i,
//             /<link.*href=["']https?:\/\//i
//           ];
          
//           externalPatterns.forEach(pattern => {
//             if (pattern.test(content)) {
//               foundExternalResources = true;
//               const matches = content.match(pattern);
//               if (matches && matches[0]) {
//                 resourceDetails.push(`${file.path}: ${matches[0].substring(0, 50)}...`);
//               }
//             }
//           });
//         } catch (error) {
//           continue;
//         }
//       }
      
//       if (foundExternalResources) {
//         results.push({
//           item: "Внешние ресурсы в веб-файлах",
//           status: "WARN",
//           details: `Обнаружены ссылки на внешние ресурсы (CDN):\n${resourceDetails.slice(0, 5).join('\n')}${resourceDetails.length > 5 ? '\n...' : ''}`,
//           severity: "medium"
//         });
//       }
//     } catch (error) {
//       // Не удалось проанализировать веб-файлы
//     }
    
//     // 7. Проверка на использование SaaS решений
//     const saasIndicators = [];
    
//     // Проверка переменных на SaaS сервисы
//     projectVariables.forEach(variable => {
//       const key = variable.key.toLowerCase();
//       if (key.includes('saas') || 
//           key.includes('software') && key.includes('service') ||
//           key.includes('platform') && key.includes('as') && key.includes('service')) {
//         saasIndicators.push(`Переменная: ${variable.key}`);
//       }
//     });
    
//     // Проверка README и документации
//     try {
//       const repoTree = await gitlab.getRepositoryTree(projectId, { recursive: true });
//       const readmeFiles = repoTree.filter(file => 
//         file.name.toLowerCase().includes('readme') ||
//         file.name.toLowerCase().includes('docs') ||
//         file.name.toLowerCase().includes('documentation')
//       ).slice(0, 3);
      
//       for (const file of readmeFiles) {
//         try {
//           const content = await gitlab.getRawFile(projectId, file.path);
//           const saasKeywords = ['SaaS', 'Software as a Service', 'Platform as a Service', 'cloud service', 'managed service'];
          
//           saasKeywords.forEach(keyword => {
//             if (content.includes(keyword)) {
//               saasIndicators.push(`Файл ${file.path}: упоминание ${keyword}`);
//             }
//           });
//         } catch (error) {
//           continue;
//         }
//       }
//     } catch (error) {
//       // Не удалось прочитать документацию
//     }
    
//     if (saasIndicators.length > 0) {
//       results.push({
//         item: "Использование SaaS решений",
//         status: "INFO",
//         details: `Обнаружены индикаторы использования SaaS:\n${saasIndicators.slice(0, 5).join('\n')}${saasIndicators.length > 5 ? '\n...' : ''}`,
//         severity: "low"
//       });
//     }
    
//     // 8. Проверка на наличие политики использования сторонних сервисов
//     try {
//       const repoTree = await gitlab.getRepositoryTree(projectId, { recursive: true });
//       const policyFiles = repoTree.filter(file => 
//         file.name.toLowerCase().includes('policy') ||
//         file.name.toLowerCase().includes('compliance') ||
//         file.name.toLowerCase().includes('guideline')
//       );
      
//       let hasThirdPartyPolicy = false;
//       for (const file of policyFiles.slice(0, 3)) {
//         try {
//           const content = await gitlab.getRawFile(projectId, file.path);
//           if (content.includes('third party') || 
//               content.includes('external service') ||
//               content.includes('vendor')) {
//             hasThirdPartyPolicy = true;
//             break;
//           }
//         } catch (error) {
//           continue;
//         }
//       }
      
//       results.push({
//         item: "Политика использования сторонних сервисов",
//         status: hasThirdPartyPolicy ? "OK" : "INFO",
//         details: hasThirdPartyPolicy
//           ? "Обнаружена документация по использованию сторонних сервисов."
//           : "Не обнаружена политика использования сторонних сервисов. Рекомендуется создать.",
//         severity: "low"
//       });
//     } catch (error) {
//       // Не удалось проверить политики
//     }
    
//     // 9. Проверка на использование deprecated или небезопасных сервисов (только если gitlabCI определен)
//     if (gitlabCI) {
//       const deprecatedServices = [];
//       const lines = gitlabCI.split('\n');
      
//       const deprecatedPatterns = [
//         { pattern: /travis-ci\.org/i, name: "Travis CI (legacy)", reason: "Миграция на travis-ci.com" },
//         { pattern: /circleci\.com\/v1\./i, name: "CircleCI v1", reason: "Устаревшая версия API" },
//         { pattern: /jenkins-ci\.org/i, name: "Jenkins (публичный)", reason: "Рекомендуется использовать внутренний инстанс" }
//       ];
      
//       lines.forEach((line, index) => {
//         deprecatedPatterns.forEach(service => {
//           if (service.pattern.test(line)) {
//             deprecatedServices.push({
//               line: index + 1,
//               name: service.name,
//               reason: service.reason,
//               content: line.trim()
//             });
//           }
//         });
//       });
      
//       if (deprecatedServices.length > 0) {
//         results.push({
//           item: "Устаревшие или небезопасные сервисы",
//           status: "WARN",
//           details: `Обнаружены устаревшие сервисы:\n${deprecatedServices.map(s => `Строка ${s.line}: ${s.name} (${s.reason}) - "${s.content}"`).join('\n')}`,
//           severity: "medium"
//         });
//       }
//     }
    
//   } catch (error) {
//     console.error(`Error in SEC-8 check for project ${projectId}:`, error);
//     results.push({
//       item: "Проверка неконтролируемого использования сторонних сервисов",
//       status: "FAIL",
//       details: `Ошибка при выполнении проверки: ${error.message}`,
//       severity: "info"
//     });
//   }
  
//   return {
//     id: "SEC-CICD-8",
//     name: "Неконтролируемое использование сторонних сервисов",
//     results
//   };
// };

module.exports = async function checkSEC8(projectId, projectData, gitlab) {
  const {
    projectHooks = [],
    projectVariables = [],
    gitlabCIRaw = null,
    repoTree = []
  } = projectData;

  const results = [];

  try {
    // 1. Проверка webhooks (внешние интеграции)
    // Категоризация webhooks
    const webhookCategories = {
      chat: [],      // Slack, Teams, Discord
      ciCd: [],      // Jenkins, CircleCI, Travis
      monitoring: [], // Datadog, New Relic, Sentry
      deployment: [], // AWS, Azure, GCP
      other: []
    };
    
    projectHooks.forEach(hook => {
      if (!hook || !hook.url) return;
      
      const url = hook.url.toLowerCase();
      
      if (url.includes('slack') || url.includes('teams') || url.includes('discord')) {
        webhookCategories.chat.push(hook);
      } else if (url.includes('jenkins') || url.includes('circleci') || url.includes('travis')) {
        webhookCategories.ciCd.push(hook);
      } else if (url.includes('datadog') || url.includes('newrelic') || url.includes('sentry')) {
        webhookCategories.monitoring.push(hook);
      } else if (url.includes('aws') || url.includes('azure') || url.includes('gcp') || url.includes('cloud')) {
        webhookCategories.deployment.push(hook);
      } else {
        webhookCategories.other.push(hook);
      }
    });
    
    const totalWebhooks = Object.values(webhookCategories).reduce((sum, arr) => sum + arr.length, 0);
    
    results.push({
      item: "Внешние интеграции (webhooks)",
      status: totalWebhooks > 0 ? "INFO" : "OK",
      details: totalWebhooks > 0
        ? `Обнаружено webhooks: Чат (${webhookCategories.chat.length}), CI/CD (${webhookCategories.ciCd.length}), Мониторинг (${webhookCategories.monitoring.length}), Деплой (${webhookCategories.deployment.length}), Другие (${webhookCategories.other.length})`
        : "Внешние интеграции не обнаружены.",
      severity: "low"
    });
    
    // 2. Проверка безопасности webhooks
    const securityIssues = [];
    
    projectHooks.forEach(hook => {
      if (!hook || !hook.url) return;
      
      const issues = [];
      
      // Проверка SSL verification
      if (hook.enable_ssl_verification === false) {
        issues.push("SSL verification отключена");
      }
      
      // Проверка использования HTTP
      if (hook.url.startsWith('http://')) {
        issues.push("Используется HTTP вместо HTTPS");
      }
      
      // Проверка на наличие секретов в URL
      const url = hook.url;
      if (url.includes('token=') || url.includes('secret=') || url.includes('key=')) {
        issues.push("Секреты в URL");
      }
      
      if (issues.length > 0) {
        securityIssues.push({
          url: hook.url,
          issues: issues
        });
      }
    });
    
    if (securityIssues.length > 0) {
      const issuesDetails = securityIssues.map(issue => 
        `${issue.url}: ${issue.issues.join(', ')}`
      ).join('\n');
      
      results.push({
        item: "Небезопасные webhooks",
        status: "DANGER",
        details: `Обнаружены проблемы безопасности в webhooks:\n${issuesDetails}`,
        severity: "high"
      });
    }
    
    // 3. Проверка переменных с внешними API ключами
    const externalApiKeys = projectVariables.filter(v => {
      if (!v || !v.key) return false;
      
      const key = v.key.toLowerCase();
      const value = v.value || '';
      
      return (
        key.includes('api_key') ||
        key.includes('_token') ||
        key.includes('access_key') ||
        key.includes('secret_key') ||
        (value.length > 20 && /^[a-zA-Z0-9]{20,}$/.test(value))
      );
    });
    
    if (externalApiKeys.length > 0) {
      // Группировка по сервисам
      const serviceGroups = {
        cloud: [],
        monitoring: [],
        communication: [],
        other: []
      };
      
      externalApiKeys.forEach(variable => {
        const key = variable.key.toLowerCase();
        
        if (key.includes('aws') || key.includes('azure') || key.includes('gcp')) {
          serviceGroups.cloud.push(variable);
        } else if (key.includes('datadog') || key.includes('newrelic') || key.includes('sentry')) {
          serviceGroups.monitoring.push(variable);
        } else if (key.includes('slack') || key.includes('teams') || key.includes('discord')) {
          serviceGroups.communication.push(variable);
        } else {
          serviceGroups.other.push(variable);
        }
      });
      
      const details = [];
      if (serviceGroups.cloud.length > 0) details.push(`Облако: ${serviceGroups.cloud.length}`);
      if (serviceGroups.monitoring.length > 0) details.push(`Мониторинг: ${serviceGroups.monitoring.length}`);
      if (serviceGroups.communication.length > 0) details.push(`Коммуникация: ${serviceGroups.communication.length}`);
      if (serviceGroups.other.length > 0) details.push(`Другие: ${serviceGroups.other.length}`);
      
      results.push({
        item: "API ключи внешних сервисов",
        status: "INFO",
        details: `Обнаружены API ключи внешних сервисов: ${details.join(', ')}`,
        severity: "low"
      });
    }
    
    // 4. Анализ CI/CD конфигурации на использование внешних сервисов
    if (gitlabCIRaw) {
      const externalServices = [];
      const servicePatterns = [
        { pattern: /snyk/i, name: "Snyk", category: "security" },
        { pattern: /sonarqube/i, name: "SonarQube", category: "code quality" },
        { pattern: /jenkins/i, name: "Jenkins", category: "ci/cd" },
        { pattern: /circleci/i, name: "CircleCI", category: "ci/cd" },
        { pattern: /travis/i, name: "Travis CI", category: "ci/cd" },
        { pattern: /aws/i, name: "AWS", category: "cloud" },
        { pattern: /azure/i, name: "Azure", category: "cloud" },
        { pattern: /gcp|google/i, name: "Google Cloud", category: "cloud" },
        { pattern: /datadog/i, name: "Datadog", category: "monitoring" },
        { pattern: /newrelic/i, name: "New Relic", category: "monitoring" },
        { pattern: /sentry/i, name: "Sentry", category: "monitoring" },
        { pattern: /slack/i, name: "Slack", category: "communication" },
        { pattern: /teams/i, name: "Microsoft Teams", category: "communication" },
        { pattern: /docker\.io/i, name: "Docker Hub", category: "registry" },
        { pattern: /npmjs\.org/i, name: "npm Registry", category: "package manager" },
        { pattern: /pypi\.org/i, name: "PyPI", category: "package manager" }
      ];
      
      servicePatterns.forEach(service => {
        if (service.pattern.test(gitlabCIRaw)) {
          if (!externalServices.some(s => s.name === service.name)) {
            externalServices.push({
              name: service.name,
              category: service.category
            });
          }
        }
      });
      
      if (externalServices.length > 0) {
        // Группируем по категориям
        const byCategory = {};
        externalServices.forEach(service => {
          if (!byCategory[service.category]) {
            byCategory[service.category] = [];
          }
          byCategory[service.category].push(service.name);
        });
        
        const categoryDetails = Object.entries(byCategory)
          .map(([category, services]) => `${category}: ${services.join(', ')}`)
          .join('\n');
        
        results.push({
          item: "Внешние сервисы в CI/CD конфигурации",
          status: "INFO",
          details: `Обнаружены ссылки на внешние сервисы:\n${categoryDetails}`,
          severity: "low"
        });
        
        // Проверка на небезопасное использование внешних сервисов
        const lines = gitlabCIRaw.split('\n');
        const insecureUsage = [];
        
        lines.forEach((line, index) => {
          // Проверка на хардкод секретов для внешних сервисов
          if (line.includes('curl') || line.includes('wget')) {
            servicePatterns.forEach(service => {
              if (service.pattern.test(line)) {
                // Проверяем, нет ли в строке секретов
                if (line.includes('token=') || line.includes('key=') || line.includes('secret=')) {
                  insecureUsage.push({
                    line: index + 1,
                    service: service.name,
                    content: line.trim().substring(0, 100) + (line.length > 100 ? '...' : '')
                  });
                }
              }
            });
          }
        });
        
        if (insecureUsage.length > 0) {
          results.push({
            item: "Небезопасное использование внешних сервисов",
            status: "DANGER",
            details: `Обнаружено небезопасное использование внешних сервисов:\n${insecureUsage.map(u => `Строка ${u.line}: ${u.service} - "${u.content}"`).join('\n')}`,
            severity: "critical"
          });
        }
      }
    } else {
      results.push({
        item: "Анализ CI/CD конфигурации",
        status: "INFO",
        details: "CI/CD конфигурация не найдена для проверки внешних сервисов.",
        severity: "low"
      });
    }
    
    // 5. Проверка зависимостей на внешние пакеты
    if (repoTree && repoTree.length > 0) {
      const packageFiles = repoTree.filter(file => 
        file.name === 'package.json' || 
        file.name === 'requirements.txt' ||
        file.name === 'Pipfile' ||
        file.name === 'go.mod' ||
        file.name === 'Gemfile' ||
        file.name === 'pom.xml' ||
        file.name === 'build.gradle'
      );
      
      if (packageFiles.length > 0) {
        results.push({
          item: "Зависимости от внешних пакетов",
          status: "INFO",
          details: `Обнаружены файлы зависимостей: ${packageFiles.map(f => f.name).join(', ')}. Зависимости загружаются из внешних реестров.`,
          severity: "low"
        });
      }
    }
    
    // 6. Проверка на использование CDN и внешних ресурсов
    if (repoTree && repoTree.length > 0) {
      const webFiles = repoTree.filter(file => 
        file.name && (
          file.name.endsWith('.html') || 
          file.name.endsWith('.js') || 
          file.name.endsWith('.css')
        )
      ).slice(0, 10);
      
      // Заметка: в текущей архитектуре мы не загружаем содержимое файлов
      // Если нужно проверять содержимое, это нужно делать в scanService.js
      
      if (webFiles.length > 0) {
        results.push({
          item: "Веб-файлы с возможными внешними ресурсами",
          status: "INFO",
          details: `Обнаружены ${webFiles.length} веб-файлов. Рекомендуется проверить на использование внешних CDN.`,
          severity: "low"
        });
      }
    }
    
    // 7. Проверка на использование SaaS решений
    const saasIndicators = [];
    
    // Проверка переменных на SaaS сервисы
    projectVariables.forEach(variable => {
      if (!variable || !variable.key) return;
      
      const key = variable.key.toLowerCase();
      if (key.includes('saas') || 
          (key.includes('software') && key.includes('service')) ||
          (key.includes('platform') && key.includes('as') && key.includes('service'))) {
        saasIndicators.push(`Переменная: ${variable.key}`);
      }
    });
    
    if (gitlabCIRaw) {
      const saasKeywords = ['SaaS', 'Software as a Service', 'Platform as a Service', 'cloud service', 'managed service'];
      saasKeywords.forEach(keyword => {
        if (gitlabCIRaw.includes(keyword)) {
          saasIndicators.push(`CI/CD: упоминание ${keyword}`);
        }
      });
    }
    
    if (saasIndicators.length > 0) {
      results.push({
        item: "Использование SaaS решений",
        status: "INFO",
        details: `Обнаружены индикаторы использования SaaS:\n${saasIndicators.slice(0, 5).join('\n')}${saasIndicators.length > 5 ? '\n...' : ''}`,
        severity: "low"
      });
    }
    
    // 8. Проверка на наличие политики использования сторонних сервисов
    if (repoTree && repoTree.length > 0) {
      const policyFiles = repoTree.filter(file => 
        file.name && (
          file.name.toLowerCase().includes('policy') ||
          file.name.toLowerCase().includes('compliance') ||
          file.name.toLowerCase().includes('guideline')
        )
      );
      
      if (policyFiles.length > 0) {
        results.push({
          item: "Файлы политик и руководств",
          status: "INFO",
          details: `Обнаружены файлы политик: ${policyFiles.map(f => f.name).join(', ')}.`,
          severity: "low"
        });
      }
    }
    
    // 9. Проверка на использование deprecated или небезопасных сервисов
    if (gitlabCIRaw) {
      const deprecatedServices = [];
      const lines = gitlabCIRaw.split('\n');
      
      const deprecatedPatterns = [
        { pattern: /travis-ci\.org/i, name: "Travis CI (legacy)", reason: "Миграция на travis-ci.com" },
        { pattern: /circleci\.com\/v1\./i, name: "CircleCI v1", reason: "Устаревшая версия API" },
        { pattern: /jenkins-ci\.org/i, name: "Jenkins (публичный)", reason: "Рекомендуется использовать внутренний инстанс" }
      ];
      
      lines.forEach((line, index) => {
        deprecatedPatterns.forEach(service => {
          if (service.pattern.test(line)) {
            deprecatedServices.push({
              line: index + 1,
              name: service.name,
              reason: service.reason,
              content: line.trim()
            });
          }
        });
      });
      
      if (deprecatedServices.length > 0) {
        results.push({
          item: "Устаревшие или небезопасные сервисы",
          status: "WARN",
          details: `Обнаружены устаревшие сервисы:\n${deprecatedServices.map(s => `Строка ${s.line}: ${s.name} (${s.reason}) - "${s.content}"`).join('\n')}`,
          severity: "medium"
        });
      }
    }
    
  } catch (error) {
    console.error(`Error in SEC-8 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка неконтролируемого использования сторонних сервисов",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }
  
  return {
    id: "SEC-CICD-8",
    name: "Неконтролируемое использование сторонних сервисов",
    results
  };
};