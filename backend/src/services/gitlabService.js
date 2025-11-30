// const axios = require('axios');

// const createGitLabService = () => {
//   const baseURL = process.env.GITLAB_URL;
//   const token = process.env.GITLAB_TOKEN;

//   const api = axios.create({
//     baseURL,
//     headers: {
//       'Authorization': `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     }
//   });

//   return {
//     // Получение списка проектов
//     getAllProjects: async () => {
//       const response = await api.get('/projects');
//       console.log(response.data)
//       return response.data;
//     },

//     // Получение деталей проекта
//     getProjectDetails: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}`);
//       return response.data;
//     },

//     // Получение пайплайнов проекта
//     getProjectPipelines: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/pipelines`);
//       return response.data;
//     },

//     // Получение джоб пайплайна
//     getPipelineJobs: async (projectId, pipelineId) => {
//       const response = await api.get(`/projects/${projectId}/pipelines/${pipelineId}/jobs`);
//       return response.data;
//     },

//     // Получение переменных проекта
//     getProjectVariables: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/variables`);
//       return response.data;
//     },

//     // Получение merge requests
//     getMergeRequests: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/merge_requests?state=merged`);
//       return response.data;
//     },

//     // Получение членов проекта
//     getProjectMembers: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/members`);
//       return response.data;
//     },

//     // Получение защищенных веток
//     getProtectedBranches: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/protected_branches`);
//       return response.data;
//     },

//     // Получение всех пользователей GitLab
//     getAllUsers: async (options = {}) => {
//       const params = new URLSearchParams();

//       // Добавляем параметры, если они переданы
//       if (options.active) params.append('active', options.active);
//       if (options.blocked) params.append('blocked', options.blocked);
//       if (options.search) params.append('search', options.search);
//       if (options.username) params.append('username', options.username);
//       if (options.per_page) params.append('per_page', options.per_page);
//       if (options.page) params.append('page', options.page);

//       const queryString = params.toString();
//       const url = `/users${queryString ? `?${queryString}` : ''}`;

//       const response = await api.get(url);
//       return response.data;
//     },

//     // Получение информации о конкретном пользователе
//     getUser: async (userId) => {
//       const response = await api.get(`/users/${userId}`);
//       return response.data;
//     },

//     // Получение всех групп
//     getAllGroups: async (options = {}) => {
//       const params = new URLSearchParams();

//       // Добавляем параметры, если они переданы
//       if (options.search) params.append('search', options.search);
//       if (options.top_level_only) params.append('top_level_only', options.top_level_only);
//       if (options.owned) params.append('owned', options.owned);
//       if (options.min_access_level) params.append('min_access_level', options.min_access_level);
//       if (options.per_page) params.append('per_page', options.per_page);
//       if (options.page) params.append('page', options.page);

//       const queryString = params.toString();
//       const url = `/groups${queryString ? `?${queryString}` : ''}`;

//       const response = await api.get(url);
//       return response.data;
//     },

//     // Получение информации о конкретной группе
//     getGroup: async (groupId) => {
//       const response = await api.get(`/groups/${groupId}`);
//       return response.data;
//     },

//     // Получение участников группы
//     getGroupMembers: async (groupId, options = {}) => {
//       const params = new URLSearchParams();

//       if (options.query) params.append('query', options.query);
//       if (options.per_page) params.append('per_page', options.per_page);
//       if (options.page) params.append('page', options.page);

//       const queryString = params.toString();
//       const url = `/groups/${groupId}/members${queryString ? `?${queryString}` : ''}`;

//       const response = await api.get(url);
//       return response.data;
//     },

//     // Получение всех участников группы (включая наследованных)
//     getAllGroupMembers: async (groupId, options = {}) => {
//       const params = new URLSearchParams();

//       if (options.query) params.append('query', options.query);
//       if (options.per_page) params.append('per_page', options.per_page);
//       if (options.page) params.append('page', options.page);

//       const queryString = params.toString();
//       const url = `/groups/${groupId}/members/all${queryString ? `?${queryString}` : ''}`;

