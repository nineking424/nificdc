import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useToast } from 'vue-toastification'

// API 기본 설정
const api = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || 'http://localhost:3000/api/v1',  // Direct backend for now
  timeout: 30000,
  withCredentials: true,  // Include cookies for authentication
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// 요청 시작 시간 저장용
const requestStartTimes = new Map()

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    // 요청 시작 시간 기록
    requestStartTimes.set(config, Date.now())
    
    // 인증 토큰 자동 첨부
    try {
      const authStore = useAuthStore()
      if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`
      }
    } catch (error) {
      // Auth store 초기화 중일 때 무시
      console.warn('Auth store not yet initialized')
    }
    
    // 요청 ID 추가 (디버깅용)
    config.headers['X-Request-ID'] = generateRequestId()
    
    // 언어 헤더 추가
    try {
      const appStore = useAppStore()
      config.headers['Accept-Language'] = appStore.language || 'ko'
      
      // 로딩 상태 관리 (특정 요청 제외)
      if (!config.skipLoading) {
        appStore.setLoading(true, config.loadingMessage || '데이터를 불러오는 중...')
      }
    } catch (error) {
      // App store 초기화 중일 때 무시
      console.warn('App store not yet initialized')
    }
    
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      params: config.params,
      data: config.data
    })
    
    return config
  },
  (error) => {
    console.error('[API Request Error]', error)
    const appStore = useAppStore()
    appStore.setLoading(false)
    return Promise.reject(error)
  }
)

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    // 응답 시간 계산
    const startTime = requestStartTimes.get(response.config)
    const responseTime = startTime ? Date.now() - startTime : 0
    requestStartTimes.delete(response.config)
    
    console.log(`[API Response] ${response.status} ${response.config.url}`, {
      responseTime: `${responseTime}ms`,
      data: response.data
    })
    
    // 로딩 상태 해제
    if (!response.config.skipLoading) {
      const appStore = useAppStore()
      appStore.setLoading(false)
    }
    
    // 성공 메시지 처리
    if (response.data.message && response.config.showSuccessMessage) {
      const toast = useToast()
      toast.success(response.data.message)
    }
    
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    // 응답 시간 계산
    const startTime = requestStartTimes.get(originalRequest)
    const responseTime = startTime ? Date.now() - startTime : 0
    requestStartTimes.delete(originalRequest)
    
    console.error(`[API Error] ${error.response?.status || 'Network'} ${originalRequest.url}`, {
      responseTime: `${responseTime}ms`,
      error: error.message,
      response: error.response?.data
    })
    
    // 로딩 상태 해제
    if (!originalRequest.skipLoading) {
      const appStore = useAppStore()
      appStore.setLoading(false)
    }
    
    const authStore = useAuthStore()
    const appStore = useAppStore()
    const toast = useToast()
    
    // 401 Unauthorized 처리 (로그인 요청이 아닌 경우만)
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/login')) {
      originalRequest._retry = true
      
      try {
        // 리프레시 토큰이 있는 경우에만 갱신 시도
        if (authStore.refreshToken) {
          await authStore.refreshAccessToken()
          
          // 원래 요청 재시도
          originalRequest.headers.Authorization = `Bearer ${authStore.token}`
          return api(originalRequest)
        } else {
          throw new Error('No refresh token available')
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        
        // 리프레시 실패 시 로그아웃
        await authStore.logout()
        
        // 로그인 페이지로 리다이렉트
        if (window.location.pathname !== '/login') {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
        }
        
        return Promise.reject(refreshError)
      }
    }
    
    // 403 Forbidden 처리
    if (error.response?.status === 403) {
      appStore.setError({
        message: '접근 권한이 없습니다.',
        code: 'FORBIDDEN'
      })
      
      if (!originalRequest.skipErrorToast) {
        toast.error('접근 권한이 없습니다.')
      }
    }
    
    // 404 Not Found 처리
    else if (error.response?.status === 404) {
      appStore.setError({
        message: '요청한 리소스를 찾을 수 없습니다.',
        code: 'NOT_FOUND'
      })
      
      if (!originalRequest.skipErrorToast) {
        toast.error('요청한 리소스를 찾을 수 없습니다.')
      }
    }
    
    // 422 Validation Error 처리
    else if (error.response?.status === 422) {
      const validationErrors = error.response.data.errors || {}
      
      appStore.setError({
        message: '입력 데이터를 확인해주세요.',
        code: 'VALIDATION_ERROR',
        details: validationErrors
      })
      
      if (!originalRequest.skipErrorToast) {
        const firstError = Object.values(validationErrors)[0]
        toast.error(firstError || '입력 데이터를 확인해주세요.')
      }
    }
    
    // 429 Too Many Requests 처리
    else if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after']
      const message = retryAfter 
        ? `너무 많은 요청이 발생했습니다. ${retryAfter}초 후에 다시 시도해주세요.`
        : '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
      
      appStore.setError({
        message,
        code: 'RATE_LIMIT_EXCEEDED'
      })
      
      if (!originalRequest.skipErrorToast) {
        toast.error(message)
      }
    }
    
    // 500 Internal Server Error 처리
    else if (error.response?.status >= 500) {
      appStore.setError({
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        code: 'SERVER_ERROR'
      })
      
      if (!originalRequest.skipErrorToast) {
        toast.error('서버 오류가 발생했습니다.')
      }
    }
    
    // 네트워크 오류 처리
    else if (error.code === 'NETWORK_ERROR' || !error.response) {
      appStore.setError({
        message: '네트워크 연결을 확인해주세요.',
        code: 'NETWORK_ERROR'
      })
      
      if (!originalRequest.skipErrorToast) {
        toast.error('네트워크 연결을 확인해주세요.')
      }
    }
    
    // 타임아웃 처리
    else if (error.code === 'ECONNABORTED') {
      appStore.setError({
        message: '요청 시간이 초과되었습니다.',
        code: 'TIMEOUT'
      })
      
      if (!originalRequest.skipErrorToast) {
        toast.error('요청 시간이 초과되었습니다.')
      }
    }
    
    // 기타 오류 처리
    else {
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          '알 수 없는 오류가 발생했습니다.'
      
      appStore.setError({
        message: errorMessage,
        code: 'UNKNOWN_ERROR'
      })
      
      if (!originalRequest.skipErrorToast) {
        toast.error(errorMessage)
      }
    }
    
    return Promise.reject(error)
  }
)

// 유틸리티 함수들
function generateRequestId() {
  return Math.random().toString(36).substr(2, 9)
}

// API 헬퍼 메서드들
export const apiHelpers = {
  // 파일 업로드
  uploadFile: (url, file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      }
    })
  },
  
  // 파일 다운로드
  downloadFile: async (url, filename) => {
    try {
      const response = await api.get(url, {
        responseType: 'blob',
        skipLoading: true
      })
      
      const blob = new Blob([response.data])
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      window.URL.revokeObjectURL(downloadUrl)
      
      return true
    } catch (error) {
      console.error('File download failed:', error)
      throw error
    }
  },
  
  // 배치 요청
  batch: async (requests) => {
    try {
      const responses = await Promise.allSettled(
        requests.map(request => api(request))
      )
      
      return responses.map((result, index) => ({
        index,
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value.data : null,
        error: result.status === 'rejected' ? result.reason : null
      }))
    } catch (error) {
      console.error('Batch request failed:', error)
      throw error
    }
  },
  
  // 페이지네이션된 요청
  paginated: async (url, params = {}) => {
    try {
      const response = await api.get(url, {
        params: {
          page: 1,
          limit: 20,
          ...params
        }
      })
      
      return {
        data: response.data.data || response.data.items || [],
        pagination: response.data.pagination || {
          page: params.page || 1,
          limit: params.limit || 20,
          total: response.data.total || 0,
          totalPages: Math.ceil((response.data.total || 0) / (params.limit || 20))
        }
      }
    } catch (error) {
      console.error('Paginated request failed:', error)
      throw error
    }
  },
  
  // 상태 체크 (헬스체크)
  healthCheck: () => {
    return api.get('/health', {
      skipLoading: true,
      skipErrorToast: true,
      timeout: 5000
    })
  }
}

export default api