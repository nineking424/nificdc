<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="900"
    scrollable
  >
    <v-card v-if="execution">
      <!-- 헤더 -->
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-avatar
            :color="getStatusColor(execution.status)"
            size="32"
            class="mr-3"
          >
            <v-icon
              :icon="getStatusIcon(execution.status)"
              color="white"
              size="18"
            />
          </v-avatar>
          <div>
            <div class="text-h6">{{ execution.jobName || `Job ${execution.jobId}` }}</div>
            <div class="text-caption text-disabled">실행 ID: {{ execution.id }}</div>
          </div>
        </div>
        
        <div class="d-flex align-center">
          <v-chip
            :color="getStatusColor(execution.status)"
            variant="tonal"
            class="mr-2"
          >
            {{ getStatusDisplayName(execution.status) }}
          </v-chip>
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="$emit('close')"
          />
        </div>
      </v-card-title>

      <v-divider />

      <!-- 탭 네비게이션 -->
      <v-tabs v-model="activeTab" class="px-4">
        <v-tab value="overview">개요</v-tab>
        <v-tab value="metrics">메트릭</v-tab>
        <v-tab value="logs">로그</v-tab>
        <v-tab value="errors" v-if="hasErrors">에러</v-tab>
        <v-tab value="config">설정</v-tab>
      </v-tabs>

      <v-divider />

      <!-- 탭 컨텐츠 -->
      <v-card-text class="pa-0" style="height: 500px;">
        <v-tabs-window v-model="activeTab">
          <!-- 개요 탭 -->
          <v-tabs-window-item value="overview" class="pa-4">
            <div class="overview-content">
              <!-- 기본 정보 -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle1">기본 정보</v-card-title>
                    <v-card-text>
                      <div class="info-grid">
                        <div class="info-item">
                          <span class="info-label">작업 ID:</span>
                          <span class="info-value">{{ execution.jobId }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">작업 타입:</span>
                          <span class="info-value">{{ execution.jobType || 'Unknown' }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">시작 시간:</span>
                          <span class="info-value">{{ formatDateTime(execution.startedAt) }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">완료 시간:</span>
                          <span class="info-value">{{ formatDateTime(execution.completedAt) || '진행 중' }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">실행 시간:</span>
                          <span class="info-value">{{ formatDuration(execution.duration) }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">실행자:</span>
                          <span class="info-value">{{ execution.executedBy || 'System' }}</span>
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>

                <v-col cols="12" md="6">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle1">성능 메트릭</v-card-title>
                    <v-card-text>
                      <div class="metrics-grid">
                        <div class="metric-card">
                          <div class="metric-value">{{ formatNumber(execution.recordsProcessed || 0) }}</div>
                          <div class="metric-label">처리된 레코드</div>
                        </div>
                        <div class="metric-card">
                          <div class="metric-value">{{ formatNumber(execution.recordsPerSecond || 0) }}</div>
                          <div class="metric-label">초당 처리량</div>
                        </div>
                        <div class="metric-card">
                          <div class="metric-value">{{ execution.errorCount || 0 }}</div>
                          <div class="metric-label">에러 수</div>
                        </div>
                        <div class="metric-card">
                          <div class="metric-value">{{ formatPercentage(execution.successRate || 0) }}</div>
                          <div class="metric-label">성공률</div>
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- 진행률 (진행 중인 경우) -->
              <v-row v-if="execution.status === 'running' && execution.progress !== undefined">
                <v-col cols="12">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle1">실행 진행률</v-card-title>
                    <v-card-text>
                      <div class="d-flex align-center justify-space-between mb-2">
                        <span>진행률</span>
                        <span class="font-weight-bold">{{ execution.progress }}%</span>
                      </div>
                      <v-progress-linear
                        :model-value="execution.progress"
                        color="primary"
                        height="8"
                        class="mb-3"
                      />
                      <div v-if="execution.currentStep" class="text-caption text-disabled">
                        현재 단계: {{ execution.currentStep }}
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- 데이터 플로우 정보 -->
              <v-row v-if="execution.dataFlow">
                <v-col cols="12">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle1">데이터 플로우</v-card-title>
                    <v-card-text>
                      <div class="flow-diagram">
                        <div
                          v-for="(step, index) in execution.dataFlow.steps"
                          :key="index"
                          class="flow-step"
                          :class="{ 'step-active': step.active, 'step-completed': step.completed }"
                        >
                          <div class="step-content">
                            <v-icon
                              :color="getStepColor(step)"
                              :icon="getStepIcon(step)"
                              size="24"
                            />
                            <div class="step-info">
                              <div class="step-name">{{ step.name }}</div>
                              <div class="step-records">{{ formatNumber(step.recordsProcessed || 0) }}건 처리</div>
                            </div>
                          </div>
                          <v-icon
                            v-if="index < execution.dataFlow.steps.length - 1"
                            class="flow-arrow"
                            color="grey"
                          >
                            mdi-arrow-right
                          </v-icon>
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-tabs-window-item>

          <!-- 메트릭 탭 -->
          <v-tabs-window-item value="metrics" class="pa-4">
            <div class="metrics-content">
              <v-row>
                <!-- 리소스 사용량 -->
                <v-col cols="12" md="6">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle1">리소스 사용량</v-card-title>
                    <v-card-text>
                      <div class="resource-metrics">
                        <div class="resource-item">
                          <div class="d-flex align-center justify-space-between mb-1">
                            <span>CPU 사용률</span>
                            <span>{{ execution.cpuUsage || 0 }}%</span>
                          </div>
                          <v-progress-linear
                            :model-value="execution.cpuUsage || 0"
                            color="primary"
                            height="6"
                          />
                        </div>
                        <div class="resource-item">
                          <div class="d-flex align-center justify-space-between mb-1">
                            <span>메모리 사용량</span>
                            <span>{{ formatBytes(execution.memoryUsage || 0) }}</span>
                          </div>
                          <v-progress-linear
                            :model-value="getMemoryPercentage(execution.memoryUsage)"
                            color="success"
                            height="6"
                          />
                        </div>
                        <div class="resource-item">
                          <div class="d-flex align-center justify-space-between mb-1">
                            <span>네트워크 I/O</span>
                            <span>{{ formatBytes(execution.networkIO || 0) }}/s</span>
                          </div>
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>

                <!-- 처리량 차트 -->
                <v-col cols="12" md="6">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle1">처리량 추이</v-card-title>
                    <v-card-text>
                      <div v-if="execution.throughputHistory" class="throughput-chart">
                        <!-- 간단한 SVG 차트 -->
                        <svg width="100%" height="200" class="mini-chart">
                          <path
                            :d="getThroughputPath(execution.throughputHistory)"
                            fill="none"
                            stroke="#1976d2"
                            stroke-width="2"
                          />
                        </svg>
                      </div>
                      <div v-else class="text-center text-disabled">
                        처리량 데이터가 없습니다
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- 상세 메트릭 테이블 -->
              <v-row>
                <v-col cols="12">
                  <v-card variant="outlined">
                    <v-card-title class="text-subtitle1">상세 메트릭</v-card-title>
                    <v-card-text>
                      <v-data-table
                        :headers="metricsHeaders"
                        :items="detailMetrics"
                        :items-per-page="5"
                        density="compact"
                      />
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-tabs-window-item>

          <!-- 로그 탭 -->
          <v-tabs-window-item value="logs" class="pa-4">
            <div class="logs-content">
              <div class="d-flex align-center justify-space-between mb-3">
                <div class="text-subtitle1">실행 로그</div>
                <div class="d-flex align-center">
                  <v-select
                    v-model="logLevel"
                    :items="logLevels"
                    label="로그 레벨"
                    density="compact"
                    variant="outlined"
                    style="width: 120px;"
                    class="mr-2"
                  />
                  <v-btn
                    variant="outlined"
                    size="small"
                    @click="refreshLogs"
                    :loading="logsLoading"
                    prepend-icon="mdi-refresh"
                  >
                    새로고침
                  </v-btn>
                </div>
              </div>

              <v-card variant="outlined" class="logs-container">
                <v-card-text class="pa-0">
                  <div v-if="logsLoading" class="text-center pa-4">
                    <v-progress-circular indeterminate size="32" />
                    <div class="mt-2">로그 로딩 중...</div>
                  </div>
                  <div v-else-if="!filteredLogs.length" class="text-center pa-4 text-disabled">
                    표시할 로그가 없습니다
                  </div>
                  <div v-else class="logs-list">
                    <div
                      v-for="(log, index) in filteredLogs"
                      :key="index"
                      class="log-entry"
                      :class="`log-${log.level}`"
                    >
                      <div class="log-header">
                        <span class="log-timestamp">{{ formatLogTimestamp(log.timestamp) }}</span>
                        <v-chip
                          :color="getLogLevelColor(log.level)"
                          size="x-small"
                          variant="tonal"
                          class="log-level-chip"
                        >
                          {{ log.level.toUpperCase() }}
                        </v-chip>
                        <span v-if="log.source" class="log-source">{{ log.source }}</span>
                      </div>
                      <div class="log-message">{{ log.message }}</div>
                      <div v-if="log.details" class="log-details">
                        <pre>{{ JSON.stringify(log.details, null, 2) }}</pre>
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-tabs-window-item>

          <!-- 에러 탭 -->
          <v-tabs-window-item value="errors" class="pa-4" v-if="hasErrors">
            <div class="errors-content">
              <div class="text-subtitle1 mb-3">에러 및 예외</div>
              
              <!-- 메인 에러 -->
              <v-alert
                v-if="execution.errorMessage"
                type="error"
                variant="outlined"
                class="mb-4"
              >
                <div class="error-header">
                  <strong>메인 에러:</strong>
                </div>
                <div class="error-message">{{ execution.errorMessage }}</div>
                <div v-if="execution.errorStack" class="error-stack mt-2">
                  <v-expansion-panels>
                    <v-expansion-panel title="스택 트레이스">
                      <v-expansion-panel-text>
                        <pre class="error-stack-content">{{ execution.errorStack }}</pre>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
              </v-alert>

              <!-- 경고 및 기타 에러 -->
              <div v-if="execution.warnings && execution.warnings.length">
                <div class="text-subtitle2 mb-2">경고</div>
                <v-alert
                  v-for="(warning, index) in execution.warnings"
                  :key="index"
                  type="warning"
                  variant="tonal"
                  class="mb-2"
                >
                  {{ warning }}
                </v-alert>
              </div>
            </div>
          </v-tabs-window-item>

          <!-- 설정 탭 -->
          <v-tabs-window-item value="config" class="pa-4">
            <div class="config-content">
              <div class="text-subtitle1 mb-3">실행 설정</div>
              
              <v-card variant="outlined">
                <v-card-text>
                  <div v-if="execution.config" class="config-tree">
                    <div
                      v-for="(value, key) in execution.config"
                      :key="key"
                      class="config-item"
                    >
                      <span class="config-key">{{ key }}:</span>
                      <span class="config-value">{{ formatConfigValue(value) }}</span>
                    </div>
                  </div>
                  <div v-else class="text-center text-disabled pa-4">
                    설정 정보가 없습니다
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>

      <!-- 액션 버튼 -->
      <v-card-actions class="px-4 py-2">
        <div class="d-flex align-center">
          <v-btn
            v-if="execution.status === 'running'"
            color="error"
            variant="outlined"
            @click="stopExecution"
            prepend-icon="mdi-stop"
          >
            실행 중지
          </v-btn>
          <v-btn
            v-if="execution.status === 'failed'"
            color="primary"
            variant="outlined"
            @click="retryExecution"
            prepend-icon="mdi-restart"
          >
            다시 실행
          </v-btn>
          <v-btn
            variant="outlined"
            @click="downloadLogs"
            prepend-icon="mdi-download"
          >
            로그 다운로드
          </v-btn>
        </div>
        <v-spacer />
        <v-btn @click="$emit('close')">닫기</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch } from 'vue';

export default {
  name: 'ExecutionDetailsDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    execution: {
      type: Object,
      default: null
    }
  },
  emits: ['update:modelValue', 'close', 'stop-execution', 'retry-execution'],
  setup(props, { emit }) {
    const activeTab = ref('overview');
    const logLevel = ref('all');
    const logsLoading = ref(false);

    // 로그 레벨 옵션
    const logLevels = [
      { title: '전체', value: 'all' },
      { title: 'Error', value: 'error' },
      { title: 'Warn', value: 'warn' },
      { title: 'Info', value: 'info' },
      { title: 'Debug', value: 'debug' }
    ];

    // 메트릭 테이블 헤더
    const metricsHeaders = [
      { title: '메트릭', key: 'name' },
      { title: '값', key: 'value' },
      { title: '단위', key: 'unit' },
      { title: '설명', key: 'description' }
    ];

    // 계산된 속성
    const hasErrors = computed(() => {
      return props.execution?.errorMessage || 
             (props.execution?.warnings && props.execution.warnings.length > 0) ||
             props.execution?.errorCount > 0;
    });

    const filteredLogs = computed(() => {
      if (!props.execution?.logs) return [];
      
      if (logLevel.value === 'all') {
        return props.execution.logs;
      }
      
      return props.execution.logs.filter(log => log.level === logLevel.value);
    });

    const detailMetrics = computed(() => {
      if (!props.execution) return [];
      
      return [
        {
          name: '처리된 레코드',
          value: formatNumber(props.execution.recordsProcessed || 0),
          unit: '건',
          description: '총 처리된 데이터 레코드 수'
        },
        {
          name: '초당 처리량',
          value: formatNumber(props.execution.recordsPerSecond || 0),
          unit: '건/초',
          description: '평균 초당 처리 속도'
        },
        {
          name: 'CPU 사용률',
          value: (props.execution.cpuUsage || 0) + '%',
          unit: '%',
          description: '평균 CPU 사용률'
        },
        {
          name: '메모리 사용량',
          value: formatBytes(props.execution.memoryUsage || 0),
          unit: 'MB',
          description: '최대 메모리 사용량'
        }
      ];
    });

    // 헬퍼 함수들
    const getStatusColor = (status) => {
      const colors = {
        'running': 'primary',
        'completed': 'success',
        'failed': 'error',
        'cancelled': 'warning',
        'pending': 'info'
      };
      return colors[status] || 'grey';
    };

    const getStatusIcon = (status) => {
      const icons = {
        'running': 'mdi-play',
        'completed': 'mdi-check',
        'failed': 'mdi-alert',
        'cancelled': 'mdi-cancel',
        'pending': 'mdi-clock'
      };
      return icons[status] || 'mdi-help';
    };

    const getStatusDisplayName = (status) => {
      const names = {
        'running': '실행 중',
        'completed': '완료',
        'failed': '실패',
        'cancelled': '취소됨',
        'pending': '대기 중'
      };
      return names[status] || status;
    };

    const getStepColor = (step) => {
      if (step.completed) return 'success';
      if (step.active) return 'primary';
      return 'grey';
    };

    const getStepIcon = (step) => {
      if (step.completed) return 'mdi-check-circle';
      if (step.active) return 'mdi-play-circle';
      return 'mdi-circle-outline';
    };

    const getLogLevelColor = (level) => {
      const colors = {
        'error': 'error',
        'warn': 'warning',
        'info': 'info',
        'debug': 'grey'
      };
      return colors[level] || 'grey';
    };

    // 포맷팅 함수들
    const formatDateTime = (timestamp) => {
      if (!timestamp) return '';
      return new Date(timestamp).toLocaleString('ko-KR');
    };

    const formatDuration = (duration) => {
      if (!duration) return '0ms';
      
      if (duration < 1000) {
        return `${duration}ms`;
      } else if (duration < 60000) {
        return `${(duration / 1000).toFixed(1)}s`;
      } else {
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
      }
    };

    const formatNumber = (num) => {
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
      } else {
        return num.toString();
      }
    };

    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B';
      
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatPercentage = (value) => {
      return (value * 100).toFixed(1) + '%';
    };

    const formatLogTimestamp = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString('ko-KR');
    };

    const formatConfigValue = (value) => {
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return value.toString();
    };

    const getMemoryPercentage = (memoryUsage) => {
      // 가정: 최대 메모리를 1GB로 설정
      const maxMemory = 1024 * 1024 * 1024; // 1GB in bytes
      return Math.min((memoryUsage / maxMemory) * 100, 100);
    };

    const getThroughputPath = (history) => {
      if (!history || history.length === 0) return '';
      
      const width = 300;
      const height = 150;
      const padding = 20;
      
      const maxValue = Math.max(...history.map(h => h.value));
      const stepX = (width - 2 * padding) / (history.length - 1);
      
      let path = '';
      history.forEach((point, index) => {
        const x = padding + index * stepX;
        const y = height - padding - ((point.value / maxValue) * (height - 2 * padding));
        
        if (index === 0) {
          path += `M ${x} ${y}`;
        } else {
          path += ` L ${x} ${y}`;
        }
      });
      
      return path;
    };

    // 이벤트 핸들러
    const refreshLogs = async () => {
      logsLoading.value = true;
      try {
        // 실제로는 API 호출로 로그를 다시 로드
        await new Promise(resolve => setTimeout(resolve, 1000));
      } finally {
        logsLoading.value = false;
      }
    };

    const stopExecution = () => {
      emit('stop-execution', props.execution);
    };

    const retryExecution = () => {
      emit('retry-execution', props.execution);
    };

    const downloadLogs = () => {
      if (!props.execution?.logs) return;
      
      const logsText = props.execution.logs
        .map(log => `[${formatLogTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}`)
        .join('\n');
      
      const blob = new Blob([logsText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `execution-${props.execution.id}-logs.txt`;
      link.click();
      URL.revokeObjectURL(url);
    };

    // 다이얼로그가 열릴 때 첫 번째 탭으로 리셋
    watch(() => props.modelValue, (newValue) => {
      if (newValue) {
        activeTab.value = 'overview';
      }
    });

    return {
      activeTab,
      logLevel,
      logsLoading,
      logLevels,
      metricsHeaders,
      hasErrors,
      filteredLogs,
      detailMetrics,
      getStatusColor,
      getStatusIcon,
      getStatusDisplayName,
      getStepColor,
      getStepIcon,
      getLogLevelColor,
      formatDateTime,
      formatDuration,
      formatNumber,
      formatBytes,
      formatPercentage,
      formatLogTimestamp,
      formatConfigValue,
      getMemoryPercentage,
      getThroughputPath,
      refreshLogs,
      stopExecution,
      retryExecution,
      downloadLogs
    };
  }
};
</script>

<style scoped>
.overview-content,
.metrics-content,
.logs-content,
.errors-content,
.config-content {
  max-height: 450px;
  overflow-y: auto;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.info-label {
  font-weight: 500;
  color: #666;
}

.info-value {
  font-family: monospace;
  font-weight: 500;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.metric-card {
  text-align: center;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: #1976d2;
  line-height: 1.2;
}

.metric-label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.flow-diagram {
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 16px 0;
}

.flow-step {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.step-content {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: white;
  margin: 0 8px;
}

.step-active .step-content {
  border-color: #1976d2;
  background: rgba(25, 118, 210, 0.05);
}

.step-completed .step-content {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.05);
}

.step-info {
  margin-left: 8px;
}

.step-name {
  font-weight: 500;
  font-size: 14px;
}

.step-records {
  font-size: 12px;
  color: #666;
}

.flow-arrow {
  margin: 0 4px;
}

.resource-metrics {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.resource-item {
  display: flex;
  flex-direction: column;
}

.mini-chart {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}

.logs-container {
  height: 400px;
}

.logs-list {
  height: 100%;
  overflow-y: auto;
  padding: 8px;
}

.log-entry {
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 4px;
  border-left: 4px solid;
  background: #f9f9f9;
}

.log-error {
  border-left-color: #f44336;
  background: rgba(244, 67, 54, 0.05);
}

.log-warn {
  border-left-color: #ff9800;
  background: rgba(255, 152, 0, 0.05);
}

.log-info {
  border-left-color: #2196f3;
  background: rgba(33, 150, 243, 0.05);
}

.log-debug {
  border-left-color: #9e9e9e;
  background: rgba(158, 158, 158, 0.05);
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.log-timestamp {
  font-family: monospace;
  font-size: 12px;
  color: #666;
}

.log-level-chip {
  font-size: 10px;
  font-weight: 600;
}

.log-source {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.log-message {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.log-details {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.log-details pre {
  font-size: 11px;
  margin: 0;
}

.error-header {
  margin-bottom: 8px;
}

.error-message {
  font-family: monospace;
  font-size: 14px;
  line-height: 1.4;
}

.error-stack-content {
  font-size: 12px;
  line-height: 1.3;
  margin: 0;
  color: #666;
}

.config-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.config-key {
  font-weight: 500;
  margin-right: 16px;
  min-width: 120px;
  color: #666;
}

.config-value {
  font-family: monospace;
  font-size: 13px;
  flex: 1;
  white-space: pre-wrap;
}

/* 스크롤바 스타일링 */
.overview-content::-webkit-scrollbar,
.metrics-content::-webkit-scrollbar,
.logs-content::-webkit-scrollbar,
.errors-content::-webkit-scrollbar,
.config-content::-webkit-scrollbar,
.logs-list::-webkit-scrollbar {
  width: 6px;
}

.overview-content::-webkit-scrollbar-track,
.metrics-content::-webkit-scrollbar-track,
.logs-content::-webkit-scrollbar-track,
.errors-content::-webkit-scrollbar-track,
.config-content::-webkit-scrollbar-track,
.logs-list::-webkit-scrollbar-track {
  background: transparent;
}

.overview-content::-webkit-scrollbar-thumb,
.metrics-content::-webkit-scrollbar-thumb,
.logs-content::-webkit-scrollbar-thumb,
.errors-content::-webkit-scrollbar-thumb,
.config-content::-webkit-scrollbar-thumb,
.logs-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .step-content {
    background: #2a2a2a;
    border-color: rgba(255, 255, 255, 0.12);
  }
  
  .step-active .step-content {
    background: rgba(25, 118, 210, 0.2);
  }
  
  .step-completed .step-content {
    background: rgba(76, 175, 80, 0.2);
  }
  
  .log-entry {
    background: #2a2a2a;
  }
  
  .log-details {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .config-item {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }
}

/* 반응형 디자인 */
@media (max-width: 600px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .flow-diagram {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .flow-step {
    flex-direction: column;
    margin-bottom: 8px;
  }
  
  .flow-arrow {
    transform: rotate(90deg);
    margin: 4px 0;
  }
  
  .log-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .config-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .config-key {
    min-width: auto;
    margin-bottom: 4px;
  }
}
</style>