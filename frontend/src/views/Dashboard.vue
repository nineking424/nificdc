<template>
  <div class="dashboard-container">
    <!-- 모던 대시보드 헤더 -->
    <header class="dashboard-header">
      <div class="header-content">
        <div class="header-main">
          <div class="welcome-section">
            <h1 class="dashboard-title">
              <v-icon size="32" color="primary" class="mr-3">mdi-view-dashboard</v-icon>
              대시보드
            </h1>
            <p class="dashboard-subtitle">
              실시간 시스템 상태와 성능 지표를 모니터링합니다
            </p>
            <div class="welcome-info">
              <span class="user-greeting">안녕하세요, {{ userName }}!</span>
              <span class="last-updated">마지막 업데이트: {{ lastUpdated }}</span>
            </div>
          </div>
          
          <div class="header-actions">
            <button class="action-button primary" @click="refreshDashboard">
              <v-icon size="20" class="mr-2">mdi-refresh</v-icon>
              새로고침
            </button>
            <button class="action-button secondary" @click="openSettings">
              <v-icon size="20" class="mr-2">mdi-cog</v-icon>
              설정
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- 메인 콘텐츠 -->
    <main class="dashboard-main">

      <!-- 시스템 상태 카드 그리드 -->
      <section class="status-section">
        <h2 class="section-title">시스템 상태</h2>
        <div class="status-grid">
          <div class="status-card success animate-card" style="animation-delay: 0ms">
            <div class="card-icon success">
              <v-icon size="32" color="white">mdi-server</v-icon>
            </div>
            <div class="card-content">
              <h3 class="card-title">Backend API</h3>
              <p class="card-status success">정상 운영</p>
              <div class="card-metrics">
                <div class="metric">
                  <span class="metric-value">99.9%</span>
                  <span class="metric-label">Uptime</span>
                </div>
                <div class="metric">
                  <span class="metric-value">45ms</span>
                  <span class="metric-label">응답시간</span>
                </div>
              </div>
            </div>
            <div class="card-indicator success"></div>
          </div>

          <div class="status-card info animate-card" style="animation-delay: 100ms">
            <div class="card-icon info">
              <v-icon size="32" color="white">mdi-database</v-icon>
            </div>
            <div class="card-content">
              <h3 class="card-title">Database</h3>
              <p class="card-status success">연결됨</p>
              <div class="card-metrics">
                <div class="metric">
                  <span class="metric-value">1,234</span>
                  <span class="metric-label">쿠리/초</span>
                </div>
                <div class="metric">
                  <span class="metric-value">25ms</span>
                  <span class="metric-label">지연시간</span>
                </div>
              </div>
            </div>
            <div class="card-indicator info"></div>
          </div>

          <div class="status-card primary animate-card" style="animation-delay: 200ms">
            <div class="card-icon primary">
              <v-icon size="32" color="white">mdi-memory</v-icon>
            </div>
            <div class="card-content">
              <h3 class="card-title">Redis Cache</h3>
              <p class="card-status success">캐시 활성</p>
              <div class="card-metrics">
                <div class="metric">
                  <span class="metric-value">78%</span>
                  <span class="metric-label">사용률</span>
                </div>
                <div class="metric">
                  <span class="metric-value">15K</span>
                  <span class="metric-label">키 수</span>
                </div>
              </div>
            </div>
            <div class="card-indicator primary"></div>
          </div>

          <div class="status-card warning animate-card" style="animation-delay: 300ms">
            <div class="card-icon warning">
              <v-icon size="32" color="white">mdi-apache</v-icon>
            </div>
            <div class="card-content">
              <h3 class="card-title">Apache NiFi</h3>
              <p class="card-status warning">설정 필요</p>
              <div class="card-metrics">
                <div class="metric">
                  <span class="metric-value">0</span>
                  <span class="metric-label">플로우</span>
                </div>
                <div class="metric">
                  <span class="metric-value">-</span>
                  <span class="metric-label">상태</span>
                </div>
              </div>
            </div>
            <div class="card-indicator warning"></div>
          </div>
        </div>
      </section>

      <!-- 메인 대시보드 콘텐츠 -->
      <div class="dashboard-content">
        <!-- 성능 차트 섹션 -->
        <section class="performance-section">
          <div class="performance-card">
            <div class="card-header">
              <div class="header-info">
                <h2 class="card-title">
                  <v-icon size="24" color="primary" class="mr-2">mdi-chart-line</v-icon>
                  시스템 성능
                </h2>
                <p class="card-subtitle">실시간 성능 메트릭 및 트렌드</p>
              </div>
              <div class="chart-controls">
                <button class="time-filter active" @click="setTimeFilter('1h')">1시간</button>
                <button class="time-filter" @click="setTimeFilter('24h')">24시간</button>
                <button class="time-filter" @click="setTimeFilter('7d')">7일</button>
              </div>
            </div>
            
            <div class="chart-container">
              <div class="chart-placeholder">
                <div class="chart-icon">
                  <v-icon size="60" color="primary-400">mdi-chart-timeline-variant</v-icon>
                </div>
                <div class="chart-lines">
                  <div class="performance-line line-1"></div>
                  <div class="performance-line line-2"></div>
                  <div class="performance-line line-3"></div>
                  <div class="performance-line line-4"></div>
                </div>
                <div class="chart-labels">
                  <div class="chart-label">CPU</div>
                  <div class="chart-label">Memory</div>
                  <div class="chart-label">Network</div>
                  <div class="chart-label">Disk I/O</div>
                </div>
              </div>
              
              <div class="development-notice">
                <div class="notice-content">
                  <v-icon size="24" color="info" class="mr-2">mdi-information</v-icon>
                  <span>실시간 모니터링 차트는 개발 중입니다.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 알림 및 활동 섹션 -->
        <aside class="activity-section">
          <!-- 최근 알림 -->
          <div class="activity-card">
            <div class="card-header">
              <h3 class="card-title">
                <v-icon size="20" color="primary" class="mr-2">mdi-bell-outline</v-icon>
                최근 알림
              </h3>
              <button class="view-all-btn">모두 보기</button>
            </div>
            
            <div class="notifications-list">
              <div class="notification-item success">
                <div class="notification-icon">
                  <v-icon size="16" color="white">mdi-check-circle</v-icon>
                </div>
                <div class="notification-content">
                  <h4 class="notification-title">시스템 정상 가동</h4>
                  <p class="notification-time">방금 전</p>
                </div>
              </div>
              
              <div class="notification-item info">
                <div class="notification-icon">
                  <v-icon size="16" color="white">mdi-information</v-icon>
                </div>
                <div class="notification-content">
                  <h4 class="notification-title">데이터베이스 연결 성공</h4>
                  <p class="notification-time">5분 전</p>
                </div>
              </div>
              
              <div class="notification-item warning">
                <div class="notification-icon">
                  <v-icon size="16" color="white">mdi-alert</v-icon>
                </div>
                <div class="notification-content">
                  <h4 class="notification-title">NiFi 설정 필요</h4>
                  <p class="notification-time">1시간 전</p>
                </div>
              </div>
              
              <div class="notification-item primary">
                <div class="notification-icon">
                  <v-icon size="16" color="white">mdi-sync</v-icon>
                </div>
                <div class="notification-content">
                  <h4 class="notification-title">데이터 동기화 완료</h4>
                  <p class="notification-time">2시간 전</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 빠른 작업 -->
          <div class="activity-card">
            <div class="card-header">
              <h3 class="card-title">
                <v-icon size="20" color="primary" class="mr-2">mdi-lightning-bolt</v-icon>
                빠른 작업
              </h3>
            </div>
            
            <div class="quick-actions">
              <button class="quick-action-btn" @click="$router.push('/systems')">
                <v-icon size="20" class="mr-2">mdi-server-plus</v-icon>
                시스템 추가
              </button>
              <button class="quick-action-btn" @click="$router.push('/mappings')">
                <v-icon size="20" class="mr-2">mdi-vector-link</v-icon>
                매핑 생성
              </button>
              <button class="quick-action-btn" @click="$router.push('/jobs')">
                <v-icon size="20" class="mr-2">mdi-play-circle</v-icon>
                작업 실행
              </button>
              <button class="quick-action-btn" @click="$router.push('/monitoring')">
                <v-icon size="20" class="mr-2">mdi-monitor-dashboard</v-icon>
                모니터링
              </button>
            </div>
          </div>
        </aside>
      </div>

      <!-- 빠른 시작 가이드 -->
      <section class="guide-section">
        <div class="guide-header">
          <h2 class="section-title">
            <v-icon size="24" color="primary" class="mr-2">mdi-rocket-launch</v-icon>
            빠른 시작 가이드
          </h2>
          <p class="section-subtitle">단계별로 따라하며 NiFiCDC를 시작하세요</p>
        </div>
        
        <div class="guide-grid">
          <div class="guide-card animate-card" style="animation-delay: 0ms">
            <div class="guide-number">1</div>
            <div class="guide-icon primary">
              <v-icon size="32" color="white">mdi-server-network</v-icon>
            </div>
            <div class="guide-content">
              <h3 class="guide-title">시스템 연결</h3>
              <p class="guide-description">
                데이터베이스와 외부 시스템을 연결하여 데이터 소스를 설정합니다.
              </p>
              <div class="guide-features">
                <span class="feature-tag">다중 DB 지원</span>
                <span class="feature-tag">실시간 테스트</span>
                <span class="feature-tag">암호화 연결</span>
              </div>
              <button class="guide-button" @click="$router.push('/systems')">
                시작하기
                <v-icon size="16" class="ml-2">mdi-arrow-right</v-icon>
              </button>
            </div>
          </div>
          
          <div class="guide-card animate-card" style="animation-delay: 100ms">
            <div class="guide-number">2</div>
            <div class="guide-icon success">
              <v-icon size="32" color="white">mdi-vector-link</v-icon>
            </div>
            <div class="guide-content">
              <h3 class="guide-title">매핑 설정</h3>
              <p class="guide-description">
                데이터 변환 규칙을 정의하고 스키마 매핑을 설정합니다.
              </p>
              <div class="guide-features">
                <span class="feature-tag">드래그 & 드롭</span>
                <span class="feature-tag">자동 매핑</span>
                <span class="feature-tag">구조 변환</span>
              </div>
              <button class="guide-button" @click="$router.push('/mappings')">
                시작하기
                <v-icon size="16" class="ml-2">mdi-arrow-right</v-icon>
              </button>
            </div>
          </div>
          
          <div class="guide-card animate-card" style="animation-delay: 200ms">
            <div class="guide-number">3</div>
            <div class="guide-icon info">
              <v-icon size="32" color="white">mdi-play-circle</v-icon>
            </div>
            <div class="guide-content">
              <h3 class="guide-title">작업 실행</h3>
              <p class="guide-description">
                데이터 동기화 작업을 생성하고 스케줄링을 설정합니다.
              </p>
              <div class="guide-features">
                <span class="feature-tag">자동 스케줄</span>
                <span class="feature-tag">실시간 모니터링</span>
                <span class="feature-tag">오류 복구</span>
              </div>
              <button class="guide-button" @click="$router.push('/jobs')">
                시작하기
                <v-icon size="16" class="ml-2">mdi-arrow-right</v-icon>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

