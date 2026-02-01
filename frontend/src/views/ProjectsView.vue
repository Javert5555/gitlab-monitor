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
          {{ store.loading ? 'Обновление...' : 'Обновить список' }}
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
  store.refreshProjectsWithToast()
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
  padding: 1.5rem;
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  border-radius: 12px;
  border: 1px solid #3a3a4e;
}

.view-header h1 {
  color: #bb86fc;
  margin: 0;
  font-size: 2rem;
}

.refresh-button {
  background: linear-gradient(135deg, #03dac6 0%, #018786 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.refresh-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  filter: brightness(1.1);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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