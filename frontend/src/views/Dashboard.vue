<template>
  <AppLayout>
    <div class="dashboard-container">
      <!-- Clean Header -->
      <div class="dashboard-header">
        <div class="header-content">
          <h1 class="page-title">대시보드</h1>
          <p class="page-subtitle">실시간 시스템 상태와 성능 지표를 모니터링합니다</p>
        </div>
        <div class="header-actions">
          <button class="clean-button clean-button-secondary" @click="refreshDashboard">
            <v-icon size="18">mdi-refresh</v-icon>
            새로고침
          </button>
        </div>
      </div>

      <!-- System Status Grid -->
      <div class="status-grid">
        <div class="status-card" :class="'status-' + getStatusType('api')">
          <div class="status-icon">
            <v-icon size="32">mdi-server</v-icon>
          </div>
          <div class="status-content">
            <h3 class="status-title">Backend API</h3>
            <div class="status-badge success">정상 운영</div>
            <div class="status-metrics">
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
        </div>

        <div class="status-card" :class="'status-' + getStatusType('database')">
          <div class="status-icon">
            <v-icon size="32">mdi-database</v-icon>
          </div>
          <div class="status-content">
            <h3 class="status-title">Database</h3>
            <div class="status-badge success">연결됨</div>
            <div class="status-metrics">
              <div class="metric">
                <span class="metric-value">1,234</span>
                <span class="metric-label">쿼리/초</span>
              </div>
              <div class="metric">
                <span class="metric-value">25ms</span>
                <span class="metric-label">지연시간</span>
              </div>
            </div>
          </div>
        </div>

        <div class="status-card" :class="'status-' + getStatusType('cache')">
          <div class="status-icon">
            <v-icon size="32">mdi-memory</v-icon>
          </div>
          <div class="status-content">
            <h3 class="status-title">Redis Cache</h3>
            <div class="status-badge success">캐시 활성</div>
            <div class="status-metrics">
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
        </div>

        <div class="status-card" :class="'status-' + getStatusType('nifi')">
          <div class="status-icon">
            <v-icon size="32">mdi-apache</v-icon>
          </div>
          <div class="status-content">
            <h3 class="status-title">Apache NiFi</h3>
            <div class="status-badge warning">설정 필요</div>
            <div class="status-metrics">
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
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="content-grid">
        <!-- Performance Chart -->
        <div class="chart-section clean-card">
          <div class="section-header">
            <h2 class="section-title">시스템 성능</h2>
            <div class="time-filter">
              <button 
                v-for="filter in timeFilters" 
                :key="filter.value"
                class="filter-button"
                :class="{ active: timeFilter === filter.value }"
                @click="timeFilter = filter.value"
              >
                {{ filter.label }}
              </button>
            </div>
          </div>
          <div class="chart-placeholder">
            <v-icon size="48" color="var(--gray-300)">mdi-chart-line</v-icon>
            <p class="placeholder-title">성능 모니터링</p>
            <p class="placeholder-text">실시간 모니터링 차트는 개발 중입니다</p>
            <div class="metric-chips">
              <span class="chip">CPU</span>
              <span class="chip">Memory</span>
              <span class="chip">Network</span>
              <span class="chip">Disk I/O</span>
            </div>
          </div>
        </div>

        <!-- Side Panel -->
        <div class="side-panel">
          <!-- Recent Activities -->
          <div class="activity-section clean-card">
            <div class="section-header">
              <h3 class="section-title">최근 활동</h3>
              <button class="clean-button clean-button-text">모두 보기</button>
            </div>
            <div class="activity-list">
              <div class="activity-item">
                <div class="activity-icon success">
                  <v-icon size="20">mdi-check-circle</v-icon>
                </div>
                <div class="activity-content">
                  <p class="activity-title">시스템 정상 가동</p>
                  <p class="activity-time">방금 전</p>
                </div>
              </div>
              <div class="activity-item">
                <div class="activity-icon info">
                  <v-icon size="20">mdi-database</v-icon>
                </div>
                <div class="activity-content">
                  <p class="activity-title">데이터베이스 연결 성공</p>
                  <p class="activity-time">5분 전</p>
                </div>
              </div>
              <div class="activity-item">
                <div class="activity-icon warning">
                  <v-icon size="20">mdi-alert</v-icon>
                </div>
                <div class="activity-content">
                  <p class="activity-title">NiFi 설정 필요</p>
                  <p class="activity-time">1시간 전</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="actions-section clean-card">
            <h3 class="section-title">빠른 작업</h3>
            <div class="action-grid">
              <button class="action-button" @click="navigateTo('/systems')">
                <v-icon size="24">mdi-plus</v-icon>
                <span>시스템 추가</span>
              </button>
              <button class="action-button" @click="navigateTo('/mappings/new')">
                <v-icon size="24">mdi-shuffle-variant</v-icon>
                <span>매핑 생성</span>
              </button>
              <button class="action-button" @click="navigateTo('/jobs')">
                <v-icon size="24">mdi-play</v-icon>
                <span>작업 실행</span>
              </button>
              <button class="action-button" @click="navigateTo('/monitoring')">
                <v-icon size="24">mdi-chart-line</v-icon>
                <span>모니터링</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Getting Started Guide -->
      <div class="guide-section">
        <h2 class="section-title">빠른 시작 가이드</h2>
        <p class="section-subtitle">단계별로 따라하며 NiFiCDC를 시작하세요</p>
        
        <div class="guide-grid">
          <div class="guide-card clean-card">
            <div class="guide-number">1</div>
            <h3 class="guide-title">시스템 연결</h3>
            <p class="guide-text">데이터베이스와 외부 시스템을 연결하여 데이터 소스를 설정합니다</p>
            <div class="guide-tags">
              <span class="tag">다중 DB 지원</span>
              <span class="tag">실시간 테스트</span>
            </div>
            <button class="clean-button clean-button-primary">시작하기</button>
          </div>

          <div class="guide-card clean-card">
            <div class="guide-number">2</div>
            <h3 class="guide-title">매핑 설정</h3>
            <p class="guide-text">데이터 변환 규칙을 정의하고 스키마 매핑을 설정합니다</p>
            <div class="guide-tags">
              <span class="tag">드래그 & 드롭</span>
              <span class="tag">자동 매핑</span>
            </div>
            <button class="clean-button clean-button-primary">시작하기</button>
          </div>

          <div class="guide-card clean-card">
            <div class="guide-number">3</div>
            <h3 class="guide-title">작업 실행</h3>
            <p class="guide-text">데이터 동기화 작업을 생성하고 스케줄링을 설정합니다</p>
            <div class="guide-tags">
              <span class="tag">자동 스케줄</span>
              <span class="tag">실시간 모니터링</span>
            </div>
            <button class="clean-button clean-button-primary">시작하기</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script>
