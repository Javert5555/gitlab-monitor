<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>Дашборд безопасности CI/CD</h1>
      <button 
        @click="triggerScan" 
        :disabled="loading"
        class="btn btn-primary"
      >
        {{ loading ? 'Сканирование...' : 'Запустить полное сканирование' }}
      </button>
    </div>

    <!-- Статистика -->
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Всего проектов</h3>
        <div class="stat-value">{{ projects.length }}</div>
      </div>
      <div class="stat-card risk-high">
        <h3>Проектов с рисками</h3>
        <div class="stat-value">{{ highRiskProjects.length }}</div>
      </div>
      <div class="stat-card risk-critical">
        <h3>Всего рисков</h3>
        <div class="stat-value">{{ totalRisks }}</div>
      </div>
    </div>

    <!-- Список проектов с рисками -->
    <div class="section">
      <h2>Проекты с обнаруженными рисками</h2>
      <div v-if="highRiskProjects.length === 0" class="empty-state">
        ✅ Риски не обнаружены
      </div>
      <div v-else class="projects-list">
        <div 
          v-for="project in highRiskProjects" 
          :key="project.id"
          class="project-card risk-card"
          @click="$router.push(`/projects/${project.id}`)"
        >
          <div class="project-header">
            <h3>{{ project.name }}</h3>
            <span class="risk-badge">{{ project.latestRiskCount }} рисков</span>
          </div>
          <p class="project-url">{{ project.url }}</p>
          <div class="project-meta">
            Обновлено: {{ formatDate(project.updatedAt) }}
          </div>
        </div>
      </div>
    </div>

    <!-- График распределения рисков -->
    <div class="section">
      <h2>Распределение рисков по проектам</h2>
      <RiskChart :projects="projects" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import RiskChart from '../components/RiskChart.vue'

const store = useProjectStore()

const projects = computed(() => store.projects)
const highRiskProjects = computed(() => store.highRiskProjects)
const totalRisks = computed(() => store.totalRisks)
const loading = computed(() => store.loading)

const triggerScan = async () => {
  await store.triggerFullScan()
}

const formatDate = (dateString) => {
  if (!dateString) return 'Никогда'
  return new Date(dateString).toLocaleString('ru-RU')
}

onMounted(() => {
  store.fetchProjects()
})
</script>

<style scoped>
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid #3498db;
}

.stat-card.risk-high {
  border-left-color: #e74c3c;
}

.stat-card.risk-critical {
  border-left-color: #c0392b;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #2c3e50;
}

.section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.projects-list {
  display: grid;
  gap: 1rem;
}

.project-card {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.project-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.risk-card {
  border-left: 4px solid #e74c3c;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.risk-badge {
  background: #e74c3c;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: bold;
}

.project-url {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.project-meta {
  color: #999;
  font-size: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>