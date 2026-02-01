module.exports = async function checkSEC6(projectId, projectData, gitlab) {
  const {
    projectVariables = [],
    repoTree = [],
    gitlabCIRaw = null,
    pipelines = [],
  } = projectData;

  const results = [];
  try {
    checkSecretVariables(results, projectVariables);
    checkVariableProtection(results, projectVariables);
    checkSecretRotation(results, projectVariables);
    await checkHardcodedSecrets(results, repoTree, projectId, gitlab);
    checkGitignoreForSecrets(results, repoTree, projectId, gitlab);
    checkCICDSecretSafety(results, gitlabCIRaw);
    checkSecretManagementSystems(results, gitlabCIRaw);

    const secretDetectionCheck = await checkSecretDetectionWithDetails(
      projectId,
      gitlabCIRaw,
      pipelines,
      gitlab,
    );
    results.push(...secretDetectionCheck);
  } catch (error) {
    console.error(`Error in SEC-6 check for project ${projectId}:`, error);
    results.push({
      item: "Проверка гигиены секретов",
      status: "FAIL",
      details: `Ошибка при выполнении проверки: ${error.message}`,
    });
  }

  return {
    id: "CICD-SEC-6",
    name: "Недостаточная гигиена секретов",
    results,
  };
};

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
    other: [],
  };

  // анализ переменных на предмет секретов
  projectVariables.forEach((variable) => {
    const key = variable.key ? variable.key.toLowerCase() : "";
    const value = variable.value || "";

    // определяем категорию
    if (
      key.includes("token") ||
      key.includes(".token") ||
      key.endsWith(".token")
    ) {
      secretCategories.tokens.push(variable);
    } else if (
      key.includes("password") ||
      key.includes(".password") ||
      key.endsWith(".password")
    ) {
      secretCategories.passwords.push(variable);
    } else if (
      key.includes("key") ||
      key.includes(".key") ||
      key.endsWith(".key") ||
      key.includes("secret")
    ) {
      secretCategories.keys.push(variable);
    } else if (
      key.includes("credential") ||
      key.includes("auth") ||
      key.includes("login")
    ) {
      secretCategories.credentials.push(variable);
    } else if (value.length > 20 && /^[a-zA-Z0-9+/=]{20,}$/.test(value)) {
      // длинные base64 строки могут быть секретами
      secretCategories.other.push(variable);
    }
  });

  const totalSecrets = Object.values(secretCategories).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  results.push({
    item: "Обнаруженные секреты в переменных",
    status: "INFO",
    details:
      totalSecrets > 0
        ? `Обнаружено секретов: Токены (${secretCategories.tokens.length}), Пароли (${secretCategories.passwords.length}), Ключи (${secretCategories.keys.length}), Учётные данные (${secretCategories.credentials.length}), Другие (${secretCategories.other.length})`
        : "Секреты в переменных не обнаружены.",
  });
}

/**
 * проверка защиты переменных (masked, protected)
 */
function checkVariableProtection(results, projectVariables) {
  const secretVariables = projectVariables.filter(
    (v) =>
      v.key &&
      (v.key.toLowerCase().includes("token") ||
        v.key.toLowerCase().includes("secret") ||
        v.key.toLowerCase().includes("password") ||
        v.key.toLowerCase().includes("key") ||
        v.key.toLowerCase().includes("credential")),
  );

  // проверка незащищённых секретов
  const unprotectedSecrets = secretVariables.filter(
    (secret) => !secret.masked || !secret.protected,
  );

  if (unprotectedSecrets.length > 0) {
    results.push({
      item: "Незащищённые секретные переменные",
      status: "FAIL",
      details: `Обнаружено ${unprotectedSecrets.length} незащищённых секретных переменных: ${unprotectedSecrets
        .map((s) => s.key)
        .slice(0, 5)
        .join(
          ", ",
        )}${unprotectedSecrets.length > 5 ? "..." : ""}. Установите protected: true и masked: true.`,
    });
  }

  // Проверка переменных с типом "file"
  const fileVariables = projectVariables.filter(
    (v) => v.variable_type === "file",
  );

  if (fileVariables.length > 0) {
    results.push({
      item: "Файловые переменные окружения",
      status: "INFO",
      details: `Обнаружено ${fileVariables.length} файловых переменных. Убедитесь, что они защищены.`,
    });
  }
}

/**
 * ппроверка ротации секретов
 */
