const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");

function getStatusFromSeverity(severity) {
  if (!severity) return "INFO";

  const severityLower = severity.toLowerCase();
  if (severityLower === "critical") return "DANGER";
  if (["high", "medium", "low"].includes(severityLower)) return "WARN";
  if (severityLower === "info") return "LOW";
  return "INFO";
}

async function runDockerScanner(image, command, projectPath, outputPath) {
  return new Promise((resolve, reject) => {
    const absPath = path.resolve(projectPath);
    const dockerCommand = `docker run --rm -v "${absPath}":/src ${image} ${command}`;

    console.log(`Running: ${dockerCommand}`);

    exec(
      dockerCommand,
      { maxBuffer: 1024 * 1024 * 10 },
      (error, stdout, stderr) => {
        if (error && !stdout) {
          return reject(`Docker scanner failed: ${stderr || error.message}`);
        }

        if (stdout) {
          fs.writeFile(outputPath, stdout, "utf8")
            .then(() => resolve(outputPath))
            .catch(reject);
        } else {
          resolve(outputPath);
        }
      },
    );
  });
}

async function cloneRepository(gitlabService, projectId, targetPath) {
  try {
    await fs.mkdir(targetPath, { recursive: true });

    const projectDetails = await gitlabService.getProjectDetails(projectId);
    const repoUrl = projectDetails.http_url_to_repo;

    return new Promise((resolve, reject) => {
      const cloneCommand = `git clone --depth 1 ${repoUrl} ${targetPath}/repo`;

      exec(cloneCommand, (error, stdout, stderr) => {
        if (error) {
          return reject(
            `Failed to clone repository: ${stderr || error.message}`,
          );
        }
        resolve(`${targetPath}/repo`);
      });
    });
  } catch (error) {
    throw new Error(`Failed to prepare repository: ${error.message}`);
  }
}

async function cleanupTempDir(tempPath) {
  try {
    await fs.rm(tempPath, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      `Failed to cleanup temp directory ${tempPath}:`,
      error.message,
    );
  }
}

module.exports = {
  getStatusFromSeverity,
  runDockerScanner,
  cloneRepository,
  cleanupTempDir,
};
