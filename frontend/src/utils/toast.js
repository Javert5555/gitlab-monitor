import { useToast } from 'vue-toastification'

export const useAppToast = () => {
  const toast = useToast()
  
  return {
    // успешные операции
    success: (message, title = 'Успех') => {
      toast.success(message, {
        title,
        icon: '✅'
      })
    },
    
    // ошибки
    error: (message, title = 'Ошибка') => {
      toast.error(message, {
        title,
        icon: '❌'
      })
    },
    
    // предупреждения
    warning: (message, title = 'Внимание') => {
      toast.warning(message, {
        title,
        icon: '⚠️'
      })
    },
    
    // информационные сообщения
    info: (message, title = 'Информация') => {
      toast.info(message, {
        title,
        icon: 'ℹ️'
      })
    },
    
    // сканирование начато
    scanStarted: (projectName = null) => {
      const message = projectName 
        ? `Сканирование проекта "${projectName}" начато`
        : 'Полное сканирование всех проектов начато'
      
      toast.info(message, {
        title: 'Сканирование',
        icon: '🔄',
        timeout: 3000
      })
    },
    
    // сканирование завершено успешно
    scanSuccess: (projectName = null, riskCount = 0) => {
      const message = projectName
        ? `Проект "${projectName}" отсканирован. Активных угроз: ${riskCount}`
        : `Все проекты отсканированы. Общее количество активных угроз: ${riskCount}`
      
      const title = projectName ? 'Сканирование завершено' : 'Полное сканирование завершено'
      
      if (riskCount > 0) {
        toast.warning(message, {
          title,
          icon: '⚠️'
        })
      } else {
        toast.success(message, {
          title,
          icon: '✅'
        })
      }
    },
    
    // ошибка сканирования
    scanError: (projectName = null, errorMessage = '') => {
      const message = projectName
        ? `Ошибка сканирования проекта "${projectName}": ${errorMessage}`
        : `Ошибка полного сканирования: ${errorMessage}`
      
      toast.error(message, {
        title: 'Ошибка сканирования',
        icon: '❌'
      })
    }
  }
}