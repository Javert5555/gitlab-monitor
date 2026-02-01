const semgrepScanner = require("./semgrepScanner");
const checkovScanner = require("./checkovScanner");
const gitleaksScanner = require("./gitleaksScanner");
const trivyScanner = require("./trivyScanner");
const trivyDockerScanner = require("./trivyDockerScanner");

async function runAllScanners(projectId, gitlabService) {
  console.log(`Running all scanners for project ${projectId}...`);

  const scanners = [
    { name: "SAST", scanner: semgrepScanner.scanWithSemgrep },
    { name: "IaC", scanner: checkovScanner.scanWithCheckov },
    {
      name: "Secret Detection",
      scanner: gitleaksScanner.scanWithGitleaks,
    },
    { name: "SCA", scanner: trivyScanner.scanWithTrivy },
  ];

  const allResults = [];

  const scannerPromises = scanners.map(async ({ name, scanner }) => {
    try {
      console.log(`Starting ${name}...`);
      const results = await scanner(projectId, gitlabService);
      console.log(`${name} completed with ${results.length} findings`);
      return results;
    } catch (error) {
      console.error(`${name} failed:`, error.message);
      return [];
    }
  });

  const resultsArrays = await Promise.all(scannerPromises);

  resultsArrays.forEach((results) => {
    allResults.push(...results);
  });

  console.log(`Total findings from all scanners: ${allResults.length}`);

  return allResults;
}

async function runDockerScanner(imageName) {
  console.log(`Running Docker scanner for image ${imageName}...`);

  try {
    const results = await trivyDockerScanner.scanDockerImage(imageName);
    console.log(`Docker scanner completed with ${results.length} findings`);
    return results;
  } catch (error) {
    console.error(`Docker scanner failed:`, error.message);
    return [];
  }
}

async function checkDockerImages() {
  const { exec } = require("child_process");

  const images = [
    { name: "semgrep", image: "semgrep/semgrep" },
    { name: "checkov", image: "bridgecrew/checkov" },
    { name: "gitleaks", image: "zricethezav/gitleaks" },
    { name: "trivy", image: "aquasec/trivy" },
  ];

  console.log("Checking Docker images...");

  for (const { name, image } of images) {
    try {
      await new Promise((resolve, reject) => {
        exec(`docker image inspect ${image}`, (error) => {
          if (error) {
            console.log(
              `Image ${image} not found. Pull with: docker pull ${image}`,
            );
          } else {
            console.log(`Image ${image} found`);
          }
          resolve();
        });
      });
    } catch (error) {
      console.error(`Error checking ${name} image:`, error.message);
    }
  }
}

module.exports = {
  runAllScanners,
  runDockerScanner,
  checkDockerImages,
};
