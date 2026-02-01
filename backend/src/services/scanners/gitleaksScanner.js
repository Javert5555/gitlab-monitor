const { runDockerScanner, getStatusFromSeverity } = require("./utils");
const fs = require("fs").promises;
const path = require("path");

async function runGitleaksScan(projectPath, outputPath) {
  const command = "detect --source /src --format json";
  return runDockerScanner(
    "zricethezav/gitleaks",
    command,
    projectPath,
    outputPath,
  );
}

function parseGitleaksResults(jsonData) {
  try {
    if (!Array.isArray(jsonData)) {
      return [];
    }

    return jsonData.map((leak) => {
      const severity = "critical";
      const status = getStatusFromSeverity(severity);

      return {
        item: "Secret Detection",
        status: status,
        details: `Обнаружен секрет: ${leak.RuleID || leak.rule} в файле ${leak.File || leak.file} (строка ${leak.StartLine || leak.line}).`,
        severity: severity,
        metadata: {
          vulnerability: {
            id: leak.RuleID || leak.rule,
            category: "secret",
            name: leak.RuleID || leak.rule,
            description: `Обнаружен потенциальный секрет типа ${leak.RuleID || leak.rule}.`,
            severity: "Critical",
            location: {
              file: leak.File || leak.file,
              start_line: leak.StartLine || leak.line,
            },
            identifiers: [
              {
                type: "cwe",
                name: "CWE-798",
                value: "798",
                url: "https://cwe.mitre.org/data/definitions/798.html",
              },
            ],
            remediation:
              "Удалите секрет из кода и поверните его в системе управления секретами.",
          },
          scanner: {
            name: "Gitleaks",
            id: "gitleaks",
            version: "8.18.0",
          },
          scan_time: new Date().toISOString(),
          scan_status: "success",
        },
      };
    });
  } catch (error) {
    console.error("Error parsing Gitleaks results:", error);
    return [];
  }
}

async function scanWithGitleaks(projectId, gitlabService) {
  const tempDir = path.join(__dirname, `../../temp/${projectId}`);
  const outputPath = path.join(tempDir, "gitleaks.json");

  try {
    const repoPath = await require("./utils").cloneRepository(
      gitlabService,
      projectId,
      tempDir,
    );

    await runGitleaksScan(repoPath, outputPath);

    const rawData = await fs.readFile(outputPath, "utf8");
    const jsonData = JSON.parse(rawData);
    const results = parseGitleaksResults(jsonData);

    await require("./utils").cleanupTempDir(tempDir);

    return results;
  } catch (error) {
    console.error(
      `Gitleaks scan failed for project ${projectId}:`,
      error.message,
    );

    return [
      {
        item: "Secret Detection (Gitleaks)",
        status: "FAIL",
        details: `Ошибка сканирования: ${error.message}`,
        severity: "info",
        metadata: {
          scanner: {
            name: "Gitleaks",
            id: "gitleaks",
            version: "8.18.0",
          },
          scan_time: new Date().toISOString(),
          scan_status: "failed",
        },
      },
    ];
  }
}

module.exports = {
  runGitleaksScan,
  parseGitleaksResults,
  scanWithGitleaks,
};