export default {
  name: 'Dashboard',
  setup() {
    const authStore = useAuthStore()
    const toast = useToast()
    
    // 반응형 데이터
    const timeFilter = ref('1h')
    const lastUpdated = ref(new Date().toLocaleString('ko-KR'))
    
    // 계산된 속성
    const userName = computed(() => {
      return authStore.user?.name || authStore.user?.email || '사용자'
    })
    
    // 메서드
    const refreshDashboard = () => {
      lastUpdated.value = new Date().toLocaleString('ko-KR')
      toast.success('대시보드가 새로고침되었습니다.')
    }
    
    const openSettings = () => {
      toast.info('대시보드 설정 기능은 개발 예정입니다.')
    }
    
    const setTimeFilter = (filter) => {
      timeFilter.value = filter
      toast.info(`시간 필터가 ${filter}로 설정되었습니다.`)
    }
    
    // 라이프사이클
    onMounted(() => {
      // 대시보드 초기 데이터 로드
      console.log('Dashboard mounted')
    })
    
    return {
      userName,
      lastUpdated,
      timeFilter,
      refreshDashboard,
      openSettings,
      setTimeFilter
    }
  }
}
</script>

<style scoped>
/* 대시보드 메인 컨테이너 */
.dashboard-container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--gray-50) 0%, var(--primary-50) 100%);
}

