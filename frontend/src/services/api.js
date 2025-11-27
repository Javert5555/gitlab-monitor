import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Интерцептор для обработки ошибок
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const projectAPI = {
  getProjects: () => api.get('/projects'),
  getProjectDetails: (id) => api.get(`/projects/${id}`)
}

export const scanAPI = {
  triggerFullScan: () => api.post('/scan/full'),
  scanProject: (projectId) => api.post(`/scan/${projectId}`)
}

export default api