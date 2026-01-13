// src/services/securityChecks/check_SEC_3.js — Проверка Dependency Scanning + SAST с детальным отчетом
const axios = require('axios');

module.exports = async function checkSEC3(projectId, projectData, gitlab) {
    const {
        repoTree = [],
        gitlabCIRaw = null,
        pipelines = [],
        pipelineJobs = []
    } = projectData;

    const results = [];
    
    try {
        // 1. Проверяем наличие файлов зависимостей
        const dependencyFiles = {
            'package.json': { manager: 'npm', found: false },
            'package-lock.json': { manager: 'npm', found: false },
            'yarn.lock': { manager: 'yarn', found: false },
            'requirements.txt': { manager: 'pip', found: false },
            'Pipfile': { manager: 'pipenv', found: false },
            'Pipfile.lock': { manager: 'pipenv', found: false },
            'go.mod': { manager: 'go', found: false },
            'go.sum': { manager: 'go', found: false },
            'Gemfile': { manager: 'rubygems', found: false },
            'Gemfile.lock': { manager: 'rubygems', found: false },
            'pom.xml': { manager: 'maven', found: false },
            'build.gradle': { manager: 'gradle', found: false },
            'build.gradle.kts': { manager: 'gradle', found: false },
            'Cargo.toml': { manager: 'cargo', found: false },
            'Cargo.lock': { manager: 'cargo', found: false },
            'composer.json': { manager: 'composer', found: false },
            'composer.lock': { manager: 'composer', found: false }
        };

        const foundFiles = [];

        for (const file of repoTree) {
            if (dependencyFiles[file.name]) {
                dependencyFiles[file.name].found = true;
                foundFiles.push(file.name);
            }
        }

        results.push({
            item: "Файлы зависимостей",
            status: "INFO",
            details: foundFiles.length > 0
                ? `Обнаружены файлы зависимостей: ${foundFiles.join(', ')}`
                : "Файлы зависимостей не обнаружены. Если проект использует зависимости, убедитесь, что они задокументированы.",
            severity: "info"
        });

        // 2. Проверяем наличие lock-файлов
        const lockFiles = ['package-lock.json', 'yarn.lock', 'Pipfile.lock', 'Gemfile.lock', 'Cargo.lock', 'composer.lock', 'go.sum'];
        const hasLockFiles = lockFiles.some(file => dependencyFiles[file]?.found);

        results.push({
            item: "Lock-файлы для фиксации версий",
            status: "INFO",
            details: hasLockFiles
                ? "Обнаружены lock-файлы, что помогает предотвратить dependency confusion атаки (lock-файлы для фиксируют версии зависимостей)."
                : "Lock-файлы не обнаружены. Рекомендуется использовать lock-файлы для фиксации версий зависимостей.",
            severity: "info"
        });

        // 3. Анализируем package.json если он есть
        if (dependencyFiles['package.json'].found) {
            try {
                // const packageJsonContent = await gitlab.getRawFile(projectId, 'package.json');
                // console.log('packageJsonContent', packageJsonContent)
                // const packageJson = JSON.parse(packageJsonContent);
                const packageJson = await gitlab.getRawFile(projectId, 'package.json');
                // console.log('packageJson', packageJson)

                // Проверка на использование публичных реестров
                const registries = [];
                
                // Проверка .npmrc
                const hasNpmrc = repoTree.some(file => file.name === '.npmrc');
                if (hasNpmrc) {
                    try {
                        const npmrcContent = await gitlab.getRawFile(projectId, '.npmrc');
                        if (npmrcContent.includes('registry=')) {
                            const registryMatch = npmrcContent.match(/registry=(https?:\/\/[^\s]+)/);
                            if (registryMatch) {
                                registries.push(`npm: ${registryMatch[1]}`);
                            }
                        }
                    } catch (e) {
                        // .npmrc не найден или ошибка чтения
                    }
                }

                // Проверка зависимостей с версиями
                const allDeps = {
                    ...(packageJson.dependencies || {}),
                    ...(packageJson.devDependencies || {})
                };

                const depsWithVersions = Object.entries(allDeps).map(([name, version]) => ({
                    name,
                    version,
                    hasExactVersion: !version.includes('^') && !version.includes('~') &&
                                      !version.includes('>') && !version.includes('<'),
                    isGitUrl: version.includes('git+') || version.startsWith('git://') || version.startsWith('git+ssh://'),
                    isFileUrl: version.startsWith('file:'),
                    isPrivateRegistry: version.includes('@') && !version.startsWith('@')
                }));

                const exactVersionDeps = depsWithVersions.filter(dep => dep.hasExactVersion);
                const gitDeps = depsWithVersions.filter(dep => dep.isGitUrl);
                const fileDeps = depsWithVersions.filter(dep => dep.isFileUrl);

                results.push({
                    item: "Анализ зависимостей npm",
                    status: "OK",
                    details: `Всего зависимостей: ${Object.keys(allDeps).length}, с точными версиями: ${exactVersionDeps.length}`,
                    severity: "critical"
                });

                // Проверка на использование git-зависимостей (более безопасно)
                if (gitDeps.length > 0) {
                    results.push({
                        item: "Git-зависимости",
                        status: "OK",
                        details: `Используются git-зависимости (${gitDeps.length}), что снижает риск dependency confusion.`,
                        severity: "low"
                    });
                }

                // Проверка на использование wildcard версий
                const wildcardVersions = depsWithVersions.filter(dep =>
                    dep.version === '*' ||
                    dep.version === 'latest' ||
                    dep.version.includes('x') ||
                    dep.version === ''
                );

                if (wildcardVersions.length > 0) {
                    results.push({
                        item: "Wildcard версии зависимостей",
                        status: "DANGER",
                        details: `Обнаружены зависимости с wildcard версиями: ${wildcardVersions.map(d => d.name).join(', ')}. Это опасно для dependency confusion атак.`,
                        severity: "high"
                    });
                }

            } catch (error) {
                results.push({
                    item: "Анализ package.json",
                    status: "WARN",
                    details: `Не удалось проанализировать package.json: ${error.message}`,
                    severity: "low"
                });
            }
        }

        // // 4. Проверяем наличие CI-конфигураций для сканирования зависимостей
        // const ciConfigs = repoTree.filter(file =>
        //     file.name === '.gitlab-ci.yml' ||
        //     file.name === '.github/workflows/' ||
        //     file.name.includes('Jenkinsfile')
        // );

        // if (ciConfigs.length > 0) {
        //     // Проверяем наличие стадий сканирования зависимостей
        //     try {
        //         const hasDependencyCheck = gitlabCIRaw && (
        //             gitlabCIRaw.includes('dependency') ||
        //             gitlabCIRaw.includes('snyk') ||
        //             gitlabCIRaw.includes('trivy') ||
        //             gitlabCIRaw.includes('owasp') ||
        //             (gitlabCIRaw.includes('scan') && gitlabCIRaw.includes('dependencies'))
        //         );

        //         results.push({
        //             item: "Сканирование зависимостей в CI/CD",
        //             status: hasDependencyCheck ? "OK" : "WARN",
        //             details: hasDependencyCheck
        //                 ? "В CI/CD настроено сканирование зависимостей."
        //                 : "В CI/CD не обнаружено сканирование зависимостей. Рекомендуется добавить этап security scanning.",
        //             severity: "medium"
        //         });
        //     } catch (error) {
        //         // Не удалось прочитать CI-конфиг
        //     }
        // }

        // 5. Проверка на использование внутренних реестров
        const internalRegistryPatterns = [
            'nexus.internal',
            'artifactory.internal',
            'registry.internal',
            'packages.company.com',
            'npm.private',
            'pypi.private'
        ];

        let hasInternalRegistry = false;
        for (const file of repoTree) {
            if (file.name === '.npmrc' || file.name === '.pypirc' || file.name === '.yarnrc') {
                try {
                    const content = await gitlab.getRawFile(projectId, file.name);
                    if (internalRegistryPatterns.some(pattern => content.includes(pattern))) {
                        hasInternalRegistry = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }

        results.push({
            item: "Использование внутренних реестров",
            status: hasInternalRegistry ? "OK" : "WARN",
            details: hasInternalRegistry
                ? "Обнаружено использование внутреннего реестра пакетов, что снижает риск dependency confusion."
                : "Не обнаружено использование внутреннего реестра пакетов. Рекомендуется настроить proxy-реестр.",
            severity: "medium"
        });

        // 6. Проверка Dockerfile на сканирование образов
        const dockerFiles = repoTree.filter(file => 
            file.name === 'Dockerfile' || file.name.endsWith('.Dockerfile')
        );

        if (dockerFiles.length > 0) {
            results.push({
                item: "Docker образы",
                status: "INFO",
                details: `Обнаружено ${dockerFiles.length} Dockerfile. Рекомендуется добавить сканирование образов на уязвимости в CI/CD.`,
                severity: "low"
            });
        }

        // 7. ПРОВЕРКА SAST (Static Application Security Testing) - РАСШИРЕННАЯ ВЕРСИЯ
        const sastCheck = await checkSASTWithDetails(projectId, gitlabCIRaw, pipelines, gitlab);
        results.push(sastCheck);

    } catch (error) {
        console.error(`Error in SEC-3 check for project ${projectId}:`, error);
        results.push({
            item: "Проверка цепочки зависимостей",
            status: "FAIL",
            details: `Ошибка при выполнении проверки: ${error.message}`,
            severity: "info"
        });
    }

    return {
        id: "CICD-SEC-3",
        name: "Злоупотребление цепочкой зависимостей",
        results
    };
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

/**
 * Расширенная проверка SAST с деталями из отчета
 */
async function checkSASTWithDetails(projectId, gitlabCIRaw, pipelines, gitlab) {
    try {
        // 1. Проверяем наличие SAST в конфигурации CI/CD
        const hasSASTInConfig = gitlabCIRaw && (
            gitlabCIRaw.includes('Security/SAST.gitlab-ci.yml') ||
            gitlabCIRaw.includes("template: 'Security/SAST") ||
            gitlabCIRaw.includes('include:') && gitlabCIRaw.includes('SAST') ||
            gitlabCIRaw.includes('sast:') && gitlabCIRaw.includes('stage:')
        );

        if (!hasSASTInConfig) {
            return {
                item: "SAST (Static Application Security Testing)",
                status: "WARN",
                details: "SAST не настроен в CI/CD конфигурации. Рекомендуется добавить статический анализ безопасности.",
                severity: "medium"
            };
        }

        // 2. Ищем последний выполненный SAST job
        if (!pipelines || pipelines.length === 0) {
            return {
                item: "SAST (Static Application Security Testing)",
                status: "INFO",
                details: "SAST настроен, но пайплайны не найдены.",
                severity: "low"
            };
        }

        // Сортируем пайплайны по дате (новые сначала)
        const sortedPipelines = [...pipelines].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        let lastSastJob = null;
        let lastSastPipeline = null;
        let sastReport = null;
        let sastFindings = null;

        // Ищем последний пайплайн с SAST job (проверяем последние 5)
        for (const pipeline of sortedPipelines.slice(0, 5)) {
            try {
                const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
                const sastJob = jobs.find(job => 
                    job.name === 'sast' || 
                    job.name.includes('sast') ||
                    (job.stage && job.stage.toLowerCase().includes('test') && job.name.toLowerCase().includes('security'))
                );

                if (sastJob && (sastJob.status === 'success' || sastJob.status === 'failed')) {
                    lastSastJob = sastJob;
                    lastSastPipeline = pipeline;
                    
                    // Пытаемся получить отчет SAST из артефактов
                    try {
                        sastReport = await gitlab.getJobArtifactFile(projectId, sastJob.id, "gl-sast-report.json");
                        sastFindings = parseSASTReport(sastReport);
                    } catch (artifactError) {
                        console.log(`Could not fetch SAST artifacts for job ${sastJob.id}:`, artifactError.message);
                        // Пробуем альтернативные пути к отчету
                        const alternativePaths = [
                            "gl-sast-report",
                            "sast-report.json",
                            "semgrep-report.json"
                        ];
                        
                        for (const path of alternativePaths) {
                            try {
                                sastReport = await gitlab.getJobArtifactFile(projectId, sastJob.id, path);
                                sastFindings = parseSASTReport(sastReport);
                                if (sastFindings) break;
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                    break;
                }
            } catch (err) {
                console.error(`Error checking SAST job in pipeline ${pipeline.id}:`, err.message);
                continue;
            }
        }

        if (!lastSastJob) {
            return {
                item: "SAST (Static Application Security Testing)",
                status: "WARN",
                details: "SAST настроен, но не выполняется в пайплайнах. Проверьте условия запуска (only/except/rules).",
                severity: "medium"
            };
        }

        // 3. Формируем детализированный результат
        const runDate = new Date(lastSastPipeline.created_at).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let details = '';
        let status = 'INFO';
        let severity = 'high';

        if (lastSastJob.status === 'success') {
            if (sastFindings && sastFindings.total !== undefined) {
                // Если есть отчет с найденными уязвимостями
                const { total, bySeverity } = sastFindings;
                
                if (total === 0) {
                    status = 'OK';
                    details = ` SAST выполнен успешно. Найдено уязвимостей: 0`;
                } else {
                    status = 'DANGER';
                    
                    details = ` SAST нашел уязвимости: ${total}`;
                    const severityParts = [];
                    if (bySeverity.critical > 0) severityParts.push(`Critical: ${bySeverity.critical}`);
                    if (bySeverity.high > 0) severityParts.push(`High: ${bySeverity.high}`);
                    if (bySeverity.medium > 0) severityParts.push(`Medium: ${bySeverity.medium}`);
                    if (bySeverity.low > 0) severityParts.push(`Low: ${bySeverity.low}`);
                    
                    if (severityParts.length > 0) {
                        details += ` (${severityParts.join(', ')})`;
                    }
                }
            } else {
                // Если отчета нет, но job успешен
                status = 'OK';
                details = ` SAST выполнен успешно (отчет не доступен)`;
                severity = 'high';
            }
        } else if (lastSastJob.status === 'failed') {
            status = 'FAIL';
            
            if (sastFindings && sastFindings.total > 0) {
                const { total, bySeverity } = sastFindings;
                details = ` SAST завершился с ошибкой из-за уязвимостей: ${total}`;
                const severityParts = [];
                if (bySeverity.critical > 0) severityParts.push(`Critical: ${bySeverity.critical}`);
                if (bySeverity.high > 0) severityParts.push(`High: ${bySeverity.high}`);
                
                if (severityParts.length > 0) {
                    details += ` (${severityParts.join(', ')})`;
                }
                
                // Определяем уровень серьезности
                if (bySeverity.critical > 0) severity = 'high';
                else if (bySeverity.high > 0) severity = 'high';
                else severity = 'high';
            } else {
                details = ` SAST завершился с ошибкой`;
                severity = 'high';
            }
        } else {
            status = 'WARN';
            details = ` SAST выполняется или отменен. Статус: ${lastSastJob.status}`;
            severity = 'high';
        }

        // Добавляем метаинформацию (только ID)
        details += `\n Последний запуск: ${runDate}`;
        details += `\n Job ID: ${lastSastJob.id}`;
        details += `\n Pipeline ID: ${lastSastPipeline.id}`;
        
        if (sastFindings && sastFindings.total !== undefined && sastFindings.total > 0) {
            details += `\n Уязвимости: ${sastFindings.total}`;
            if (sastFindings.bySeverity) {
                details += ` (C:${sastFindings.bySeverity.critical || 0}, H:${sastFindings.bySeverity.high || 0}, M:${sastFindings.bySeverity.medium || 0}, L:${sastFindings.bySeverity.low || 0})`;
            }
            
            // Добавляем примеры уязвимостей если есть
            if (sastFindings.sampleVulnerabilities && sastFindings.sampleVulnerabilities.length > 0) {
                details += `\n\nПримеры:`;
                sastFindings.sampleVulnerabilities.forEach((vuln, index) => {
                    details += `\n${index + 1}. ${vuln.severity.toUpperCase()}: ${vuln.name} (${vuln.location})`;
                });
            }
        }

        return {
            item: "SAST (Static Application Security Testing)",
            status: status,
            details: details,
            severity: severity,
            metadata: {
                jobId: lastSastJob.id,
                pipelineId: lastSastPipeline.id,
                runDate: lastSastPipeline.created_at,
                findings: sastFindings,
                jobStatus: lastSastJob.status
            }
        };

    } catch (error) {
        console.error(`Error in SAST check for project ${projectId}:`, error);
        return {
            item: "SAST (Static Application Security Testing)",
            status: "WARN",
            details: `Ошибка при проверке SAST: ${error.message}`,
            severity: "high"
        };
    }
}

/**
 * Парсинг отчета SAST (GitLab формат)
 */
function parseSASTReport(reportData) {
    try {
        if (!reportData) {
            return null;
        }

        // Если reportData - строка, пробуем парсить как JSON
        let data;
        if (typeof reportData === 'string') {
            try {
                data = JSON.parse(reportData);
            } catch (e) {
                console.error('SAST report is not valid JSON:', e.message);
                return null;
            }
        } else {
            data = reportData;
        }

        // GitLab SAST отчет имеет такую структуру:
        // {
        //   "version": "15.0.0",
        //   "vulnerabilities": [...],
        //   "remediations": [...]
        // }
        
        const vulnerabilities = data.vulnerabilities || [];
        const total = vulnerabilities.length;
        
        // Группируем по severity
        const bySeverity = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
            unknown: 0
        };

        vulnerabilities.forEach(vuln => {
            const severity = (vuln.severity || 'unknown').toLowerCase();
            if (bySeverity.hasOwnProperty(severity)) {
                bySeverity[severity]++;
            } else {
                bySeverity.unknown++;
            }
        });

        // Извлекаем примеры уязвимостей (первые 3)
        const sampleVulnerabilities = vulnerabilities.slice(0, 3).map(vuln => ({
            name: vuln.name || vuln.message || 'Unknown vulnerability',
            severity: vuln.severity || 'unknown',
            location: vuln.location ? 
                (vuln.location.file ? `${vuln.location.file}:${vuln.location.start_line || 'N/A'}` : 'N/A') : 
                'N/A',
            description: vuln.description || vuln.message || 'No description'
        }));

        return {
            total,
            bySeverity,
            sampleVulnerabilities,
            scanDate: data.scan ? (data.scan.end_time || data.scan.start_time || new Date().toISOString()) : new Date().toISOString(),
            scanner: data.scan ? (data.scan.scanner ? data.scan.scanner.name : 'GitLab SAST') : 'GitLab SAST',
            reportVersion: data.version || 'unknown'
        };

    } catch (error) {
        console.error('Error parsing SAST report:', error);
        return null;
    }
}