/* 대시보드 헤더 */
.dashboard-header {
  background: white;
  border-bottom: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
}

.header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.welcome-section {
  flex: 1;
}

.dashboard-title {
  font-size: 2.5rem;
  font-weight: 900;
  color: var(--gray-900);
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
}

.dashboard-subtitle {
  font-size: 1.125rem;
  color: var(--gray-600);
  margin: 0 0 1rem 0;
  line-height: 1.6;
}

.welcome-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-greeting {
  font-size: 1rem;
  font-weight: 600;
  color: var(--primary-700);
}

.last-updated {
  font-size: 0.875rem;
  color: var(--gray-500);
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

/* 대시보드 메인 */
.dashboard-main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

/* 섹션 공통 스타일 */
.section-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--gray-900);
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
}

.section-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  margin: 0;
  line-height: 1.6;
}

/* 시스템 상태 섹션 */
.status-section {
  margin-bottom: 1rem;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.status-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: 2rem;
  border: 1px solid var(--gray-200);
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
}

.status-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.card-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 10;
}

.card-icon.success { background: var(--success-600); }
.card-icon.info { background: var(--primary-600); }
.card-icon.primary { background: var(--primary-700); }
.card-icon.warning { background: var(--warning-600); }

.card-content {
  position: relative;
  z-index: 10;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 0.5rem 0;
}

