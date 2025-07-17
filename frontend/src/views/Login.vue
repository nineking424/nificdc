<template>
  <div class="login-container">
    <div class="login-content">
      <!-- 로그인 폼 섹션 -->
      <div class="login-form-section">
        <div class="login-form-container">
          <!-- 로고 및 헤더 -->
          <div class="login-header">
            <div class="brand-logo">
              <v-icon size="48" color="primary">mdi-database-sync</v-icon>
              <h1>NiFiCDC</h1>
              <p class="brand-subtitle">실시간 데이터 동기화 플랫폼</p>
            </div>
          </div>

          <!-- 로그인 폼 -->
          <div class="login-card clean-card">
            <h2 class="login-title">로그인</h2>
            <p class="login-subtitle">계정에 로그인하여 시작하세요</p>
            
            <form @submit.prevent="handleLogin" class="login-form">
              <div class="form-group">
                <label class="form-label">이메일 주소</label>
                <div class="input-wrapper">
                  <v-icon size="20" class="input-icon">mdi-email-outline</v-icon>
                  <input
                    v-model="form.email"
                    type="email"
                    class="clean-form-input with-icon"
                    :class="{ 'error': emailError }"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div v-if="emailError" class="error-message">
                  <v-icon size="16">mdi-alert-circle</v-icon>
                  {{ emailError }}
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">비밀번호</label>
                <div class="input-wrapper">
                  <v-icon size="20" class="input-icon">mdi-lock-outline</v-icon>
                  <input
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    class="clean-form-input with-icon with-action"
                    :class="{ 'error': passwordError }"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    class="input-action"
                    @click="showPassword = !showPassword"
                  >
                    <v-icon size="20">
                      {{ showPassword ? 'mdi-eye-off' : 'mdi-eye' }}
                    </v-icon>
                  </button>
                </div>
                <div v-if="passwordError" class="error-message">
                  <v-icon size="16">mdi-alert-circle</v-icon>
                  {{ passwordError }}
                </div>
              </div>

              <div class="form-options">
                <label class="checkbox-wrapper">
                  <input type="checkbox" v-model="rememberMe" class="checkbox-input">
                  <span class="checkbox-label">로그인 상태 유지</span>
                </label>
                <a href="#" class="forgot-link">비밀번호를 잊으셨나요?</a>
              </div>

              <button
                type="submit"
                class="clean-button clean-button-primary login-submit"
                :disabled="loading || !isFormValid"
              >
                <v-icon v-if="!loading" size="20">mdi-login</v-icon>
                <v-progress-circular v-else indeterminate size="20" width="2" />
                <span>{{ loading ? '로그인 중...' : '로그인' }}</span>
              </button>
            </form>

            <div class="divider">
              <span>또는</span>
            </div>

            <button class="clean-button clean-button-secondary social-button" @click="loginWithGitHub">
              <v-icon size="20">mdi-github</v-icon>
              GitHub으로 로그인
            </button>
          </div>

          <div class="login-footer">
            <p>계정이 없으신가요? <a href="#" class="link">회원가입</a></p>
            <p class="version">Version {{ appVersion }}</p>
          </div>
        </div>
      </div>

      <!-- 우측 비주얼 섹션 -->
      <div class="visual-section">
        <div class="visual-content">
          <h2 class="visual-title">데이터 동기화의 새로운 기준</h2>
          <p class="visual-subtitle">
            NiFiCDC로 실시간 데이터 파이프라인을 구축하고<br>
            비즈니스 인사이트를 빠르게 확보하세요
          </p>

          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-icon">
                <v-icon size="32">mdi-lightning-bolt</v-icon>
              </div>
              <h3>초고속 동기화</h3>
              <p>밀리초 단위의 실시간 데이터 처리</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">
                <v-icon size="32">mdi-shield-check</v-icon>
              </div>
              <h3>엔터프라이즈 보안</h3>
              <p>금융권 수준의 보안과 안정성</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">
                <v-icon size="32">mdi-chart-line</v-icon>
              </div>
              <h3>지능형 모니터링</h3>
              <p>AI 기반 성능 최적화와 예측 분석</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">
                <v-icon size="32">mdi-puzzle</v-icon>
              </div>
              <h3>쉬운 통합</h3>
              <p>다양한 데이터베이스와 시스템 지원</p>
            </div>
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <div class="stat-value">99.9%</div>
              <div class="stat-label">가동률</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <div class="stat-value">10M+</div>
              <div class="stat-label">초당 처리량</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <div class="stat-value">500+</div>
              <div class="stat-label">기업 고객</div>
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
import api from '@/utils/api'
import packageInfo from '../../package.json'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const toast = useToast()
    
    const form = ref({
      email: '',
      password: ''
    })
    
    const showPassword = ref(false)
    const loading = ref(false)
    const rememberMe = ref(false)
    const appVersion = ref(packageInfo.version)
    
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
      return form.value.email && 
             form.value.password && 
             !emailError.value && 
             !passwordError.value
    })
    
    const handleLogin = async () => {
      if (!isFormValid.value) {
        toast.error('입력 정보를 다시 확인해주세요.')
        return
      }
      
      loading.value = true
      
      try {
        const loginData = {
          email: form.value.email,
          password: form.value.password
        }
        
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
      appVersion,
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
/* Login Container */
.login-container {
  min-height: 100vh;
  background: var(--gray-50);
}

.login-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

/* Login Form Section */
.login-form-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--white);
}

