import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1000000
})

export const projectAPI = {
  // получить список всех проектов
  getProjects: () => api.get('/projects'),
  
  // получить детальную информацию о проекте
  getProjectDetails: (projectId) => api.get(`/projects/${projectId}`),
  
  // запустить полное сканирование
  triggerFullScan: () => api.post('/scan/full'),
  
  // запустить сканирование конкретного проекта
  scanProject: (projectId) => api.post(`/scan/${projectId}`)
}

export const scheduleAPI = {
    getSchedule: () => api.get('/schedule'),
    updateSchedule: (schedule) => api.post('/schedule', { schedule }),
    getAvailableSchedules: () => api.get('/schedule/available')
}

export default api