.card-status {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 1.5rem 0;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  display: inline-block;
}

.card-status.success {
  background: var(--success-100);
  color: var(--success-800);
}

.card-status.warning {
  background: var(--warning-100);
  color: var(--warning-800);
}

.card-metrics {
  display: flex;
  gap: 2rem;
}

.metric {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-indicator {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  border-radius: 0 var(--radius-2xl) var(--radius-2xl) 0;
}

.card-indicator.success { background: var(--success-500); }
.card-indicator.info { background: var(--primary-500); }
.card-indicator.primary { background: var(--primary-600); }
.card-indicator.warning { background: var(--warning-500); }

/* 대시보드 콘텐츠 레이아웃 */
.dashboard-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  align-items: start;
}

/* 성능 섹션 */
.performance-section {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
  overflow: hidden;
}

.performance-card .card-header {
  padding: 2rem 2rem 1rem 2rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-info .card-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
}

.header-info .card-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  margin: 0;
}

.chart-controls {
  display: flex;
  gap: 0.5rem;
  background: var(--gray-100);
  border-radius: var(--radius-lg);
  padding: 0.25rem;
}

.time-filter {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  cursor: pointer;
  transition: all 0.2s ease;
}

.time-filter.active {
  background: white;
  color: var(--primary-600);
  box-shadow: var(--shadow-sm);
}

.time-filter:hover:not(.active) {
  background: var(--gray-200);
}

