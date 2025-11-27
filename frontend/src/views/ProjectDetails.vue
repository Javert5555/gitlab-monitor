<template>
  <div class="project-details">
    <div v-if="loading" class="loading">Загрузка...</div>
    
    <div v-else-if="error" class="error-alert">
      {{ error }}
    </div>

    <div v-else-if="projectData" class="details-container">
      <!-- Заголовок проекта -->
      <div class="project-header">
        <button @click="$router.back()" class="btn btn-back">← Назад</button>
        <div class="header-content">
          <h1>{{ projectData.project.name }}</h1>
          <p class="project-url">{{ projectData.project.url }}</p>
        </div>
        <button 
          @click="scanProject" 
          :disabled="scanning"
          class="btn btn-primary"
        >
          {{ scanning ? 'Сканирование...' : 'Сканировать' }}
        </button>
      </div>

      <!-- Последние результаты сканирования -->
      <div class="section">
        <h2>Последние результаты сканирования</h2>
        
        <div v-if="latestScan" class="scan-results">
          <div class="scan-header">
            <h3>Сканирование от {{ formatDate(latestScan.scannedAt) }}</h3>
            <div class="scan-summary">
              <span class="risk-total">Всего рисков: {{ latestScan.summary?.totalRisks || 0 }}</span>
              <span v-if="latestScan.summary?.critical" class="risk-critical">
                Критических: {{ latestScan.summary.critical }}
              </span>
              <span v-if="latestScan.summary?.high" class="risk-high">
                Высоких: {{ latestScan.summary.high }}
              </span>
            </div>
          </div>

          <!-- Результаты проверок -->
          <div class="security-checks">
            <div 
              v-for="check in latestScan.results" 
              :key="check.id"
              class="check-card"
              :class="getCheckStatusClass(check)"
            >
              <div class="check-header">
                <h4>{{ check.name }}</h4>
                <span class="check-status">{{ getCheckStatusText(check) }}</span>
              </div>
              
              <div v-if="check.results && check.results.length" class="check-details">
                <div 
                  v-for="(result, index) in check.results" 
                  :key="index"
                  class="result-item"
                  :class="result.status.toLowerCase()"
                >
                  <span class="result-details">{{ result.item }}: {{ result.details }}</span>
                  <span v-if="result.severity" class="severity-badge" :class="result.severity.toLowerCase()">
                    {{ result.severity }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          Нет данных сканирования
        </div>
      </div>

      <!-- История сканирований -->
      <div class="section">
        <h2>История сканирований</h2>
        <div class="scan-history">
          <div 
            v-for="scan in projectData.scans" 
            :key="scan.id"
            class="scan-history-item"
          >
            <div class="scan-date">{{ formatDate(scan.scannedAt) }}</div>
            <div class="scan-risks">
              Рисков: {{ scan.summary?.totalRisks || 0 }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/projectStore'

const route = useRoute()
const store = useProjectStore()
const scanning = ref(false)

const projectData = computed(() => store.currentProject)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const latestScan = computed(() => {
  if (!projectData.value?.scans?.length) return null
  return projectData.value.scans[0]
})

const scanProject = async () => {
  scanning.value = true
  await store.scanSingleProject(route.params.id)
  scanning.value = false
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('ru-RU')
}

const getCheckStatusClass = (check) => {
  const hasFailures = check.results?.some(r => r.status === 'FAIL')
  const hasWarnings = check.results?.some(r => r.status === 'WARN')
  
  if (hasFailures) return 'check-failed'
  if (hasWarnings) return 'check-warning'
  return 'check-passed'
}

const getCheckStatusText = (check) => {
  const hasFailures = check.results?.some(r => r.status === 'FAIL')
  const hasWarnings = check.results?.some(r => r.status === 'WARN')
  
  if (hasFailures) return 'Есть риски'
  if (hasWarnings) return 'Предупреждения'
  return 'Без рисков'
}

onMounted(() => {
  store.fetchProjectDetails(route.params.id)
})
</script>

<style scoped>
.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 1rem;
}

.header-content {
  flex: 1;
}

.btn-back {
  background: #95a5a6;
  color: white;
}

.scan-results {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
}

.scan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #ecf0f1;
}

.scan-summary {
  display: flex;
  gap: 1rem;
}

.risk-total, .risk-critical, .risk-high {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: bold;
}

.risk-total {
  background: #f39c12;
  color: white;
}

.risk-critical {
  background: #c0392b;
  color: white;
}

.risk-high {
  background: #e74c3c;
  color: white;
}

.security-checks {
  display: grid;
  gap: 1rem;
}

.check-card {
  padding: 1rem;
  border-radius: 6px;
  border-left: 4px solid #27ae60;
}

.check-card.check-failed {
  border-left-color: #e74c3c;
  background: #fdf2f2;
}

.check-card.check-warning {
  border-left-color: #f39c12;
  background: #fef9e7;
}

.check-card.check-passed {
  border-left-color: #27ae60;
  background: #f2f9f2;
}

.check-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.check-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: bold;
}

.check-failed .check-status {
  background: #e74c3c;
  color: white;
}

.check-warning .check-status {
  background: #f39c12;
  color: white;
}

.check-passed .check-status {
  background: #27ae60;
  color: white;
}

.check-details {
  margin-top: 0.5rem;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  margin: 0.25rem 0;
  border-radius: 4px;
  font-size: 0.875rem;
}

.result-item.fail {
  background: #fadbd8;
  color: #c0392b;
}

.result-item.warn {
  background: #fdebd0;
  color: #e67e22;
}

.result-item.pass {
  background: #d5f4e6;
  color: #27ae60;
}

.severity-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.severity-badge.critical {
  background: #c0392b;
  color: white;
}

.severity-badge.high {
  background: #e74c3c;
  color: white;
}

.severity-badge.medium {
  background: #f39c12;
  color: white;
}

.severity-badge.low {
  background: #3498db;
  color: white;
}

.scan-history {
  display: grid;
  gap: 0.5rem;
}

.scan-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #3498db;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #7f8c8d;
  font-style: italic;
}
</style>