.login-form-container {
  width: 100%;
  max-width: 420px;
}

/* Brand Logo */
.login-header {
  text-align: center;
  margin-bottom: var(--space-10);
}

.brand-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.brand-logo h1 {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin: 0;
}

.brand-subtitle {
  font-size: var(--font-size-base);
  color: var(--gray-600);
  margin: 0;
}

/* Login Card */
.login-card {
  padding: var(--space-8);
  background: var(--white);
  border: 1px solid var(--gray-100);
}

.login-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
  text-align: center;
}

.login-subtitle {
  font-size: var(--font-size-base);
  color: var(--gray-600);
  margin: 0 0 var(--space-8);
  text-align: center;
}

/* Login Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--gray-700);
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-400);
  pointer-events: none;
}

.clean-form-input.with-icon {
  padding-left: var(--space-10);
}

.clean-form-input.with-action {
  padding-right: var(--space-10);
}

.input-action {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: var(--space-2);
  cursor: pointer;
  color: var(--gray-400);
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
}

.input-action:hover {
  background: var(--gray-100);
  color: var(--gray-600);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--error);
}

/* Form Options */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}

.checkbox-label {
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  user-select: none;
}

.forgot-link {
  font-size: var(--font-size-sm);
  color: var(--primary);
  text-decoration: none;
  transition: all var(--transition-base);
}

.forgot-link:hover {
  color: var(--primary-dark);
  text-decoration: underline;
}

/* Login Submit Button */
.login-submit {
  width: 100%;
  justify-content: center;
  gap: var(--space-2);
  font-size: var(--font-size-base);
  padding: var(--space-3) var(--space-4);
}

/* Divider */
.divider {
  position: relative;
  text-align: center;
  margin: var(--space-6) 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gray-200);
}

.divider span {
  background: var(--white);
  padding: 0 var(--space-4);
  color: var(--gray-500);
  font-size: var(--font-size-sm);
  position: relative;
}

/* Social Button */
.social-button {
  width: 100%;
  justify-content: center;
  gap: var(--space-2);
}

/* Login Footer */
.login-footer {
  text-align: center;
  margin-top: var(--space-8);
}

.login-footer p {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin: var(--space-2) 0;
}

.login-footer .link {
  color: var(--primary);
  text-decoration: none;
  font-weight: var(--font-medium);
  transition: all var(--transition-base);
}

.login-footer .link:hover {
  color: var(--primary-dark);
  text-decoration: underline;
}

.version {
  font-size: var(--font-size-xs);
  color: var(--gray-500);
}

/* Visual Section */
.visual-section {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  position: relative;
  overflow: hidden;
}

.visual-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}

.visual-content {
  position: relative;
  z-index: 1;
  max-width: 500px;
  color: var(--white);
}

.visual-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-4);
  line-height: 1.2;
}

.visual-subtitle {
  font-size: var(--font-size-lg);
  opacity: 0.9;
  line-height: 1.6;
  margin: 0 0 var(--space-10);
}

/* Feature Grid */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-10);
}

.feature-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  transition: all var(--transition-base);
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.feature-icon {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
  color: var(--white);
}

.feature-card h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  margin: 0 0 var(--space-2);
}

.feature-card p {
  font-size: var(--font-size-sm);
  opacity: 0.8;
  margin: 0;
  line-height: 1.5;
}

/* Stats Row */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-1);
}

.stat-label {
  font-size: var(--font-size-sm);
  opacity: 0.8;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .login-content {
    grid-template-columns: 1fr;
  }
  
  .visual-section {
    display: none;
  }
}

@media (max-width: 768px) {
  .login-form-section {
    padding: var(--space-4);
  }
  
  .login-card {
    padding: var(--space-6);
  }
  
  .brand-logo h1 {
    font-size: var(--font-size-3xl);
  }
  
  .form-options {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }
}

@media (max-width: 640px) {
  .login-form-container {
    max-width: 100%;
  }
  
  .login-card {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }
}
</style>