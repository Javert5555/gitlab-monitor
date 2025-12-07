<template>
  <div class="project-detail-view">
    <div v-if="store.loading && !store.currentProject" class="loading">
      <div class="spinner"></div>
      Загрузка данных проекта...
    </div>

    <div v-else-if="store.currentProject">
      <div class="project-header">
        <div class="header-main">
          <h1>{{ store.currentProject.project.name }}</h1>
          <p class="project-url">
            <a :href="store.currentProject.project.url" target="_blank">
              {{ store.currentProject.project.url }}
            </a>
          </p>
          <div class="project-meta">
            <span class="meta-item">
              GitLab ID: {{ store.currentProject.project.gitlabProjectId }}
            </span>
            <span class="meta-item">
              Сканирований: {{ store.currentProject.scans?.length || 0 }}
            </span>
          </div>
        </div>
        <div class="header-actions">
          <button 
            @click="scanProject" 
            :disabled="store.loading"
            class="scan-button"
            :class="{ 'loading': store.loading }"
          >
            <span v-if="store.loading" class="button-loading">
              <span class="spinner"></span>
              Сканирование...
            </span>
            <span v-else>
              Сканировать проект
            </span>
          </button>
          <!-- <button 
            @click="refreshProject" 
            :disabled="store.loading"
            class="refresh-button"
          >
            Обновить
          </button> -->
        </div>
      </div>

      <div v-if="store.error" class="error-message">
        {{ store.error }}
      </div>

      <ProjectDetail 
        :project="store.currentProject"
        @refresh="fetchProjectDetails"
      />
    </div>

    <div v-else-if="store.error" class="error-message">
      {{ store.error }}
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/project'
import ProjectDetail from '../components/ProjectDetail.vue'

const route = useRoute()
const store = useProjectStore()

const projectId = route.params.projectId

const fetchProjectDetails = () => {
  store.fetchProjectDetails(projectId)
}

const scanProject = async () => {
  try {
    await store.scanSingleProject(projectId)
  } catch (error) {
    // Ошибка уже обработана в store
  }
}

// const refreshProject = async () => {
//   await fetchProjectDetails()
// }

onMounted(() => {
  fetchProjectDetails()
})

watch(() => route.params.projectId, (newProjectId) => {
  if (newProjectId) {
    fetchProjectDetails()
  }
})
</script>

<style scoped>
.project-detail-view {
  max-width: 1200px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: 3rem;
  font-size: 1.2rem;
  color: #7f8c8d;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.loading .spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #ecf0f1;
}

.header-main h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.project-url a {
  color: #3498db;
  text-decoration: none;
  font-size: 1.1rem;
}

.project-url a:hover {
  text-decoration: underline;
}

.project-meta {
  margin-top: 0.5rem;
  display: flex;
  gap: 1rem;
}

.meta-item {
  background: #ecf0f1;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  color: #7f8c8d;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-direction: column;
  min-width: 200px;
}

.scan-button, .refresh-button {
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.scan-button {
  background: #e67e22;
}

.scan-button.loading {
  background: #95a5a6;
}

.scan-button:hover:not(:disabled) {
  background: #d35400;
}

.refresh-button {
  background: #3498db;
}

.refresh-button:hover:not(:disabled) {
  background: #2980b9;
}

.scan-button:disabled,
.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.button-loading .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background: #e74c3c;
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  text-align: center;
}
</style>