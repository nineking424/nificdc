<template>
  <div class="home-container">
    <!-- 모던 헤더 네비게이션 -->
    <header class="modern-header">
      <nav class="nav-container">
        <div class="brand">
          <h1 class="brand-logo text-gradient">NiFiCDC</h1>
          <span class="brand-tagline">Data Sync Platform</span>
        </div>
        
        <div class="nav-actions">
          <a 
            href="https://github.com/nineking424/nificdc" 
            target="_blank"
            class="nav-link"
          >
            <v-icon size="20">mdi-github</v-icon>
            GitHub
          </a>
          
          <!-- 로그인/로그아웃 버튼 -->
          <button 
            v-if="!isAuthenticated"
            class="auth-button login-btn"
            @click="goToLogin"
          >
            <v-icon size="18" class="mr-2">mdi-login</v-icon>
            로그인
          </button>
          
          <div v-else class="user-menu">
            <v-menu offset-y>
              <template #activator="{ props }">
                <button
                  class="auth-button user-btn"
                  v-bind="props"
                >
                  <div class="user-avatar">
                    <v-icon size="16">mdi-account</v-icon>
                  </div>
                  <span>{{ userName }}</span>
                  <v-icon size="16">mdi-chevron-down</v-icon>
                </button>
              </template>
              
              <v-list class="user-dropdown">
                <v-list-item @click="goToDashboard" class="dropdown-item">
                  <v-icon class="mr-3" size="18">mdi-view-dashboard</v-icon>
                  대시보드
                </v-list-item>
                <v-divider />
                <v-list-item @click="logout" class="dropdown-item">
                  <v-icon class="mr-3" size="18">mdi-logout</v-icon>
                  로그아웃
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
      </nav>
    </header>

    <!-- 메인 콘텐츠 -->
    <main class="main-content">
      <!-- 히어로 섹션 -->
      <section class="hero-section">
        <div class="hero-background">
          <div class="gradient-overlay"></div>
          <div class="floating-shapes">
            <div class="shape shape-1"></div>
            <div class="shape shape-2"></div>
            <div class="shape shape-3"></div>
          </div>
        </div>
        
        <div class="hero-content">
          <div class="hero-text fade-in">
            <h1 class="hero-title">
              Real-time Data Sync
              <span class="text-gradient">Revolution</span>
            </h1>
            <p class="hero-subtitle">
              Apache NiFi 기반의 차세대 데이터 변경 추적 및 동기화 플랫폼으로 
              실시간 데이터 파이프라인을 구축하세요
            </p>
            
            <div class="hero-stats">
              <div class="stat-item">
                <div class="stat-number">99.9%</div>
                <div class="stat-label">Uptime</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">10M+</div>
                <div class="stat-label">Records/sec</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">50+</div>
                <div class="stat-label">Connectors</div>
              </div>
            </div>
            
            <div class="hero-actions">
              <button
                class="cta-button primary"
                @click="navigateToPage('systems')"
              >
                <v-icon size="20" class="mr-2">mdi-rocket-launch</v-icon>
                시작하기
              </button>
              <button
                class="cta-button secondary"
                @click="navigateToPage('monitoring')"
              >
                <v-icon size="20" class="mr-2">mdi-chart-timeline-variant</v-icon>
                모니터링 보기
              </button>
            </div>
          </div>
          
          <div class="hero-visual slide-up">
            <div class="dashboard-preview">
              <div class="preview-header">
                <div class="preview-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div class="preview-title">NiFiCDC Dashboard</div>
              </div>
              <div class="preview-content">
                <div class="chart-placeholder">
                  <v-icon size="60" color="primary">mdi-chart-line</v-icon>
                  <div class="chart-lines">
                    <div class="line line-1"></div>
                    <div class="line line-2"></div>
                    <div class="line line-3"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 기능 소개 섹션 -->
      <section class="features-section">
        <div class="section-container">
          <div class="section-header">
            <h2 class="section-title">
              Platform <span class="text-gradient">Features</span>
            </h2>
            <p class="section-subtitle">
              NiFiCDC가 제공하는 차세대 데이터 동기화 솔루션으로 
              비즈니스의 데이터 파이프라인을 혁신하세요
            </p>
          </div>

          <div class="features-grid">
            <div class="feature-card card-hover scale-in">
              <div class="feature-icon">
                <div class="icon-bg primary">
                  <v-icon size="32" color="white">mdi-server-network</v-icon>
                </div>
              </div>
              <div class="feature-content">
                <h3 class="feature-title">시스템 관리</h3>
                <p class="feature-description">
                  다양한 데이터베이스와 시스템을 통합 연결하고 관리합니다.
                  실시간 연결 테스트와 상태 모니터링으로 안정성을 보장합니다.
                </p>
                <div class="feature-benefits">
                  <span class="benefit-tag">50+ Connectors</span>
                  <span class="benefit-tag">Real-time Test</span>
                  <span class="benefit-tag">Auto Recovery</span>
                </div>
                <button 
                  class="feature-button"
                  @click="navigateToPage('systems')"
                >
                  <span>시작하기</span>
                  <v-icon size="16">mdi-arrow-right</v-icon>
                </button>
              </div>
            </div>

            <div class="feature-card card-hover scale-in" style="animation-delay: 0.1s">
              <div class="feature-icon">
                <div class="icon-bg success">
                  <v-icon size="32" color="white">mdi-shuffle-variant</v-icon>
                </div>
              </div>
              <div class="feature-content">
                <h3 class="feature-title">매핑 관리</h3>
                <p class="feature-description">
                  직관적인 비주얼 인터페이스로 데이터 변환 규칙을 설계하고 관리합니다.
                  복잡한 ETL 프로세스도 드래그 앤 드롭으로 간단하게 구성하세요.
                </p>
                <div class="feature-benefits">
                  <span class="benefit-tag">Visual Designer</span>
                  <span class="benefit-tag">Auto Mapping</span>
                  <span class="benefit-tag">Schema Evolution</span>
                </div>
                <button 
                  class="feature-button"
                  @click="navigateToPage('mappings')"
                >
                  <span>탐색하기</span>
                  <v-icon size="16">mdi-arrow-right</v-icon>
                </button>
              </div>
            </div>

            <div class="feature-card card-hover scale-in" style="animation-delay: 0.2s">
              <div class="feature-icon">
                <div class="icon-bg info">
                  <v-icon size="32" color="white">mdi-chart-timeline-variant</v-icon>
                </div>
              </div>
              <div class="feature-content">
                <h3 class="feature-title">실시간 모니터링</h3>
                <p class="feature-description">
                  고급 대시보드와 알림 시스템으로 데이터 파이프라인의 성능과 상태를
                  실시간으로 추적하고 최적화합니다.
                </p>
                <div class="feature-benefits">
                  <span class="benefit-tag">Live Metrics</span>
                  <span class="benefit-tag">Smart Alerts</span>
                  <span class="benefit-tag">Performance AI</span>
                </div>
                <button 
                  class="feature-button"
                  @click="navigateToPage('monitoring')"
                >
                  <span>모니터링</span>
                  <v-icon size="16">mdi-arrow-right</v-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>

    <!-- 모던 푸터 -->
    <footer class="modern-footer">
      <div class="footer-content">
        <div class="footer-brand">
          <h3 class="text-gradient">NiFiCDC</h3>
          <p>차세대 데이터 동기화 플랫폼</p>
        </div>
        <div class="footer-info">
          <p>© 2024 NiFiCDC Platform. Built with Vue.js, Node.js, and Apache NiFi.</p>
          <div class="footer-links">
            <a href="https://github.com/nineking424/nificdc" target="_blank">GitHub</a>
            <span>•</span>
            <a href="#" @click="navigateToPage('systems')">시작하기</a>
            <span>•</span>
            <a href="#" @click="navigateToPage('monitoring')">모니터링</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

