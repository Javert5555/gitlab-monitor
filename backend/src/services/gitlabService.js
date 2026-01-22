const axios = require("axios");
require("dotenv").config();

const baseURL = process.env.GITLAB_URL;
const token = process.env.GITLAB_TOKEN;

const api = axios.create({
  baseURL,
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});

// ============================================================================
//                         ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ============================================================================

async function safeRequest(fn, defaultValue = null) {
  try {
    const res = await fn();
    return res?.data ?? defaultValue;
  } catch (err) {
    console.error(`GitLab API Error:`, err.message);
    return defaultValue;
  }
}

// ============================================================================
//                          ПРОЕКТЫ
// ============================================================================
module.exports = {
  // Получение всех проектов (страницы можно добавлять динамически)
  getAllProjects: async () =>
    safeRequest(() => api.get(`/projects?membership=true&per_page=100`), []),

  getProjectDetails: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}`)),

  // ========================================================================
  //                          ВЕТКИ
  // ========================================================================

  getBranches: async (projectId) =>
    safeRequest(
      () => api.get(`/projects/${projectId}/repository/branches`),
      []
    ),

  getProtectedBranches: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/protected_branches`), []),

  // ========================================================================
  //                          MERGE REQUESTS
  // ========================================================================

  getMergeRequests: async (projectId, state = "all") =>
    safeRequest(
      () =>
        api.get(
          `/projects/${projectId}/merge_requests?state=${state}&per_page=100`
        ),
      []
    ),

  // ========================================================================
  //                  УЧАСТНИКИ ПРОЕКТА
  // ========================================================================

  getProjectMembers: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/members/all`), []),

  // ========================================================================
  //                          PIPELINES & JOBS
  // ========================================================================

  getProjectPipelines: async (projectId) =>
    safeRequest(
      () => api.get(`/projects/${projectId}/pipelines?per_page=50`),
      []
    ),

  getPipelineDetails: async (projectId, pipelineId) =>
    safeRequest(() =>
      api.get(`/projects/${projectId}/pipelines/${pipelineId}`)
    ),

  getPipelineJobs: async (projectId, pipelineId) =>
    safeRequest(
      () =>
        api.get(
          `/projects/${projectId}/pipelines/${pipelineId}/jobs?per_page=100`
        ),
      []
    ),

  getJobDetails: async (projectId, jobId) =>
      safeRequest(() => api.get(`/projects/${projectId}/jobs/${jobId}`)),

  getJobArtifactFile: async (projectId, jobId, artifactPath = "gl-sast-report.json") =>
      safeRequest(() =>
          api.get(`/projects/${projectId}/jobs/${jobId}/artifacts/${artifactPath}`, {
              responseType: "json",
          })
      ),

  // ========================================================================
  //                             JOB ARTEFACTS
  // ========================================================================

  getJobArtifacts: async (projectId, jobId) =>
    safeRequest(() =>
      api.get(`/projects/${projectId}/jobs/${jobId}/artifacts`, {
        responseType: "arraybuffer",
      })
    ),

  // ========================================================================
  //                              VARIABLES
  // ========================================================================

  getProjectVariables: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/variables`), []),

  // ========================================================================
  //                           REPOSITORY TREE & FILES
  // ========================================================================

  getRepositoryTree: async (projectId, params = {}) =>
    safeRequest(
      () => api.get(`/projects/${projectId}/repository/tree`, { params }),
      []
    ),

  getRepositoryFile: async (projectId, filePath, ref = "main") =>
    safeRequest(() =>
      api.get(
        `/projects/${projectId}/repository/files/${encodeURIComponent(
          filePath
        )}`,
        { params: { ref } }
      )
    ),

  getRawFile: async (projectId, filePath, ref = "main") =>
    safeRequest(() =>
      api.get(
        `/projects/${projectId}/repository/files/${encodeURIComponent(
          filePath
        )}/raw`,
        { params: { ref } }
      )
    ),

  // ========================================================================
  //                           RUNNERS
  // ========================================================================

  getProjectRunners: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/runners`), []),

  // ========================================================================
  //                   ENVIRONMENTS & DEPLOYMENTS
  // ========================================================================

  getProjectEnvironments: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/environments`), []),

  getProjectDeployments: async (projectId) =>
    safeRequest(
      () => api.get(`/projects/${projectId}/deployments?per_page=50`),
      []
    ),

  // ========================================================================
  //                        WEBHOOKS
  // ========================================================================

  getProjectHooks: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/hooks`), []),

  // ========================================================================
  //                      USERS
  // ========================================================================

  getAllUsers: async (options = {}) => {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([k, v]) => params.append(k, v));
    return safeRequest(() => api.get(`/users?${params.toString()}`), []);
  },

  getUser: async (userId) => safeRequest(() => api.get(`/users/${userId}`)),


  getDeployKeys: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/deploy_keys`), []),
};
