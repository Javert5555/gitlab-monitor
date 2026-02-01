<template>
  <div class="trend-chart">
    <div v-if="!hasData" class="no-data-message">
      <p>Недостаточно данных для построения графика</p>
      <p class="hint">Требуется минимум 2 сканирования</p>
    </div>
    
    <div v-else>
      <div class="chart-container">
        <canvas ref="chartCanvas"></canvas>
      </div>
      
      <div class="chart-legend">
        <div class="legend-item" v-for="item in legendItems" :key="item.label">
          <span class="legend-color" :style="{ backgroundColor: item.color }"></span>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  scans: {
    type: Array,
    required: true,
    default: () => []
  },
  height: {
    type: Number,
    default: 300
  },
  showLegend: {
    type: Boolean,
    default: true
  },
  title: {
    type: String,
    default: 'Тенденции изменения угроз'
  }
})

const emits = defineEmits(['chart-created', 'chart-updated'])

const chartCanvas = ref(null)
let chartInstance = null

// Проверяем, есть ли достаточно данных
const hasData = computed(() => {
  return props.scans && props.scans.length > 1
})

// Подготавливаем данные для графика
const chartData = computed(() => {
  if (!hasData.value) return null
  
  // Сортируем сканирования от старых к новым
  const scans = [...props.scans].reverse()
  
  // Форматируем даты для оси X
  const labels = scans.map(scan => {
    const date = new Date(scan.scannedAt)
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  })
  
  // Собираем данные для каждого типа угроз
  const criticalData = scans.map(scan => scan.summary?.critical || 0)
  const highData = scans.map(scan => scan.summary?.high || 0)
  const mediumData = scans.map(scan => scan.summary?.medium || 0)
  const lowData = scans.map(scan => scan.summary?.low || 0)
  const totalData = scans.map(scan => scan.summary?.totalRisks || 0)
  
  return {
    labels,
    datasets: [
      {
        label: 'Critical',
        data: criticalData,
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'High',
        data: highData,
        borderColor: '#e67e22',
        backgroundColor: 'rgba(230, 126, 34, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Medium',
        data: mediumData,
        borderColor: '#f39c12',
        backgroundColor: 'rgba(243, 156, 18, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Low',
        data: lowData,
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Total',
        data: totalData,
        borderColor: '#2ecc71',
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        borderWidth: 3,
        borderDash: [5, 5],
        tension: 0.4,
        fill: false,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  }
})

// Элементы легенды
const legendItems = computed(() => [
  { label: 'Critical (Критические)', color: '#e74c3c' },
  { label: 'High (Высокие)', color: '#e67e22' },
  { label: 'Medium (Средние)', color: '#f39c12' },
  { label: 'Low (Низкие)', color: '#3498db' },
  { label: 'Total (Всего)', color: '#2ecc71' }
])

// Настройки графика
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: props.title,
      font: {
        size: 16,
        weight: 'bold'
      },
      padding: {
        top: 10,
        bottom: 20
      }
    },
    legend: {
      position: 'top',
      labels: {
        padding: 15,
        usePointStyle: true,
        pointStyle: 'circle',
        font: {
          size: 11
        }
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: '#3498db',
      borderWidth: 1,
      padding: 10,
      callbacks: {
        label: function(context) {
          const label = context.dataset.label || ''
          const value = context.parsed.y
          return `${label}: ${value}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(0, 0, 0, 0.05)',
        drawBorder: false
      },
      ticks: {
        maxRotation: 45,
        minRotation: 45,
        font: {
          size: 11
        }
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0, 0, 0, 0.05)',
        drawBorder: false
      },
      title: {
        display: true,
        text: 'Количество угроз',
        font: {
          size: 12,
          weight: 'bold'
        }
      },
      ticks: {
        stepSize: 1,
        precision: 0
      }
    }
  },
  interaction: {
    intersect: false,
    mode: 'nearest'
  },
  animation: {
    duration: 750,
    easing: 'easeInOutQuart'
  }
}

// Создаём график
const createChart = () => {
  if (!chartCanvas.value || !chartData.value) return
  
  // Уничтожаем предыдущий график, если он существует
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  
  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: chartData.value,
    options: {
      ...chartOptions,
      plugins: {
        ...chartOptions.plugins,
        legend: {
          ...chartOptions.plugins.legend,
          display: props.showLegend
        }
      }
    }
  })
  
  emits('chart-created', chartInstance)
}

// Обновляем график
const updateChart = () => {
  if (chartInstance && chartData.value) {
    chartInstance.data = chartData.value
    chartInstance.update('active')
    emits('chart-updated', chartInstance)
  }
}

// Следим за изменениями данных
watch(() => props.scans, (newScans, oldScans) => {
  if (JSON.stringify(newScans) !== JSON.stringify(oldScans)) {
    nextTick(() => {
      if (hasData.value) {
        if (chartInstance) {
          updateChart()
        } else {
          createChart()
        }
      } else if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }
    })
  }
}, { deep: true })

// Инициализация
onMounted(() => {
  nextTick(() => {
    if (hasData.value) {
      createChart()
    }
  })
})

// Очистка
onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})

// Экспортируем методы для внешнего использования
defineExpose({
  getChart: () => chartInstance,
  destroyChart: () => {
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }
  },
  updateChart
})
</script>

<style scoped>
.trend-chart {
  width: 100%;
}

.no-data-message {
  text-align: center;
  padding: 3rem;
  color: #a0a0c0;
  font-style: italic;
  background: #2d2d44;
  border-radius: 8px;
  border: 1px dashed #3a3a4e;
}

.hint {
  font-size: 0.9rem;
  margin-top: 0.5rem;
  color: #8a8aa0;
}

.chart-container {
  position: relative;
  height: v-bind(height + 'px');
  width: 100%;
  margin: 1rem 0;
  background: #1e1e2e;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #3a3a4e;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
  background: #2d2d44;
  border-radius: 8px;
  margin-top: 1rem;
  border: 1px solid #3a3a4e;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #e0e0e0;
  cursor: default;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.legend-item:hover {
  background: #3a3a4e;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.legend-item:hover .legend-color {
  transform: scale(1.2);
}
</style>