.chart-container {
  padding: 2rem;
  position: relative;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.chart-placeholder {
  position: relative;
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-icon {
  position: relative;
  z-index: 10;
}

.chart-lines {
  position: absolute;
  inset: 0;
  opacity: 0.3;
}

.performance-line {
  position: absolute;
  height: 2px;
  background: var(--primary-400);
  border-radius: 1px;
  animation: pulseChart 3s infinite;
}

.line-1 {
  width: 40%;
  top: 20%;
  left: 10%;
  animation-delay: 0s;
}

.line-2 {
  width: 60%;
  top: 40%;
  left: 20%;
  animation-delay: 0.5s;
}

.line-3 {
  width: 50%;
  top: 60%;
  left: 15%;
  animation-delay: 1s;
}

.line-4 {
  width: 70%;
  top: 80%;
  left: 5%;
  animation-delay: 1.5s;
}

@keyframes pulseChart {
  0%, 100% { opacity: 0.3; transform: scaleX(1); }
  50% { opacity: 0.8; transform: scaleX(1.1); }
}

.chart-labels {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
}

.chart-label {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  background: var(--gray-100);
  border-radius: var(--radius-sm);
}

.development-notice {
  margin-top: 2rem;
  padding: 1rem;
  background: var(--primary-50);
  border: 1px solid var(--primary-200);
  border-radius: var(--radius-lg);
}

.notice-content {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-700);
  font-size: 0.875rem;
  font-weight: 500;
}

/* 활동 섹션 */
.activity-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.activity-card {
  background: white;
  border-radius: var(--radius-2xl);
  border: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.activity-card .card-header {
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.activity-card .card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
  display: flex;
  align-items: center;
}

.view-all-btn {
  background: none;
  border: none;
  color: var(--primary-600);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.view-all-btn:hover {
  background: var(--primary-50);
  color: var(--primary-700);
}

/* 알림 목록 */
.notifications-list {
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notification-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem;
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
}

.notification-item:hover {
  background: var(--gray-50);
}

.notification-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-item.success .notification-icon {
  background: var(--success-600);
}

.notification-item.info .notification-icon {
  background: var(--primary-600);
}

.notification-item.warning .notification-icon {
  background: var(--warning-600);
}

.notification-item.primary .notification-icon {
  background: var(--primary-700);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 0.25rem 0;
  line-height: 1.4;
}

.notification-time {
  font-size: 0.75rem;
  color: var(--gray-500);
  margin: 0;
}

/* 빠른 작업 */
.quick-actions {
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.quick-action-btn:hover {
  background: var(--primary-50);
  border-color: var(--primary-200);
  color: var(--primary-700);
  transform: translateX(4px);
}

/* 가이드 섹션 */
.guide-section {
  background: white;
  border-radius: var(--radius-2xl);
  padding: 2rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
}

.guide-header {
  text-align: center;
  margin-bottom: 3rem;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 2rem;
}

.guide-card {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-2xl);
  padding: 2rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.guide-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  background: white;
}

.guide-number {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  width: 32px;
  height: 32px;
  background: var(--primary-100);
  color: var(--primary-700);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.875rem;
}

.guide-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.guide-icon.primary { background: var(--primary-600); }
.guide-icon.success { background: var(--success-600); }
.guide-icon.info { background: var(--primary-700); }

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.guide-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.guide-description {
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0;
}

.guide-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.feature-tag {
  background: var(--gray-200);
  color: var(--gray-700);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
}

.guide-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--primary-600);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: auto;
}

.guide-button:hover {
  background: var(--primary-700);
  transform: translateY(-1px);
}

/* 공통 버튼 스타일 */
.action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-lg);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
}

.action-button.primary {
  background: var(--primary-600);
  color: white;
}

.action-button.primary:hover {
  background: var(--primary-700);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.action-button.secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
}

.action-button.secondary:hover {
  background: var(--gray-200);
  transform: translateY(-1px);
}

/* 애니메이션 */
.animate-card {
  animation: slideInUp 0.6s ease-out;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 반응형 디자인 */
@media (max-width: 1024px) {
  .header-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 2rem;
  }
  
  .dashboard-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  
  .status-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }
  
  .guide-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-main {
    padding: 1rem;
  }
  
  .header-content {
    padding: 1.5rem 1rem;
  }
  
  .dashboard-title {
    font-size: 2rem;
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .status-card {
    padding: 1.5rem;
  }
  
  .card-metrics {
    gap: 1rem;
  }
  
  .performance-card .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .chart-controls {
    width: 100%;
    justify-content: center;
  }
  
  .guide-section {
    padding: 1.5rem;
  }
  
  .guide-card {
    padding: 1.5rem;
  }
}

@media (max-width: 640px) {
  .action-button {
    padding: 0.625rem 1.25rem;
    font-size: 0.8rem;
  }
  
  .header-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .action-button {
    justify-content: center;
  }
}
</style>