//       const response = await api.get(url);
//       return response.data;
//     },

//     // Получение подгрупп группы
//     getGroupSubgroups: async (groupId, options = {}) => {
//       const params = new URLSearchParams();

//       if (options.skip_groups) params.append('skip_groups', options.skip_groups.join(','));
//       if (options.all_available) params.append('all_available', options.all_available);
//       if (options.search) params.append('search', options.search);
//       if (options.order_by) params.append('order_by', options.order_by);
//       if (options.sort) params.append('sort', options.sort);
//       if (options.owned) params.append('owned', options.owned);
//       if (options.min_access_level) params.append('min_access_level', options.min_access_level);
//       if (options.per_page) params.append('per_page', options.per_page);
//       if (options.page) params.append('page', options.page);

//       const queryString = params.toString();
//       const url = `/groups/${groupId}/subgroups${queryString ? `?${queryString}` : ''}`;

//       const response = await api.get(url);
//       return response.data;
//     },

//     // Получение проектов группы
//     getGroupProjects: async (groupId, options = {}) => {
//       const params = new URLSearchParams();

//       if (options.visibility) params.append('visibility', options.visibility);
//       if (options.search) params.append('search', options.search);
//       if (options.order_by) params.append('order_by', options.order_by);
//       if (options.sort) params.append('sort', options.sort);
//       if (options.archived) params.append('archived', options.archived);
//       if (options.per_page) params.append('per_page', options.per_page);
//       if (options.page) params.append('page', options.page);

//       const queryString = params.toString();
//       const url = `/groups/${groupId}/projects${queryString ? `?${queryString}` : ''}`;

//       const response = await api.get(url);
//       return response.data;
//     },

//     // Получение дерева репозитория
//     getRepositoryTree: async (projectId, params = {}) => {
//       const response = await api.get(`/projects/${projectId}/repository/tree`, { params });
//       return response.data;
//     },

//     // Получение файла
//     getRepositoryFile: async (projectId, filePath, ref) => {
//       const response = await api.get(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
//         params: { ref }
//       });
//       return response.data;
//     },

//     // Получение Runner'ов проекта
//     getProjectRunners: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/runners`);
//       return response.data;
//     },

//     // Интеграции (webhooks, сторонние сервисы)
//     getProjectHooks: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/hooks`);
//       return response.data;
//     },

//     // Окружения (dev, stage, prod)
//     getProjectEnvironments: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/environments`);
//       return response.data;
//     },

//     // История деплоев
//     getProjectDeployments: async (projectId) => {
//       const response = await api.get(`/projects/${projectId}/deployments`);
//       return response.data;
//     },

//     // Артефакты job'а
//     getJobArtifacts: async (projectId, jobId) => {
//       const response = await api.get(
//         `/projects/${projectId}/jobs/${jobId}/artifacts`,
//         { responseType: "arraybuffer" }
//       );
//       return response.data;
//     },

//   };
// };

// module.exports = createGitLabService();

// src/services/gitlabService.js
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
//  ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
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
  //                          УЧАСТНИКИ ПРОЕКТА
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
  //                        WEBHOOKS (3rd party services)
  // ========================================================================

  getProjectHooks: async (projectId) =>
    safeRequest(() => api.get(`/projects/${projectId}/hooks`), []),

  // ========================================================================
  //                      USERS (для IAM проверок)
  // ========================================================================

  getAllUsers: async (options = {}) => {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([k, v]) => params.append(k, v));
    return safeRequest(() => api.get(`/users?${params.toString()}`), []);
  },

  getUser: async (userId) => safeRequest(() => api.get(`/users/${userId}`)),

  // =============================
  // NEW: fetch .gitlab-ci.yml raw
  // =============================
  getGitlabCIFile: async (projectId, ref = "main") => {
    console.log('projectId', projectId)
    return safeRequest(
      () =>
        api.get(`/projects/${projectId}/repository/files/.gitlab-ci.yml/raw`, {
          params: { ref },
        }),
      null
    );
  },
};
