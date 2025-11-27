<template>
  <div class="projects-page">
    <div class="page-header">
      <h1>Проекты GitLab</h1>
      <div class="header-actions">
        <button 
          @click="refreshProjects" 
          :disabled="loading"
          class="btn btn-secondary"
        >
          {{ loading ? 'Обновление...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <div class="projects-container">
      <div v-if="loading" class="loading">Загрузка проектов...</div>
      
      <div v-else-if="error" class="error-alert">
        {{ error }}
      </div>

      <div v-else class="projects-grid">
        <div 
          v-for="project in projects" 
          :key="project.id"
          class="project-card"
          :class="{ 'has-risks': project.latestRiskCount > 0 }"
          @click="$router.push(`/projects/${project.id}`)"
        >
          <div class="project-icon">📁</div>
          <div class="project-info">
            <h3>{{ project.name }}</h3>
            <p class="project-id">ID: {{ project.gitlabProjectId }}</p>
            <p class="project-url">{{ project.url }}</p>
          </div>
          <div class="project-risks">
            <span 
              v-if="project.latestRiskCount > 0" 
              class="risk-indicator high"
            >
              {{ project.latestRiskCount }} рисков
            </span>
            <span v-else class="risk-indicator clean">
              ✅ Без рисков
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useProjectStore } from '../stores/projectStore'

const store = useProjectStore()
const { projects, loading, error } = store

const refreshProjects = () => {
  store.fetchProjects()
}

onMounted(() => {
  store.fetchProjects()
})
</script>

<style scoped>
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border-left: 4px solid #27ae60;
}

.project-card.has-risks {
  border-left-color: #e74c3c;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.project-icon {
  font-size: 2rem;
}

.project-info {
  flex: 1;
}

.project-info h3 {
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.project-id {
  color: #7f8c8d;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.project-url {
  color: #3498db;
  font-size: 0.875rem;
  word-break: break-all;
}

.risk-indicator {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: bold;
}

.risk-indicator.high {
  background: #e74c3c;
  color: white;
}

.risk-indicator.clean {
  background: #27ae60;
  color: white;
}

.loading, .error-alert {
  text-align: center;
  padding: 3rem;
  font-size: 1.1rem;
}

.error-alert {
  background: #e74c3c;
  color: white;
  border-radius: 8px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
}
</style>