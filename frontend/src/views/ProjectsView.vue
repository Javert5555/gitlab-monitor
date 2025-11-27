<template>
  <div class="projects-view">
    <div class="view-header">
      <h1>Проекты GitLab</h1>
      <div class="header-actions">
        <button 
          @click="refreshProjects" 
          :disabled="store.loading"
          class="refresh-button"
        >
          {{ store.loading ? 'Обновление...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <div v-if="store.error" class="error-message">
      {{ store.error }}
    </div>

    <ProjectList 
      :projects="store.sortedProjects"
      :loading="store.loading"
      @refresh="store.fetchProjects"
    />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useProjectStore } from '../stores/project'
import ProjectList from '../components/ProjectList.vue'

const store = useProjectStore()

const refreshProjects = () => {
  store.fetchProjects()
}

onMounted(() => {
  store.fetchProjects()
})
</script>

<style scoped>
.projects-view {
  max-width: 1200px;
  margin: 0 auto;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.view-header h1 {
  color: #2c3e50;
  margin: 0;
}

.refresh-button {
  background: #27ae60;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.refresh-button:hover:not(:disabled) {
  background: #219a52;
}

.refresh-button:disabled {
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