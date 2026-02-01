<template>
  <div class="project-list">
    <div v-if="loading" class="loading">
      Загрузка проектов...
    </div>

    <div v-else-if="projects.length === 0" class="empty-state">
      Проекты не найдены
    </div>

    <div v-else class="projects-grid">
      <div 
        v-for="project in projects" 
        :key="project.id"
        class="project-card"
        @click="$router.push(`/projects/${project.id}`)"
      >
        <div class="project-info">
          <h3 class="project-name">{{ project.name }}</h3>
          <p class="project-id">ID: {{ project.gitlabProjectId }}</p>
          <p class="project-updated">
            Обновлено: {{ formatDate(project.updatedAt) }}
          </p>
        </div>
        <div class="project-risks">
          <RiskBadge :count="project.latestRiskCount" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import RiskBadge from './RiskBadge.vue'

const router = useRouter()

defineProps({
  projects: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const formatDate = (dateString) => {
  if (!dateString) return 'Никогда'
  return new Date(dateString).toLocaleString('ru-RU')
}
</script>

<style scoped>
.project-list {
  width: 100%;
}

.loading, .empty-state {
  text-align: center;
  padding: 3rem;
  color: #a0a0c0;
  font-size: 1.1rem;
  background: #1e1e2e;
  border-radius: 12px;
  border: 1px solid #3a3a4e;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border: 1px solid #3a3a4e;
}

.project-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  border-color: #bb86fc;
  background: linear-gradient(135deg, #2d2d44 0%, #3a3a4e 100%);
}

.project-info {
  flex: 1;
}

.project-name {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #e0e0e0;
}

.project-id {
  color: #a0a0c0;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.project-updated {
  color: #8a8aa0;
  font-size: 0.8rem;
}

.project-risks {
  margin-left: 1rem;
}
</style>