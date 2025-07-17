<template>
  <AppLayout>
    <div class="job-container">
      <!-- Clean Header -->
      <div class="job-header">
        <div class="header-content">
          <h1 class="page-title">작업 관리</h1>
          <p class="page-subtitle">데이터 동기화 작업을 관리하고 모니터링합니다</p>
        </div>
        <button class="clean-button clean-button-primary" @click="showAlert">
          <v-icon size="18">mdi-plus</v-icon>
          새 작업 생성
        </button>
      </div>

      <!-- Info Alert -->
      <div class="info-alert clean-card">
        <div class="alert-icon">
          <v-icon size="24" color="info">mdi-information</v-icon>
        </div>
        <div class="alert-content">
          <h3 class="alert-title">작업 관리 페이지</h3>
          <p class="alert-text">작업 관리 기능은 현재 개발 중입니다.</p>
          <div class="alert-features">
            <h4>예정된 기능:</h4>
            <ul>
              <li>데이터 동기화 작업 생성 및 관리</li>
              <li>작업 스케줄링 및 실행</li>
              <li>작업 모니터링 및 로그 확인</li>
              <li>작업 성능 분석 및 최적화</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Job Status Cards -->
      <div class="status-grid">
        <div class="status-card success">
          <div class="status-icon">
            <v-icon size="48">mdi-check-circle</v-icon>
          </div>
          <div class="status-content">
            <div class="status-value">3</div>
            <div class="status-label">실행 중</div>
          </div>
        </div>

        <div class="status-card warning">
          <div class="status-icon">
            <v-icon size="48">mdi-pause-circle</v-icon>
          </div>
          <div class="status-content">
            <div class="status-value">2</div>
            <div class="status-label">대기 중</div>
          </div>
        </div>

        <div class="status-card error">
          <div class="status-icon">
            <v-icon size="48">mdi-alert-circle</v-icon>
          </div>
          <div class="status-content">
            <div class="status-value">0</div>
            <div class="status-label">실패</div>
          </div>
        </div>

        <div class="status-card info">
          <div class="status-icon">
            <v-icon size="48">mdi-clock-outline</v-icon>
          </div>
          <div class="status-content">
            <div class="status-value">1</div>
            <div class="status-label">예약됨</div>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="content-grid">
        <!-- Recent Jobs -->
        <div class="recent-jobs clean-card">
          <div class="section-header">
            <h2 class="section-title">최근 작업</h2>
            <button class="clean-button clean-button-text" @click="showAlert">
              모든 작업 보기
            </button>
          </div>

          <div class="job-list">
            <div class="job-item">
              <div class="job-icon success">
                <v-icon size="24">mdi-database-sync</v-icon>
              </div>
              <div class="job-info">
                <h4 class="job-name">사용자 데이터 동기화</h4>
                <p class="job-details">PostgreSQL → MySQL | 실행 중 (85% 완료)</p>
              </div>
              <div class="job-status">
                <span class="status-badge success">실행 중</span>
              </div>
            </div>

            <div class="job-item">
              <div class="job-icon warning">
                <v-icon size="24">mdi-database-sync</v-icon>
              </div>
              <div class="job-info">
                <h4 class="job-name">주문 데이터 ETL</h4>
                <p class="job-details">Oracle → PostgreSQL | 다음 실행: 15:00</p>
              </div>
              <div class="job-status">
                <span class="status-badge warning">대기 중</span>
              </div>
            </div>

            <div class="job-item">
              <div class="job-icon info">
                <v-icon size="24">mdi-database-sync</v-icon>
              </div>
              <div class="job-info">
                <h4 class="job-name">로그 아카이빙</h4>
                <p class="job-details">MySQL → S3 | 매일 자정 실행</p>
              </div>
              <div class="job-status">
                <span class="status-badge info">예약됨</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Performance Metrics -->
        <div class="performance-section">
          <!-- Performance Chart -->
          <div class="performance-chart clean-card">
            <div class="section-header">
              <h2 class="section-title">작업 성능 추이</h2>
            </div>
            <div class="chart-placeholder">
              <v-icon size="64" color="var(--gray-300)">mdi-chart-line</v-icon>
              <h3>성능 차트</h3>
              <p>작업 성능 차트는 개발 중입니다.</p>
            </div>
          </div>

          <!-- Performance Indicators -->
          <div class="performance-indicators clean-card">
            <div class="section-header">
              <h2 class="section-title">성능 지표</h2>
            </div>
            
            <div class="metric-list">
              <div class="metric-item">
                <div class="metric-header">
                  <span class="metric-label">평균 처리 시간</span>
                  <span class="metric-value">2.3초</span>
                </div>
                <div class="metric-progress">
                  <div class="progress-bar" style="width: 65%"></div>
                </div>
              </div>

              <div class="metric-item">
                <div class="metric-header">
                  <span class="metric-label">성공률</span>
                  <span class="metric-value success">98.5%</span>
                </div>
                <div class="metric-progress">
                  <div class="progress-bar success" style="width: 98.5%"></div>
                </div>
              </div>

              <div class="metric-item">
                <div class="metric-header">
                  <span class="metric-label">처리량 (records/min)</span>
                  <span class="metric-value">1,250</span>
                </div>
                <div class="metric-progress">
                  <div class="progress-bar info" style="width: 80%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script>
