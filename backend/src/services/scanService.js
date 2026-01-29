const checks = require("./securityChecks");
const gitlab = require("./gitlabService");

const checkList = [
  checks.checkSEC1,
  checks.checkSEC2,
  checks.checkSEC3,
  checks.checkSEC4,
  checks.checkSEC5,
  checks.checkSEC6,
  checks.checkSEC7,
  checks.checkSEC8,
  checks.checkSEC9,
  checks.checkSEC10,
];

async function fetchAllProjectData(projectId) {
  console.log(`Fetching all data for project ${projectId}...`);

  try {
    const [
      protectedBranches,
      branches,
      mergeRequests,
      pipelines,
      gitlabCIRaw,
      projectDetails,
      projectVariables,
      projectMembers,
      deployKeys,
      repoTree,
      projectEnvironments,
      projectDeployments,
      pipelineJobs,
      projectRunners,
      projectHooks,
      allUsers,
    ] = await Promise.all([
      gitlab.getProtectedBranches(projectId),
      gitlab.getBranches(projectId),
      gitlab.getMergeRequests(projectId, "merged"),
      gitlab.getProjectPipelines(projectId),
      gitlab.getRawFile(projectId, ".gitlab-ci.yml").catch(() => null), // Может быть null если файла нет
      gitlab.getProjectDetails(projectId),
      gitlab.getProjectVariables(projectId),
      gitlab.getProjectMembers(projectId),
      gitlab.getDeployKeys
        ? gitlab.getDeployKeys(projectId).catch(() => [])
        : Promise.resolve([]),
      gitlab.getRepositoryTree(projectId, { recursive: true }),
      gitlab.getProjectEnvironments(projectId),
      gitlab.getProjectDeployments(projectId),
      gitlab.getPipelineJobs(projectId),
      gitlab.getProjectRunners(projectId),
      gitlab.getProjectHooks(projectId),
      gitlab.getAllUsers
        ? gitlab.getAllUsers().catch(() => [])
        : Promise.resolve([]),
    ]);

    return {
      projectId,
      protectedBranches,
      branches,
      mergeRequests,
      pipelines,
      gitlabCIRaw,
      projectDetails,
      projectVariables,
      projectMembers,
      deployKeys,
      repoTree,
      projectEnvironments,
      projectDeployments,
      projectRunners,
      projectHooks,
      allUsers,
    };
  } catch (error) {
    console.error(`Error fetching data for project ${projectId}:`, error);
    return {
      projectId,
      protectedBranches: [],
      branches: [],
      mergeRequests: [],
      pipelines: [],
      gitlabCIRaw: null,
      projectDetails: {},
      projectVariables: [],
      projectMembers: [],
      deployKeys: [],
      repoTree: [],
      projectEnvironments: [],
      projectDeployments: [],
      projectRunners: [],
      projectHooks: [],
      allUsers: [],
    };
  }
}

async function scanProject(project) {
  const projectId = project.gitlabProjectId;

  const projectData = await fetchAllProjectData(projectId);

  const results = [];

  for (const checkFn of checkList) {
    try {
      const r = await checkFn(projectId, projectData, gitlab);
      results.push(r);
    } catch (err) {
      console.error(
        `Check ${checkFn.name} failed for project ${projectId}:`,
        err.message || err,
      );
      results.push({
        id: checkFn.name || "unknown",
        name: checkFn.name || "unknown",
        results: [
          {
            item: "internal",
            status: "FAIL",
            details: "Check execution failed",
          },
        ],
      });
    }
  }

  try {
    console.log(`Starting external scanners for project ${projectId}...`);

    const scannerResults = await runAllScanners(projectId, gitlabService);

    scannerResults.forEach((result) => {
      results.push({
        id: `SCANNER-${result.item.split(" ")[0]}`,
        name: result.item,
        results: [result],
      });
    });

    if (projectData.gitlabCIRaw && projectData.gitlabCIRaw.includes("image:")) {
      const imageMatch = projectData.gitlabCIRaw.match(
        /image:\s*["']?([^"'\s]+)["']?/,
      );
      if (imageMatch && imageMatch[1]) {
        const dockerResults = await runDockerScanner(imageMatch[1]);
        dockerResults.forEach((result) => {
          results.push({
            id: "SCANNER-DOCKER",
            name: result.item,
            results: [result],
          });
        });
      }
    }

    console.log(`External scanners completed for project ${projectId}`);
  } catch (error) {
    console.error(`External scanners failed for project ${projectId}:`, error);
  }

  const summary = buildSummary(results);

  return {
    projectId,
    results,
    summary,
    scannedAt: new Date(),
  };
}

function buildSummary(results) {
  const summary = { totalRisks: 0, critical: 0, high: 0, medium: 0, low: 0 };

  for (const sec of results) {
    for (const r of sec.results || []) {
      if (r.status === "FAIL" || r.status === "WARN" || r.status === "DANGER") {
        summary.totalRisks++;

        if (r.severity && typeof r.severity === "string") {
          const s = r.severity.toLowerCase();
          if (s === "critical") summary.critical++;
          if (s === "high") summary.high++;
          if (s === "medium") summary.medium++;
          if (s === "low") summary.low++;
        }
      }
    }
  }

  return summary;
}

module.exports = {
  scanProject,
  buildSummary,
  fetchAllProjectData,
};
