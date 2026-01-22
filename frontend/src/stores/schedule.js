import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { scheduleAPI } from '../api'
import { useAppToast } from '../utils/toast'

export const useScheduleStore = defineStore('schedule', () => {
    const currentSchedule = ref(null)
    const nextRun = ref(null)
    const availableSchedules = ref([])
    const loading = ref(false)
    const error = ref(null)
    
    const toast = useAppToast()

    // геттер для форматированного времени следующего запуска
    const nextRunFormatted = computed(() => {
        if (!nextRun.value) return 'Не запланировано'
        const date = new Date(nextRun.value)
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    })

    // геттер для форматированного расписания
    const scheduleFormatted = computed(() => {
        return currentSchedule.value?.formatted || 'Не установлено'
    })

    // загружаем текущее расписание
    const fetchSchedule = async () => {
        loading.value = true
        error.value = null
        try {
            const response = await scheduleAPI.getSchedule()
            currentSchedule.value = response.data
            nextRun.value = response.data.nextRun
            availableSchedules.value = response.data.availableSchedules || []
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message
            error.value = 'Ошибка при загрузке расписания: ' + errorMsg
            console.error('Error fetching schedule:', err)
        } finally {
            loading.value = false
        }
    }

    // загружаем доступные расписания
    const fetchAvailableSchedules = async () => {
        try {
            const response = await scheduleAPI.getAvailableSchedules()
            availableSchedules.value = response.data.schedules || []
        } catch (err) {
            console.error('Error fetching available schedules:', err)
        }
    }

    // обновляем расписание
    const updateSchedule = async (scheduleKey) => {
        loading.value = true
        error.value = null
        try {
            const response = await scheduleAPI.updateSchedule(scheduleKey)
            
            // обновляем локальное состояние
            currentSchedule.value = response.data
            nextRun.value = response.data.nextRun
            
            // показываем уведомление
            toast.success(response.data.message, 'Расписание обновлено')
            
            return response.data
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message
            error.value = 'Ошибка при обновлении расписания: ' + errorMsg
            toast.error('Не удалось обновить расписание', errorMsg)
            console.error('Error updating schedule:', err)
            throw err
        } finally {
            loading.value = false
        }
    }

    const initialize = async () => {
        await Promise.all([
            fetchSchedule(),
            fetchAvailableSchedules()
        ])
    }

    return {
        // State
        currentSchedule,
        nextRun,
        availableSchedules,
        loading,
        error,
        
        // Getters
        nextRunFormatted,
        scheduleFormatted,
        
        // Actions
        fetchSchedule,
        fetchAvailableSchedules,
        updateSchedule,
        initialize
    }
})