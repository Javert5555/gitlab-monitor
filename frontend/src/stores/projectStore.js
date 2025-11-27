import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectAPI, scanAPI } from '../services/api'

export const useProjectStore = defineStore('projects', () => {
  const projects = ref([])
  const currentProject = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Геттер для проектов с высоким риском
  const highRiskProjects = computed(() => 
    projects.value.filter(p => p.latestRiskCount > 0)
  )

  // Геттер для общего количества рисков
  const totalRisks = computed(() =>
    projects.value.reduce((sum, p) => sum + p.latestRiskCount, 0)
  )

  // Действия
  const fetchProjects = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await projectAPI.getProjects()
      projects.value = response.data
    } catch (err) {
      error.value = 'Ошибка загрузки проектов'
      console.error(err)
    } finally {
      loading.value = false
    }
  }

  const fetchProjectDetails = async (id) => {
    loading.value = true
    error.value = null
    try {
      const response = await projectAPI.getProjectDetails(id)
      currentProject.value = response.data
    } catch (err) {
      error.value = 'Ошибка загрузки деталей проекта'
      console.error(err)
    } finally {
      loading.value = false
    }
  }

  const triggerFullScan = async () => {
    loading.value = true
    try {
      await scanAPI.triggerFullScan()
      // После сканирования обновляем список проектов
      await fetchProjects()
    } catch (err) {
      error.value = 'Ошибка запуска сканирования'
      console.error(err)
    } finally {
      loading.value = false
    }
  }

  const scanSingleProject = async (projectId) => {
    try {
      await scanAPI.scanProject(projectId)
      // Обновляем данные проекта
      await fetchProjects()
      if (currentProject.value?.project?.id === projectId) {
        await fetchProjectDetails(projectId)
      }
    } catch (err) {
      error.value = 'Ошибка сканирования проекта'
      console.error(err)
    }
  }

  return {
    // State
    projects,
    currentProject,
    loading,
    error,
    
    // Getters
    highRiskProjects,
    totalRisks,
    
    // Actions
    fetchProjects,
    fetchProjectDetails,
    triggerFullScan,
    scanSingleProject
  }
})