import AppLayout from '@/components/AppLayout.vue'
import { useToast } from 'vue-toastification'

export default {
  name: 'JobManagement',
  components: {
    AppLayout
  },
  setup() {
    const toast = useToast()
    
    const showAlert = () => {
      toast.info('작업 관리 기능은 현재 개발 중입니다.')
    }
    
    return {
      showAlert
    }
  }
}
</script>

<style scoped>
.job-container {
  padding: var(--space-6);
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.job-header {
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

/* Info Alert */
.info-alert {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-6);
  margin-bottom: var(--space-8);
  background: var(--info-soft);
  border: 1px solid var(--info);
}

.alert-icon {
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.alert-text {
  color: var(--gray-700);
  margin: 0 0 var(--space-4);
}

.alert-features h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.alert-features ul {
  margin: 0;
  padding-left: var(--space-6);
  color: var(--gray-700);
}

.alert-features li {
  margin-bottom: var(--space-1);
}

/* Status Grid */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.status-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  text-align: center;
  border: 2px solid;
  transition: all var(--transition-base);
}

.status-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.status-card.success {
  border-color: var(--success);
  background: var(--success-soft);
}

.status-card.warning {
  border-color: var(--warning);
  background: var(--warning-soft);
}

.status-card.error {
  border-color: var(--error);
  background: var(--error-soft);
}

.status-card.info {
  border-color: var(--info);
  background: var(--info-soft);
}

.status-icon {
  margin-bottom: var(--space-3);
}

.status-card.success .status-icon { color: var(--success); }
.status-card.warning .status-icon { color: var(--warning); }
.status-card.error .status-icon { color: var(--error); }
.status-card.info .status-icon { color: var(--info); }

.status-value {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin-bottom: var(--space-2);
}

.status-label {
  font-size: var(--font-size-lg);
  font-weight: var(--font-medium);
  color: var(--gray-700);
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
}

/* Recent Jobs */
.recent-jobs {
  grid-column: 1;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.job-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.job-item:hover {
  background: var(--gray-100);
}

.job-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.job-icon.success { background: var(--success-soft); color: var(--success); }
.job-icon.warning { background: var(--warning-soft); color: var(--warning); }
.job-icon.info { background: var(--info-soft); color: var(--info); }

.job-info {
  flex: 1;
  min-width: 0;
}

.job-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-1);
}

.job-details {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin: 0;
}

.job-status {
  flex-shrink: 0;
}

.status-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.status-badge.success { background: var(--success-soft); color: var(--success); }
.status-badge.warning { background: var(--warning-soft); color: var(--warning); }
.status-badge.info { background: var(--info-soft); color: var(--info); }

/* Performance Section */
.performance-section {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-6);
}

.performance-chart {
  min-height: 400px;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  text-align: center;
}

.chart-placeholder h3 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-semibold);
  color: var(--gray-700);
  margin: var(--space-4) 0 var(--space-2);
}

.chart-placeholder p {
  color: var(--gray-600);
  margin: 0;
}

/* Performance Indicators */
.metric-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-label {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

.metric-value {
  font-size: var(--font-size-base);
  font-weight: var(--font-bold);
  color: var(--gray-900);
}

.metric-value.success { color: var(--success); }

.metric-progress {
  height: 8px;
  background: var(--gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}

.progress-bar.success { background: var(--success); }
.progress-bar.info { background: var(--info); }

/* Responsive */
@media (max-width: 1024px) {
  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .performance-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .job-container {
    padding: var(--space-4);
  }
  
  .job-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
  
  .status-grid {
    grid-template-columns: 1fr;
  }
  
  .job-item {
    flex-direction: column;
    text-align: center;
  }
  
  .job-info {
    text-align: center;
  }
}
</style>