<template>
  <div class="home-view">
    <div class="hero-section">
      <h1>Система мониторинга безопасности CI/CD</h1>
      <p class="subtitle">
        Автоматический сбор и анализ данных о безопасности в контуре GitLab CI/CD
      </p>
    </div>

    <div class="stats-grid" v-if="!store.loading">
      <div class="stat-card">
        <div class="stat-number">{{ store.projects.length }}</div>
        <div class="stat-label">Всего проектов</div>
      </div>
      <div class="stat-card risk-stat">
        <div class="stat-number">{{ store.totalRisks }}</div>
        <div class="stat-label">Общее количество активных угроз</div>
      </div>
      <div class="stat-card high-risk-stat">
        <div class="stat-number">{{ store.highRiskProjects.length }}</div>
        <div class="stat-label">Проектов с активными угрозами</div>
      </div>
    </div>

    <div class="actions-section">
      <button 
        @click="triggerScan" 
        :disabled="store.loading"
        class="scan-button"
        :class="{ 'loading': store.loading }"
      >
        <span v-if="store.loading" class="button-loading">
          <span class="spinner"></span>
          Сканирование...
        </span>
        <span v-else>
          Запустить полное сканирование
        </span>
      </button>
      
      <button 
        @click="refreshProjects" 
        :disabled="store.loading"
        class="refresh-button"
      >
        Обновить данные
      </button>
    </div>

    <div v-if="store.error" class="error-message">
      {{ store.error }}
    </div>

    <div class="info-section">
      <h2>OWASP Top 10 CI/CD Security Risks</h2>
      <div class="risks-list">
        <div v-for="risk in owaspRisks" :key="risk.id" class="risk-item">
          <strong>SEC-CICD-{{ risk.id }}:</strong> {{ risk.description }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()

const owaspRisks = [
  { id: 1, description: 'Insufficient Flow Control Mechanisms / Недостаточные механизмы управления потоком' },
  { id: 2, description: 'Inadequate Identity and Access Management / Неадекватное управление идентификацией и доступом' },
  { id: 3, description: 'Dependency Chain Abuse / Злоупотребление цепочкой зависимостей' },
  { id: 4, description: 'Poisoned Pipeline Execution (PPE) / Выполнение «отравленного» pipeline' },
  { id: 5, description: 'Insufficient PBAC (Pipeline-Based Access Controls) / Недостаточный контроль доступа конвейера' },
  { id: 6, description: 'Insufficient Credential Hygiene / Недостаточная гигиена учетных данных' },
  { id: 7, description: 'Insecure System Configuration / Небезопасная конфигурация системы' },
  { id: 8, description: 'Ungoverned Usage of 3rd Party Services / Нерегулируемое использование сторонних сервисов' },
  { id: 9, description: 'Improper Artifact Integrity Validation / Ненадлежащая проверка целостности артефактов' },
  { id: 10, description: 'Insufficient Logging and Visibility / Недостаточное логирование и видимость' }
]

const triggerScan = async () => {
  try {
    await store.triggerFullScan()
  } catch (error) {
    // Ошибка уже обработана в store
  }
}

const refreshProjects = async () => {
  await store.refreshProjectsWithToast()
}

onMounted(() => {
  store.fetchProjects()
})
</script>

<style scoped>
.home-view {
  max-width: 1000px;
  margin: 0 auto;
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
}

.hero-section h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.subtitle {
  font-size: 1.2rem;
  color: #7f8c8d;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.stat-card {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  border-left: 4px solid #3498db;
}

.risk-stat {
  border-left-color: #e74c3c;
}

.high-risk-stat {
  border-left-color: #f39c12;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #7f8c8d;
  font-size: 0.9rem;
}

.actions-section {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 3rem;
  flex-wrap: wrap;
}

.scan-button, .refresh-button {
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.scan-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.scan-button.loading {
  background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
}

.refresh-button {
  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
}

.scan-button:hover:not(:disabled),
.refresh-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.15);
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

.spinner {
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

.info-section {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.info-section h2 {
  margin-bottom: 1.5rem;
  color: #2c3e50;
}

.risks-list {
  display: grid;
  gap: 0.8rem;
}

.risk-item {
  padding: 0.8rem;
  background: #f8f9fa;
  border-radius: 5px;
  border-left: 3px solid #3498db;
}
</style>