module.exports = async function checkSEC4(projectId, project, gitlab) {
  const {
    repoTree = [],
    branches = [],
    protectedBranches = [],
    gitlabCIRaw,
    projectVariables = [],
    pipelines = [],
    projectRunners = [],
    projectHooks = [],
    projectMembers = [],
    projectEnvironments = [],
    projectDetails = {}
  } = project;

  const results = [];

  try {
    // Проверка наличия CI/CD конфигурационных файлов
    const ciConfigs = repoTree.filter(file => 
      file.name === '.gitlab-ci.yml' ||
      file.name === 'Jenkinsfile' ||
      file.name.includes('azure-pipelines.yml')
    );
    
    const hasCiConfigs = ciConfigs.length > 0;
    
    results.push({
      item: "Наличие CI/CD конфигураций",
      status: "INFO",
      details: hasCiConfigs
        ? `Обнаружены файлы CI/CD: ${ciConfigs.map(f => f.name).join(', ')}`
        : "Файлы CI/CD не обнаружены. Проверка PPE не применима.",
    });
    
    if (!hasCiConfigs) {
      return {
        id: "SEC-CICD-4",
        name: "Poisoned Pipeline Execution (PPE) / Выполнение «отравленного» pipeline",
        results
      };
    }

    const iacVulnerabilities = await checkIacScanningWithDetails(
      projectId, 
      gitlabCIRaw, 
      pipelines, 
      gitlab
    );

    results.push(...iacVulnerabilities);

    checkDirectPPE(results, branches, protectedBranches, gitlabCIRaw, repoTree, ciConfigs);
    checkIndirectPPE(results, gitlabCIRaw, repoTree, projectId, gitlab);
    checkPublicPPE(results, projectDetails, gitlabCIRaw);
    checkProtectionMeasures(results, {
      projectRunners,
      projectEnvironments,
      projectVariables,
      projectHooks,
      pipelines,
      gitlabCIRaw
    });

  } catch (error) {
    console.error(`Error in SEC-4 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка Poisoned Pipeline Execution (PPE)",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
    });
  }

  return {
    id: "SEC-CICD-4",
    name: "Poisoned Pipeline Execution (PPE) / Выполнение «отравленного» pipeline",
    results
  };
};

function checkDirectPPE(results, branches, protectedBranches, gitlabCIRaw, repoTree, ciConfigs) {
  // защита веток с CI файлами
  const mainBranches = branches.filter(b => 
    b.name === 'main' || b.name === 'master' || b.name === 'develop'
  );
  
  const unprotectedMainBranches = mainBranches.filter(branch => {
    const protectedBranch = protectedBranches.find(pb => pb.name === branch.name);
    return !protectedBranch || 
           (protectedBranch.push_access_levels && 
            protectedBranch.push_access_levels.some(access => access.access_level <= 30));
  });
  
  if (unprotectedMainBranches.length > 0) {
    results.push({
      item: "[D-PPE] Защита основных веток с CI файлами",
      status: "WARN",
      details: `Основные ветки не защищены от прямого изменения: ${unprotectedMainBranches.map(b => b.name).join(', ')}. Разработчики могут напрямую изменять CI конфигурации.`,
    });
  }

  // Раздельные репозитории / submodules / includes
  if (gitlabCIRaw) {
    const lines = gitlabCIRaw.split('\n');
    
    // Проверка на использование include с внешними источниками
    const externalIncludes = lines.filter(line => 
      line.includes('include:') && 
      (line.includes('http://') || line.includes('https://') || line.includes('git@'))
    );
    
    if (externalIncludes.length > 0) {
      results.push({
        item: "[D-PPE] Внешние include в CI/CD",
        status: "WARN",
        details: `Обнаружены include из внешних источников (${externalIncludes.length} шт.). Это вектор для D-PPE атак.`,
      });
    }
  }

  // Наличие CODEOWNERS для CI файлов
  const codeownersFiles = repoTree.filter(file => 
    file.name === 'CODEOWNERS' || 
    file.name === '.github/CODEOWNERS'
  );
  
  const hasCodeowners = codeownersFiles.length > 0;
  
}
/**
 * Проверка Indirect PPE - защита от изменения зависимых файлов
 */
async function checkIndirectPPE(results, gitlabCIRaw, repoTree, projectId, gitlab) {
  if (!gitlabCIRaw) return;
  
  const lines = gitlabCIRaw.split('\n');
  
  // Поиск исполняемых скриптов, на которые ссылается CI
  const scriptPatterns = [
    /\.sh$/i,
    /\.bash$/i,
    /Makefile/i,
    /Dockerfile/i,
    /\.ps1$/i,
    /\.py$/i,
    /\.js$/i
  ];
  
  const referencedScripts = [];
  lines.forEach(line => {
    scriptPatterns.forEach(pattern => {
      if (pattern.test(line)) {
        const match = line.match(/([\w\.\/-]+\.(sh|bash|py|js|ps1))/i);
        if (match) {
          referencedScripts.push(match[1]);
        }
      }
    });
  });
  
  // Проверка защиты этих скриптов (поиск в репозитории)
  const foundScripts = [];
  for (const script of referencedScripts.slice(0, 10)) {
    const scriptFile = repoTree.find(file => file.path && file.path.includes(script));
    if (scriptFile) {
      foundScripts.push(script);
    }
  }

  // Проверка на динамическое исполнение кода
  const dangerousPatterns = [
    { pattern: /curl.*\|.*(bash|sh)/i, description: "Загрузка и исполнение скриптов из интернета" },
    { pattern: /wget.*-O.*\|.*(bash|sh)/i, description: "Скачивание и исполнение файлов" },
    { pattern: /eval.*(curl|wget)/i, description: "Динамическое исполнение загруженного кода" },
    { pattern: /sh.*<.*(curl|wget)/i, description: "Прямое исполнение из сети" },
    { pattern: /python.*<.*(curl|wget)/i, description: "Исполнение Python кода из сети" }
  ];
  
  const foundPatterns = [];
  lines.forEach((line, index) => {
    dangerousPatterns.forEach(pattern => {
      if (pattern.pattern.test(line)) {
        foundPatterns.push({
          line: index + 1,
          pattern: pattern.description,
          content: line.trim()
        });
      }
    });
  });
  
  if (foundPatterns.length > 0) {
    results.push({
      item: "[I-PPE] Динамическое исполнение кода",
      status: "FAIL",
      details: `Обнаружены опасные паттерны I-PPE:\n${foundPatterns.map(p => `Строка ${p.line}: ${p.pattern}`).slice(0, 3).join('\n')}`,
    });
  }

  // Проверка на использование небезопасных команд
  const unsafeCommands = lines.filter(line => 
    (line.includes('curl') || line.includes('wget')) &&
    (line.includes('|') || line.includes('>') || line.includes('<')) &&
    !line.includes('#')
  );

  if (unsafeCommands.length > 0) {
    results.push({
      item: "[I-PPE] Небезопасные команды загрузки",
      status: "WARN",
      details: `Обнаружены потенциально опасные команды загрузки: ${unsafeCommands.length} шт.`,
    });
  }
}

/**
 * Проверка Public PPE - защита публичных проектов
 */
function checkPublicPPE(results, projectDetails, gitlabCIRaw) {
  // Проверка, является ли проект публичным
  const isPublicProject = projectDetails.visibility === 'public' || 
                         projectDetails.visibility === 'internal';
  
  if (isPublicProject) {
    results.push({
      item: "[3PE] Публичный проект",
      status: "WARN",
      details: "Проект является публичным. Повышен риск Public PPE атак через fork и PR.",
    });
    
    // Проверка настройки pipeline для PR
    if (gitlabCIRaw) {
      const lines = gitlabCIRaw.split('\n');
      const hasPRPipeline = lines.some(line => 
        (line.includes('only:') && line.includes('merge_requests')) ||
        (line.includes('rules:') && line.includes('$CI_PIPELINE_SOURCE') && line.includes('merge_request'))
      );
      
      if (hasPRPipeline) {
        results.push({
          item: "[3PE] Pipeline для Pull Requests",
          status: "INFO",
          details: "Настроен pipeline для выполнения при создании PR. Убедитесь в строгих проверках для PR.",
        });
      }
    }
  }
}

// проверка способов защиты от PPE
function checkProtectionMeasures(results, data) {
  const { 
    projectRunners = [], 
    projectEnvironments = [], 
    projectVariables = [],
    projectHooks = [],
    pipelines = [],
    gitlabCIRaw 
  } = data;
  
  
  // разделение секретов по окружениям
  const secretVariables = projectVariables.filter(v =>
    v.key && (
      v.key.toLowerCase().includes('token') ||
      v.key.toLowerCase().includes('secret') ||
      v.key.toLowerCase().includes('password') ||
      v.key.toLowerCase().includes('key')
    )
  );
  
  const globalSecrets = secretVariables.filter(v => 
    !v.environment_scope || v.environment_scope === '*'
  );
  
  if (globalSecrets.length > 0) {
    results.push({
      item: "Защита: Разделение секретов",
      status: "INFO",
      details: `${globalSecrets.length} секретов доступны во всех окружениях. Рекомендуется использовать environment-scoped переменные.`,
    });
  }
  
  // Проверка на наличие dev/prod окружений
  const prodEnvironments = projectEnvironments.filter(env =>
    env.name && (
      env.name.toLowerCase().includes('prod') ||
      env.name.toLowerCase().includes('production')
    )
  );
  
  const devEnvironments = projectEnvironments.filter(env =>
    env.name && (
      env.name.toLowerCase().includes('dev') ||
      env.name.toLowerCase().includes('staging') ||
      env.name.toLowerCase().includes('test')
    )
  );
  
  if (prodEnvironments.length > 0 && devEnvironments.length > 0) {
    results.push({
      item: "Защита: Разделение окружений",
      status: "INFO",
      details: `Обнаружены отдельные окружения: prod (${prodEnvironments.length}), dev (${devEnvironments.length}).`,
    });
  }
  
  // Проверка на привилегированные раннеры
  const privilegedRunners = projectRunners.filter(r => 
    r.tag_list && r.tag_list.includes('privileged')
  );
  
  if (privilegedRunners.length > 0) {
    results.push({
      item: "Защита: Привилегированные раннеры",
      status: "WARN",
      details: `Обнаружены ${privilegedRunners.length} привилегированных раннеров. Они могут быть мишенью для PPE атак.`,
    });
  }
  
  // Проверка на стабильность сборок
  if (pipelines && pipelines.length > 0) {
    const recentPipelines = pipelines.slice(0, 10);
    const failedPipelines = recentPipelines.filter(p => p.status === 'failed');
    const successRate = recentPipelines.length > 0 ? 
      ((recentPipelines.length - failedPipelines.length) / recentPipelines.length) * 100 : 100;
    
    if (successRate < 80 && recentPipelines.length >= 3) {
      results.push({
        item: "Стабильность сборок",
        status: "INFO",
        details: `Низкая стабильность сборок: ${successRate.toFixed(1)}% успешных. Частые сбои могут маскировать PPE атаки.`,
      });
    }
  }
  
  // Проверка на использование Docker образов с фиксированными версиями
  if (gitlabCIRaw) {
    const lines = gitlabCIRaw.split('\n');
    const imageLines = lines.filter(line => line.includes('image:'));
    const latestImages = imageLines.filter(line => 
      line.includes(':latest') || 
      (line.includes('image:') && !line.includes(':'))
    );
    
    if (latestImages.length > 0) {
      results.push({
        item: "Тэги Docker-образов",
        status: "INFO",
        details: `Обнаружены образы с тегом latest или без тега (${latestImages.length} шт.). Используйте фиксированные версии.`,
      });
    }
  }
}

async function checkIacScanningWithDetails(projectId, gitlabCIRaw, pipelines, gitlab) {
    try {
        const hasIacScanningInConfig = gitlabCIRaw && (
            gitlabCIRaw.includes('Security/SAST-IaC.gitlab-ci.yml') ||
            gitlabCIRaw.includes('Jobs/SAST-IaC.gitlab-ci.yml') ||
            gitlabCIRaw.includes('Security/IaC.gitlab-ci.yml') ||
            gitlabCIRaw.includes("template: 'Security/SAST-IaC") ||
            gitlabCIRaw.includes('iac_scanning:') ||
            gitlabCIRaw.includes('iac-scanning:') ||
            gitlabCIRaw.includes('kics-iac-sast') ||
            gitlabCIRaw.includes('kics:') ||
            gitlabCIRaw.includes('tfsec:') ||
            gitlabCIRaw.includes('checkov:')
        );

        if (!hasIacScanningInConfig) {
            return [];
        }

        if (!pipelines || pipelines.length === 0) {
            return [];
        }

        const sortedPipelines = [...pipelines].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        let lastIacScanningJob = null;
        let lastIacScanningPipeline = null;
        let iacScanningReport = null;
        let iacScanningFindings = null;

        for (const pipeline of sortedPipelines.slice(0, 5)) {
            try {
                const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
                const iacScanningJob = jobs.find(job => 
                    job.name === 'iac_scanning' || 
                    job.name.includes('iac_scanning') ||
                    job.name.includes('kics-iac-sast') ||
                    job.name.includes('kics') ||
                    job.name.includes('tfsec') ||
                    job.name.includes('checkov') ||
                    (job.stage && job.stage.toLowerCase().includes('test') && 
                     job.name.toLowerCase().includes('iac'))
                );

                if (iacScanningJob && (iacScanningJob.status === 'success' || 
                                       iacScanningJob.status === 'failed')) {
                    lastIacScanningJob = iacScanningJob;
                    lastIacScanningPipeline = pipeline;
                    
                    try {
                        iacScanningReport = await gitlab.getJobArtifactFile(
                            projectId, 
                            iacScanningJob.id, 
                            "gl-sast-report.json"
                        );
                        iacScanningFindings = parseIacScanningReport(iacScanningReport);
                    } catch (artifactError) {
                        console.log(`Could not fetch IaC Scanning artifacts for job ${iacScanningJob.id}:`, 
                                  artifactError.message);
                        const alternativePaths = [
                            "gl-sast-iac-report",
                            "gl-sast-report.json",
                            "iac-scanning-report.json",
                            "kics-report.json",
                            "tfsec-report.json",
                            "checkov-report.json"
                        ];
                        
                        for (const path of alternativePaths) {
                            try {
                                iacScanningReport = await gitlab.getJobArtifactFile(
                                    projectId, 
                                    iacScanningJob.id, 
                                    path
                                );
                                iacScanningFindings = parseIacScanningReport(iacScanningReport);
                                if (iacScanningFindings) break;
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                    break;
                }
            } catch (err) {
                console.error(`Error checking IaC Scanning job in pipeline ${pipeline.id}:`, err.message);
                continue;
            }
        }

        if (!lastIacScanningJob) {
            return [{
                item: "IaC Scanning",
                status: "INFO",
                details: "Отчёт не найден",
            }];
        }

        if (!iacScanningFindings || !iacScanningFindings.vulnerabilities || 
            iacScanningFindings.vulnerabilities.length === 0) {
            return [{
                item: "IaC Scanning",
                status: "INFO",
                details: "Отчёт не найден",
            }];
        }

        const vulnerabilities = iacScanningFindings.vulnerabilities.map(vuln => {
            let status;
            const severity = vuln.severity?.toLowerCase() || 'unknown';
            
            if (severity === 'critical') {
                status = 'DANGER';
            } else if (['high', 'medium', 'low'].includes(severity)) {
                status = 'WARN';
            } else {
                status = 'INFO';
            }

            let iacType = 'IaC';
            const fileName = vuln.location?.file || '';
            if (fileName.endsWith('.tf')) {
                iacType = 'Terraform';
            } else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
                iacType = 'Kubernetes/YAML';
            } else if (fileName.endsWith('.json')) {
                iacType = 'CloudFormation/JSON';
            } else if (fileName === 'Dockerfile' || fileName.endsWith('.dockerfile')) {
                iacType = 'Docker';
            }

            const kicsId = vuln.identifiers?.find(id => id.type === 'kics_id')?.value || 
                          vuln.cve?.replace('kics_id:', '').split(':')[0] || 
                          'Не указан';

            const details = `${vuln.description || vuln.name}\n` +
                          `Тип инфраструктуры: ${iacType}\n` +
                          `Файл: ${vuln.location?.file || 'Не указан'}\n` +
                          `Строка: ${vuln.location?.start_line || 'Не указана'}\n` +
                          `Правило KICS: ${kicsId}\n` +
                          `Категория: ${vuln.category || 'sast'}`;

            const documentationUrl = vuln.identifiers?.find(id => id.type === 'kics_id')?.url ||
                                    vuln.identifiers?.find(id => id.type === 'cwe')?.url ||
                                    null;

            return {
                item: "IaC Scanning",
                status: status,
                details: details,
                severity: severity,
                metadata: {
                    id: vuln.id,
                    scanner: vuln.scanner?.name || 'KICS',
                    location: vuln.location,
                    iac_type: iacType,
                    kics_id: kicsId,
                    cve: vuln.cve,
                    category: vuln.category,
                    identifiers: vuln.identifiers,
                    documentation_url: documentationUrl,
                    jobId: lastIacScanningJob.id,
                    pipelineId: lastIacScanningPipeline.id,
                    runDate: lastIacScanningPipeline.created_at
                }
            };
        });

        return vulnerabilities;

    } catch (error) {
        console.error(`Error in IaC Scanning check for project ${projectId}:`, error);
        return [];
    }
}

function parseIacScanningReport(reportData) {
    try {
        if (!reportData) {
            return null;
        }

        let data;
        if (typeof reportData === 'string') {
            try {
                data = JSON.parse(reportData);
            } catch (e) {
                console.error('IaC Scanning report is not valid JSON:', e.message);
                return null;
            }
        } else {
            data = reportData;
        }

        const vulnerabilities = data.vulnerabilities || [];
        
        const severityStats = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
            unknown: 0
        };
        
        vulnerabilities.forEach(vuln => {
            const severity = (vuln.severity || 'unknown').toLowerCase();
            if (severityStats.hasOwnProperty(severity)) {
                severityStats[severity]++;
            } else {
                severityStats.unknown++;
            }
        });

        return {
            vulnerabilities: vulnerabilities,
            total: vulnerabilities.length,
            severityStats: severityStats,
            scanDate: data.scan?.end_time || data.scan?.start_time || new Date().toISOString(),
            scanner: data.scan?.scanner?.name || (data.scan?.analyzer?.name || 'KICS'),
            scannerVersion: data.scan?.scanner?.version || data.scan?.analyzer?.version,
            scanType: data.scan?.type || 'sast'
        };
    } catch (error) {
        console.error('Error parsing IaC Scanning report:', error);
        return null;
    }
}
