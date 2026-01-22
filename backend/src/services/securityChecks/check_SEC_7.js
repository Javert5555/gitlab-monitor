module.exports = async function checkSEC7(projectId, projectData, gitlab) {
  const {
    projectRunners = [],
    projectDetails = {},
    projectVariables = [],
    projectEnvironments = [],
    projectHooks = [],
    gitlabCIRaw = null,
    repoTree = []
  } = projectData;

  const results = [];

  try {
    const runners = projectRunners;
    
    //раннеры с устаревшей конфигурацией
    const outdatedRunners = runners.filter(r => {
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
    
    // раннеры без ограничений по тегам
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
    const projectSettings = projectDetails;
    
    // анализ CI/CD конфигурации на небезопасные настройки
    if (gitlabCIRaw) {
      const lines = gitlabCIRaw.split('\n');
      
      // использование небезопасных образов
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
          details: `Обнаружены образы с тегом latest:\n${unsafeImages.map(img => `Строка ${img.line}: ${img.description} - "${img.content}"`).slice(0, 3).join('\n')}${unsafeImages.length > 3 ? '\n...' : ''}`,
          severity: "high"
        });
      }
      
      // отсутствие ресурсных ограничений
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
      
      // использование небезопасных volume mounts
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
          status: "DANGER",
          details: `Обнаружены небезопасные volume mounts:\n${unsafeVolumes.map(v => `Строка ${v.line}: ${v.risk} - "${v.content}"`).slice(0, 3).join('\n')}${unsafeVolumes.length > 3 ? '\n...' : ''}`,
          severity: "critical"
        });
      }
      
      // использование привилегированных контейнеров
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
          status: "DANGER",
          details: `Обнаружены привилегированные контейнеры:\n${privilegedContainers.map(c => `Строка ${c.line}: "${c.content}"`).slice(0, 3).join('\n')}${privilegedContainers.length > 3 ? '\n...' : ''}`,
          severity: "critical"
        });
      }
      
      // проверка на использование устаревших сервисов
      const deprecatedServices = [];
      const servicePatterns = [
        { pattern: /mysql:5\.6/, description: "MySQL 5.6 (EOL)" },
        { pattern: /postgres:9\.6/, description: "PostgreSQL 9.6 (EOL)" },
        { pattern: /redis:3\.2/, description: "Redis 3.2 (старая версия)" },
        { pattern: /node:8/, description: "Node.js 8 (EOL)" },
        { pattern: /python:2\.7/, description: "Python 2.7 (EOL)" },
        { pattern: /ruby:2\.3/, description: "Ruby 2.3 (EOL)" }
      ];
      
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
          status: "DANGER",
          details: `Обнаружены устаревшие сервисы:\n${deprecatedServices.map(s => `Строка ${s.line}: ${s.description}`).slice(0, 3).join('\n')}${deprecatedServices.length > 3 ? '\n...' : ''}`,
          severity: "high"
        });
      }
    }
    
    // проверка настроек окружений
    const environments = projectEnvironments;
    
    // проверка окружения с внешними URL
    const externalEnvironments = environments.filter(env => 
      env.external_url && 
      (env.external_url.startsWith('http://') || 
       (!env.external_url.includes('.internal') && 
        !env.external_url.includes('.local')))
    );
    
    if (externalEnvironments.length > 0) {
      results.push({
        item: "Окружения с публичными URL",
        status: "WARN",
        details: `Обнаружены окружения с публичными URL: ${externalEnvironments.slice(0, 3).map(e => `${e.name}`).join(', ')}${externalEnvironments.length > 3 ? '...' : ''}`,
        severity: "medium"
      });
    } else {
      results.push({
        item: "Окружения с публичными URL",
        status: "OK",
        details: `В проекте не обнаружены окружения.`,
        severity: "medium"
      });
    }
    
    // проверка настроек webhooks
    const hooks = projectHooks;
    
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
    id: "SEC-CICD-7",
    name: "Небезопасная конфигурация системы",
    results
  };
};