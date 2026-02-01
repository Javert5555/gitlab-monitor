const { runDockerScanner, getStatusFromSeverity } = require("./utils");
const fs = require("fs").promises;
const path = require("path");

async function runTrivyScan(projectPath, outputPath) {
  const command = "fs --format json /src";
  return runDockerScanner("aquasec/trivy", command, projectPath, outputPath);
}

function parseTrivyResults(jsonData) {
  try {
    if (!jsonData || !jsonData.Results) {
      return [];
    }

    const vulnerabilities = [];

    jsonData.Results.forEach((result) => {
      result.Vulnerabilities?.forEach((vuln) => {
        const severity = vuln.Severity?.toLowerCase() || "unknown";
        const status = getStatusFromSeverity(severity);

        vulnerabilities.push({
          item: "SCA (Dependency Scanning)",
          status: status,
          details: `Обнаружена уязвимость: ${vuln.VulnerabilityID} в пакете ${vuln.PkgName} версии ${vuln.InstalledVersion}.`,
          severity: severity,
          metadata: {
            vulnerability: {
              id: vuln.VulnerabilityID,
              category: "sca",
              name: vuln.Title || vuln.VulnerabilityID,
              description: vuln.Description || "Уязвимость в зависимостях",
              severity: vuln.Severity || "unknown",
              cve: vuln.VulnerabilityID,
              location: {
                file: result.Target,
                start_line: null,
              },
              identifiers: [
                {
                  type: "cve",
                  name: vuln.VulnerabilityID,
                  value: vuln.VulnerabilityID,
                  url: `https://nvd.nist.gov/vuln/detail/${vuln.VulnerabilityID}`,
                },
                {
                  type: "cwe",
                  name: `CWE-${vuln.CweIDs?.[0] || "unknown"}`,
                  value: vuln.CweIDs?.[0] || "unknown",
                  url: `https://cwe.mitre.org/data/definitions/${vuln.CweIDs?.[0] || "unknown"}.html`,
                },
              ],
              remediation: vuln.FixedVersion
                ? `Обновите пакет до версии ${vuln.FixedVersion}`
                : "Обновите пакет до последней версии.",
            },
            scanner: {
              name: "Trivy",
              id: "trivy",
              version: "0.50.0",
            },
            scan_time: new Date().toISOString(),
            scan_status: "success",
          },
        });
      });
    });

    return vulnerabilities;
  } catch (error) {
    console.error("Error parsing Trivy results:", error);
    return [];
  }
}

async function scanWithTrivy(projectId, gitlabService) {
  const tempDir = path.join(__dirname, `../../temp/${projectId}`);
  const outputPath = path.join(tempDir, "trivy.json");

  try {
    const repoPath = await require("./utils").cloneRepository(
      gitlabService,
      projectId,
      tempDir,
    );

    await runTrivyScan(repoPath, outputPath);

    const rawData = await fs.readFile(outputPath, "utf8");
    const jsonData = JSON.parse(rawData);
    const results = parseTrivyResults(jsonData);

    await require("./utils").cleanupTempDir(tempDir);

    return results;
  } catch (error) {
    console.error(`Trivy scan failed for project ${projectId}:`, error.message);

    return [
      {
        item: "SCA (Trivy)",
        status: "FAIL",
        details: `Ошибка сканирования: ${error.message}`,
        severity: "info",
        metadata: {
          scanner: {
            name: "Trivy",
            id: "trivy",
            version: "0.50.0",
          },
          scan_time: new Date().toISOString(),
          scan_status: "failed",
        },
      },
    ];
  }
}

module.exports = {
  runTrivyScan,
  parseTrivyResults,
  scanWithTrivy,
};
