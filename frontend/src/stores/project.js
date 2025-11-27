import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectAPI } from '../api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref([])
  const currentProject = ref(null)
  const loading = ref(false)
  const error = ref(null)

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
      error.value = 'Ошибка при загрузке проектов: ' + (err.response?.data?.error || err.message)
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
      error.value = 'Ошибка при загрузке деталей проекта: ' + (err.response?.data?.error || err.message)
      console.error('Error fetching project details:', err)
    } finally {
      loading.value = false
    }
  }

  const triggerFullScan = async () => {
    loading.value = true
    error.value = null
    try {
      await projectAPI.triggerFullScan()
      // После сканирования обновляем список проектов
      await fetchProjects()
    } catch (err) {
      error.value = 'Ошибка при запуске сканирования: ' + (err.response?.data?.error || err.message)
      console.error('Error triggering full scan:', err)
    } finally {
      loading.value = false
    }
  }

  const scanSingleProject = async (projectId) => {
    loading.value = true
    error.value = null
    try {
      await projectAPI.scanProject(projectId)
      // Обновляем данные проекта после сканирования
      await fetchProjectDetails(projectId)
      await fetchProjects()
    } catch (err) {
      error.value = 'Ошибка при сканировании проекта: ' + (err.response?.data?.error || err.message)
      console.error('Error scanning project:', err)
    } finally {
      loading.value = false
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
    scanSingleProject
  }
})