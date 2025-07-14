import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import i18n from './plugins/i18n'
import toast from './plugins/toast'
import './assets/styles/main.scss'
import './styles/design-system.css'
import './styles/mobile.css'
import { initMobileOptimization } from './utils/mobile'

const app = createApp(App)

// 모바일 최적화 초기화
initMobileOptimization()

// 글로벌 에러 핸들링
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err)
  console.error('Vue Info:', info)
  
  // 개발 환경에서만 상세 에러 표시
  if (process.env.NODE_ENV === 'development') {
    console.error('Vue Instance:', instance)
  }
}

// 플러그인 및 라이브러리 등록
app.use(createPinia())
app.use(router)
app.use(vuetify)
app.use(i18n)
app.use(toast)

// 글로벌 프로퍼티 추가
app.config.globalProperties.$filters = {
  formatDate: (date) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  },
  formatBytes: (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// 앱 초기화 및 인증 상태 복원
async function initializeApp() {
  // 인증 스토어 초기화
  const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()
  
  try {
    // 새로고침 시 로컬 스토리지에서 인증 상태 복원
    await authStore.initialize()
  } catch (error) {
    console.warn('Authentication initialization failed:', error)
  }
  
  // Vue 앱 마운트
  app.mount('#app')
}

// 앱 초기화 실행
initializeApp()