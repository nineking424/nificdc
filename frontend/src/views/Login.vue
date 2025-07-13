<template>
  <div class="login-container">
    <!-- 배경 패턴 -->
    <div class="background-pattern">
      <div class="pattern-grid"></div>
      <div class="floating-elements">
        <div class="element element-1"></div>
        <div class="element element-2"></div>
        <div class="element element-3"></div>
      </div>
    </div>

    <div class="login-content">
      <!-- 로그인 폼 섹션 -->
      <div class="login-form-section">
        <div class="login-form-container">
          <!-- 로고 및 헤더 -->
          <div class="login-header">
            <div class="brand-logo">
              <h1 class="text-gradient">NiFiCDC</h1>
              <span class="brand-subtitle">Data Sync Platform</span>
            </div>
            <div class="welcome-text">
              <h2>환영합니다</h2>
              <p>계정에 로그인하여 데이터 동기화 여정을 시작하세요</p>
            </div>
          </div>

          <!-- 로그인 폼 -->
          <form @submit.prevent="handleLogin" class="modern-form">
            <div class="form-group">
              <div class="input-wrapper">
                <input
                  v-model="form.email"
                  type="email"
                  placeholder=" "
                  class="modern-input"
                  :class="{ 'error': emailError }"
                  required
                />
                <label class="modern-label">이메일 주소</label>
                <div class="input-icon">
                  <v-icon size="20" color="gray-400">mdi-email-outline</v-icon>
                </div>
              </div>
              <div v-if="emailError" class="error-message">{{ emailError }}</div>
            </div>

            <div class="form-group">
              <div class="input-wrapper">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder=" "
                  class="modern-input"
                  :class="{ 'error': passwordError }"
                  required
                />
                <label class="modern-label">비밀번호</label>
                <div class="input-icon">
                  <v-icon size="20" color="gray-400">mdi-lock-outline</v-icon>
                </div>
                <button
                  type="button"
                  class="password-toggle"
                  @click="showPassword = !showPassword"
                >
                  <v-icon size="20" :color="showPassword ? 'primary' : 'gray-400'">
                    {{ showPassword ? 'mdi-eye-off' : 'mdi-eye' }}
                  </v-icon>
                </button>
              </div>
              <div v-if="passwordError" class="error-message">{{ passwordError }}</div>
            </div>

            <div class="form-options">
              <label class="checkbox-wrapper">
                <input type="checkbox" v-model="rememberMe">
                <span class="checkmark"></span>
                <span class="checkbox-label">로그인 상태 유지</span>
              </label>
              <router-link to="/reset-password" class="forgot-link">
                비밀번호 찾기
              </router-link>
            </div>

            <button
              type="submit"
              class="login-button"
              :disabled="loading"
              :class="{ 'loading': loading }"
            >
              <span v-if="!loading" class="button-content">
                <v-icon size="20" class="mr-2">mdi-login</v-icon>
                로그인
              </span>
              <div v-else class="loading-spinner">
                <div class="spinner"></div>
                <span>로그인 중...</span>
              </div>
            </button>
          </form>

          <!-- 소셜 로그인 (옵션) -->
          <div class="social-login">
            <div class="divider">
              <span>또는</span>
            </div>
            <button class="social-button github" type="button" @click="loginWithGitHub">
              <v-icon size="20" class="mr-2">mdi-github</v-icon>
              GitHub으로 로그인
            </button>
          </div>
        </div>
      </div>

      <!-- 우측 비주얼 섹션 -->
      <div class="visual-section">
        <div class="visual-content">
          <div class="visual-header">
            <h2>Real-time Data Sync</h2>
            <p>실시간 데이터 동기화로 비즈니스의 디지털 전환을 가속화하세요</p>
          </div>
          
          <div class="feature-highlights">
            <div class="highlight-item">
              <div class="highlight-icon">
                <v-icon size="24" color="white">mdi-lightning-bolt</v-icon>
              </div>
              <div class="highlight-text">
                <h3>실시간 처리</h3>
                <p>밀리초 단위의 초고속 데이터 동기화</p>
              </div>
            </div>
            
            <div class="highlight-item">
              <div class="highlight-icon">
                <v-icon size="24" color="white">mdi-shield-check</v-icon>
              </div>
              <div class="highlight-text">
                <h3>기업급 보안</h3>
                <p>엔터프라이즈 수준의 보안과 신뢰성</p>
              </div>
            </div>
            
            <div class="highlight-item">
              <div class="highlight-icon">
                <v-icon size="24" color="white">mdi-chart-timeline-variant</v-icon>
              </div>
              <div class="highlight-text">
                <h3>스마트 모니터링</h3>
                <p>AI 기반 성능 분석과 최적화</p>
              </div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">99.9%</div>
              <div class="stat-label">Uptime</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">10M+</div>
              <div class="stat-label">Records/sec</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">500+</div>
              <div class="stat-label">Enterprises</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const toast = useToast()
    
    const form = ref({
      email: 'admin@example.com',  // 테스트용 기본값
      password: 'admin123'         // 테스트용 기본값
    })
    
    const showPassword = ref(false)
    const loading = ref(false)
    const rememberMe = ref(false)
    
    // 실시간 유효성 검사
    const emailError = computed(() => {
      if (!form.value.email) return ''
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
        return '올바른 이메일 형식을 입력해주세요'
      }
      return ''
    })
    
    const passwordError = computed(() => {
      if (!form.value.password) return ''
      if (form.value.password.length < 6) {
        return '비밀번호는 최소 6자 이상이어야 합니다'
      }
      return ''
    })
    
    const isFormValid = computed(() => {
      const hasEmail = form.value.email && form.value.email.trim().length > 0
      const hasPassword = form.value.password && form.value.password.trim().length > 0
      const noEmailError = !emailError.value
      const noPasswordError = !passwordError.value
      
      console.log('[DEBUG] Validity check:', {
        hasEmail,
        hasPassword, 
        noEmailError,
        noPasswordError,
        email: form.value.email,
        password: form.value.password
      })
      
      return hasEmail && hasPassword && noEmailError && noPasswordError
    })
    
    const handleLogin = async () => {
      // 디버깅: 폼 데이터 로깅
      console.log('[DEBUG] Form data:', JSON.stringify(form.value))
      console.log('[DEBUG] Form email:', form.value.email)
      console.log('[DEBUG] Form password:', form.value.password)
      console.log('[DEBUG] isFormValid:', isFormValid.value)
      
      if (!isFormValid.value) {
        toast.error('입력 정보를 다시 확인해주세요.')
        return
      }
      
      loading.value = true
      
      try {
        const loginData = {
          email: form.value.email,
          password: form.value.password
          // rememberMe는 일단 제거하여 테스트
        }
        console.log('[DEBUG] Sending login data:', JSON.stringify(loginData))
        
        await authStore.login(loginData)
        
        toast.success('로그인에 성공했습니다!')
        
        const redirect = router.currentRoute.value.query.redirect || '/dashboard'
        router.push(redirect)
      } catch (error) {
        console.error('Login failed:', error)
        
        const errorMessage = error.response?.data?.error || 
                           error.response?.data?.message || 
                           '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.'
        
        toast.error(errorMessage)
      } finally {
        loading.value = false
      }
    }
    
    const loginWithGitHub = () => {
      toast.info('GitHub 로그인 기능은 준비 중입니다.')
    }
    
    return {
      form,
      showPassword,
      loading,
      rememberMe,
      emailError,
      passwordError,
      isFormValid,
      handleLogin,
      loginWithGitHub
    }
  }
}
</script>

