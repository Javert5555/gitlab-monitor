<template>
  <div 
    class="risk-badge"
    :class="riskClass"
  >
    {{ count }}
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  count: {
    type: Number,
    required: true
  }
})

const riskClass = computed(() => {
  if (props.count === 0) return 'risk-none'
  if (props.count <= 3) return 'risk-low'
  if (props.count <= 10) return 'risk-medium'
  return 'risk-high'
})
</script>

<style scoped>
.risk-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
  border-radius: 50%;
  font-weight: bold;
  font-size: 0.9rem;
  color: white;
}

.risk-none {
  background: #27ae60;
}

.risk-low {
  background: #f39c12;
}

.risk-medium {
  background: #e67e22;
}

.risk-high {
  background: #e74c3c;
}
</style>