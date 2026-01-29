const { runDockerScanner, getStatusFromSeverity } = require("./utils");
const fs = require("fs").promises;
const path = require("path");

async function runSemgrepScan(projectPath, outputPath) {
  const command = "scan --config auto --json /src";
  return runDockerScanner("semgrep/semgrep", command, projectPath, outputPath);
}

function parseSemgrepResults(jsonData) {
  try {
    if (!jsonData || !jsonData.results) {
      return [];
    }

    return jsonData.results.map((finding) => {
      const severity = finding.extra.severity?.toLowerCase() || "unknown";
      const status = getStatusFromSeverity(severity);

      return {
        item: "SAST (Static Application Security Testing)",
        status: status,
        details: `Обнаружена уязвимость: ${finding.extra.message} в файле ${finding.path} (строка ${finding.start.line}).`,
        severity: severity,
        metadata: {
          vulnerability: {
            id: finding.check_id,
            category: "sast",
            name: finding.extra.message,
            description:
              finding.extra.metadata?.description || finding.extra.message,
            severity: finding.extra.severity || "unknown",
            cve: finding.extra.metadata?.cve || finding.check_id,
            location: {
              file: finding.path,
              start_line: finding.start.line,
            },
            identifiers: [
              {
                type: "cwe",
                name: `CWE-${finding.extra.metadata?.cwe || "unknown"}`,
                value: finding.extra.metadata?.cwe || "unknown",
                url: `https://cwe.mitre.org/data/definitions/${finding.extra.metadata?.cwe || "unknown"}.html`,
              },
            ],
            remediation:
              finding.extra.metadata?.remediation ||
              "Проверьте код и устраните уязвимость.",
          },
          scanner: {
            name: "Semgrep",
            id: "semgrep",
            version: "1.145.0",
          },
          scan_time: new Date().toISOString(),
          scan_status: "success",
        },
      };
    });
  } catch (error) {
    console.error("Error parsing Semgrep results:", error);
    return [];
  }
}

async function scanWithSemgrep(projectId, gitlabService) {
  const tempDir = path.join(__dirname, `../../temp/${projectId}`);
  const outputPath = path.join(tempDir, "semgrep.json");

  try {
    const repoPath = await require("./utils").cloneRepository(
      gitlabService,
      projectId,
      tempDir,
    );

    await runSemgrepScan(repoPath, outputPath);

    const rawData = await fs.readFile(outputPath, "utf8");
    const jsonData = JSON.parse(rawData);
    const results = parseSemgrepResults(jsonData);

    await require("./utils").cleanupTempDir(tempDir);

    return results;
  } catch (error) {
    console.error(
      `Semgrep scan failed for project ${projectId}:`,
      error.message,
    );

    return [
      {
        item: "SAST (Semgrep)",
        status: "FAIL",
        details: `Ошибка сканирования: ${error.message}`,
        severity: "info",
        metadata: {
          scanner: {
            name: "Semgrep",
            id: "semgrep",
            version: "1.145.0",
          },
          scan_time: new Date().toISOString(),
          scan_status: "failed",
        },
      },
    ];
  }
}

module.exports = {
  runSemgrepScan,
  parseSemgrepResults,
  scanWithSemgrep,
};
