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
        // проверяем наличие файлов зависимостей
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
        });

        // проверяем наличие lock-файлов
        const lockFiles = ['package-lock.json', 'yarn.lock', 'Pipfile.lock', 'Gemfile.lock', 'Cargo.lock', 'composer.lock', 'go.sum'];
        const hasLockFiles = lockFiles.some(file => dependencyFiles[file]?.found);

        results.push({
            item: "Lock-файлы для фиксации версий",
            status: "INFO",
            details: hasLockFiles
                ? "Обнаружены lock-файлы, что помогает предотвратить dependency confusion атаки (lock-файлы для фиксируют версии зависимостей)."
                : "Lock-файлы не обнаружены. Рекомендуется использовать lock-файлы для фиксации версий зависимостей.",
        });

        // анализируем package.json если он есть
        if (dependencyFiles['package.json'].found) {
            try {
                const packageJson = await gitlab.getRawFile(projectId, 'package.json');

                // проверка на использование публичных реестров
                const registries = [];
                
                // проверка .npmrc
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
                        console.error('checkSEC3 error')
                    }
                }

                // проверка зависимостей с версиями
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
                });

                if (gitDeps.length > 0) {
                    results.push({
                        item: "Git-зависимости",
                        status: "OK",
                        details: `Используются git-зависимости (${gitDeps.length}), что снижает риск dependency confusion.`,
                    });
                }

                const wildcardVersions = depsWithVersions.filter(dep =>
                    dep.version === '*' ||
                    dep.version === 'latest' ||
                    dep.version.includes('x') ||
                    dep.version === ''
                );

                if (wildcardVersions.length > 0) {
                    results.push({
                        item: "Wildcard версии зависимостей",
                        status: "WARN",
                        details: `Обнаружены зависимости с wildcard версиями: ${wildcardVersions.map(d => d.name).join(', ')}. Это опасно для dependency confusion атак.`,
                    });
                }

            } catch (error) {
                results.push({
                    item: "Анализ package.json",
                    status: "WARN",
                    details: `Не удалось проанализировать package.json: ${error.message}`,
                });
            }
        }

        // проверка на использование внутренних реестров
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
        });

        // проверка Dockerfile на сканирование образов
        const dockerFiles = repoTree.filter(file => 
            file.name === 'Dockerfile' || file.name.endsWith('.Dockerfile')
        );

        if (dockerFiles.length > 0) {
            results.push({
                item: "Docker образы",
                status: "WARN",
                details: `Обнаружено ${dockerFiles.length} Dockerfile. Рекомендуется добавить сканирование образов на уязвимости в CI/CD.`,
            });
        }

        const sastCheck = await checkSASTWithDetails(projectId, gitlabCIRaw, pipelines, gitlab);
        results.push(...sastCheck);

        const scaCheck = await checkDependencyScanningWithDetails(projectId, gitlabCIRaw, pipelines, gitlab);
        results.push(...scaCheck);

    } catch (error) {
        console.error(`Error in SEC-3 check for project ${projectId}:`, error);
        results.push({
            item: "Проверка цепочки зависимостей",
            status: "FAIL",
            details: `Ошибка при выполнении проверки: ${error.message}`,
        });
    }

    return {
        id: "CICD-SEC-3",
        name: "Злоупотребление цепочкой зависимостей",
        results
    };
};