import AppLayout from '@/components/AppLayout.vue'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

export default {
  name: 'Dashboard',
  components: {
    AppLayout
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const toast = useToast()
    
    const timeFilter = ref('1h')
    const timeFilters = [
      { value: '1h', label: '1시간' },
      { value: '24h', label: '24시간' },
      { value: '7d', label: '7일' }
    ]
    
    const getStatusType = (service) => {
      const statusMap = {
        api: 'success',
        database: 'success',
        cache: 'success',
        nifi: 'warning'
      }
      return statusMap[service] || 'default'
    }
    
    const refreshDashboard = () => {
      toast.success('대시보드가 새로고침되었습니다')
    }
    
    const navigateTo = (path) => {
      router.push(path)
    }
    
    return {
      timeFilter,
      timeFilters,
      getStatusType,
      refreshDashboard,
      navigateTo
    }
  }
}
</script>

<style scoped>
.dashboard-container {
  padding: var(--space-6);
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-8);
}

.page-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin: 0;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--gray-600);
  margin-top: var(--space-2);
}

/* Status Grid */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.status-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  border: 1px solid var(--gray-100);
  display: flex;
  gap: var(--space-4);
  transition: all var(--transition-base);
}

.status-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.status-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gray-50);
  flex-shrink: 0;
}

.status-success .status-icon {
  background: var(--success-soft);
  color: var(--success);
}

.status-warning .status-icon {
  background: var(--warning-soft);
  color: var(--warning);
}

.status-content {
  flex: 1;
}

.status-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.status-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-3);
}

.status-badge.success {
  background: var(--success-soft);
  color: var(--success);
}

.status-badge.warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.status-metrics {
  display: flex;
  gap: var(--space-6);
}

.metric {
  display: flex;
  flex-direction: column;
}

.metric-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
}

.metric-label {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

/* Chart Section */
.chart-section {
  min-height: 400px;
}

.time-filter {
  display: flex;
  gap: var(--space-1);
}

.filter-button {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-300);
  background: var(--white);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-base);
}

.filter-button:hover {
  background: var(--gray-50);
}

.filter-button.active {
  background: var(--primary);
  color: var(--white);
  border-color: var(--primary);
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  text-align: center;
}

.placeholder-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-medium);
  color: var(--gray-700);
  margin: var(--space-3) 0 var(--space-2);
}

.placeholder-text {
  color: var(--gray-600);
  margin-bottom: var(--space-4);
}

.metric-chips {
  display: flex;
  gap: var(--space-2);
}

.chip {
  padding: var(--space-1) var(--space-3);
  background: var(--gray-100);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  color: var(--gray-700);
}

/* Side Panel */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Activity Section */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.activity-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--gray-100);
}

.activity-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.activity-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-icon.success {
  background: var(--success-soft);
  color: var(--success);
}

.activity-icon.info {
  background: var(--info-soft);
  color: var(--info);
}

.activity-icon.warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--gray-900);
  margin: 0;
}

.activity-time {
  font-size: var(--font-size-xs);
  color: var(--gray-600);
  margin: var(--space-1) 0 0;
}

/* Action Grid */
.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-base);
}

.action-button:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

/* Guide Section */
.guide-section {
  margin-top: var(--space-12);
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-6);
  margin-top: var(--space-6);
}

.guide-card {
  position: relative;
  padding: var(--space-8) var(--space-6) var(--space-6);
}

.guide-number {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  width: 40px;
  height: 40px;
  background: var(--primary);
  color: var(--white);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-bold);
}

.guide-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-3);
}

.guide-text {
  font-size: var(--font-size-base);
  color: var(--gray-600);
  line-height: 1.6;
  margin-bottom: var(--space-4);
}

.guide-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.tag {
  padding: var(--space-1) var(--space-2);
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

/* Responsive */
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .side-panel {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-6);
  }
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: var(--space-4);
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .side-panel {
    grid-template-columns: 1fr;
  }
  
  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>