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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.risk-none {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
}

.risk-low {
  background: linear-gradient(135deg, #ffb300 0%, #ff8f00 100%);
}

.risk-medium {
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
}

.risk-high {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
}
</style>