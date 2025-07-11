import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 상태
  const isLoading = ref(false)
  const loadingMessage = ref('')
  const error = ref(null)
  const notifications = ref([])
  const sidebar = ref({
    isOpen: true,
    isMini: false,
    isTemporary: false
  })
  const theme = ref(localStorage.getItem('nificdc-theme') || 'light')
  const language = ref(localStorage.getItem('nificdc-language') || 'ko')
  const navigationHistory = ref([])
  const breadcrumbs = ref([])
  const pageTitle = ref('NiFiCDC')
  const socketConnected = ref(false)
  const onlineStatus = ref(navigator.onLine)
  
  // 전역 설정
  const settings = ref({
    autoRefresh: true,
    refreshInterval: 30000, // 30초
    showNotifications: true,
    compactMode: false,
    animations: true,
    soundEnabled: false
  })
  
  // 계산된 속성
  const isDarkTheme = computed(() => theme.value === 'dark')
  const isOnline = computed(() => onlineStatus.value && socketConnected.value)
  const hasError = computed(() => !!error.value)
  const unreadNotifications = computed(() => 
    notifications.value.filter(n => !n.read).length
  )
  
  // 액션
  const setLoading = (loading, message = '') => {
    isLoading.value = loading
    loadingMessage.value = message
  }
  
  const setError = (errorData) => {
    if (errorData) {
      error.value = {
        message: errorData.message || '알 수 없는 오류가 발생했습니다.',
        details: errorData.details || '',
        code: errorData.code || '',
        timestamp: Date.now()
      }
    } else {
      error.value = null
    }
  }
  
  const clearError = () => {
    error.value = null
  }
  
  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      type: notification.type || 'info', // info, success, warning, error
      title: notification.title || '',
      message: notification.message || '',
      read: false,
      persistent: notification.persistent || false,
      timestamp: Date.now(),
      actions: notification.actions || []
    }
    
    notifications.value.unshift(newNotification)
    
    // 최대 100개까지 유지
    if (notifications.value.length > 100) {
      notifications.value = notifications.value.slice(0, 100)
    }
    
    // 자동 제거 (persistent가 아닌 경우)
    if (!newNotification.persistent) {
      setTimeout(() => {
        removeNotification(newNotification.id)
      }, 5000)
    }
    
    return newNotification.id
  }
  
  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }
  
  const markNotificationAsRead = (id) => {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = true
    }
  }
  
  const markAllNotificationsAsRead = () => {
    notifications.value.forEach(n => n.read = true)
  }
  
  const clearAllNotifications = () => {
    notifications.value = []
  }
  
  const toggleSidebar = () => {
    sidebar.value.isOpen = !sidebar.value.isOpen
  }
  
  const setSidebarOpen = (isOpen) => {
    sidebar.value.isOpen = isOpen
  }
  
  const setSidebarMini = (isMini) => {
    sidebar.value.isMini = isMini
  }
  
  const setSidebarTemporary = (isTemporary) => {
    sidebar.value.isTemporary = isTemporary
  }
  
  const setTheme = (newTheme) => {
    theme.value = newTheme
    localStorage.setItem('nificdc-theme', newTheme)
    
    // Vuetify 테마 적용
    if (typeof window !== 'undefined' && window.$vuetify) {
      window.$vuetify.theme.global.name = newTheme
    }
  }
  
  const toggleTheme = () => {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }
  
  const setLanguage = (newLanguage) => {
    language.value = newLanguage
    localStorage.setItem('nificdc-language', newLanguage)
  }
  
  const addToHistory = (routeInfo) => {
    const existingIndex = navigationHistory.value.findIndex(
      item => item.path === routeInfo.path
    )
    
    if (existingIndex > -1) {
      // 기존 항목 업데이트
      navigationHistory.value[existingIndex] = {
        ...navigationHistory.value[existingIndex],
        ...routeInfo,
        timestamp: Date.now()
      }
    } else {
      // 새 항목 추가
      navigationHistory.value.unshift(routeInfo)
      
      // 최대 20개까지 유지
      if (navigationHistory.value.length > 20) {
        navigationHistory.value = navigationHistory.value.slice(0, 20)
      }
    }
  }
  
  const setBreadcrumbs = (crumbs) => {
    breadcrumbs.value = crumbs
  }
  
  const setPageTitle = (title) => {
    pageTitle.value = title
    document.title = title ? `${title} - NiFiCDC` : 'NiFiCDC'
  }
  
  const setSocketConnected = (connected) => {
    socketConnected.value = connected
  }
  
  const setOnlineStatus = (online) => {
    onlineStatus.value = online
  }
  
  const updateSettings = (newSettings) => {
    settings.value = { ...settings.value, ...newSettings }
    localStorage.setItem('nificdc-settings', JSON.stringify(settings.value))
  }
  
  const resetSettings = () => {
    settings.value = {
      autoRefresh: true,
      refreshInterval: 30000,
      showNotifications: true,
      compactMode: false,
      animations: true,
      soundEnabled: false
    }
    localStorage.removeItem('nificdc-settings')
  }
  
  // 초기화 함수
  const initialize = () => {
    // 설정 복원
    const savedSettings = localStorage.getItem('nificdc-settings')
    if (savedSettings) {
      try {
        settings.value = { ...settings.value, ...JSON.parse(savedSettings) }
      } catch (error) {
        console.warn('Failed to parse saved settings:', error)
      }
    }
    
    // 온라인 상태 감지
    window.addEventListener('online', () => setOnlineStatus(true))
    window.addEventListener('offline', () => setOnlineStatus(false))
    
    // 미디어 쿼리 감지 (반응형)
    const mediaQuery = window.matchMedia('(max-width: 960px)')
    const handleMediaChange = (e) => {
      setSidebarTemporary(e.matches)
      if (e.matches) {
        setSidebarOpen(false)
      }
    }
    
    mediaQuery.addListener(handleMediaChange)
    handleMediaChange(mediaQuery)
  }
  
  // 정리 함수
  const destroy = () => {
    window.removeEventListener('online', () => setOnlineStatus(true))
    window.removeEventListener('offline', () => setOnlineStatus(false))
  }
  
  return {
    // 상태
    isLoading,
    loadingMessage,
    error,
    notifications,
    sidebar,
    theme,
    language,
    navigationHistory,
    breadcrumbs,
    pageTitle,
    socketConnected,
    onlineStatus,
    settings,
    
    // 계산된 속성
    isDarkTheme,
    isOnline,
    hasError,
    unreadNotifications,
    
    // 액션
    setLoading,
    setError,
    clearError,
    addNotification,
    removeNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    toggleSidebar,
    setSidebarOpen,
    setSidebarMini,
    setSidebarTemporary,
    setTheme,
    toggleTheme,
    setLanguage,
    addToHistory,
    setBreadcrumbs,
    setPageTitle,
    setSocketConnected,
    setOnlineStatus,
    updateSettings,
    resetSettings,
    initialize,
    destroy
  }
})