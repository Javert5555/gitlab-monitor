module.exports = async function checkSEC10(projectId, projectData, gitlab) {
  const {
    gitlabCIRaw = null,
    pipelines = [],
    projectDetails = {},
    repoTree = []
  } = projectData;

  const results = [];

  try {
    // проверка наличия CI/CD конфигурации
    if (!gitlabCIRaw) {
      results.push({
        item: "CI/CD конфигурация",
        status: "INFO",
        details: "CI/CD конфигурация не найдена. Проверка логирования невозможна.",
        severity: "info"
      });
      return {
        id: "SEC-CICD-10",
        name: "Недостаточное логирование и видимость",
        results
      };
    }
    
    // анализ CI/CD конфигурации на предмет логирования
    const lines = gitlabCIRaw.split('\n');
    
    // наличие явного логирования
    const hasExplicitLogging = lines.some(line => 
      line.includes('echo') ||
      line.includes('printf') ||
      line.includes('logger') ||
      line.includes('log') && line.includes(':') ||
      line.includes('LOG_LEVEL') ||
      line.includes('DEBUG') ||
      line.includes('VERBOSE')
    );
    
    results.push({
      item: "Явное логирование в CI/CD",
      status: hasExplicitLogging ? "OK" : "WARN",
      details: hasExplicitLogging
        ? "Обнаружено явное логирование в конфигурации."
        : "Явное логирование не обнаружено. Рекомендуется добавить логирование.",
      severity: "low"
    });
    
    // проверка на логирование ошибок
    const hasErrorLogging = lines.some(line => 
      line.includes('trap') ||
      line.includes('set -e') ||
      line.includes('set -o errexit') ||
      line.includes('set -o pipefail') ||
      line.includes('onerror') ||
      line.includes('catch') ||
      line.includes('finally')
    );
    
    results.push({
      item: "Обработка и логирование ошибок",
      status: hasErrorLogging ? "OK" : "WARN",
      details: hasErrorLogging
        ? "Обнаружена обработка ошибок в конфигурации."
        : "Не обнаружена явная обработка ошибок. Рекомендуется добавить обработчики ошибок (catch).",
      severity: "medium"
    });
    
    // проверка на подавление вывода (что нежелательно)
    const hasOutputSuppression = lines.some(line => 
      line.includes('> /dev/null') ||
      line.includes('2>&1') && line.includes('/dev/null') ||
      line.includes('silent') ||
      line.includes('quiet')
    );
    
    if (hasOutputSuppression) {
      results.push({
        item: "Подавление вывода CI/CD",
        status: "WARN",
        details: "Обнаружено подавление вывода команд. Это может скрыть важную информацию для отладки.",
        severity: "medium"
      });
    }
    
    // проверка на использование переменных для управления уровнем логирования
    const hasLogLevelVariables = lines.some(line => 
      (line.includes('LOG_LEVEL') || line.includes('DEBUG')) && 
      (line.includes('${') || line.includes('$LOG'))
    );
    
    results.push({
      item: "Управление уровнем логирования",
      status: hasLogLevelVariables ? "OK" : "WARN",
      details: hasLogLevelVariables
        ? "Обнаружены переменные для управления уровнем логирования."
        : "Не обнаружено управление уровнем логирования. Рекомендуется добавить LOG_LEVEL переменные.",
      severity: "low"
    });
    
    // проверка на логирование секретов (опасно!)
    const secretLoggingPatterns = [
      /echo.*\$.*(PASSWORD|TOKEN|SECRET|KEY)/i,
      /printf.*\$.*(PASSWORD|TOKEN|SECRET|KEY)/i,
      /log.*\$.*(PASSWORD|TOKEN|SECRET|KEY)/i,
      /printenv.*(PASSWORD|TOKEN|SECRET|KEY)/i
    ];
    
    const secretLoggingIssues = [];
    lines.forEach((line, index) => {
      secretLoggingPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          secretLoggingIssues.push({
            line: index + 1,
            content: line.trim()
          });
        }
      });
    });
    
    if (secretLoggingIssues.length > 0) {
      results.push({
        item: "Потенциальная утечка секретов в логи",
        status: "FAIL",
        details: `Обнаружены команды, которые могут логировать секреты:\n${secretLoggingIssues.map(issue => `Строка ${issue.line}: "${issue.content}"`).join('\n')}`,
        severity: "critical"
      });
    }
    
    // проверка на мониторинг и алертинг
    const hasMonitoring = lines.some(line => 
      line.includes('alert') ||
      line.includes('notify') ||
      line.includes('slack') ||
      line.includes('teams') ||
      line.includes('webhook') ||
      line.includes('datadog') ||
      line.includes('newrelic') ||
      line.includes('sentry')
    );
    
    results.push({
      item: "Интеграция с системами мониторинга",
      status: "INFO",
      details: hasMonitoring
        ? "Обнаружены интеграции с системами мониторинга и алертинга."
        : "Не обнаружены интеграции с системами мониторинга. Рекомендуется добавить алертинг при сбоях.",
      severity: "info"
    });
    
    // проверка на наличие этапов сбора метрик
    const hasMetricsCollection = lines.some(line => 
      line.includes('metrics') ||
      line.includes('prometheus') ||
      line.includes('grafana') ||
      line.includes('stats') ||
      line.includes('analytics')
    );
    
    results.push({
      item: "Сбор метрик производительности",
      status: "INFO",
      details: hasMetricsCollection
        ? "Обнаружен сбор метрик производительности."
        : "Не обнаружен сбор метрик производительности. Рекомендуется добавить сбор метрик.",
      severity: "info"
    });
    
    // проверка настройки retention логов в GitLab
    if (pipelines && pipelines.length > 0) {
      // проверяем, доступны ли логи старых пайплайнов
      const oldPipelines = pipelines.filter(p => {
        if (!p.created_at) return false;
        const pipelineDate = new Date(p.created_at);
        const now = new Date();
        const ageInDays = (now - pipelineDate) / (1000 * 60 * 60 * 24);
        return ageInDays > 30; // Старше 30 дней
      });
      
      if (oldPipelines.length > 0) {
        results.push({
          item: "Доступность истории пайплайнов",
          status: "INFO",
          details: `Доступны логи пайплайнов старше 30 дней (${oldPipelines.length} шт.).`,
          severity: "info"
        });
      }
    }
    
    // проверка настроек проекта для логирования
    // проверка доступных функций логирования GitLab
    const gitlabLoggingFeatures = {
      hasContainerRegistry: projectDetails.container_registry_enabled || false,
      hasWiki: projectDetails.wiki_enabled || false,
      hasIssues: projectDetails.issues_enabled || false,
      hasMergeRequests: true // Всегда есть для GitLab
    };
    
    const enabledFeatures = Object.values(gitlabLoggingFeatures).filter(v => v).length;
    
    results.push({
      item: "Функции логирования GitLab",
      status: enabledFeatures > 2 ? "OK" : "WARN",
      details: `Включено ${enabledFeatures} из 4 функций логирования GitLab.`,
      severity: "low"
    });
    
    // проверка на наличие кастомных логов или артефактов с логами
    const hasLogArtifacts = lines.some(line => 
      line.includes('artifacts:') && 
      (line.includes('logs') || 
       line.includes('.log') || 
       line.includes('reports'))
    );
    
    if (hasLogArtifacts) {
      results.push({
        item: "Артефакты с логами",
        status: "INFO",
        details: "Обнаружено сохранение логов как артефактов.",
        severity: "low"
      });
    }
    
    // проверка на наличие этапов security scanning с логами
    const hasSecurityScanLogs = lines.some(line => 
      (line.includes('sast') || 
       line.includes('dast') || 
       line.includes('container_scanning') || 
       line.includes('secret_detection')) &&
      (line.includes('artifacts:') || line.includes('reports:'))
    );
    
    results.push({
      item: "Логи сканирования безопасности",
      status: "INFO",
      details: hasSecurityScanLogs
        ? "Обнаружено сохранение логов сканирования безопасности."
        : "Не обнаружено сохранение логов сканирования безопасности. Рекомендуется сохранять отчеты security scanning.",
      severity: "info"
    });
  
    // проверка на наличие интеграции с SIEM системами
    const hasSIEMIntegration = lines.some(line => 
      line.includes('splunk') ||
      line.includes('elk') ||
      line.includes('elastic') ||
      line.includes('kibana') ||
      line.includes('logstash') ||
      line.includes('graylog')
    );
    
    results.push({
      item: "Интеграция с SIEM системами",
      status: "INFO",
      details: hasSIEMIntegration
        ? "Обнаружена интеграция с SIEM системой."
        : "Не обнаружена интеграция с SIEM системами. Рекомендуется настройка для enterprise окружений.",
      severity: "info"
    });
    
    // проверка репозитория на наличие конфигураций логирования
    if (repoTree && repoTree.length > 0) {
      const loggingConfigFiles = repoTree.filter(file => 
        file.name && (
          file.name.includes('log') ||
          file.name.includes('logger') ||
          file.name.includes('logging') ||
          file.name === '.env' ||
          file.name === 'docker-compose.yml' ||
          file.name.includes('config') && (
            file.name.endsWith('.yml') || 
            file.name.endsWith('.yaml') || 
            file.name.endsWith('.json')
          )
        )
      ).slice(0, 10);
      
      if (loggingConfigFiles.length > 0) {
        results.push({
          item: "Конфигурационные файлы логирования",
          status: "INFO",
          details: `Обнаружены потенциальные конфигурационные файлы логирования: ${loggingConfigFiles.map(f => f.name).join(', ')}`,
          severity: "info"
        });
      }
    }
    
    // проверка на наличие документации по логированию
    if (repoTree && repoTree.length > 0) {
      const docsFiles = repoTree.filter(file => 
        file.name && (
          file.name.toLowerCase().includes('readme') ||
          file.name.toLowerCase().includes('docs') ||
          file.name.toLowerCase().includes('logging') ||
          file.name.toLowerCase().includes('monitoring')
        )
      );
      
      let hasLoggingDocs = false;
      
      results.push({
        item: "Документация по логированию и мониторингу",
        status: "INFO",
        details: "Для проверки документации требуется дополнительный анализ содержимого файлов.",
        severity: "info"
      });
    }
    
  } catch (error) {
    console.error(`Error in SEC-10 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка логирования и мониторинга",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
      severity: "info"
    });
  }
  
  return {
    id: "SEC-CICD-10",
    name: "Недостаточное логирование и видимость",
    results
  };
};