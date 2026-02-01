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

    <div class="scheduling-section">
        <h2>Планирование сканирования</h2>
        
        <div v-if="scheduleStore.loading && !scheduleStore.currentSchedule" class="loading">
            Загрузка расписания...
        </div>
        
        <div v-else class="schedule-content">
            <div class="current-schedule">
                <p><strong>Текущее расписание полного сканирования:</strong> {{ scheduleStore.scheduleFormatted }}</p>
                <!-- <p><strong>Следующий запуск:</strong> {{ scheduleStore.nextRunFormatted }}</p> -->
            </div>
            
            <div class="schedule-controls">
                <div class="schedule-select">
                    <label for="schedule-select">Изменить расписание:</label>
                    <select 
                        id="schedule-select"
                        v-model="selectedSchedule"
                        @change="updateSchedule"
                        :disabled="scheduleStore.loading"
                        class="schedule-dropdown"
                    >
                        <option value="" disabled>Выберите расписание...</option>
                        <option value="disabled">Отключить</option>
                        <option value="every-10-minutes">Каждые 10 минут</option>
                        <optgroup label="По часам">
                            <option value="hourly">Каждый час</option>
                            <option value="every-2-hours">Каждые 2 часа</option>
                            <option value="every-3-hours">Каждые 3 часа</option>
                            <option value="every-4-hours">Каждые 4 часа</option>
                            <option value="every-6-hours">Каждые 6 часов</option>
                            <option value="every-8-hours">Каждые 8 часов</option>
                            <option value="every-12-hours">Каждые 12 часов</option>
                        </optgroup>
                        <optgroup label="По дням">
                            <option value="daily">Ежедневно</option>
                            <option value="every-2-days">Каждые 2 дня</option>
                            <option value="every-3-days">Каждые 3 дня</option>
                            <option value="every-4-days">Каждые 4 дня</option>
                            <option value="weekly">Еженедельно</option>
                        </optgroup>
                    </select>
                </div>
                
                <div v-if="scheduleStore.loading" class="schedule-loading">
                    <span class="spinner-small"></span>
                    Обновление...
                </div>
                
                <div v-if="scheduleStore.error" class="schedule-error">
                    {{ scheduleStore.error }}
                </div>
            </div>
        </div>
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
import { ref, onMounted } from 'vue'
import { useProjectStore } from '../stores/project'
import { useScheduleStore } from '../stores/schedule'

const store = useProjectStore()
const scheduleStore = useScheduleStore()

const selectedSchedule = ref('')

// Обработка изменения расписания
const updateSchedule = async () => {
    if (!selectedSchedule.value) return
    
    try {
        await scheduleStore.updateSchedule(selectedSchedule.value)
        selectedSchedule.value = '' // Сбрасываем выбор
    } catch (error) {
        // Ошибка уже обработана в store
    }
}

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
    scheduleStore.initialize()
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
  padding: 2rem;
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  border-radius: 12px;
  border: 1px solid #3a3a4e;
}

.hero-section h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #bb86fc;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.subtitle {
  font-size: 1.2rem;
  color: #a0a0c0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.stat-card {
  background: #1e1e2e;
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-left: 4px solid #2196f3;
  border: 1px solid #3a3a4e;
}

.risk-stat {
  border-left-color: #f44336;
  background: linear-gradient(135deg, #2a1e2e 0%, #1e2a3e 100%);
}

.high-risk-stat {
  border-left-color: #ff9800;
  background: linear-gradient(135deg, #2e2a1e 0%, #3e2d1e 100%);
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  color: #ffffff;
}

.stat-label {
  color: #a0a0c0;
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
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}

.scan-button {
  background: linear-gradient(135deg, #bb86fc 0%, #3700b3 100%);
}

.scan-button.loading {
  background: linear-gradient(135deg, #424242 0%, #616161 100%);
}

.refresh-button {
  background: linear-gradient(135deg, #03dac6 0%, #018786 100%);
}

.scan-button:hover:not(:disabled),
.refresh-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
  filter: brightness(1.1);
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
  background: linear-gradient(135deg, #b00020 0%, #cf6679 100%);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  text-align: center;
  border: 1px solid #ff5252;
}

.info-section {
  background: #1e1e2e;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border: 1px solid #3a3a4e;
}

.info-section h2 {
  margin-bottom: 1.5rem;
  color: #bb86fc;
  border-bottom: 2px solid #3a3a4e;
  padding-bottom: 0.5rem;
}

.risks-list {
  display: grid;
  gap: 0.8rem;
}

.risk-item {
  padding: 0.8rem;
  background: #2d2d44;
  border-radius: 8px;
  border-left: 3px solid #2196f3;
  color: #e0e0e0;
  transition: all 0.3s ease;
}

.risk-item:hover {
  background: #3a3a4e;
  transform: translateX(5px);
}

.scheduling-section {
  background: #1e1e2e;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  margin-bottom: 3rem;
  border: 1px solid #3a3a4e;
}

.scheduling-section h2 {
  margin-bottom: 1.5rem;
  color: #bb86fc;
  border-bottom: 2px solid #3a3a4e;
  padding-bottom: 0.5rem;
}

.current-schedule {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #2d2d44;
  border-radius: 8px;
  border-left: 4px solid #2196f3;
}

.current-schedule p {
  margin: 0.5rem 0;
  color: #e0e0e0;
}

.schedule-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.schedule-select {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-select label {
  font-weight: 600;
  color: #bb86fc;
}

.schedule-dropdown {
  padding: 0.75rem;
  border: 1px solid #3a3a4e;
  border-radius: 6px;
  font-size: 1rem;
  background: #2d2d44;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.3s ease;
}

.schedule-dropdown:hover {
  border-color: #bb86fc;
  background: #3a3a4e;
}

.schedule-dropdown:focus {
  outline: none;
  border-color: #bb86fc;
  box-shadow: 0 0 0 3px rgba(187, 134, 252, 0.1);
}

.schedule-dropdown:disabled {
  background: #424242;
  cursor: not-allowed;
  color: #757575;
}

.schedule-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #a0a0c0;
  font-size: 0.9rem;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid #bb86fc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.schedule-error {
  color: #ff5252;
  background: rgba(255, 82, 82, 0.1);
  padding: 0.75rem;
  border-radius: 6px;
  border-left: 4px solid #ff5252;
  font-size: 0.9rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #a0a0c0;
}
</style>