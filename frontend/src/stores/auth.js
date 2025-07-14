import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/utils/api'
import { useToast } from 'vue-toastification'

export const useAuthStore = defineStore('auth', () => {
  const toast = useToast()
  
  // 상태
  const user = ref(null)
  const token = ref(localStorage.getItem('auth_token'))
  const refreshToken = ref(localStorage.getItem('refresh_token'))
  const isLoading = ref(false)
  const loginAttempts = ref(0)
  const lastLoginAttempt = ref(null)
  
  // 계산된 속성
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const userRole = computed(() => user.value?.role || 'guest')
  const userName = computed(() => user.value?.name || user.value?.username || '')
  const userEmail = computed(() => user.value?.email || '')
  const isAdmin = computed(() => userRole.value === 'admin')
  const isModerator = computed(() => ['admin', 'moderator'].includes(userRole.value))
  
  // 권한 체크
  const hasPermission = computed(() => (permission) => {
    if (!user.value) return false
    
    const userPermissions = user.value.permissions || []
    const rolePermissions = user.value.role_permissions || []
    
    return userPermissions.includes(permission) || 
           rolePermissions.includes(permission) ||
           isAdmin.value
  })
  
  // 액션
  const login = async (credentials) => {
    try {
      isLoading.value = true
      
      console.log('[AUTH] Login attempt with credentials:', credentials)
      console.log('[AUTH] Current API base URL:', api.defaults.baseURL)
      
      // 로그인 시도 제한 확인
      if (loginAttempts.value >= 5) {
        const timeSinceLastAttempt = Date.now() - lastLoginAttempt.value
        const waitTime = 15 * 60 * 1000 // 15분
        
        if (timeSinceLastAttempt < waitTime) {
          const remainingTime = Math.ceil((waitTime - timeSinceLastAttempt) / 60000)
          throw new Error(`너무 많은 로그인 시도가 있었습니다. ${remainingTime}분 후에 다시 시도해주세요.`)
        } else {
          loginAttempts.value = 0
        }
      }
      
      console.log('[AUTH] Making API call to:', `${api.defaults.baseURL}/auth/login`)
      const response = await api.post('/auth/login', credentials)
      
      if (response.data.success) {
        const { user: userData, accessToken, refreshToken: newRefreshToken } = response.data.data || response.data
        
        // 상태 업데이트
        user.value = userData
        token.value = accessToken
        // refreshToken은 HTTP-Only 쿠키로 설정되므로 직접 저장하지 않음
        
        // 로컬 스토리지에 저장
        localStorage.setItem('auth_token', accessToken)
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken)
          refreshToken.value = newRefreshToken
        }
        localStorage.setItem('user_data', JSON.stringify(userData))
        
        // API 헤더 설정
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
        
        // 로그인 시도 초기화
        loginAttempts.value = 0
        lastLoginAttempt.value = null
        
        toast.success(`환영합니다, ${userData.name}님!`)
        
        return { success: true, user: userData }
      } else {
        throw new Error(response.data.message || '로그인에 실패했습니다.')
      }
    } catch (error) {
      loginAttempts.value++
      lastLoginAttempt.value = Date.now()
      
      const errorMessage = error.response?.data?.message || error.message || '로그인 중 오류가 발생했습니다.'
      toast.error(errorMessage)
      
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const register = async (userData) => {
    try {
      isLoading.value = true
      
      const response = await api.post('/auth/register', userData)
      
      if (response.data.success) {
        toast.success('회원가입이 완료되었습니다. 로그인해주세요.')
        return { success: true }
      } else {
        throw new Error(response.data.message || '회원가입에 실패했습니다.')
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '회원가입 중 오류가 발생했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const logout = async () => {
    try {
      if (token.value) {
        await api.post('/auth/logout')
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // 상태 초기화
      user.value = null
      token.value = null
      refreshToken.value = null
      
      // 로컬 스토리지 정리
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user_data')
      
      // API 헤더 제거
      delete api.defaults.headers.common['Authorization']
      
      toast.info('로그아웃되었습니다.')
    }
  }
  
  const fetchUser = async () => {
    try {
      if (!token.value) {
        throw new Error('No token available')
      }
      
      const response = await api.get('/auth/me')
      
      if (response.data.success) {
        user.value = response.data.user
        localStorage.setItem('user_data', JSON.stringify(response.data.user))
        return response.data.user
      } else {
        throw new Error('Failed to fetch user data')
      }
    } catch (error) {
      console.error('Fetch user error:', error)
      // 401 에러인 경우에만 로그아웃 처리
      if (error.response?.status === 401) {
        await logout()
      }
      throw error
    }
  }
  
  const refreshAccessToken = async () => {
    try {
      if (!refreshToken.value) {
        throw new Error('No refresh token available')
      }
      
      const response = await api.post('/auth/refresh', {
        refreshToken: refreshToken.value
      })
      
      if (response.data.success) {
        const { token: newAccessToken, refreshToken: newRefreshToken } = response.data
        
        token.value = newAccessToken
        refreshToken.value = newRefreshToken
        
        localStorage.setItem('auth_token', newAccessToken)
        localStorage.setItem('refresh_token', newRefreshToken)
        
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`
        
        return newAccessToken
      } else {
        throw new Error('Token refresh failed')
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      await logout()
      throw error
    }
  }
  
  const updateProfile = async (profileData) => {
    try {
      isLoading.value = true
      
      const response = await api.put('/auth/profile', profileData)
      
      if (response.data.success) {
        user.value = { ...user.value, ...response.data.user }
        localStorage.setItem('user_data', JSON.stringify(user.value))
        toast.success('프로필이 업데이트되었습니다.')
        return response.data.user
      } else {
        throw new Error(response.data.message || '프로필 업데이트에 실패했습니다.')
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '프로필 업데이트 중 오류가 발생했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const changePassword = async (passwordData) => {
    try {
      isLoading.value = true
      
      const response = await api.put('/auth/password', passwordData)
      
      if (response.data.success) {
        toast.success('비밀번호가 변경되었습니다.')
        return { success: true }
      } else {
        throw new Error(response.data.message || '비밀번호 변경에 실패했습니다.')
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '비밀번호 변경 중 오류가 발생했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const forgotPassword = async (email) => {
    try {
      isLoading.value = true
      
      const response = await api.post('/auth/forgot-password', { email })
      
      if (response.data.success) {
        toast.success('비밀번호 재설정 링크를 이메일로 전송했습니다.')
        return { success: true }
      } else {
        throw new Error(response.data.message || '비밀번호 재설정 요청에 실패했습니다.')
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '비밀번호 재설정 요청 중 오류가 발생했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const resetPassword = async (token, password) => {
    try {
      isLoading.value = true
      
      const response = await api.post('/auth/reset-password', { token, password })
      
      if (response.data.success) {
        toast.success('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.')
        return { success: true }
      } else {
        throw new Error(response.data.message || '비밀번호 재설정에 실패했습니다.')
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || '비밀번호 재설정 중 오류가 발생했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  // 초기화 함수
  const initialize = async () => {
    if (token.value) {
      try {
        // API 헤더 설정
        api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
        
        // 로컬 스토리지에서 사용자 데이터 복원
        const userData = localStorage.getItem('user_data')
        if (userData) {
          try {
            user.value = JSON.parse(userData)
          } catch (parseError) {
            console.warn('Failed to parse stored user data:', parseError)
            localStorage.removeItem('user_data')
          }
        }
        
        // 사용자 정보 갱신 시도 (실패해도 로그아웃하지 않음)
        try {
          await fetchUser()
        } catch (fetchError) {
          console.warn('Failed to fetch updated user data:', fetchError)
          // 로컬 스토리지에 사용자 데이터가 있다면 그것을 유지
          if (!user.value) {
            throw fetchError // 사용자 데이터가 없으면 에러를 던져서 로그아웃 처리
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        await logout()
      }
    }
  }
  
  return {
    // 상태
    user,
    token,
    isLoading,
    loginAttempts,
    
    // 계산된 속성
    isAuthenticated,
    userRole,
    userName,
    userEmail,
    isAdmin,
    isModerator,
    hasPermission,
    
    // 액션
    login,
    register,
    logout,
    fetchUser,
    refreshAccessToken,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    initialize
  }
})