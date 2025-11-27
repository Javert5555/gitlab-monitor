<template>
  <div class="project-detail-view">
    <div v-if="store.loading && !store.currentProject" class="loading">
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
        </div>
        <div class="header-actions">
          <button 
            @click="scanProject" 
            :disabled="store.loading"
            class="scan-button"
          >
            {{ store.loading ? 'Сканирование...' : 'Сканировать проект' }}
          </button>
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
  await store.scanSingleProject(projectId)
}

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
}

.project-url a:hover {
  text-decoration: underline;
}

.scan-button {
  background: #e67e22;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.scan-button:hover:not(:disabled) {
  background: #d35400;
}

.scan-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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