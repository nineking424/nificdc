<template>
  <div class="monitoring-dashboard">
    <v-container fluid>
      <!-- 헤더 -->
      <v-row class="mb-4">
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center">
            <div>
              <h1 class="text-h4 font-weight-bold">모니터링 대시보드</h1>
              <p class="text-subtitle-1 text-medium-emphasis">
                실시간 시스템 상태 및 성능 모니터링
              </p>
            </div>
            <div class="d-flex align-center gap-2">
              <v-chip
                :color="connectionStatus.color"
                size="small"
                :prepend-icon="connectionStatus.icon"
                variant="tonal"
              >
                {{ connectionStatus.text }}
              </v-chip>
              <v-btn
                variant="outlined"
                prepend-icon="mdi-refresh"
                @click="refreshData"
                :loading="loading"
              >
                새로고침
              </v-btn>
              <v-btn
                variant="outlined"
                prepend-icon="mdi-cog"
                @click="showSettings = true"
              >
                설정
              </v-btn>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- 실시간 메트릭 카드 -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6" md="3">
          <v-card color="primary" variant="tonal" class="metric-card">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon size="40" class="mr-3">mdi-pulse</v-icon>
                <div>
                  <div class="text-h4 font-weight-bold">{{ metrics.performance?.throughput || 0 }}</div>
                  <div class="text-body-2">처리량 (시간당)</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card color="success" variant="tonal" class="metric-card">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon size="40" class="mr-3">mdi-speedometer</v-icon>
                <div>
                  <div class="text-h4 font-weight-bold">{{ metrics.performance?.avgLatency || 0 }}ms</div>
                  <div class="text-body-2">평균 지연시간</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card color="warning" variant="tonal" class="metric-card">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon size="40" class="mr-3">mdi-alert-circle</v-icon>
                <div>
                  <div class="text-h4 font-weight-bold">{{ metrics.performance?.errorRate || 0 }}%</div>
                  <div class="text-body-2">에러율</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card color="info" variant="tonal" class="metric-card">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon size="40" class="mr-3">mdi-chart-line</v-icon>
                <div>
                  <div class="text-h4 font-weight-bold">{{ metrics.summary?.runningJobs || 0 }}</div>
                  <div class="text-body-2">실행 중인 작업</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 메인 차트 영역 -->
      <v-row class="mb-4">
        <v-col cols="12" md="8">
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
              <span>시간대별 실행 통계</span>
              <v-btn-toggle
                v-model="chartPeriod"
                variant="outlined"
                density="compact"
                @update:model-value="updateChartData"
              >
                <v-btn value="1h">1시간</v-btn>
                <v-btn value="6h">6시간</v-btn>
                <v-btn value="24h">24시간</v-btn>
              </v-btn-toggle>
            </v-card-title>
            <v-card-text>
              <div class="chart-container">
                <canvas ref="executionChart"></canvas>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="fill-height">
            <v-card-title>시스템 상태</v-card-title>
            <v-card-text>
              <div class="mb-4">
                <div class="d-flex justify-space-between align-center mb-2">
                  <span>전체 상태</span>
                  <v-chip
                    :color="getHealthColor(health.overall?.status)"
                    size="small"
                    variant="tonal"
                  >
                    {{ getHealthLabel(health.overall?.status) }}
                  </v-chip>
                </div>
                <v-progress-linear
                  :model-value="health.overall?.score || 0"
                  :color="getHealthColor(health.overall?.status)"
                  height="8"
                  rounded
                />
              </div>
              
              <div class="mb-3">
                <div class="text-subtitle-2 mb-2">구성 요소 상태</div>
                <div v-for="(component, key) in health.components" :key="key" class="mb-2">
                  <div class="d-flex justify-space-between align-center">
                    <span class="text-body-2">{{ getComponentLabel(key) }}</span>
                    <v-chip
                      :color="getHealthColor(component.status)"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ getHealthLabel(component.status) }}
                    </v-chip>
                  </div>
                </div>
              </div>
              
              <div v-if="health.components?.server" class="mb-3">
                <div class="text-subtitle-2 mb-2">서버 리소스</div>
                <div class="mb-2">
                  <div class="d-flex justify-space-between align-center mb-1">
                    <span class="text-body-2">메모리</span>
                    <span class="text-body-2">{{ health.components.server.memoryUsage }}%</span>
                  </div>
                  <v-progress-linear
                    :model-value="health.components.server.memoryUsage"
                    color="primary"
                    height="4"
                    rounded
                  />
                </div>
                <div class="mb-2">
                  <div class="d-flex justify-space-between align-center mb-1">
                    <span class="text-body-2">CPU</span>
                    <span class="text-body-2">{{ health.components.server.cpuUsage }}%</span>
                  </div>
                  <v-progress-linear
                    :model-value="health.components.server.cpuUsage"
                    color="warning"
                    height="4"
                    rounded
                  />
                </div>
                <div class="text-caption text-medium-emphasis">
                  업타임: {{ formatUptime(health.components.server.uptime) }}
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 상위 작업 및 최근 실행 -->
      <v-row>
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>상위 성능 작업</v-card-title>
            <v-card-text>
              <v-list dense>
                <v-list-item
                  v-for="job in topJobs"
                  :key="job.id"
                  class="px-0"
                >
                  <template #prepend>
                    <v-avatar color="primary" size="small">
                      {{ job.executionCount }}
                    </v-avatar>
                  </template>
                  <v-list-item-title>{{ job.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    평균 실행시간: {{ job.avgDuration }}ms | 
                    성공률: {{ job.successRate }}%
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>최근 실행 내역</v-card-title>
            <v-card-text>
              <v-list dense>
                <v-list-item
                  v-for="execution in recentExecutions"
                  :key="execution.id"
                  class="px-0"
                >
                  <template #prepend>
                    <v-icon
                      :color="getExecutionStatusColor(execution.status)"
                      size="small"
                    >
                      {{ getExecutionStatusIcon(execution.status) }}
                    </v-icon>
                  </template>
                  <v-list-item-title>{{ execution.job?.name }}</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ $filters.formatDate(execution.startedAt) }} | 
                    {{ execution.duration ? `${execution.duration}ms` : '실행 중' }}
                  </v-list-item-subtitle>
                  <template #append>
                    <v-chip
                      :color="getExecutionStatusColor(execution.status)"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ getExecutionStatusLabel(execution.status) }}
                    </v-chip>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 설정 대화상자 -->
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
    </v-container>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { monitoringService } from '@/services/monitoringService';
import Chart from 'chart.js/auto';

export default {
  name: 'MonitoringDashboard',
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
          color: 'success',
          icon: 'mdi-wifi',
          text: '연결됨'
        };
      } else {
        return {
          color: 'error',
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
            borderColor: 'rgb(33, 150, 243)',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
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
.monitoring-dashboard {
  padding: 20px;
}

.metric-card {
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
}

.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}

.v-card {
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.v-list-item:last-child {
  border-bottom: none;
}

.gap-2 {
  gap: 8px;
}

.fill-height {
  height: 100%;
}

.text-h4 {
  font-size: 1.75rem !important;
  font-weight: 600 !important;
}

.text-subtitle-1 {
  font-size: 1rem !important;
  opacity: 0.7;
}

.text-body-2 {
  font-size: 0.875rem !important;
}

.text-caption {
  font-size: 0.75rem !important;
  opacity: 0.6;
}

.v-progress-linear {
  border-radius: 4px;
}

.v-chip {
  font-size: 0.75rem;
  font-weight: 500;
}

@media (max-width: 960px) {
  .monitoring-dashboard {
    padding: 16px;
  }
  
  .chart-container {
    height: 250px;
  }
}
</style>