<template>
  <v-container fluid class="monitoring-dashboard">
    <!-- 상단 메트릭 카드 -->
    <v-row class="mb-4">
      <v-col cols="12" sm="6" md="3" v-for="metric in topMetrics" :key="metric.key">
        <MetricCard
          :title="metric.title"
          :value="metric.value"
          :unit="metric.unit"
          :icon="metric.icon"
          :color="metric.color"
          :trend="metric.trend"
          :loading="loading.metrics"
        />
      </v-col>
    </v-row>

    <!-- 주요 차트 섹션 -->
    <v-row class="mb-4">
      <!-- 실시간 처리량 차트 -->
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-chart-line</v-icon>
            실시간 처리량
            <v-spacer />
            <v-btn-toggle v-model="chartTimeRange" mandatory dense>
              <v-btn size="small" value="1h">1시간</v-btn>
              <v-btn size="small" value="6h">6시간</v-btn>
              <v-btn size="small" value="24h">24시간</v-btn>
            </v-btn-toggle>
          </v-card-title>
          <v-card-text>
            <ThroughputChart
              :data="chartData.throughput"
              :timeRange="chartTimeRange"
              :height="300"
              :loading="loading.charts"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 시스템 상태 -->
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-server</v-icon>
            시스템 상태
          </v-card-title>
          <v-card-text>
            <SystemStatusPanel
              :systems="systemStatus"
              :loading="loading.systems"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 차트 그리드 -->
    <v-row class="mb-4">
      <!-- CPU 사용률 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon class="mr-2">mdi-chip</v-icon>
            CPU 사용률
          </v-card-title>
          <v-card-text>
            <ResourceChart
              :data="chartData.cpu"
              type="cpu"
              :height="250"
              :loading="loading.charts"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 메모리 사용률 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon class="mr-2">mdi-memory</v-icon>
            메모리 사용률
          </v-card-title>
          <v-card-text>
            <ResourceChart
              :data="chartData.memory"
              type="memory"
              :height="250"
              :loading="loading.charts"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 에러 분석 및 최근 활동 -->
    <v-row class="mb-4">
      <!-- 에러 분석 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon class="mr-2">mdi-alert-circle</v-icon>
            에러 분석
          </v-card-title>
          <v-card-text>
            <ErrorAnalysisChart
              :data="errorAnalysis"
              :height="250"
              :loading="loading.errors"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 최근 작업 실행 -->
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon class="mr-2">mdi-clock-outline</v-icon>
            최근 작업 실행
          </v-card-title>
          <v-card-text style="max-height: 300px; overflow-y: auto;">
            <RecentExecutionsList
              :executions="recentExecutions"
              :loading="loading.executions"
              @execution-click="showExecutionDetails"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 알림 및 이벤트 -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-icon class="mr-2">mdi-bell</v-icon>
            실시간 알림
            <v-spacer />
            <v-chip
              :color="alerts.length > 0 ? 'error' : 'success'"
              size="small"
              variant="tonal"
            >
              {{ alerts.length }}개 알림
            </v-chip>
          </v-card-title>
          <v-card-text>
            <AlertsPanel
              :alerts="alerts"
              :loading="loading.alerts"
              @alert-dismiss="dismissAlert"
              @alert-acknowledge="acknowledgeAlert"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 실행 상세 대화상자 -->
    <ExecutionDetailsDialog
      v-model="showExecutionDialog"
      :execution="selectedExecution"
      @close="showExecutionDialog = false"
    />

    <!-- 설정 대화상자 -->
    <DashboardSettingsDialog
      v-model="showSettingsDialog"
      :settings="dashboardSettings"
      @save="saveDashboardSettings"
    />

    <!-- 플로팅 액션 버튼 -->
    <v-fab
      icon="mdi-cog"
      location="bottom end"
      size="small"
      color="primary"
      @click="showSettingsDialog = true"
    />
  </v-container>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { useMonitoringStore } from '@/stores/monitoring';
import { useWebSocket } from '@/composables/useWebSocket';
import MetricCard from '@/components/monitoring/MetricCard.vue';
import ThroughputChart from '@/components/monitoring/ThroughputChart.vue';
import SystemStatusPanel from '@/components/monitoring/SystemStatusPanel.vue';
import ResourceChart from '@/components/monitoring/ResourceChart.vue';
import ErrorAnalysisChart from '@/components/monitoring/ErrorAnalysisChart.vue';
import RecentExecutionsList from '@/components/monitoring/RecentExecutionsList.vue';
import AlertsPanel from '@/components/monitoring/AlertsPanel.vue';
import ExecutionDetailsDialog from '@/components/monitoring/ExecutionDetailsDialog.vue';
import DashboardSettingsDialog from '@/components/monitoring/DashboardSettingsDialog.vue';