<style scoped>
/* 로그인 페이지 전용 스타일 */
.login-container {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
}

/* 배경 패턴 */
.background-pattern {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, 
    var(--primary-50) 0%, 
    var(--primary-100) 25%, 
    var(--gray-50) 50%, 
    var(--primary-50) 75%, 
    var(--primary-100) 100%);
}

.pattern-grid {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 1px 1px, var(--primary-200) 1px, transparent 0);
  background-size: 40px 40px;
  opacity: 0.3;
}

.floating-elements {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.element {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-400), var(--primary-600));
  opacity: 0.1;
  animation: float 15s infinite;
}

.element-1 {
  width: 150px;
  height: 150px;
  top: 10%;
  left: 5%;
  animation-delay: 0s;
}

.element-2 {
  width: 100px;
  height: 100px;
  top: 70%;
  right: 10%;
  animation-delay: -5s;
}

.element-3 {
  width: 80px;
  height: 80px;
  bottom: 15%;
  left: 70%;
  animation-delay: -10s;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-20px) rotate(120deg); }
  66% { transform: translateY(15px) rotate(240deg); }
}

/* 메인 콘텐츠 */
.login-content {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

/* 로그인 폼 섹션 */
.login-form-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
}

.login-form-container {
  width: 100%;
  max-width: 450px;
}

/* 로그인 헤더 */
.login-header {
  text-align: center;
  margin-bottom: 3rem;
}

.brand-logo h1 {
  font-size: 2.5rem;
  font-weight: 900;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(135deg, var(--primary-600), var(--primary-800));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-subtitle {
  color: var(--gray-600);
  font-size: 1rem;
  font-weight: 500;
}

.welcome-text {
  margin-top: 2rem;
}

.welcome-text h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 0.5rem 0;
}

