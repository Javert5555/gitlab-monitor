module.exports = async function checkSEC7(projectId, projectData, gitlab) {
  const {
    projectRunners = [],
    projectDetails = {},
    projectVariables = [],
    projectEnvironments = [],
    projectHooks = [],
    gitlabCIRaw = null,
    repoTree = [],
    pipelines = [],
  } = projectData;

  const results = [];

  try {
    const runners = projectRunners;

    //раннеры с устаревшей конфигурацией
    const outdatedRunners = runners.filter((r) => {
      return r.status === "offline" || r.status === "not_connected";
    });

    if (outdatedRunners.length > 0) {
      results.push({
        item: "Неактивные или отключенные раннеры",
        status: "WARN",
        details: `Обнаружено ${outdatedRunners.length} неактивных или отключенных раннеров. Рекомендуется удалить неиспользуемые раннеры.`,
      });
    }

    // раннеры без ограничений по тегам
    const runnersWithoutTags = runners.filter(
      (r) => !r.tag_list || r.tag_list.length === 0,
    );

    if (runnersWithoutTags.length > 0) {
      results.push({
        item: "Раннеры без тегов",
        status: "WARN",
        details: `Обнаружено ${runnersWithoutTags.length} раннеров без тегов. Это может привести к выполнению jobs на неподходящих раннерах.`,
      });
    }
    const projectSettings = projectDetails;

    // анализ CI/CD конфигурации на небезопасные настройки
    if (gitlabCIRaw) {
      const lines = gitlabCIRaw.split("\n");

      // использование небезопасных образов
      const unsafeImages = [];
      const imagePatterns = [
        {
          pattern: /image:\s*["']?alpine:latest["']?/,
          description: "Образ alpine:latest (плавающий тег)",
        },
        {
          pattern: /image:\s*["']?node:latest["']?/,
          description: "Образ node:latest (плавающий тег)",
        },
        {
          pattern: /image:\s*["']?python:latest["']?/,
          description: "Образ python:latest (плавающий тег)",
        },
        {
          pattern: /image:\s*["']?ubuntu:latest["']?/,
          description: "Образ ubuntu:latest (плавающий тег)",
        },
        {
          pattern: /image:\s*["']?docker:latest["']?/,
          description: "Образ docker:latest (плавающий тег)",
        },
      ];

      lines.forEach((line, index) => {
        imagePatterns.forEach((pattern) => {
          if (pattern.pattern.test(line)) {
            unsafeImages.push({
              line: index + 1,
              description: pattern.description,
              content: line.trim(),
            });
          }
        });
      });

      if (unsafeImages.length > 0) {
        results.push({
          item: "Небезопасные Docker образы (плавающие теги)",
          status: "WARN",
          details: `Обнаружены образы с тегом latest:\n${unsafeImages
            .map(
              (img) =>
                `Строка ${img.line}: ${img.description} - "${img.content}"`,
            )
            .slice(0, 3)
            .join("\n")}${unsafeImages.length > 3 ? "\n..." : ""}`,
        });
      }

      // отсутствие ресурсных ограничений
      let hasResourceLimits = false;
      lines.forEach((line) => {
        if (
          line.includes("services:") ||
          line.includes("resources:") ||
          line.includes("limits:") ||
          line.includes("cpu_quota:") ||
          line.includes("mem_limit:")
        ) {
          hasResourceLimits = true;
        }
      });

      if (!hasResourceLimits) {
        results.push({
          item: "Отсутствие ограничений ресурсов",
          status: "WARN",
          details:
            "В конфигурации не установлены ограничения на CPU и memory. Это может привести к исчерпанию ресурсов.",
        });
      }

      // использование небезопасных volume mounts
      const unsafeVolumes = [];
      const volumePattern = /-\s*["']?\/.*:.*["']?/g;

      lines.forEach((line, index) => {
        if (
          volumePattern.test(line) &&
          (line.includes("/var/run/docker.sock") ||
            line.includes("/etc/passwd") ||
            line.includes("/etc/shadow") ||
            line.includes("/root") ||
            line.includes("/home"))
        ) {
          unsafeVolumes.push({
            line: index + 1,
            content: line.trim(),
            risk: line.includes("/var/run/docker.sock")
              ? "Docker socket exposure"
              : line.includes("/etc/passwd")
                ? "System password file exposure"
                : line.includes("/etc/shadow")
                  ? "System shadow file exposure"
                  : "Sensitive directory exposure",
          });
        }
      });

      if (unsafeVolumes.length > 0) {
        results.push({
          item: "Небезопасные volume mounts",
          status: "WARN",
          details: `Обнаружены небезопасные volume mounts:\n${unsafeVolumes
            .map((v) => `Строка ${v.line}: ${v.risk} - "${v.content}"`)
            .slice(0, 3)
            .join("\n")}${unsafeVolumes.length > 3 ? "\n..." : ""}`,
        });
      }

      // использование привилегированных контейнеров
      const privilegedContainers = [];
      lines.forEach((line, index) => {
        if (
          line.includes("privileged: true") ||
          line.includes("privileged: yes")
        ) {
          privilegedContainers.push({
            line: index + 1,
            content: line.trim(),
          });
        }
      });

      if (privilegedContainers.length > 0) {
        results.push({
          item: "Привилегированные контейнеры",
          status: "WARN",
          details: `Обнаружены привилегированные контейнеры:\n${privilegedContainers
            .map((c) => `Строка ${c.line}: "${c.content}"`)
            .slice(0, 3)
            .join("\n")}${privilegedContainers.length > 3 ? "\n..." : ""}`,
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
        { pattern: /ruby:2\.3/, description: "Ruby 2.3 (EOL)" },
      ];

      lines.forEach((line, index) => {
        servicePatterns.forEach((service) => {
          if (service.pattern.test(line)) {
            deprecatedServices.push({
              line: index + 1,
              description: service.description,
              content: line.trim(),
            });
          }
        });
      });

      if (deprecatedServices.length > 0) {
        results.push({
          item: "Устаревшие сервисы в конфигурации",
          status: "WARN",
          details: `Обнаружены устаревшие сервисы:\n${deprecatedServices
            .map((s) => `Строка ${s.line}: ${s.description}`)
            .slice(0, 3)
            .join("\n")}${deprecatedServices.length > 3 ? "\n..." : ""}`,
        });
      }
    }

    // проверка настроек окружений
    const environments = projectEnvironments;

    // проверка окружения с внешними URL
    const externalEnvironments = environments.filter(
      (env) =>
        env.external_url &&
        (env.external_url.startsWith("http://") ||
          (!env.external_url.includes(".internal") &&
            !env.external_url.includes(".local"))),
    );

    if (externalEnvironments.length > 0) {
      results.push({
        item: "Окружения с публичными URL",
        status: "WARN",
        details: `Обнаружены окружения с публичными URL: ${externalEnvironments
          .slice(0, 3)
          .map((e) => `${e.name}`)
          .join(", ")}${externalEnvironments.length > 3 ? "..." : ""}`,
      });
    } else {
      results.push({
        item: "Окружения с публичными URL",
        status: "OK",
        details: `В проекте не обнаружены окружения.`,
      });
    }

    const containerVulnerabilities = await checkContainerScanningWithDetails(
      projectId,
      gitlabCIRaw,
      pipelines,
      gitlab,
    );

    console.log('containerVulnerabilities')

    results.push(...containerVulnerabilities)
  } catch (error) {
    console.error(`Error in SEC-7 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка небезопасной конфигурации системы",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
    });
  }

  return {
    id: "SEC-CICD-7",
    name: "Небезопасная конфигурация системы",
    results,
  };
};

async function checkContainerScanningWithDetails(
  projectId,
  gitlabCIRaw,
  pipelines,
  gitlab,
) {
  try {
    const hasContainerScanningInConfig =
      gitlabCIRaw &&
      (gitlabCIRaw.includes("Security/Container-Scanning.gitlab-ci.yml") ||
        gitlabCIRaw.includes("template: 'Security/Container-Scanning") ||
        gitlabCIRaw.includes("container_scanning:") ||
        gitlabCIRaw.includes("container-scanning:") ||
        gitlabCIRaw.includes("trivy:") ||
        gitlabCIRaw.includes("clair:"));

    if (!hasContainerScanningInConfig) {
      return [];
    }

    if (!pipelines || pipelines.length === 0) {
      return [];
    }

    const sortedPipelines = [...pipelines].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    let lastContainerScanningJob = null;
    let lastContainerScanningPipeline = null;
    let containerScanningReport = null;
    let containerScanningFindings = null;

    for (const pipeline of sortedPipelines.slice(0, 5)) {
      try {
        const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
        const containerScanningJob = jobs.find(
          (job) =>
            job.name === "container_scanning" ||
            job.name.includes("container_scanning") ||
            job.name.includes("container-scanning") ||
            job.name.includes("trivy") ||
            job.name.includes("clair") ||
            (job.stage &&
              job.stage.toLowerCase().includes("test") &&
              job.name.toLowerCase().includes("container")),
        );

        if (
          containerScanningJob &&
          (containerScanningJob.status === "success" ||
            containerScanningJob.status === "failed")
        ) {
          lastContainerScanningJob = containerScanningJob;
          lastContainerScanningPipeline = pipeline;

          try {
            containerScanningReport = await gitlab.getJobArtifactFile(
              projectId,
              containerScanningJob.id,
              "gl-container-scanning-report.json",
            );
            containerScanningFindings = parseContainerScanningReport(
              containerScanningReport,
            );
          } catch (artifactError) {
            console.log(
              `Could not fetch Container Scanning artifacts for job ${containerScanningJob.id}:`,
              artifactError.message,
            );
            const alternativePaths = [
              "gl-container-scanning-report",
              "container-scanning-report.json",
              "trivy-report.json",
              "clair-report.json",
            ];

            for (const path of alternativePaths) {
              try {
                containerScanningReport = await gitlab.getJobArtifactFile(
                  projectId,
                  containerScanningJob.id,
                  path,
                );
                containerScanningFindings = parseContainerScanningReport(
                  containerScanningReport,
                );
                if (containerScanningFindings) break;
              } catch (e) {
                continue;
              }
            }
          }
          break;
        }
      } catch (err) {
        console.error(
          `Error checking Container Scanning job in pipeline ${pipeline.id}:`,
          err.message,
        );
        continue;
      }
    }

    if (!lastContainerScanningJob) {
      return [{
        item: "Container Scanning",
        status: "INFO",
        details: "Отчёт не найден",
      }];
    }

    if (
      !containerScanningFindings ||
      !containerScanningFindings.vulnerabilities ||
      containerScanningFindings.vulnerabilities.length === 0
    ) {
      return [{
        item: "Container Scanning",
        status: "INFO",
        details: "Отчёт не найден",
      }];
    }

    const vulnerabilities = containerScanningFindings.vulnerabilities.map(
      (vuln) => {
        let status;
        const severity = vuln.severity?.toLowerCase() || "unknown";

        if (severity === "critical") {
          status = "DANGER";
        } else if (["high", "medium", "low"].includes(severity)) {
          status = "WARN";
        } else {
          status = "INFO";
        }

        const details =
          `${vuln.description || vuln.name}\n` +
          `Образ: ${vuln.location?.image || "Не указан"}\n` +
          `Компонент: ${vuln.location?.dependency || vuln.component || "Не указан"}\n` +
          `Версия: ${vuln.location?.version || "Не указана"}\n` +
          `CVE: ${vuln.cve || "Не указан"}\n` +
          `CVSS Score: ${vuln.cvss_score || "Не указан"}`;

        return {
          item: "Container Scanning",
          status: status,
          details: details,
          severity: severity,
          metadata: {
            id: vuln.id,
            scanner: vuln.scanner?.name || "Unknown",
            location: vuln.location,
            cve: vuln.cve,
            component: vuln.component,
            cvss_score: vuln.cvss_score,
            fixed_version: vuln.fixed_version,
            jobId: lastContainerScanningJob.id,
            pipelineId: lastContainerScanningPipeline.id,
            runDate: lastContainerScanningPipeline.created_at,
          },
        };
      },
    );
    
    console.log('vulnerabilities',vulnerabilities)

    return vulnerabilities;
  } catch (error) {
    console.error(
      `Error in Container Scanning check for project ${projectId}:`,
      error,
    );
    return [];
  }
}

function parseContainerScanningReport(reportData) {
  try {
    if (!reportData) {
      return null;
    }

    let data;
    if (typeof reportData === "string") {
      try {
        data = JSON.parse(reportData);
      } catch (e) {
        console.error(
          "Container Scanning report is not valid JSON:",
          e.message,
        );
        return null;
      }
    } else {
      data = reportData;
    }

    const vulnerabilities = data.vulnerabilities || [];

    return {
      vulnerabilities: vulnerabilities,
      total: vulnerabilities.length,
      scanDate:
        data.scan?.end_time ||
        data.scan?.start_time ||
        new Date().toISOString(),
      scanner: data.scan?.scanner?.name || "GitLab Container Scanning",
    };
  } catch (error) {
    console.error("Error parsing Container Scanning report:", error);
    return null;
  }
}
