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

/* В HomeView.vue стили */
.scheduling-section {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    margin-bottom: 3rem;
}

.scheduling-section h2 {
    margin-bottom: 1.5rem;
    color: #2c3e50;
    border-bottom: 2px solid #ecf0f1;
    padding-bottom: 0.5rem;
}

.current-schedule {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #3498db;
}

.current-schedule p {
    margin: 0.5rem 0;
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
    color: #2c3e50;
}

.schedule-dropdown {
    padding: 0.75rem;
    border: 1px solid #bdc3c7;
    border-radius: 6px;
    font-size: 1rem;
    background: white;
    cursor: pointer;
    transition: border-color 0.3s;
}

.schedule-dropdown:hover {
    border-color: #3498db;
}

.schedule-dropdown:focus {
    outline: none;
    border-color: #2980b9;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.schedule-dropdown:disabled {
    background: #f8f9fa;
    cursor: not-allowed;
}

.schedule-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #7f8c8d;
    font-size: 0.9rem;
}

.spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.schedule-error {
    color: #e74c3c;
    background: #ffeaea;
    padding: 0.75rem;
    border-radius: 6px;
    border-left: 4px solid #e74c3c;
    font-size: 0.9rem;
}

.loading {
    text-align: center;
    padding: 2rem;
    color: #7f8c8d;
}
</style>