async function checkSASTWithDetails(projectId, gitlabCIRaw, pipelines, gitlab) {
    try {
        const hasSASTInConfig = gitlabCIRaw && (
            gitlabCIRaw.includes('Security/SAST.gitlab-ci.yml') ||
            gitlabCIRaw.includes("template: 'Security/SAST") ||
            gitlabCIRaw.includes('include:') && gitlabCIRaw.includes('SAST') ||
            gitlabCIRaw.includes('sast:') && gitlabCIRaw.includes('stage:')
        );

        if (!hasSASTInConfig) {
            return [];
        }

        if (!pipelines || pipelines.length === 0) {
            return [];
        }

        const sortedPipelines = [...pipelines].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        let lastSastJob = null;
        let lastSastPipeline = null;
        let sastReport = null;
        let sastFindings = null;

        for (const pipeline of sortedPipelines.slice(0, 5)) {
            try {
                const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
                const sastJob = jobs.find(job => 
                    job.name === 'sast' || 
                    job.name.includes('sast') ||
                    (job.stage && job.stage.toLowerCase().includes('test') && 
                     job.name.toLowerCase().includes('security'))
                );

                if (sastJob && (sastJob.status === 'success' || sastJob.status === 'failed')) {
                    lastSastJob = sastJob;
                    lastSastPipeline = pipeline;
                    
                    try {
                        sastReport = await gitlab.getJobArtifactFile(projectId, sastJob.id, "gl-sast-report.json");
                        sastFindings = parseSASTReport(sastReport);
                    } catch (artifactError) {
                        console.log(`Could not fetch SAST artifacts for job ${sastJob.id}:`, artifactError.message);
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
            return [{
                item: "SAST (Static Application Security Testing)",
                status: "INFO",
                details: "Отчёт не найден",
            }];
        }

        if (!sastFindings || !sastFindings.vulnerabilities || sastFindings.vulnerabilities.length === 0) {
            return [{
                item: "SAST (Static Application Security Testing)",
                status: "INFO",
                details: "Отчёт не найден",
            }];
        }

        const vulnerabilities = sastFindings.vulnerabilities.map(vuln => {
            let status;
            const severity = vuln.severity?.toLowerCase() || 'unknown';
            
            if (severity === 'critical') {
                status = 'DANGER';
            } else if (['high', 'medium', 'low'].includes(severity)) {
                status = 'WARN';
            } else {
                status = 'INFO';
            }

            const details = `${vuln.description || vuln.name}\n` +
                          `Файл: ${vuln.location?.file || 'Не указан'}\n` +
                          `Строка: ${vuln.location?.start_line || 'Не указана'}\n` +
                          `CVE: ${vuln.cve || 'Не указан'}\n` +
                          `Категория: ${vuln.category || 'Не указана'}`;

            return {
                item: vuln.name || "Неизвестная уязвимость",
                status: status,
                details: details,
                severity: severity,
                metadata: {
                    id: vuln.id,
                    scanner: vuln.scanner?.name || 'Unknown',
                    location: vuln.location,
                    identifiers: vuln.identifiers,
                    jobId: lastSastJob.id,
                    pipelineId: lastSastPipeline.id,
                    runDate: lastSastPipeline.created_at
                }
            };
        });

        return vulnerabilities;

    } catch (error) {
        console.error(`Error in SAST check for project ${projectId}:`, error);
        return [];
    }
}

function parseSASTReport(reportData) {
    try {
        if (!reportData) {
            return null;
        }

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

        const vulnerabilities = data.vulnerabilities || [];
        
        return {
            vulnerabilities: vulnerabilities,
            total: vulnerabilities.length,
            scanDate: data.scan?.end_time || data.scan?.start_time || new Date().toISOString(),
            scanner: data.scan?.scanner?.name || 'Unknown'
        };
    } catch (error) {
        console.error('Error parsing SAST report:', error);
        return null;
    }
}

async function checkDependencyScanningWithDetails(projectId, gitlabCIRaw, pipelines, gitlab) {
    try {
        const hasDependencyScanningInConfig = gitlabCIRaw && (
            gitlabCIRaw.includes('Security/Dependency-Scanning.gitlab-ci.yml') ||
            gitlabCIRaw.includes("template: 'Security/Dependency-Scanning") ||
            gitlabCIRaw.includes('dependency_scanning:') ||
            gitlabCIRaw.includes('dependency-scanning:')
        );

        if (!hasDependencyScanningInConfig) {
            return [];
        }

        if (!pipelines || pipelines.length === 0) {
            return [];
        }

        const sortedPipelines = [...pipelines].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );

        let lastDependencyScanningJob = null;
        let lastDependencyScanningPipeline = null;
        let dependencyScanningReport = null;
        let dependencyScanningFindings = null;

        for (const pipeline of sortedPipelines.slice(0, 5)) {
            try {
                const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
                const dependencyScanningJob = jobs.find(job => 
                    job.name === 'dependency_scanning' || 
                    job.name.includes('dependency_scanning') ||
                    job.name.includes('dependency-scanning') ||
                    (job.stage && job.stage.toLowerCase().includes('test') && 
                     job.name.toLowerCase().includes('dependency'))
                );

                if (dependencyScanningJob && (dependencyScanningJob.status === 'success' || 
                                              dependencyScanningJob.status === 'failed')) {
                    lastDependencyScanningJob = dependencyScanningJob;
                    lastDependencyScanningPipeline = pipeline;
                    
                    try {
                        dependencyScanningReport = await gitlab.getJobArtifactFile(
                            projectId, 
                            dependencyScanningJob.id, 
                            "gl-dependency-scanning-report.json"
                        );
                        dependencyScanningFindings = parseDependencyScanningReport(dependencyScanningReport);
                    } catch (artifactError) {
                        console.log(`Could not fetch Dependency Scanning artifacts for job ${dependencyScanningJob.id}:`, 
                                  artifactError.message);
                        const alternativePaths = [
                            "gl-dependency-scanning-report",
                            "dependency-scanning-report.json",
                            "dependency_scanning_report.json"
                        ];
                        
                        for (const path of alternativePaths) {
                            try {
                                dependencyScanningReport = await gitlab.getJobArtifactFile(
                                    projectId, 
                                    dependencyScanningJob.id, 
                                    path
                                );
                                dependencyScanningFindings = parseDependencyScanningReport(dependencyScanningReport);
                                if (dependencyScanningFindings) break;
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                    break;
                }
            } catch (err) {
                console.error(`Error checking Dependency Scanning job in pipeline ${pipeline.id}:`, err.message);
                continue;
            }
        }

        if (!lastDependencyScanningJob) {
            return [{
                item: "SCA (Dependency Scanning)",
                status: "INFO",
                details: "Отчёт не найден",
            }];
        }

        if (!dependencyScanningFindings || !dependencyScanningFindings.vulnerabilities || 
            dependencyScanningFindings.vulnerabilities.length === 0) {
            return [{
                item: "SCA (Dependency Scanning)",
                status: "INFO",
                details: "Отчёт не найден",
            }];
        }

        const vulnerabilities = dependencyScanningFindings.vulnerabilities.map(vuln => {
            let status;
            const severity = vuln.severity?.toLowerCase() || 'unknown';
            
            if (severity === 'critical') {
                status = 'DANGER';
            } else if (['high', 'medium', 'low'].includes(severity)) {
                status = 'WARN';
            } else {
                status = 'INFO';
            }

            const dependencyName = vuln.location?.dependency?.package?.name || 
                                  vuln.location?.dependency?.name || 
                                  vuln.component || 
                                  'Не указана';
            
            const dependencyVersion = vuln.location?.dependency?.version || 
                                     vuln.location?.version || 
                                     'Не указана';
            
            const packageManager = vuln.location?.dependency?.package_manager || 
                                  vuln.location?.package_manager || 
                                  'Не указан';

            const details = `${vuln.description || vuln.name}\n` +
                          `Зависимость: ${dependencyName}\n` +
                          `Версия: ${dependencyVersion}\n` +
                          `Пакетный менеджер: ${packageManager}\n` +
                          `CVE: ${vuln.cve || 'Не указан'}\n` +
                          `Исправленная версия: ${vuln.fixed_version || 'Не указана'}`;

            return {
                item: "Dependency Scanning",
                status: status,
                details: details,
                severity: severity,
                metadata: {
                    id: vuln.id,
                    scanner: vuln.scanner?.name || 'Dependency Scanning',
                    location: vuln.location,
                    cve: vuln.cve,
                    component: dependencyName,
                    version: dependencyVersion,
                    package_manager: packageManager,
                    fixed_version: vuln.fixed_version,
                    cvss_score: vuln.cvss_score,
                    identifiers: vuln.identifiers,
                    jobId: lastDependencyScanningJob.id,
                    pipelineId: lastDependencyScanningPipeline.id,
                    runDate: lastDependencyScanningPipeline.created_at
                }
            };
        });

        return vulnerabilities;

    } catch (error) {
        console.error(`Error in Dependency Scanning check for project ${projectId}:`, error);
        return [];
    }
}

function parseDependencyScanningReport(reportData) {
    try {
        if (!reportData) {
            return null;
        }

        let data;
        if (typeof reportData === 'string') {
            try {
                data = JSON.parse(reportData);
            } catch (e) {
                console.error('Dependency Scanning report is not valid JSON:', e.message);
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
            scanner: data.scan?.scanner?.name || (data.scan?.analyzer?.name || 'Dependency Scanning')
        };
    } catch (error) {
        console.error('Error parsing Dependency Scanning report:', error);
        return null;
    }
}