.welcome-text p {
  color: var(--gray-600);
  font-size: 1rem;
  line-height: 1.5;
  margin: 0;
}

/* 모던 폼 */
.modern-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-wrapper {
  position: relative;
}

.modern-input {
  width: 100%;
  padding: 1rem 3rem 1rem 3rem;
  border: 2px solid var(--gray-300);
  border-radius: var(--radius-xl);
  font-size: 1rem;
  transition: all 0.2s ease;
  background: white;
  font-family: inherit;
}

.modern-input:focus {
  border-color: var(--primary-500);
  outline: none;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.modern-input.error {
  border-color: var(--error-500);
}

.modern-input.error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.modern-label {
  position: absolute;
  left: 3rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1rem;
  color: var(--gray-500);
  transition: all 0.2s ease;
  pointer-events: none;
  background: white;
  padding: 0 0.5rem;
}

.modern-input:focus + .modern-label,
.modern-input:not(:placeholder-shown) + .modern-label {
  top: 0;
  font-size: 0.75rem;
  color: var(--primary-600);
  font-weight: 500;
}

.modern-input.error:focus + .modern-label,
.modern-input.error:not(:placeholder-shown) + .modern-label {
  color: var(--error-600);
}

.input-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.password-toggle {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-md);
  transition: background-color 0.2s ease;
}

.password-toggle:hover {
  background: var(--gray-100);
}

.error-message {
  color: var(--error-600);
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* 폼 옵션 */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0.5rem 0;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.checkbox-wrapper input[type="checkbox"] {
  display: none;
}

.checkmark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--gray-300);
  border-radius: var(--radius-sm);
  position: relative;
  transition: all 0.2s ease;
  background: white;
}

.checkbox-wrapper input:checked + .checkmark {
  background: var(--primary-600);
  border-color: var(--primary-600);
}

.checkbox-wrapper input:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(45deg);
  width: 6px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
}

.checkbox-label {
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 500;
}

.forgot-link {
  color: var(--primary-600);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: color 0.2s ease;
}

.forgot-link:hover {
  color: var(--primary-700);
  text-decoration: underline;
}

/* 로그인 버튼 */
.login-button {
  width: 100%;
  padding: 1rem 2rem;
  background: var(--primary-600);
  color: white;
  border: none;
  border-radius: var(--radius-xl);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
}

.login-button:hover:not(:disabled) {
  background: var(--primary-700);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.button-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.loading-spinner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 소셜 로그인 */
.social-login {
  margin-top: 2rem;
}

.divider {
  position: relative;
  text-align: center;
  margin: 1.5rem 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gray-300);
}

.divider span {
  background: white;
  padding: 0 1rem;
  color: var(--gray-500);
  font-size: 0.875rem;
  font-weight: 500;
}

.social-button {
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: var(--gray-900);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.social-button:hover {
  background: var(--gray-800);
  transform: translateY(-1px);
}

/* 우측 비주얼 섹션 */
.visual-section {
  background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;
}

.visual-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" stroke-width="0.5" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
}

.visual-content {
  position: relative;
  z-index: 10;
  max-width: 500px;
  color: white;
  text-align: center;
}

.visual-header h2 {
  font-size: 2.25rem;
  font-weight: 800;
  margin: 0 0 1rem 0;
  line-height: 1.2;
}

.visual-header p {
  font-size: 1.125rem;
  opacity: 0.9;
  line-height: 1.6;
  margin: 0 0 3rem 0;
}

/* 기능 하이라이트 */
.feature-highlights {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.highlight-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-align: left;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
}

.highlight-item:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateX(10px);
}

.highlight-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.highlight-text h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.highlight-text p {
  font-size: 0.875rem;
  opacity: 0.8;
  margin: 0;
  line-height: 1.4;
}

/* 통계 그리드 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem 1rem;
  border-radius: var(--radius-lg);
  text-align: center;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* 반응형 디자인 */
@media (max-width: 1024px) {
  .login-content {
    grid-template-columns: 1fr;
  }
  
  .visual-section {
    order: -1;
    min-height: 40vh;
  }
  
  .feature-highlights {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .login-form-section {
    padding: 1.5rem 1rem;
  }
  
  .login-form-container {
    max-width: 100%;
  }
  
  .brand-logo h1 {
    font-size: 2rem;
  }
  
  .welcome-text h2 {
    font-size: 1.5rem;
  }
  
  .visual-header h2 {
    font-size: 1.75rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .form-options {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .modern-input {
    padding: 0.875rem 2.5rem 0.875rem 2.5rem;
  }
  
  .modern-label {
    left: 2.5rem;
  }
  
  .input-icon {
    left: 0.75rem;
  }
  
  .password-toggle {
    right: 0.75rem;
  }
}
</style>