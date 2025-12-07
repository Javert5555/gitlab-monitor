import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectAPI } from '../api'
import { useAppToast } from '../utils/toast'

export const useProjectStore = defineStore('project', () => {
  const projects = ref([])
  const currentProject = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const toast = useAppToast()

  // Геттер для проектов с сортировкой по количеству рисков
  const sortedProjects = computed(() => {
    return [...projects.value].sort((a, b) => b.latestRiskCount - a.latestRiskCount)
  })

  // Геттер для общего количества рисков
  const totalRisks = computed(() => {
    return projects.value.reduce((sum, project) => sum + project.latestRiskCount, 0)
  })

  // Геттер для проектов с высоким риском
  const highRiskProjects = computed(() => {
    return projects.value.filter(project => project.latestRiskCount > 0)
  })

  // Действия
  const fetchProjects = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await projectAPI.getProjects()
      projects.value = response.data
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message
      error.value = 'Ошибка при загрузке проектов: ' + errorMsg
      toast.error('Не удалось загрузить список проектов')
      console.error('Error fetching projects:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchProjectDetails = async (projectId) => {
    loading.value = true
    error.value = null
    try {
      const response = await projectAPI.getProjectDetails(projectId)
      currentProject.value = response.data
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message
      error.value = 'Ошибка при загрузке деталей проекта: ' + errorMsg
      toast.error('Не удалось загрузить детали проекта')
      console.error('Error fetching project details:', err)
    } finally {
      loading.value = false
    }
  }

  const triggerFullScan = async () => {
    loading.value = true
    error.value = null
    try {
      toast.scanStarted()
      const response = await projectAPI.triggerFullScan()
      
      // После сканирования обновляем список проектов
      await fetchProjects()
      
      // Показываем успешное уведомление
      toast.scanSuccess(null, totalRisks.value)
      
      return response.data
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message
      error.value = 'Ошибка при запуске сканирования: ' + errorMsg
      toast.scanError(null, errorMsg)
      console.error('Error triggering full scan:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const scanSingleProject = async (projectId) => {
    loading.value = true
    error.value = null
    try {
      const project = projects.value.find(p => p.id == projectId) || currentProject.value?.project
      const projectName = project?.name || `ID: ${projectId}`
      
      toast.scanStarted(projectName)
      
      const response = await projectAPI.scanProject(projectId)
      
      // Обновляем данные проекта после сканирования
      await fetchProjectDetails(projectId)
      await fetchProjects()
      
      // Получаем актуальное количество рисков
      const updatedProject = projects.value.find(p => p.id == projectId)
      const riskCount = updatedProject?.latestRiskCount || 0
      
      // Показываем успешное уведомление
      toast.scanSuccess(projectName, riskCount)
      
      return response.data
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message
      const project = projects.value.find(p => p.id == projectId) || currentProject.value?.project
      const projectName = project?.name || `ID: ${projectId}`
      
      error.value = 'Ошибка при сканировании проекта: ' + errorMsg
      toast.scanError(projectName, errorMsg)
      console.error('Error scanning project:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Новый метод для быстрого обновления с уведомлением
  const refreshProjectsWithToast = async () => {
    try {
      await fetchProjects()
      toast.success('Список проектов обновлен')
    } catch (err) {
      // Ошибка уже обработана в fetchProjects
    }
  }

  return {
    // State
    projects,
    currentProject,
    loading,
    error,
    
    // Getters
    sortedProjects,
    totalRisks,
    highRiskProjects,
    
    // Actions
    fetchProjects,
    fetchProjectDetails,
    triggerFullScan,
    scanSingleProject,
    refreshProjectsWithToast
  }
})