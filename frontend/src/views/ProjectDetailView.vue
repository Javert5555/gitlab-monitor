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
              <!-- GitLab ID: {{ projectId }} -->
              ID: {{ projectId }}
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
    console.log(projectId)
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
  color: #a0a0c0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  background: #1e1e2e;
  border-radius: 12px;
  border: 1px solid #3a3a4e;
}

.loading .spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #3a3a4e;
  border-top: 4px solid #bb86fc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #3a3a4e;
  background: #1e1e2e;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #3a3a4e;
}

.header-main h1 {
  color: #bb86fc;
  margin-bottom: 0.5rem;
}

.project-url a {
  color: #64b5f6;
  text-decoration: none;
  font-size: 1.1rem;
}

.project-url a:hover {
  text-decoration: underline;
  color: #90caf9;
}

.project-meta {
  margin-top: 0.5rem;
  display: flex;
  gap: 1rem;
}

.meta-item {
  background: #2d2d44;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  color: #a0a0c0;
  border: 1px solid #3a3a4e;
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
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.scan-button {
  background: linear-gradient(135deg, #ff9800 0%, #ef6c00 100%);
}

.scan-button.loading {
  background: linear-gradient(135deg, #424242 0%, #616161 100%);
}

.scan-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #ffa726 0%, #f57c00 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.refresh-button {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
}

.refresh-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.scan-button:disabled,
.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
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

.error-message {
  background: linear-gradient(135deg, #b00020 0%, #cf6679 100%);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  text-align: center;
  border: 1px solid #ff5252;
}
</style>