function checkSecretRotation(results, projectVariables) {
  const now = new Date();
  const rotationThreshold = 90 * 24 * 60 * 60 * 1000; // 90 дней

  const secretVariables = projectVariables.filter(
    (v) =>
      v.key &&
      (v.key.toLowerCase().includes("token") ||
        v.key.toLowerCase().includes("secret") ||
        v.key.toLowerCase().includes("password") ||
        v.key.toLowerCase().includes("key")),
  );

  const oldSecrets = secretVariables.filter((v) => {
    if (!v.created_at) return false;
    const created = new Date(v.created_at);
    return now - created > rotationThreshold;
  });

  if (oldSecrets.length > 0) {
    results.push({
      item: "Устаревшие секреты (более 90 дней)",
      status: "WARN",
      details: `Обнаружено ${oldSecrets.length} секретов, созданных более 90 дней назад. Рекомендуется регулярная ротация.`,
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
    {
      pattern: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/gi,
      name: "Пароли",
    },
    {
      pattern: /(token|access_token|api_key)\s*[:=]\s*["'][^"']{10,}["']/gi,
      name: "Токены",
    },
    {
      pattern: /(secret|secret_key)\s*[:=]\s*["'][^"']{8,}["']/gi,
      name: "Секретные ключи",
    },
    {
      pattern: /BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY/gi,
      name: "Приватные ключи",
    },
    {
      pattern:
        /(aws_access_key_id|aws_secret_access_key)\s*[:=]\s*["'][^"']{10,}["']/gi,
      name: "AWS ключи",
    },
  ];

  // проверяем только определённые типы файлов
  const fileTypesToCheck = [
    ".env",
    ".env.example",
    ".env.local",
    ".env.production",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".js",
    ".ts",
    ".py",
    ".java",
    ".go",
    ".rb",
    ".sh",
    ".bash",
    ".zsh",
  ];

  const filesToCheck = repoTree
    .filter(
      (file) =>
        fileTypesToCheck.some((ext) => file.name.endsWith(ext)) &&
        file.type === "blob",
    )
    .slice(0, 10); // ограничиваем количество проверяемых файлов

  for (const file of filesToCheck) {
    try {
      const content = await gitlab.getRawFile(projectId, file.path);

      secretPatterns.forEach((pattern) => {
        const matches = content.match(pattern.pattern);
        if (matches && matches.length > 0) {
          suspiciousFiles.push({
            file: file.path,
            pattern: pattern.name,
            matches: matches.slice(0, 3), // ограничиваем количество примеров
          });
        }
      });
    } catch (error) {
      // пропускаем файлы, которые не удалось прочитать
      continue;
    }
  }

  if (suspiciousFiles.length > 0) {
    const fileDetails = suspiciousFiles
      .map((f) => `${f.file}: ${f.pattern}`)
      .slice(0, 3)
      .join("\n");

    results.push({
      item: "Хардкод секретов в файлах",
      status: "DANGER",
      details: `Обнаружены потенциальные секреты в файлах:\n${fileDetails}${suspiciousFiles.length > 3 ? "\n..." : ""}`,
    });
  }
}

/**
 * проверка .gitignore на исключение файлов с секретами
 */
async function checkGitignoreForSecrets(results, repoTree, projectId, gitlab) {
  const gitignoreFiles = repoTree.filter((file) => file.name === ".gitignore");
  let hasGitignoreForSecrets = false;

  if (gitignoreFiles.length > 0) {
    try {
      const gitignoreContent = await gitlab.getRawFile(projectId, ".gitignore");
      const secretFilePatterns = [
        ".env",
        "*.pem",
        "*.key",
        "*.crt",
        "secrets/",
        "credentials/",
      ];

      hasGitignoreForSecrets = secretFilePatterns.some((pattern) =>
        gitignoreContent.includes(pattern),
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
  });
}

/**
 * проверка CI/CD конфигурации на безопасную работу с секретами
 */
function checkCICDSecretSafety(results, gitlabCIRaw) {
  if (!gitlabCIRaw) return;

  const lines = gitlabCIRaw.split("\n");

  // проверка на эхо секретов в логах
  let hasSecretEcho = false;
  lines.forEach((line, index) => {
    if (line.includes("echo") && line.includes("$")) {
      const varMatch = line.match(/\${[A-Z_][A-Z0-9_]+}/g);
      if (varMatch) {
        const suspiciousVars = varMatch.filter(
          (v) =>
            v.includes("TOKEN") ||
            v.includes("SECRET") ||
            v.includes("PASSWORD") ||
            v.includes("KEY"),
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
      details:
        "Обнаружено echo переменных, которые могут содержать секреты. Это может привести к утечке секретов в логах.",
    });
  }

  // проверка на передачу секретов через command line
  const commandLineSecrets = lines.filter(
    (line) =>
      line.includes("curl") &&
      (line.includes('-H "Authorization:') ||
        line.includes('--header "Authorization:')),
  );

  if (commandLineSecrets.length > 0) {
    results.push({
      item: "Передача секретов через command line",
      status: "WARN",
      details:
        "Обнаружена передача секретов через command line аргументы. Они могут быть видны в процессах системы.",
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
    });
    return;
  }

  const hasSecretManager =
    gitlabCIRaw.includes("vault") ||
    gitlabCIRaw.includes("aws secretmanager") ||
    gitlabCIRaw.includes("azure keyvault") ||
    gitlabCIRaw.includes("gcp secretmanager");

  results.push({
    item: "Использование систем управления секретами",
    status: hasSecretManager ? "OK" : "INFO",
    details: hasSecretManager
      ? "Обнаружено использование системы управления секретами."
      : "Не обнаружено использование систем управления секретами (Vault, AWS Secrets Manager и т.д.).",
  });
}

async function checkSecretDetectionWithDetails(
  projectId,
  gitlabCIRaw,
  pipelines,
  gitlab,
) {
  try {
    const hasSecretDetectionInConfig =
      gitlabCIRaw &&
      (gitlabCIRaw.includes("Security/Secret-Detection.gitlab-ci.yml") ||
        gitlabCIRaw.includes("template: 'Security/Secret-Detection") ||
        gitlabCIRaw.includes("secret_detection:") ||
        gitlabCIRaw.includes("secret-detection:"));

    if (!hasSecretDetectionInConfig) {
      return [];
    }

    if (!pipelines || pipelines.length === 0) {
      return [];
    }

    const sortedPipelines = [...pipelines].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    let lastSecretDetectionJob = null;
    let lastSecretDetectionPipeline = null;
    let secretDetectionReport = null;
    let secretDetectionFindings = null;

    for (const pipeline of sortedPipelines.slice(0, 5)) {
      try {
        const jobs = await gitlab.getPipelineJobs(projectId, pipeline.id);
        const secretDetectionJob = jobs.find(
          (job) =>
            job.name === "secret_detection" ||
            job.name.includes("secret_detection") ||
            job.name.includes("secret-detection") ||
            (job.stage &&
              job.stage.toLowerCase().includes("test") &&
              job.name.toLowerCase().includes("secret")),
        );

        if (
          secretDetectionJob &&
          (secretDetectionJob.status === "success" ||
            secretDetectionJob.status === "failed")
        ) {
          lastSecretDetectionJob = secretDetectionJob;
          lastSecretDetectionPipeline = pipeline;

          try {
            secretDetectionReport = await gitlab.getJobArtifactFile(
              projectId,
              secretDetectionJob.id,
              "gl-secret-detection-report.json",
            );
            secretDetectionFindings = parseSecretDetectionReport(
              secretDetectionReport,
            );
          } catch (artifactError) {
            console.log(
              `Could not fetch Secret Detection artifacts for job ${secretDetectionJob.id}:`,
              artifactError.message,
            );
            const alternativePaths = [
              "gl-secret-detection-report",
              "secret-detection-report.json",
              "gitleaks-report.json",
              "secrets-report.json",
            ];

            for (const path of alternativePaths) {
              try {
                secretDetectionReport = await gitlab.getJobArtifactFile(
                  projectId,
                  secretDetectionJob.id,
                  path,
                );
                secretDetectionFindings = parseSecretDetectionReport(
                  secretDetectionReport,
                );
                if (secretDetectionFindings) break;
              } catch (e) {
                continue;
              }
            }
          }
          break;
        }
      } catch (err) {
        console.error(
          `Error checking Secret Detection job in pipeline ${pipeline.id}:`,
          err.message,
        );
        continue;
      }
    }

    if (!lastSecretDetectionJob) {
      return [{
        item: "Secret Detection",
        status: "INFO",
        details: "Отчёт не найден",
      }];
    }

    if (
      !secretDetectionFindings ||
      !secretDetectionFindings.vulnerabilities ||
      secretDetectionFindings.vulnerabilities.length === 0
    ) {
      return [{
        item: "Secret Detection",
        status: "INFO",
        details: "Отчёт не найден",
      }];
    }

    const vulnerabilities = secretDetectionFindings.vulnerabilities.map(
      (vuln) => {
        const severity = "critical";
        const status = "DANGER";

        const details =
          `${vuln.message || vuln.description || vuln.name}\n` +
          `Тип секрета: ${vuln.category || vuln.name || "Неизвестный тип"}\n` +
          `Файл: ${vuln.location?.file || "Не указан"}\n` +
          `Строка: ${vuln.location?.start_line || "Не указана"}`;

        return {
          item: "Secret Detection",
          status: status,
          details: details,
          severity: severity,
          metadata: {
            id: vuln.id,
            scanner: vuln.scanner?.name || "GitLab Secret Detection",
            location: vuln.location,
            category: vuln.category,
            jobId: lastSecretDetectionJob.id,
            pipelineId: lastSecretDetectionPipeline.id,
            runDate: lastSecretDetectionPipeline.created_at,
          },
        };
      },
    );

    return vulnerabilities;
  } catch (error) {
    console.error(
      `Error in Secret Detection check for project ${projectId}:`,
      error,
    );
    return [];
  }
}

function parseSecretDetectionReport(reportData) {
  try {
    if (!reportData) {
      return null;
    }

    let data;
    if (typeof reportData === "string") {
      try {
        data = JSON.parse(reportData);
      } catch (e) {
        console.error("Secret Detection report is not valid JSON:", e.message);
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
      scanner: data.scan?.scanner?.name || "GitLab Secret Detection",
    };
  } catch (error) {
    console.error("Error parsing Secret Detection report:", error);
    return null;
  }
}
