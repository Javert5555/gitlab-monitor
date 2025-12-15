<template>
  <div class="project-detail">
    <!-- Детали последнего сканирования -->
    <div v-if="latestScan" class="section">
      <h2>Результаты последнего сканирования</h2>
      <div class="security-checks">
        <div 
          v-for="check in latestScan.results" 
          :key="check.id"
          class="security-check"
        >
          <div class="check-header">
            <h3 class="check-name">{{ check.name }}</h3>
            <span class="check-id">{{ check.id }}</span>
          </div>
          
          <div v-if="!check.results || check.results.length === 0" class="no-results">
            Проверки не выполнялись
          </div>
          
          <div v-else class="check-results">
            <div 
              v-for="(result, index) in check.results" 
              :key="index"
              class="check-result"
              :class="getStatusClass(result.status)"
            >
              <div class="result-header">
                <span class="result-item">{{ result.item }}</span>
                <span class="result-status">{{ result.status }}</span>
              </div>
              <div v-if="result.details" class="result-details">
                {{ result.details }}
              </div>
              <div v-if="result.severity" class="result-severity">
                Уровень угрозы: 
                <span :class="'severity-' + result.severity.toLowerCase()">
                  {{ result.severity }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Последние сканирования -->
    <div class="section">
      <h2>История сканирований</h2>
      <div v-if="!project.scans || project.scans.length === 0" class="empty-state">
        Сканирования не проводились
      </div>
      <div v-else class="scans-list">
        <div 
          v-for="scan in project.scans" 
          :key="scan.id"
          class="scan-item"
        >
          <div class="scan-header">
            <span class="scan-date">{{ formatDate(scan.scannedAt) }}</span>
            <RiskBadge :count="scan.summary?.totalRisks || 0" />
          </div>
          <div class="scan-summary">
            <div class="risk-breakdown">
              <span v-if="scan.summary?.critical" class="risk-count critical">
                C: {{ scan.summary.critical }}
              </span>
              <span v-if="scan.summary?.high" class="risk-count high">
                H: {{ scan.summary.high }}
              </span>
              <span v-if="scan.summary?.medium" class="risk-count medium">
                M: {{ scan.summary.medium }}
              </span>
              <span v-if="scan.summary?.low" class="risk-count low">
                L: {{ scan.summary.low }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import RiskBadge from './RiskBadge.vue'

const props = defineProps({
  project: {
    type: Object,
    required: true
  }
})

const latestScan = computed(() => {
  if (!props.project.scans || props.project.scans.length === 0) return null
  return props.project.scans[0]
})

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString('ru-RU')
}

const getStatusClass = (status) => {
  const statusMap = {
    'DANGER': 'status-danger',
    'FAIL': 'status-danger',
    'WARN': 'status-warn',
    'PASS': 'status-pass',
    'INFO': 'status-info'
  }
  return statusMap[status] || 'status-unknown'
}
</script>

<style scoped>
.project-detail {
  display: grid;
  gap: 2rem;
}

.section {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.section h2 {
  margin-bottom: 1.5rem;
  color: #2c3e50;
  border-bottom: 2px solid #ecf0f1;
  padding-bottom: 0.5rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #7f8c8d;
  font-style: italic;
}

.scans-list {
  display: grid;
  gap: 1rem;
}

.scan-item {
  padding: 1.5rem;
  border: 1px solid #ecf0f1;
  border-radius: 8px;
  transition: background-color 0.3s;
}

.scan-item:hover {
  background-color: #f8f9fa;
}

.scan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.scan-date {
  font-weight: 600;
  color: #2c3e50;
}

.risk-breakdown {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.risk-count {
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 600;
}

.risk-count.critical {
  background: #e74c3c;
  color: white;
}

.risk-count.high {
  background: #e67e22;
  color: white;
}

.risk-count.medium {
  background: #f39c12;
  color: white;
}

.risk-count.low {
  background: #3498db;
  color: white;
}

.security-checks {
  display: grid;
  gap: 1.5rem;
}

.security-check {
  border: 1px solid #ecf0f1;
  border-radius: 8px;
  overflow: hidden;
}

.check-header {
  background: #f8f9fa;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ecf0f1;
}

.check-name {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.check-id {
  background: #3498db;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 600;
}

.no-results {
  padding: 2rem;
  text-align: center;
  color: #7f8c8d;
  font-style: italic;
}

.check-results {
  padding: 1rem;
}

.check-result {
  padding: 1rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  border-left: 4px solid #bdc3c7;
}

.check-result.status-danger {
  background: #ffeaea;
  border-left-color: #e74c3c;
}

.check-result.status-warn {
  background: #fff4e6;
  border-left-color: #e67e22;
}

.check-result.status-pass {
  background: #e8f6f3;
  border-left-color: #27ae60;
}

.check-result.status-info {
  background: #e3f2fd;
  border-left-color: #3498db;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.result-item {
  font-weight: 600;
  color: #2c3e50;
}

.result-status {
  padding: 0.25rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-danger .result-status {
  background: #e74c3c;
  color: white;
}

.status-warn .result-status {
  background: #e67e22;
  color: white;
}

.status-pass .result-status {
  background: #27ae60;
  color: white;
}

.status-info .result-status {
  background: #3498db;
  color: white;
}

.result-details {
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.result-severity {
  font-size: 0.8rem;
  font-weight: 600;
}

.severity-critical {
  color: #e74c3c;
}

.severity-high {
  color: #e67e22;
}

.severity-medium {
  color: #f39c12;
}

.severity-low {
  color: #3498db;
}
</style>