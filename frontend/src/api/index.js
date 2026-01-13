import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1000000
})

export const projectAPI = {
  // Получить список всех проектов
  getProjects: () => api.get('/projects'),
  
  // Получить детальную информацию о проекте
  getProjectDetails: (projectId) => api.get(`/projects/${projectId}`),
  
  // Запустить полное сканирование
  triggerFullScan: () => api.post('/scan/full'),
  
  // Запустить сканирование конкретного проекта
  scanProject: (projectId) => api.post(`/scan/${projectId}`)
}

export default api