export default {
  name: 'Home',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const toast = useToast()
    
    // 인증 상태 컴퓨티드
    const isAuthenticated = computed(() => authStore.isAuthenticated)
    const userName = computed(() => authStore.userName)
    
    // 로그인 페이지로 이동
    const goToLogin = () => {
      router.push({ name: 'Login' })
    }
    
    // 대시보드로 이동
    const goToDashboard = () => {
      router.push({ name: 'Dashboard' })
    }
    
    // 로그아웃
    const logout = async () => {
      try {
        await authStore.logout()
        toast.success('로그아웃되었습니다.')
        router.push({ name: 'Home' })
      } catch (error) {
        console.error('Logout error:', error)
        toast.error('로그아웃 중 오류가 발생했습니다.')
      }
    }
    
    // 페이지 네비게이션 (인증 상태 확인)
    const navigateToPage = (routeName) => {
      if (isAuthenticated.value) {
        // 로그인된 상태면 바로 이동
        router.push({ name: routeName })
      } else {
        // 로그인이 필요한 경우 로그인 페이지로 리다이렉트
        toast.info('로그인이 필요한 서비스입니다.')
        router.push({ 
          name: 'Login', 
          query: { redirect: router.resolve({ name: routeName }).fullPath }
        })
      }
    }
    
    return {
      isAuthenticated,
      userName,
      goToLogin,
      goToDashboard,
      logout,
      navigateToPage
    }
  }
}
</script>