export default {
  name: 'MonitoringDashboard',
  components: {
    MetricCard,
    ThroughputChart,
    SystemStatusPanel,
    ResourceChart,
    ErrorAnalysisChart,
    RecentExecutionsList,
    AlertsPanel,
    ExecutionDetailsDialog,
    DashboardSettingsDialog
  },
  setup() {
    const monitoringStore = useMonitoringStore();
    
    // 반응형 상태
    const loading = reactive({
      metrics: true,
      charts: true,
      systems: true,
      errors: true,
      executions: true,
      alerts: true
    });
    
    const chartTimeRange = ref('6h');
    const showExecutionDialog = ref(false);
    const showSettingsDialog = ref(false);
    const selectedExecution = ref(null);
    
    // 차트 데이터
    const chartData = reactive({
      throughput: [],
      cpu: [],
      memory: [],
      network: []
    });
    
    // 시스템 상태 및 메트릭
    const systemStatus = ref([]);
    const recentExecutions = ref([]);
    const alerts = ref([]);
    const errorAnalysis = ref({});
    
    // 대시보드 설정
    const dashboardSettings = reactive({
      autoRefresh: true,
      refreshInterval: 5000,
      showAlerts: true,
      compactMode: false,
      theme: 'auto'
    });

    // WebSocket 연결
    const { 
      isConnected, 
      connectionError, 
      subscribe, 
      unsubscribe,
      send 
    } = useWebSocket('/monitoring');

    // 계산된 속성
    const topMetrics = computed(() => [
      {
        key: 'activeJobs',
        title: '활성 작업',
        value: monitoringStore.metrics?.summary?.activeJobs || 0,
        unit: '개',
        icon: 'mdi-play-circle',
        color: 'primary',
        trend: calculateTrend('activeJobs')
      },
      {
        key: 'throughput',
        title: '처리량',
        value: monitoringStore.metrics?.performance?.throughput || 0,
        unit: '/h',
        icon: 'mdi-speedometer',
        color: 'success',
        trend: calculateTrend('throughput')
      },
      {
        key: 'avgLatency',
        title: '평균 지연시간',
        value: formatLatency(monitoringStore.metrics?.performance?.avgLatency || 0),
        unit: '',
        icon: 'mdi-timer',
        color: 'warning',
        trend: calculateTrend('avgLatency', true) // 낮을수록 좋음
      },
      {
        key: 'errorRate',
        title: '에러율',
        value: monitoringStore.metrics?.performance?.errorRate || 0,
        unit: '%',
        icon: 'mdi-alert',
        color: monitoringStore.metrics?.performance?.errorRate > 5 ? 'error' : 'success',
        trend: calculateTrend('errorRate', true) // 낮을수록 좋음
      }
    ]);

    // 메서드
    const connectWebSocket = () => {
      if (!isConnected.value) {
        subscribe(['metrics', 'alerts', 'system', 'logs']);
      }
    };

    const handleWebSocketMessage = (message) => {
      const { type, data } = message;
      
      switch (type) {
        case 'metrics':
          updateMetrics(data);
          break;
        case 'alert':
          addAlert(data);
          break;
        case 'health':
          updateSystemStatus(data);
          break;
        case 'initial_state':
          initializeData(data);
          break;
      }
    };

    const updateMetrics = (metrics) => {
      monitoringStore.updateMetrics(metrics);
      updateChartData(metrics);
      loading.metrics = false;
      loading.charts = false;
    };

    const updateChartData = (metrics) => {
      const timestamp = new Date().toISOString();
      
      // 처리량 데이터 업데이트
      chartData.throughput.push({
        timestamp,
        value: metrics.performance?.throughput || 0
      });
      
      // CPU 데이터 업데이트
      if (metrics.system?.cpu) {
        chartData.cpu.push({
          timestamp,
          value: metrics.system.cpu.usage
        });
      }
      
      // 메모리 데이터 업데이트
      if (metrics.system?.memory) {
        chartData.memory.push({
          timestamp,
          value: metrics.system.memory.usage
        });
      }
      
      // 데이터 크기 제한 (최근 100개 포인트)
      ['throughput', 'cpu', 'memory'].forEach(key => {
        if (chartData[key].length > 100) {
          chartData[key] = chartData[key].slice(-100);
        }
      });
    };

    const updateSystemStatus = (healthData) => {
      systemStatus.value = healthData.components ? 
        Object.entries(healthData.components).map(([name, status]) => ({
          name,
          status: status.status || 'unknown',
          ...status
        })) : [];
      loading.systems = false;
    };

    const addAlert = (alert) => {
      alerts.value.unshift({
        id: alert.id || `alert_${Date.now()}`,
        ...alert,
        timestamp: new Date(alert.timestamp || Date.now())
      });
      
      // 알림 개수 제한
      if (alerts.value.length > 50) {
        alerts.value = alerts.value.slice(0, 50);
      }
    };

    const initializeData = (data) => {
      if (data.metrics) updateMetrics(data.metrics);
      if (data.health) updateSystemStatus(data.health);
      if (data.recentExecutions) {
        recentExecutions.value = data.recentExecutions;
        loading.executions = false;
      }
      
      loading.alerts = false;
    };

    const calculateTrend = (metricKey, lowerIsBetter = false) => {
      const history = monitoringStore.getMetricHistory(metricKey, 10);
      if (history.length < 2) return null;
      
      const recent = history.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
      const previous = history.slice(-6, -3).reduce((sum, val) => sum + val, 0) / 3;
      
      if (previous === 0) return null;
      
      const change = ((recent - previous) / previous) * 100;
      const direction = lowerIsBetter ? -change : change;
      
      return {
        direction: direction > 2 ? 'up' : direction < -2 ? 'down' : 'stable',
        percentage: Math.abs(change).toFixed(1)
      };
    };

    const formatLatency = (latency) => {
      if (latency < 1000) return `${latency}ms`;
      return `${(latency / 1000).toFixed(1)}s`;
    };

    const showExecutionDetails = (execution) => {
      selectedExecution.value = execution;
      showExecutionDialog.value = true;
    };

    const dismissAlert = (alertId) => {
      const index = alerts.value.findIndex(alert => alert.id === alertId);
      if (index > -1) {
        alerts.value.splice(index, 1);
      }
    };

    const acknowledgeAlert = (alertId) => {
      const alert = alerts.value.find(alert => alert.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
      }
    };

    const saveDashboardSettings = (settings) => {
      Object.assign(dashboardSettings, settings);
      localStorage.setItem('dashboardSettings', JSON.stringify(settings));
      showSettingsDialog.value = false;
    };

    const loadDashboardSettings = () => {
      const saved = localStorage.getItem('dashboardSettings');
      if (saved) {
        try {
          Object.assign(dashboardSettings, JSON.parse(saved));
        } catch (error) {
          console.warn('대시보드 설정 로드 실패:', error);
        }
      }
    };

    const refreshData = () => {
      if (isConnected.value) {
        send({
          type: 'get_metrics',
          filter: { type: 'current' }
        });
      }
    };

    // 라이프사이클
    onMounted(() => {
      loadDashboardSettings();
      connectWebSocket();
      
      // WebSocket 메시지 리스너 등록
      const unsubscribeWS = subscribe(['metrics', 'alerts', 'system'], handleWebSocketMessage);
      
      // 자동 새로고침 설정
      let refreshTimer;
      if (dashboardSettings.autoRefresh) {
        refreshTimer = setInterval(refreshData, dashboardSettings.refreshInterval);
      }
      
      // 정리 함수 등록
      onUnmounted(() => {
        if (unsubscribeWS) unsubscribeWS();
        if (refreshTimer) clearInterval(refreshTimer);
      });
    });

    return {
      // 상태
      loading,
      chartTimeRange,
      showExecutionDialog,
      showSettingsDialog,
      selectedExecution,
      chartData,
      systemStatus,
      recentExecutions,
      alerts,
      errorAnalysis,
      dashboardSettings,
      
      // 계산된 속성
      topMetrics,
      isConnected,
      connectionError,
      
      // 메서드
      showExecutionDetails,
      dismissAlert,
      acknowledgeAlert,
      saveDashboardSettings,
      refreshData
    };
  }
};
</script>

