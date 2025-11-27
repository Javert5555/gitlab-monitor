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
  color: #7f8c8d;
  font-size: 1.1rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.15);
}

.project-info {
  flex: 1;
}

.project-name {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #2c3e50;
}

.project-id {
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.project-updated {
  color: #95a5a6;
  font-size: 0.8rem;
}

.project-risks {
  margin-left: 1rem;
}
</style>