<style scoped>
/* Home 페이지 전용 스타일 */
.home-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
}

/* 모던 헤더 */
.modern-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.5);
  transition: all 0.3s ease;
}

.nav-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-logo {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--primary-600), var(--primary-800));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-tagline {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--gray-700);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: var(--primary-600);
}

.auth-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-lg);
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
}

.login-btn {
  background: var(--primary-600);
  color: white;
}

.login-btn:hover {
  background: var(--primary-700);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.user-btn {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
}

.user-btn:hover {
  background: var(--gray-200);
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-100);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-dropdown {
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-lg) !important;
  border: 1px solid var(--gray-200) !important;
}

.dropdown-item {
  padding: 0.75rem 1rem !important;
  transition: background-color 0.2s ease !important;
}

.dropdown-item:hover {
  background-color: var(--gray-50) !important;
}

/* 메인 콘텐츠 */
.main-content {
  margin-top: 80px;
}

/* 히어로 섹션 */
.hero-section {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.hero-background {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--primary-50) 0%, var(--primary-100) 100%);
}

.gradient-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, 
    rgba(14, 165, 233, 0.1) 0%, 
    rgba(59, 130, 246, 0.05) 50%, 
    rgba(139, 92, 246, 0.1) 100%);
}

.floating-shapes {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.shape {
  position: absolute;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-400), var(--primary-600));
  opacity: 0.1;
  animation: float 20s infinite;
}

.shape-1 {
  width: 200px;
  height: 200px;
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.shape-2 {
  width: 150px;
  height: 150px;
  top: 60%;
  right: 15%;
  animation-delay: -7s;
}

.shape-3 {
  width: 100px;
  height: 100px;
  bottom: 20%;
  left: 60%;
  animation-delay: -14s;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-30px) rotate(120deg); }
  66% { transform: translateY(20px) rotate(240deg); }
}

.hero-content {
  position: relative;
  z-index: 10;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.hero-text {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 900;
  line-height: 1.1;
  color: var(--gray-900);
  margin: 0;
}

.hero-subtitle {
  font-size: 1.25rem;
  line-height: 1.6;
  color: var(--gray-600);
  max-width: 500px;
}

.hero-stats {
  display: flex;
  gap: 2rem;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary-600), var(--primary-800));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.cta-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  border-radius: var(--radius-xl);
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.cta-button.primary {
  background: var(--primary-600);
  color: white;
  box-shadow: var(--shadow-lg);
}

.cta-button.primary:hover {
  background: var(--primary-700);
  transform: translateY(-2px);
  box-shadow: var(--shadow-xl);
}

.cta-button.secondary {
  background: white;
  color: var(--primary-600);
  border: 2px solid var(--primary-600);
}

.cta-button.secondary:hover {
  background: var(--primary-50);
  transform: translateY(-2px);
}

.hero-visual {
  display: flex;
  justify-content: center;
  align-items: center;
}

.dashboard-preview {
  width: 100%;
  max-width: 500px;
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  border: 1px solid var(--gray-200);
  overflow: hidden;
  transform: perspective(1000px) rotateY(-15deg) rotateX(10deg);
}

