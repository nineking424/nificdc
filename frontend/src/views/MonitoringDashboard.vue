<template>
  <AppLayout>
    <div class="monitoring-container">
      <!-- Clean Header -->
      <div class="monitoring-header">
        <div class="header-content">
          <h1 class="page-title">모니터링 대시보드</h1>
          <p class="page-subtitle">실시간 시스템 상태 및 성능 모니터링</p>
        </div>
        <div class="header-actions">
          <div class="connection-status" :class="'status-' + connectionStatus.status">
            <v-icon size="16">{{ connectionStatus.icon }}</v-icon>
            <span>{{ connectionStatus.text }}</span>
          </div>
          <button class="clean-button clean-button-secondary" @click="refreshData" :disabled="loading">
            <v-icon size="18" :class="{ 'spin': loading }">mdi-refresh</v-icon>
            새로고침
          </button>
          <button class="clean-button clean-button-secondary" @click="showSettings = true">
            <v-icon size="18">mdi-cog</v-icon>
            설정
          </button>
        </div>
      </div>

      <!-- Metric Cards -->
      <div class="metric-grid">
        <div class="metric-card primary">
          <div class="metric-icon">
            <v-icon size="40">mdi-pulse</v-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics.performance?.throughput || 0 }}</div>
            <div class="metric-label">처리량 (시간당)</div>
          </div>
        </div>
        
        <div class="metric-card success">
          <div class="metric-icon">
            <v-icon size="40">mdi-speedometer</v-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics.performance?.avgLatency || 0 }}ms</div>
            <div class="metric-label">평균 지연시간</div>
          </div>
        </div>
        
        <div class="metric-card warning">
          <div class="metric-icon">
            <v-icon size="40">mdi-alert-circle</v-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics.performance?.errorRate || 0 }}%</div>
            <div class="metric-label">에러율</div>
          </div>
        </div>
        
        <div class="metric-card info">
          <div class="metric-icon">
            <v-icon size="40">mdi-chart-line</v-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ metrics.summary?.runningJobs || 0 }}</div>
            <div class="metric-label">실행 중인 작업</div>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="content-grid">
        <!-- Chart Section -->
        <div class="chart-section clean-card">
          <div class="section-header">
            <h2 class="section-title">시간대별 실행 통계</h2>
            <div class="chart-controls">
              <button 
                v-for="period in [{ value: '1h', label: '1시간' }, { value: '6h', label: '6시간' }, { value: '24h', label: '24시간' }]"
                :key="period.value"
                class="period-button"
                :class="{ active: chartPeriod === period.value }"
                @click="chartPeriod = period.value; updateChartData()"
              >
                {{ period.label }}
              </button>
            </div>
          </div>
          <div class="chart-container">
            <canvas ref="executionChart"></canvas>
          </div>
        </div>
        
        <!-- System Health -->
        <div class="health-section clean-card">
          <div class="section-header">
            <h2 class="section-title">시스템 상태</h2>
          </div>
          
          <div class="health-content">
            <div class="overall-health">
              <div class="health-header">
                <span>전체 상태</span>
                <span class="status-badge" :class="'status-' + health.overall?.status">
                  {{ getHealthLabel(health.overall?.status) }}
                </span>
              </div>
              <div class="health-progress">
                <div 
                  class="progress-fill" 
                  :class="'status-' + health.overall?.status"
                  :style="{ width: (health.overall?.score || 0) + '%' }"
                ></div>
              </div>
            </div>
            
            <div class="component-health">
              <h3>구성 요소 상태</h3>
              <div class="component-list">
                <div v-for="(component, key) in health.components" :key="key" class="component-item">
                  <span class="component-name">{{ getComponentLabel(key) }}</span>
                  <span class="status-indicator" :class="'status-' + component.status">
                    <v-icon size="16">{{ getHealthIcon(component.status) }}</v-icon>
                    {{ getHealthLabel(component.status) }}
                  </span>
                </div>
              </div>
            </div>
            
            <div v-if="health.components?.server" class="server-resources">
              <h3>서버 리소스</h3>
              <div class="resource-item">
                <div class="resource-header">
                  <span>메모리</span>
                  <span>{{ health.components.server.memoryUsage }}%</span>
                </div>
                <div class="resource-progress">
                  <div 
                    class="progress-fill primary"
                    :style="{ width: health.components.server.memoryUsage + '%' }"
                  ></div>
                </div>
              </div>
              <div class="resource-item">
                <div class="resource-header">
                  <span>CPU</span>
                  <span>{{ health.components.server.cpuUsage }}%</span>
                </div>
                <div class="resource-progress">
                  <div 
                    class="progress-fill warning"
                    :style="{ width: health.components.server.cpuUsage + '%' }"
                  ></div>
                </div>
              </div>
              <div class="uptime">
                업타임: {{ formatUptime(health.components.server.uptime) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Job Statistics -->
      <div class="stats-grid">
        <!-- Top Jobs -->
        <div class="job-stats clean-card">
          <div class="section-header">
            <h2 class="section-title">상위 성능 작업</h2>
          </div>
          <div class="job-list">
            <div v-for="job in topJobs" :key="job.id" class="job-item">
              <div class="job-rank">{{ job.executionCount }}</div>
              <div class="job-info">
                <h4>{{ job.name }}</h4>
                <p>평균 실행시간: {{ job.avgDuration }}ms | 성공률: {{ job.successRate }}%</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Recent Executions -->
        <div class="executions clean-card">
          <div class="section-header">
            <h2 class="section-title">최근 실행 내역</h2>
          </div>
          <div class="execution-list">
            <div v-for="execution in recentExecutions" :key="execution.id" class="execution-item">
              <div class="execution-icon" :class="'status-' + execution.status">
                <v-icon size="16">{{ getExecutionStatusIcon(execution.status) }}</v-icon>
              </div>
              <div class="execution-info">
                <h4>{{ execution.job?.name }}</h4>
                <p>
                  {{ $filters.formatDate(execution.startedAt) }} | 
                  {{ execution.duration ? `${execution.duration}ms` : '실행 중' }}
                </p>
              </div>
              <span class="status-badge" :class="'status-' + execution.status">
                {{ getExecutionStatusLabel(execution.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Dialog -->
      <v-dialog v-model="showSettings" max-width="600">
        <v-card>
          <v-card-title>모니터링 설정</v-card-title>
          <v-card-text>
            <v-form v-model="settingsValid">
              <v-row>
                <v-col cols="12">
                  <v-switch
                    v-model="settings.autoRefresh"
                    label="자동 새로고침"
                    hint="실시간 데이터 자동 업데이트"
                    persistent-hint
                  />
                </v-col>
                <v-col cols="12">
                  <v-slider
                    v-model="settings.refreshInterval"
                    label="새로고침 간격 (초)"
                    min="5"
                    max="60"
                    step="5"
                    thumb-label
                    :disabled="!settings.autoRefresh"
                  />
                </v-col>
                <v-col cols="12">
                  <v-switch
                    v-model="settings.soundAlerts"
                    label="소리 알림"
                    hint="중요한 이벤트 발생 시 소리 알림"
                    persistent-hint
                  />
                </v-col>
                <v-col cols="12">
                  <v-switch
                    v-model="settings.showTooltips"
                    label="도구 팁 표시"
                    hint="차트 및 메트릭에 상세 정보 표시"
                    persistent-hint
                  />
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn @click="showSettings = false">취소</v-btn>
            <v-btn
              color="primary"
              @click="saveSettings"
              :disabled="!settingsValid"
            >
              저장
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </AppLayout>
</template>

<script>
import AppLayout from '@/components/AppLayout.vue';
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { monitoringService } from '@/services/monitoringService';
import Chart from 'chart.js/auto';

export default {
  name: 'MonitoringDashboard',
  components: {
    AppLayout
  },
  setup() {
    const router = useRouter();
    const appStore = useAppStore();
    const authStore = useAuthStore();
    const { user } = storeToRefs(authStore);

    // 반응형 상태
    const loading = ref(false);
    const showSettings = ref(false);
    const settingsValid = ref(true);
    const chartPeriod = ref('24h');
    const executionChart = ref(null);
    const chart = ref(null);
    
    // 데이터 상태
    const metrics = reactive({
      summary: {},
      performance: {},
      trends: {},
      topJobs: [],
      lastUpdated: null
    });
    
    const health = reactive({
      overall: {},
      components: {},
      lastChecked: null
    });
    
    const recentExecutions = ref([]);
    const topJobs = ref([]);
    const systemStats = ref({});
    
    // 설정 상태
    const settings = reactive({
      autoRefresh: true,
      refreshInterval: 10,
      soundAlerts: false,
      showTooltips: true
    });
    
    // 자동 새로고침 타이머
    let refreshTimer = null;

    // 연결 상태
    const connectionStatus = computed(() => {
      if (monitoringService.isConnectedToWebSocket()) {
        return {
          status: 'success',
          icon: 'mdi-wifi',
          text: '연결됨'
        };
      } else {
        return {
          status: 'error',
          icon: 'mdi-wifi-off',
          text: '연결 안됨'
        };
      }
    });

    // WebSocket 이벤트 리스너 등록
    const setupWebSocketListeners = () => {
      monitoringService.addEventListener('connected', () => {
        console.log('WebSocket 연결 성공');
      });
      
      monitoringService.addEventListener('disconnected', () => {
        console.log('WebSocket 연결 끊김');
      });
      
      monitoringService.addEventListener('initialState', (data) => {
        updateData(data);
      });
      
      monitoringService.addEventListener('metrics', (data) => {
        Object.assign(metrics, data);
        updateChart();
      });
      
      monitoringService.addEventListener('health', (data) => {
        Object.assign(health, data);
      });
      
      monitoringService.addEventListener('event', ({ eventType, data }) => {
        handleRealTimeEvent(eventType, data);
      });
    };

    // 실시간 이벤트 처리
    const handleRealTimeEvent = (eventType, data) => {
      switch (eventType) {
        case 'job_started':
          appStore.showNotification({
            type: 'info',
            message: `작업 '${data.jobName}'이 시작되었습니다.`
          });
          break;
          
        case 'job_completed':
          appStore.showNotification({
            type: 'success',
            message: `작업 '${data.jobName}'이 완료되었습니다.`
          });
          break;
          
        case 'job_failed':
          appStore.showNotification({
            type: 'error',
            message: `작업 '${data.jobName}'이 실패했습니다.`
          });
          if (settings.soundAlerts) {
            playNotificationSound();
          }
          break;
          
        case 'system_alert':
          appStore.showNotification({
            type: 'warning',
            message: `시스템 알림: ${data.message}`
          });
          break;
      }
    };

    // 데이터 업데이트
    const updateData = (data) => {
      if (data.metrics) {
        Object.assign(metrics, data.metrics);
      }
      if (data.health) {
        Object.assign(health, data.health);
      }
      if (data.recentExecutions) {
        recentExecutions.value = data.recentExecutions;
      }
      if (data.systemStats) {
        systemStats.value = data.systemStats;
      }
      
      updateChart();
    };

    // 차트 업데이트
    const updateChart = () => {
      if (!chart.value || !metrics.trends?.hourlyStats) return;
      
      const hourlyStats = metrics.trends.hourlyStats;
      const labels = Object.keys(hourlyStats).sort();
      const data = labels.map(label => hourlyStats[label]);
      
      chart.value.data.labels = labels;
      chart.value.data.datasets[0].data = data;
      chart.value.update();
    };

    // 차트 초기화
    const initChart = async () => {
      await nextTick();
      
      if (!executionChart.value) return;
      
      const ctx = executionChart.value.getContext('2d');
      chart.value = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: '실행 횟수',
            data: [],
            borderColor: '#1976D2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: '시간'
              }
            },
            y: {
              display: true,
              title: {
                display: true,
                text: '실행 횟수'
              },
              beginAtZero: true
            }
          },
          plugins: {
            tooltip: {
              enabled: settings.showTooltips
            }
          }
        }
      });
    };

    // 차트 기간 변경
    const updateChartData = () => {
      const hours = chartPeriod.value === '1h' ? 1 : 
                   chartPeriod.value === '6h' ? 6 : 24;
      
      monitoringService.getHourlyStats(hours).then(response => {
        const hourlyStats = response.data;
        const labels = Object.keys(hourlyStats).sort();
        const data = labels.map(label => hourlyStats[label]);
        
        if (chart.value) {
          chart.value.data.labels = labels;
          chart.value.data.datasets[0].data = data;
          chart.value.update();
        }
      }).catch(error => {
        console.error('시간대별 통계 조회 실패:', error);
      });
    };

    // 데이터 새로고침
    const refreshData = async () => {
      loading.value = true;
      try {
        const response = await monitoringService.getDashboard();
        updateData(response.data);
        
        // 상위 작업 및 최근 실행 업데이트
        const [topJobsResponse] = await Promise.all([
          monitoringService.getTopJobs(10)
        ]);
        
        topJobs.value = topJobsResponse.data;
      } catch (error) {
        console.error('데이터 새로고침 실패:', error);
        appStore.showNotification({
          type: 'error',
          message: '데이터 새로고침에 실패했습니다.'
        });
      } finally {
        loading.value = false;
      }
    };

    // 자동 새로고침 설정
    const setupAutoRefresh = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      
      if (settings.autoRefresh) {
        refreshTimer = setInterval(refreshData, settings.refreshInterval * 1000);
      }
    };

    // 설정 저장
    const saveSettings = () => {
      localStorage.setItem('monitoringSettings', JSON.stringify(settings));
      setupAutoRefresh();
      
      // 차트 툴팁 설정 업데이트
      if (chart.value) {
        chart.value.options.plugins.tooltip.enabled = settings.showTooltips;
        chart.value.update();
      }
      
      showSettings.value = false;
      appStore.showNotification({
        type: 'success',
        message: '설정이 저장되었습니다.'
      });
    };

    // 설정 로드
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('monitoringSettings');
      if (savedSettings) {
        Object.assign(settings, JSON.parse(savedSettings));
      }
    };

    // 알림 소리 재생
    const playNotificationSound = () => {
      try {
        const audio = new Audio('/notification.mp3');
        audio.play();
      } catch (error) {
        console.error('알림 소리 재생 실패:', error);
      }
    };

    // 유틸리티 함수들
    const getHealthColor = (status) => {
      const colors = {
        healthy: 'success',
        degraded: 'warning',
        error: 'error'
      };
      return colors[status] || 'grey';
    };

    const getHealthLabel = (status) => {
      const labels = {
        healthy: '정상',
        degraded: '주의',
        error: '오류'
      };
      return labels[status] || '알 수 없음';
    };

    const getHealthIcon = (status) => {
      const icons = {
        healthy: 'mdi-check-circle',
        degraded: 'mdi-alert',
        error: 'mdi-close-circle'
      };
      return icons[status] || 'mdi-help-circle';
    };

    const getComponentLabel = (key) => {
      const labels = {
        database: '데이터베이스',
        systems: '연결 시스템',
        nifi: 'NiFi',
        server: '서버'
      };
      return labels[key] || key;
    };

    const getExecutionStatusColor = (status) => {
      const colors = {
        queued: 'grey',
        running: 'orange',
        completed: 'success',
        failed: 'error',
        cancelled: 'warning'
      };
      return colors[status] || 'grey';
    };

    const getExecutionStatusIcon = (status) => {
      const icons = {
        queued: 'mdi-clock-outline',
        running: 'mdi-play-circle',
        completed: 'mdi-check-circle',
        failed: 'mdi-close-circle',
        cancelled: 'mdi-cancel'
      };
      return icons[status] || 'mdi-help-circle';
    };

    const getExecutionStatusLabel = (status) => {
      const labels = {
        queued: '대기',
        running: '실행 중',
        completed: '완료',
        failed: '실패',
        cancelled: '취소'
      };
      return labels[status] || status;
    };

    const formatUptime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}시간 ${minutes}분`;
    };

    // 설정 변경 감지
    watch(() => settings.autoRefresh, setupAutoRefresh);
    watch(() => settings.refreshInterval, setupAutoRefresh);

    // 컴포넌트 마운트 시 초기화
    onMounted(async () => {
      loadSettings();
      setupWebSocketListeners();
      
      // WebSocket 연결
      if (user.value?.token) {
        monitoringService.connect(user.value.token);
      }
      
      // 초기 데이터 로드
      await refreshData();
      
      // 차트 초기화
      await initChart();
      
      // 자동 새로고침 설정
      setupAutoRefresh();
    });

    // 컴포넌트 언마운트 시 정리
    onUnmounted(() => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      
      if (chart.value) {
        chart.value.destroy();
      }
      
      monitoringService.disconnect();
    });

    return {
      // 반응형 상태
      loading,
      showSettings,
      settingsValid,
      chartPeriod,
      executionChart,
      metrics,
      health,
      recentExecutions,
      topJobs,
      systemStats,
      settings,
      
      // 계산된 속성
      connectionStatus,
      
      // 메서드
      refreshData,
      updateChartData,
      saveSettings,
      getHealthColor,
      getHealthLabel,
      getHealthIcon,
      getComponentLabel,
      getExecutionStatusColor,
      getExecutionStatusIcon,
      getExecutionStatusLabel,
      formatUptime
    };
  }
};
</script>

<style scoped>
.monitoring-container {
  padding: var(--space-6);
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.monitoring-header {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
}

.connection-status.status-success {
  background: var(--success-soft);
  color: var(--success);
}

.connection-status.status-error {
  background: var(--error-soft);
  color: var(--error);
}

/* Metric Grid */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.metric-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  transition: all var(--transition-base);
  border: 2px solid;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.metric-card.primary { 
  border-color: var(--primary); 
  background: var(--primary-soft);
}

.metric-card.success { 
  border-color: var(--success); 
  background: var(--success-soft);
}

.metric-card.warning { 
  border-color: var(--warning); 
  background: var(--warning-soft);
}

.metric-card.info { 
  border-color: var(--info); 
  background: var(--info-soft);
}

.metric-icon {
  flex-shrink: 0;
}

.metric-card.primary .metric-icon { color: var(--primary); }
.metric-card.success .metric-icon { color: var(--success); }
.metric-card.warning .metric-icon { color: var(--warning); }
.metric-card.info .metric-icon { color: var(--info); }

.metric-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
}

.metric-label {
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  margin-top: var(--space-1);
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

/* Chart Section */
.chart-section {
  min-height: 400px;
}

.chart-controls {
  display: flex;
  gap: var(--space-1);
}

.period-button {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-300);
  background: var(--white);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-base);
}

.period-button:hover {
  background: var(--gray-50);
}

.period-button.active {
  background: var(--primary);
  color: var(--white);
  border-color: var(--primary);
}

.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
  padding: var(--space-4);
}

/* Health Section */
.health-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.overall-health {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.health-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-base);
}

.health-progress {
  height: 8px;
  background: var(--gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width var(--transition-base);
}

.progress-fill.status-healthy { background: var(--success); }
.progress-fill.status-degraded { background: var(--warning); }
.progress-fill.status-error { background: var(--error); }
.progress-fill.primary { background: var(--primary); }
.progress-fill.warning { background: var(--warning); }

.component-health h3,
.server-resources h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-700);
  margin: 0 0 var(--space-3);
}

.component-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.component-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);
}

.component-name {
  color: var(--gray-700);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
}

.status-indicator.status-healthy { color: var(--success); }
.status-indicator.status-degraded { color: var(--warning); }
.status-indicator.status-error { color: var(--error); }

.resource-item {
  margin-bottom: var(--space-3);
}

.resource-header {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  margin-bottom: var(--space-1);
}

.resource-progress {
  height: 4px;
  background: var(--gray-200);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.uptime {
  font-size: var(--font-size-xs);
  color: var(--gray-600);
  margin-top: var(--space-2);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6);
}

/* Job List */
.job-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.job-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--gray-50);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.job-item:hover {
  background: var(--gray-100);
}

.job-rank {
  width: 32px;
  height: 32px;
  background: var(--primary);
  color: var(--white);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-bold);
  flex-shrink: 0;
}

.job-info h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-medium);
  color: var(--gray-900);
  margin: 0 0 var(--space-1);
}

.job-info p {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin: 0;
}

/* Execution List */
.execution-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.execution-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--gray-50);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.execution-item:hover {
  background: var(--gray-100);
}

.execution-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.execution-icon.status-queued { background: var(--gray-200); color: var(--gray-600); }
.execution-icon.status-running { background: var(--warning-soft); color: var(--warning); }
.execution-icon.status-completed { background: var(--success-soft); color: var(--success); }
.execution-icon.status-failed { background: var(--error-soft); color: var(--error); }
.execution-icon.status-cancelled { background: var(--warning-soft); color: var(--warning); }

.execution-info {
  flex: 1;
  min-width: 0;
}

.execution-info h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-medium);
  color: var(--gray-900);
  margin: 0 0 var(--space-1);
}

.execution-info p {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin: 0;
}

.status-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.status-badge.status-healthy,
.status-badge.status-completed { 
  background: var(--success-soft); 
  color: var(--success); 
}

.status-badge.status-degraded,
.status-badge.status-running,
.status-badge.status-cancelled { 
  background: var(--warning-soft); 
  color: var(--warning); 
}

.status-badge.status-error,
.status-badge.status-failed { 
  background: var(--error-soft); 
  color: var(--error); 
}

.status-badge.status-queued { 
  background: var(--gray-100); 
  color: var(--gray-600); 
}

/* Utilities */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .monitoring-container {
    padding: var(--space-4);
  }
  
  .monitoring-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
  
  .metric-grid {
    grid-template-columns: 1fr;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .chart-container {
    height: 250px;
  }
}
</style>