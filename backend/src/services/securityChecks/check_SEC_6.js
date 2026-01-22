module.exports = async function checkSEC6(projectId, projectData, gitlab) {
    const {
        projectVariables = [],
        repoTree = [],
        gitlabCIRaw = null,
        pipelines = []
    } = projectData;

    const results = [];
    try {
        // --- ПРОВЕРКИ ГИГИЕНЫ СЕКРЕТОВ ---

        // анализ переменных окружения на наличие секретов
        checkSecretVariables(results, projectVariables);

        // проверка защиты переменных (masked, protected)
        checkVariableProtection(results, projectVariables);

        // проверка ротации секретов
        checkSecretRotation(results, projectVariables);

        // проверка файлов на наличие хардкодных секретов
        await checkHardcodedSecrets(results, repoTree, projectId, gitlab);

        // проверка .gitignore на исключение файлов с секретами
        checkGitignoreForSecrets(results, repoTree, projectId, gitlab);

        // проверка CI/CD конфигурации на безопасную работу с секретами
        checkCICDSecretSafety(results, gitlabCIRaw);

        // проверка на использование систем управления секретами
        checkSecretManagementSystems(results, gitlabCIRaw);

        // проверка SECRET DETECTION (GitLab CI/CD)
        const secretDetectionCheck = await checkSecretDetection(projectId, gitlabCIRaw, pipelines, gitlab);
        results.push(secretDetectionCheck);

    } catch (error) {
        console.error(`Error in SEC-6 check for project ${projectId}:`, error);
        results.push({
            item: "Проверка гигиены секретов",
            status: "FAIL",
            details: `Ошибка при выполнении проверки: ${error.message}`,
            severity: "info"
        });
    }

    return {
        id: "CICD-SEC-6",
        name: "Недостаточная гигиена секретов",
        results
    };
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

/**
 * анализ переменных окружения на наличие секретов
 */
function checkSecretVariables(results, projectVariables) {
    // категории секретов
    const secretCategories = {
        tokens: [],
        passwords: [],
        keys: [],
        credentials: [],
        other: []
    };

    // анализ переменных на предмет секретов
    projectVariables.forEach(variable => {
        const key = variable.key ? variable.key.toLowerCase() : '';
        const value = variable.value || '';

        // определяем категорию
        if (key.includes('token') || key.includes('.token') || key.endsWith('.token')) {
            secretCategories.tokens.push(variable);
        } else if (key.includes('password') || key.includes('.password') || key.endsWith('.password')) {
            secretCategories.passwords.push(variable);
        } else if (key.includes('key') || key.includes('.key') || key.endsWith('.key') || key.includes('secret')) {
            secretCategories.keys.push(variable);
        } else if (key.includes('credential') || key.includes('auth') || key.includes('login')) {
            secretCategories.credentials.push(variable);
        } else if (value.length > 20 && /^[a-zA-Z0-9+/=]{20,}$/.test(value)) {
            // длинные base64 строки могут быть секретами
            secretCategories.other.push(variable);
        }
    });

    const totalSecrets = Object.values(secretCategories).reduce((sum, arr) => sum + arr.length, 0);

    results.push({
        item: "Обнаруженные секреты в переменных",
        status: "INFO",
        details: totalSecrets > 0
            ? `Обнаружено секретов: Токены (${secretCategories.tokens.length}), Пароли (${secretCategories.passwords.length}), Ключи (${secretCategories.keys.length}), Учётные данные (${secretCategories.credentials.length}), Другие (${secretCategories.other.length})`
            : "Секреты в переменных не обнаружены.",
        severity: "info"
    });
}

/**
 * проверка защиты переменных (masked, protected)
 */
function checkVariableProtection(results, projectVariables) {
    const secretVariables = projectVariables.filter(v =>
        v.key && (
            v.key.toLowerCase().includes('token') ||
            v.key.toLowerCase().includes('secret') ||
            v.key.toLowerCase().includes('password') ||
            v.key.toLowerCase().includes('key') ||
            v.key.toLowerCase().includes('credential')
        )
    );

    // проверка незащищённых секретов
    const unprotectedSecrets = secretVariables.filter(secret =>
        !secret.masked || !secret.protected
    );

    if (unprotectedSecrets.length > 0) {
        results.push({
            item: "Незащищённые секретные переменные",
            status: "FAIL",
            details: `Обнаружено ${unprotectedSecrets.length} незащищённых секретных переменных: ${unprotectedSecrets.map(s => s.key).slice(0, 5).join(', ')}${unprotectedSecrets.length > 5 ? '...' : ''}. Установите protected: true и masked: true.`,
            severity: "critical"
        });
    }

    // Проверка переменных с типом "file"
    const fileVariables = projectVariables.filter(v => v.variable_type === 'file');

    if (fileVariables.length > 0) {
        results.push({
            item: "Файловые переменные окружения",
            status: "INFO",
            details: `Обнаружено ${fileVariables.length} файловых переменных. Убедитесь, что они защищены.`,
            severity: "info"
        });
    }
}

/**
 * ппроверка ротации секретов
 */
function checkSecretRotation(results, projectVariables) {
    const now = new Date();
    const rotationThreshold = 90 * 24 * 60 * 60 * 1000; // 90 дней

    const secretVariables = projectVariables.filter(v =>
        v.key && (
            v.key.toLowerCase().includes('token') ||
            v.key.toLowerCase().includes('secret') ||
            v.key.toLowerCase().includes('password') ||
            v.key.toLowerCase().includes('key')
        )
    );

    const oldSecrets = secretVariables.filter(v => {
        if (!v.created_at) return false;
        const created = new Date(v.created_at);
        return (now - created) > rotationThreshold;
    });

    if (oldSecrets.length > 0) {
        results.push({
            item: "Устаревшие секреты (более 90 дней)",
            status: "WARN",
            details: `Обнаружено ${oldSecrets.length} секретов, созданных более 90 дней назад. Рекомендуется регулярная ротация.`,
            severity: "medium"
        });
    }
}

/**
 * проверка файлов на наличие хардкодных секретов
 * требует дополнительных запросов GitLab API
 */
async function checkHardcodedSecrets(results, repoTree, projectId, gitlab) {
    if (!repoTree || repoTree.length == 0) return;

    const suspiciousFiles = [];
    const secretPatterns = [
        { pattern: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/gi, name: "Пароли" },
        { pattern: /(token|access_token|api_key)\s*[:=]\s*["'][^"']{10,}["']/gi, name: "Токены" },
        { pattern: /(secret|secret_key)\s*[:=]\s*["'][^"']{8,}["']/gi, name: "Секретные ключи" },
        { pattern: /BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY/gi, name: "Приватные ключи" },
        { pattern: /(aws_access_key_id|aws_secret_access_key)\s*[:=]\s*["'][^"']{10,}["']/gi, name: "AWS ключи" }
    ];

    // проверяем только определённые типы файлов
    const fileTypesToCheck = [
        '.env', '.env.example', '.env.local', '.env.production',
        '.json', '.yaml', '.yml', '.toml',
        '.js', '.ts', '.py', '.java', '.go', '.rb',
        '.sh', '.bash', '.zsh'
    ];

    const filesToCheck = repoTree.filter(file =>
        fileTypesToCheck.some(ext => file.name.endsWith(ext)) &&
        file.type === 'blob'
    ).slice(0, 10); // ограничиваем количество проверяемых файлов

    for (const file of filesToCheck) {
        try {
            const content = await gitlab.getRawFile(projectId, file.path);

            secretPatterns.forEach(pattern => {
                const matches = content.match(pattern.pattern);
                if (matches && matches.length > 0) {
                    suspiciousFiles.push({
                        file: file.path,
                        pattern: pattern.name,
                        matches: matches.slice(0, 3) // ограничиваем количество примеров
                    });
                }
            });
        } catch (error) {
            // пропускаем файлы, которые не удалось прочитать
            continue;
        }
    }

    if (suspiciousFiles.length > 0) {
        const fileDetails = suspiciousFiles.map(f =>
            `${f.file}: ${f.pattern}`
        ).slice(0, 3).join('\n');

        results.push({
            item: "Хардкод секретов в файлах",
            status: "DANGER",
            details: `Обнаружены потенциальные секреты в файлах:\n${fileDetails}${suspiciousFiles.length > 3 ? '\n...' : ''}`,
            severity: "critical"
        });
    }
}

/**
 * проверка .gitignore на исключение файлов с секретами
 */
async function checkGitignoreForSecrets(results, repoTree, projectId, gitlab) {
    const gitignoreFiles = repoTree.filter(file => file.name === '.gitignore');
    let hasGitignoreForSecrets = false;

    if (gitignoreFiles.length > 0) {
        try {
            const gitignoreContent = await gitlab.getRawFile(projectId, '.gitignore');
            const secretFilePatterns = ['.env', '*.pem', '*.key', '*.crt', 'secrets/', 'credentials/'];

            hasGitignoreForSecrets = secretFilePatterns.some(pattern =>
                gitignoreContent.includes(pattern)
            );
        } catch (error) {
            // Не удалось прочитать .gitignore
        }
    }

    results.push({
        item: "Защита файлов с секретами в .gitignore",
        status: hasGitignoreForSecrets ? "OK" : "WARN",
        details: hasGitignoreForSecrets
            ? ".gitignore содержит паттерны для защиты файлов с секретами."
            : ".gitignore не содержит паттернов для защиты файлов с секретами. Добавьте .env, *.key и т.д.",
        severity: "medium"
    });
}

/**
 * проверка CI/CD конфигурации на безопасную работу с секретами
 */
function checkCICDSecretSafety(results, gitlabCIRaw) {
    if (!gitlabCIRaw) return;

    const lines = gitlabCIRaw.split('\n');

    // проверка на эхо секретов в логах
    let hasSecretEcho = false;
    lines.forEach((line, index) => {
        if (line.includes('echo') && line.includes('$')) {
            const varMatch = line.match(/\${[A-Z_][A-Z0-9_]+}/g);
            if (varMatch) {
                const suspiciousVars = varMatch.filter(v =>
                    v.includes('TOKEN') ||
                    v.includes('SECRET') ||
                    v.includes('PASSWORD') ||
                    v.includes('KEY')
                );
                if (suspiciousVars.length > 0) {
                    hasSecretEcho = true;
                }
            }
        }
    });

    if (hasSecretEcho) {
        results.push({
            item: "Эхо секретов в CI/CD логах",
            status: "FAIL",
            details: "Обнаружено echo переменных, которые могут содержать секреты. Это может привести к утечке секретов в логах.",
            severity: "high"
        });
    }

    // проверка на передачу секретов через command line
    const commandLineSecrets = lines.filter(line =>
        line.includes('curl') &&
        (line.includes('-H "Authorization:') || line.includes('--header "Authorization:'))
    );

    if (commandLineSecrets.length > 0) {
        results.push({
            item: "Передача секретов через command line",
            status: "WARN",
            details: "Обнаружена передача секретов через command line аргументы. Они могут быть видны в процессах системы.",
            severity: "medium"
        });
    }
}

/**
 * проверка на использование систем управления секретами
 */
function checkSecretManagementSystems(results, gitlabCIRaw) {
    if (!gitlabCIRaw) {
        results.push({
            item: "Использование систем управления секретами",
            status: "INFO",
            details: "CI/CD конфигурация не найдена.",
            severity: "info"
        });
        return;
    }

    const hasSecretManager = gitlabCIRaw.includes('vault') ||
        gitlabCIRaw.includes('aws secretmanager') ||
        gitlabCIRaw.includes('azure keyvault') ||
        gitlabCIRaw.includes('gcp secretmanager');

    results.push({
        item: "Использование систем управления секретами",
        status: hasSecretManager ? "OK" : "INFO",
        details: hasSecretManager
            ? "Обнаружено использование системы управления секретами."
            : "Не обнаружено использование систем управления секретами (Vault, AWS Secrets Manager и т.д.).",
        severity: "info"
    });
}

/**
 * проверка Secret Detection (GitLab CI/CD)
 */
async function checkSecretDetection(projectId, gitlabCIRaw, pipelines, gitlab) {
    try {
        // проверяем наличие Secret Detection в конфигурации CI/CD
        const hasSecretDetectionInConfig = gitlabCIRaw && (
            gitlabCIRaw.includes('Secret-Detection.gitlab-ci.yml') ||
            gitlabCIRaw.includes("template: 'Jobs/Secret-Detection") ||
            gitlabCIRaw.includes('Secret Detection') ||
            gitlabCIRaw.includes('secret_detection:') ||
            gitlabCIRaw.includes('secrets:') && gitlabCIRaw.includes('stage:')
        );

        if (!hasSecretDetectionInConfig) {
            return {
                item: "Secret Detection (GitLab CI/CD)",
                status: "WARN",
                details: "Secret Detection не настроен в CI/CD конфигурации. Рекомендуется добавить автоматическое обнаружение секретов.",
                severity: "critical"
            };
        }

        // ищем последний выполненный Secret Detection job
        if (!pipelines || pipelines.length === 0) {
            return {
                item: "Secret Detection (GitLab CI/CD)",
                status: "INFO",
                details: "Secret Detection настроен, но пайплайны не найдены.",
                severity: "critical"
            };
        }

        // сортируем пайплайны по дате (новые сначала)
        const sortedPipelines = [...pipelines].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        let lastSecretsJob = null;
        let lastSecretsPipeline = null;
        let secretsReport = null;
        let secretsFindings = null;

        // ищем последний пайплайн с Secret Detection job (проверяем последние 5)
        for (const pipeline of sortedPipelines.slice(0, 5)) {
            try {
                const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
                const secretsJob = jobs.find(job => 
                    job.name === 'secret_detection' || 
                    job.name.includes('secret') ||
                    job.name.includes('secrets') ||
                    (job.stage && job.stage.toLowerCase().includes('test') && 
                     (job.name.toLowerCase().includes('secret') || job.name.toLowerCase().includes('secrets')))
                );

                if (secretsJob && (secretsJob.status === 'success' || secretsJob.status === 'failed')) {
                    lastSecretsJob = secretsJob;
                    lastSecretsPipeline = pipeline;
                    
                    // пытаемся получить отчет Secret Detection из артефактов
                    try {
                        secretsReport = await gitlab.getJobArtifactFile(projectId, secretsJob.id, "gl-secret-detection-report.json");
                        secretsFindings = parseSecretDetectionReport(secretsReport);
                    } catch (artifactError) {
                        console.log(`Could not fetch Secret Detection artifacts for job ${secretsJob.id}:`, artifactError.message);
                        // пробуем альтернативные пути к отчету
                        const alternativePaths = [
                            "gl-secret-detection-report",
                            "secret-detection-report.json",
                            "gitleaks-report.json",
                            "secrets-report.json"
                        ];
                        
                        for (const path of alternativePaths) {
                            try {
                                secretsReport = await gitlab.getJobArtifactFile(projectId, secretsJob.id, path);
                                secretsFindings = parseSecretDetectionReport(secretsReport);
                                if (secretsFindings) break;
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                    break;
                }
            } catch (err) {
                console.error(`Error checking Secret Detection job in pipeline ${pipeline.id}:`, err.message);
                continue;
            }
        }

        if (!lastSecretsJob) {
            return {
                item: "Secret Detection (GitLab CI/CD)",
                status: "WARN",
                details: "Secret Detection настроен, но не выполняется в пайплайнах. Проверьте условия запуска.",
                severity: "critical"
            };
        }

        // формируем результат
        const runDate = new Date(lastSecretsPipeline.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let details = '';
        let status = 'INFO';
        let severity = 'critical';

        if (lastSecretsJob.status === 'success') {
            if (secretsFindings && secretsFindings.total !== undefined) {
                const { total } = secretsFindings;
                
                if (total === 0) {
                    status = 'OK';
                    details = `Secret Detection выполнен успешно. Найдено секретов: 0`;
                    severity = 'critical';
                } else {
                    status = 'DANGER';
                    // для секретов любое количество > 0 - это проблема
                    if (total >= 10) severity = 'critical';
                    else if (total >= 5) severity = 'critical';
                    else if (total >= 3) severity = 'critical';
                    else severity = 'critical';
                    
                    details = `Secret Detection нашел секреты: ${total}.`;
                    
                    // добавляем информацию о типах секретов если есть
                    if (secretsFindings.byType && Object.keys(secretsFindings.byType).length > 0) {
                        const typeDetails = Object.entries(secretsFindings.byType)
                            .map(([type, count]) => `${type}: ${count}`)
                            .join(', ');
                        details += ` (${typeDetails})`;
                    }
                }
            } else {
                // если отчета нет, но job успешен
                status = 'OK';
                details = `Secret Detection выполнен успешно (отчет не доступен)`;
                severity = 'critical';
            }
        } else if (lastSecretsJob.status === 'failed') {
            status = 'DANGER';
            
            if (secretsFindings && secretsFindings.total > 0) {
                const { total } = secretsFindings;
                details = `Secret Detection завершился с ошибкой из-за найденных секретов: ${total}`;
                
                if (total >= 10) severity = 'critical';
                else if (total >= 5) severity = 'critical';
                else severity = 'critical';
            } else {
                details = `Secret Detection завершился с ошибкой (без найденных секретов)`;
                severity = 'critical';
            }
        } else {
            status = 'WARN';
            details = `Secret Detection выполняется или отменен. Статус: ${lastSecretsJob.status}`;
            severity = 'critical';
        }

        // добавляем метаинформацию
        details += `\nПоследний запуск: ${runDate}.`;
        details += `\nJob ID: ${lastSecretsJob.id}.`;
        details += `\nPipeline ID: ${lastSecretsPipeline.id}.`;
        
        if (secretsFindings && secretsFindings.total !== undefined && secretsFindings.total > 0) {
            details += `\nКоличество найденных секретов: ${secretsFindings.total}.`;
        }

        return {
            item: "Secret Detection (GitLab CI/CD)",
            status: status,
            details: details,
            severity: severity,
            metadata: {
                jobId: lastSecretsJob.id,
                pipelineId: lastSecretsPipeline.id,
                runDate: lastSecretsPipeline.created_at,
                findings: secretsFindings,
                jobStatus: lastSecretsJob.status
            }
        };

    } catch (error) {
        console.error(`Error in Secret Detection check for project ${projectId}:`, error);
        return {
            item: "Secret Detection (GitLab CI/CD)",
            status: "FAIL",
            details: `Ошибка при проверке Secret Detection: ${error.message}`,
            severity: "critical"
        };
    }
}

/**
 * парсинг отчета Secret Detection (GitLab формат)
 */
function parseSecretDetectionReport(reportData) {
    try {
        if (!reportData) {
            return null;
        }

        // если reportData - строка, пробуем парсить как JSON
        let data;
        if (typeof reportData === 'string') {
            try {
                data = JSON.parse(reportData);
            } catch (e) {
                console.error('Secret Detection report is not valid JSON:', e.message);
                return null;
            }
        } else {
            data = reportData;
        }
        
        const vulnerabilities = data.vulnerabilities || [];
        const total = vulnerabilities.length;
        
        // группируем по типу секрета
        const byType = {};
        const sampleSecrets = [];

        vulnerabilities.forEach((vuln, index) => {
            const type = vuln.name || vuln.category || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
            
            // сохраняем первые 3 секрета как примеры
            if (index < 3) {
                sampleSecrets.push({
                    type: type,
                    description: vuln.message || vuln.description || 'Обнаружен секрет',
                    location: vuln.location ? 
                        (vuln.location.file ? `${vuln.location.file}:${vuln.location.start_line || 'N/A'}` : 'N/A') : 
                        'N/A',
                    severity: vuln.severity || 'unknown'
                });
            }
        });

        return {
            total,
            byType,
            sampleSecrets,
            scanDate: data.scan ? (data.scan.end_time || data.scan.start_time || new Date().toISOString()) : new Date().toISOString(),
            scanner: data.scan ? (data.scan.scanner ? data.scan.scanner.name : 'GitLab Secret Detection') : 'GitLab Secret Detection',
            reportVersion: data.version || 'unknown'
        };

    } catch (error) {
        console.error('Error parsing Secret Detection report:', error);
        return null;
    }
}