<style scoped>
.monitoring-dashboard {
  padding: 16px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.metric-card {
  transition: all 0.3s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.chart-container {
  position: relative;
  width: 100%;
}

.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-indicator.healthy {
  background-color: #4caf50;
}

.status-indicator.warning {
  background-color: #ff9800;
}

.status-indicator.error {
  background-color: #f44336;
}

.alert-item {
  border-left: 4px solid;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 4px;
}

.alert-item.critical {
  border-left-color: #f44336;
  background-color: #ffebee;
}

.alert-item.high {
  border-left-color: #ff9800;
  background-color: #fff3e0;
}

.alert-item.medium {
  border-left-color: #2196f3;
  background-color: #e3f2fd;
}

.alert-item.low {
  border-left-color: #4caf50;
  background-color: #e8f5e8;
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .monitoring-dashboard {
    background-color: #121212;
  }
  
  .alert-item.critical {
    background-color: rgba(244, 67, 54, 0.1);
  }
  
  .alert-item.high {
    background-color: rgba(255, 152, 0, 0.1);
  }
  
  .alert-item.medium {
    background-color: rgba(33, 150, 243, 0.1);
  }
  
  .alert-item.low {
    background-color: rgba(76, 175, 80, 0.1);
  }
}

/* 반응형 디자인 */
@media (max-width: 960px) {
  .monitoring-dashboard {
    padding: 8px;
  }
}

/* 애니메이션 */
@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

.loading-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

/* 스크롤바 스타일링 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>