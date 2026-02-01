const { runDockerScanner, getStatusFromSeverity } = require("./utils");
const fs = require("fs").promises;
const path = require("path");

async function runCheckovScan(projectPath, outputPath) {
  const command = "-d /src --output json";
  return runDockerScanner(
    "bridgecrew/checkov",
    command,
    projectPath,
    outputPath,
  );
}

function parseCheckovResults(jsonData) {
  try {
    if (!jsonData || !jsonData.results || !jsonData.results.failed_checks) {
      return [];
    }

    return jsonData.results.failed_checks.map((check) => {
      const severity = check.severity?.toLowerCase() || "unknown";
      const status = getStatusFromSeverity(severity);

      return {
        item: "IaC Scanning",
        status: status,
        details: `Обнаружена уязвимость: ${check.check_name} в файле ${check.file_path} (строка ${check.file_line_range?.[0] || "N/A"}).`,
        severity: severity,
        metadata: {
          vulnerability: {
            id: check.check_id,
            category: "iac",
            name: check.check_name,
            description: check.description || check.check_name,
            severity: check.severity || "unknown",
            cve: check.check_id,
            location: {
              file: check.file_path,
              start_line: check.file_line_range?.[0] || null,
            },
            identifiers: [
              {
                type: "cwe",
                name: `CWE-${check.cwe || "unknown"}`,
                value: check.cwe || "unknown",
                url: `https://cwe.mitre.org/data/definitions/${check.cwe || "unknown"}.html`,
              },
            ],
            remediation: check.guideline || "Исправьте конфигурацию IaC.",
          },
          scanner: {
            name: "Checkov",
            id: "checkov",
            version: "2.4.0",
          },
          scan_time: jsonData.summary?.date || new Date().toISOString(),
          scan_status: "success",
        },
      };
    });
  } catch (error) {
    console.error("Error parsing Checkov results:", error);
    return [];
  }
}

async function scanWithCheckov(projectId, gitlabService) {
  const tempDir = path.join(__dirname, `../../temp/${projectId}`);
  const outputPath = path.join(tempDir, "checkov.json");

  try {
    const repoPath = await require("./utils").cloneRepository(
      gitlabService,
      projectId,
      tempDir,
    );

    await runCheckovScan(repoPath, outputPath);

    const rawData = await fs.readFile(outputPath, "utf8");
    const jsonData = JSON.parse(rawData);
    const results = parseCheckovResults(jsonData);

    await require("./utils").cleanupTempDir(tempDir);

    return results;
  } catch (error) {
    console.error(
      `Checkov scan failed for project ${projectId}:`,
      error.message,
    );

    return [
      {
        item: "IaC (Checkov)",
        status: "FAIL",
        details: `Ошибка сканирования: ${error.message}`,
        severity: "info",
        metadata: {
          scanner: {
            name: "Checkov",
            id: "checkov",
            version: "2.4.0",
          },
          scan_time: new Date().toISOString(),
          scan_status: "failed",
        },
      },
    ];
  }
}

module.exports = {
  runCheckovScan,
  parseCheckovResults,
  scanWithCheckov,
};