.preview-header {
  padding: 1rem;
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.preview-dots {
  display: flex;
  gap: 0.5rem;
}

.preview-dots span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--gray-300);
}

.preview-dots span:nth-child(1) { background: var(--error-400); }
.preview-dots span:nth-child(2) { background: var(--warning-400); }
.preview-dots span:nth-child(3) { background: var(--success-400); }

.preview-title {
  font-weight: 600;
  color: var(--gray-700);
  font-size: 0.875rem;
}

.preview-content {
  padding: 2rem;
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.chart-placeholder {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-lines {
  position: absolute;
  width: 200px;
  height: 120px;
  opacity: 0.3;
}

.line {
  position: absolute;
  height: 2px;
  background: var(--primary-400);
  border-radius: 1px;
  animation: pulse 3s infinite;
}

.line-1 {
  width: 80px;
  top: 20px;
  left: 0;
  animation-delay: 0s;
}

.line-2 {
  width: 120px;
  top: 60px;
  left: 20px;
  animation-delay: 1s;
}

.line-3 {
  width: 100px;
  top: 100px;
  left: 40px;
  animation-delay: 2s;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scaleX(1); }
  50% { opacity: 0.8; transform: scaleX(1.1); }
}

/* 기능 섹션 */
.features-section {
  padding: 6rem 0;
  background: white;
}

.section-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
}

.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.section-title {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 1rem;
  color: var(--gray-900);
}

.section-subtitle {
  font-size: 1.25rem;
  color: var(--gray-600);
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: 2rem;
  border: 1px solid var(--gray-200);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary-400), var(--primary-600));
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.feature-card:hover::before {
  transform: scaleX(1);
}

.feature-icon {
  margin-bottom: 1.5rem;
}

.icon-bg {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.icon-bg.primary { background: var(--primary-600); }
.icon-bg.success { background: var(--success-600); }
.icon-bg.info { background: var(--primary-500); }

.feature-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feature-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.feature-description {
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0;
}

.feature-benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.benefit-tag {
  background: var(--gray-100);
  color: var(--gray-700);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
}

.feature-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--primary-50);
  color: var(--primary-700);
  border: 1px solid var(--primary-200);
  border-radius: var(--radius-lg);
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  cursor: pointer;
  align-self: flex-start;
  margin-top: auto;
}

.feature-button:hover {
  background: var(--primary-600);
  color: white;
  border-color: var(--primary-600);
  transform: translateY(-1px);
}

/* 모던 푸터 */
.modern-footer {
  background: var(--gray-900);
  color: white;
  padding: 3rem 0 2rem;
}

.footer-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 2rem;
}

.footer-brand h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 800;
}

.footer-brand p {
  margin: 0;
  color: var(--gray-400);
  font-size: 0.875rem;
}

.footer-info {
  text-align: right;
}

.footer-info p {
  margin: 0 0 0.5rem 0;
  color: var(--gray-400);
  font-size: 0.875rem;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}

.footer-links a {
  color: var(--gray-300);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-links a:hover {
  color: white;
}

.footer-links span {
  color: var(--gray-600);
}

/* 반응형 디자인 */
@media (max-width: 1024px) {
  .hero-content {
    grid-template-columns: 1fr;
    gap: 3rem;
    text-align: center;
  }
  
  .hero-title {
    font-size: 2.5rem;
  }
  
  .dashboard-preview {
    transform: none;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .nav-container {
    padding: 1rem;
  }
  
  .brand-tagline {
    display: none;
  }
  
  .hero-title {
    font-size: 2rem;
  }
  
  .hero-subtitle {
    font-size: 1rem;
  }
  
  .hero-stats {
    justify-content: center;
  }
  
  .section-title {
    font-size: 2rem;
  }
  
  .section-subtitle {
    font-size: 1rem;
  }
  
  .footer-content {
    flex-direction: column;
    text-align: center;
  }
  
  .footer-info {
    text-align: center;
  }
}

@media (max-width: 640px) {
  .hero-actions {
    justify-content: center;
  }
  
  .cta-button {
    padding: 0.875rem 1.5rem;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
  
  .feature-card {
    padding: 1.5rem;
  }
}
</style>