<template>
  <div class="chart-container">
    <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  projects: {
    type: Array,
    required: true
  }
})

const chartData = computed(() => {
  const projectNames = props.projects.map(p => p.name)
  const riskCounts = props.projects.map(p => p.latestRiskCount)

  return {
    labels: projectNames,
    datasets: [
      {
        label: 'Количество рисков',
        data: riskCounts,
        backgroundColor: riskCounts.map(count => 
          count === 0 ? '#27ae60' : count > 5 ? '#e74c3c' : '#f39c12'
        ),
        borderColor: '#34495e',
        borderWidth: 1
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: true,
      text: 'Распределение рисков по проектам'
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Количество рисков'
      }
    },
    x: {
      title: {
        display: true,
        text: 'Проекты'
      }
    }
  }
}
</script>

<style scoped>
.chart-container {
  height: 400px;
  position: relative;
}
</style>