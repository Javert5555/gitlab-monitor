import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import Toast, { POSITION } from 'vue-toastification'
import 'vue-toastification/dist/index.css'

const app = createApp(App)
const pinia = createPinia()

const toastOptions = {
  timeout: 5000,
  position: POSITION.TOP_RIGHT,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false,
  toastClassName: 'dark-toast',
  bodyClassName: 'dark-toast-body',
  toastDefaults: {
    success: {
      className: 'dark-success',
      iconTheme: {
        primary: '#388e3c',
        secondary: '#ffffff'
      }
    },
    error: {
      className: 'dark-error',
      iconTheme: {
        primary: '#d32f2f',
        secondary: '#ffffff'
      }
    },
    warning: {
      className: 'dark-warning',
      iconTheme: {
        primary: '#f57c00',
        secondary: '#ffffff'
      }
    },
    info: {
      className: 'dark-info',
      iconTheme: {
        primary: '#1976d2',
        secondary: '#ffffff'
      }
    }
  }
}

app.use(pinia)
app.use(router)
app.use(Toast, toastOptions)
app.mount('#app')