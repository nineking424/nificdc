<template>
  <div class="recent-executions-list">
    <!-- 로딩 상태 -->
    <div v-if="loading" class="d-flex justify-center align-center pa-4">
      <v-progress-circular
        indeterminate
        color="primary"
        size="32"
      />
      <span class="ml-3">실행 이력 로딩 중...</span>
    </div>

    <!-- 데이터 없음 상태 -->
    <div v-else-if="!executions || executions.length === 0" class="text-center pa-4">
      <v-icon size="48" color="grey-lighten-1">mdi-clock-outline</v-icon>
      <div class="text-subtitle2 text-disabled mt-2">최근 실행 이력이 없습니다</div>
    </div>

    <!-- 실행 목록 -->
    <div v-else class="executions-container">
      <!-- 헤더 -->
      <div v-if="showHeader" class="list-header d-flex justify-space-between align-center mb-3">
        <div class="text-subtitle2">최근 작업 실행</div>
        <v-btn
          variant="text"
          size="small"
          @click="refreshList"
          :loading="refreshing"
        >
          <v-icon>mdi-refresh</v-icon>
        </v-btn>
      </div>

      <!-- 실행 항목들 -->
      <div class="executions-list">
        <v-card
          v-for="execution in displayedExecutions"
          :key="execution.id"
          class="execution-item mb-2"
          :class="getExecutionCardClass(execution.status)"
          variant="outlined"
          @click="selectExecution(execution)"
        >
          <v-card-text class="pa-3">
            <div class="d-flex align-center">
              <!-- 상태 표시 -->
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

              <!-- 실행 정보 -->
              <div class="execution-info flex-grow-1">
                <div class="d-flex align-center justify-space-between">
                  <div class="execution-title">
                    {{ execution.jobName || `Job ${execution.jobId}` }}
                  </div>
                  <div class="execution-time text-caption text-disabled">
                    {{ formatTimestamp(execution.startedAt) }}
                  </div>
                </div>
                
                <!-- 부제목 -->
                <div class="execution-subtitle text-caption text-disabled">
                  ID: {{ execution.id }} · {{ execution.jobType || 'Unknown Type' }}
                </div>

                <!-- 진행률 표시 (진행 중인 경우) -->
                <div v-if="execution.status === 'running' && execution.progress !== undefined" class="mt-2">
                  <v-progress-linear
                    :model-value="execution.progress"
                    color="primary"
                    height="4"
                    class="mb-1"
                  />
                  <div class="text-caption text-disabled">{{ execution.progress }}% 완료</div>
                </div>

                <!-- 메트릭 정보 -->
                <div v-if="showMetrics && hasMetrics(execution)" class="execution-metrics mt-2">
                  <div class="d-flex align-center flex-wrap">
                    <!-- 처리량 -->
                    <div v-if="execution.recordsProcessed" class="metric-chip">
                      <v-chip size="x-small" variant="outlined">
                        <v-icon size="12" class="mr-1">mdi-database</v-icon>
                        {{ formatNumber(execution.recordsProcessed) }}건
                      </v-chip>
                    </div>

                    <!-- 실행 시간 -->
                    <div v-if="execution.duration" class="metric-chip">
                      <v-chip size="x-small" variant="outlined">
                        <v-icon size="12" class="mr-1">mdi-timer</v-icon>
                        {{ formatDuration(execution.duration) }}
                      </v-chip>
                    </div>

                    <!-- 에러 수 -->
                    <div v-if="execution.errorCount > 0" class="metric-chip">
                      <v-chip size="x-small" variant="outlined" color="error">
                        <v-icon size="12" class="mr-1">mdi-alert</v-icon>
                        {{ execution.errorCount }}개 에러
                      </v-chip>
                    </div>

                    <!-- 처리 속도 -->
                    <div v-if="execution.recordsPerSecond" class="metric-chip">
                      <v-chip size="x-small" variant="outlined" color="info">
                        <v-icon size="12" class="mr-1">mdi-speedometer</v-icon>
                        {{ formatNumber(execution.recordsPerSecond) }}/s
                      </v-chip>
                    </div>
                  </div>
                </div>

                <!-- 에러 메시지 (실패한 경우) -->
                <div v-if="execution.status === 'failed' && execution.errorMessage" class="execution-error mt-2">
                  <v-alert
                    type="error"
                    variant="tonal"
                    density="compact"
                    class="text-caption"
                  >
                    {{ execution.errorMessage }}
                  </v-alert>
                </div>
              </div>

              <!-- 액션 버튼 -->
              <div class="execution-actions ml-2">
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      v-bind="props"
                      icon="mdi-dots-vertical"
                      variant="text"
                      size="small"
                      @click.stop
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item @click="viewDetails(execution)">
                      <v-list-item-title>
                        <v-icon class="mr-2" size="small">mdi-eye</v-icon>
                        상세 보기
                      </v-list-item-title>
                    </v-list-item>
                    <v-list-item @click="viewLogs(execution)">
                      <v-list-item-title>
                        <v-icon class="mr-2" size="small">mdi-text-box</v-icon>
                        로그 보기
                      </v-list-item-title>
                    </v-list-item>
                    <v-list-item 
                      v-if="execution.status === 'running'"
                      @click="stopExecution(execution)"
                    >
                      <v-list-item-title>
                        <v-icon class="mr-2" size="small">mdi-stop</v-icon>
                        실행 중지
                      </v-list-item-title>
                    </v-list-item>
                    <v-list-item 
                      v-if="execution.status === 'failed'"
                      @click="retryExecution(execution)"
                    >
                      <v-list-item-title>
                        <v-icon class="mr-2" size="small">mdi-restart</v-icon>
                        다시 실행
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- 더 보기 버튼 -->
      <div v-if="hasMore" class="text-center mt-3">
        <v-btn
          variant="outlined"
          size="small"
          @click="loadMore"
          :loading="loadingMore"
        >
          더 보기 ({{ remainingCount }}개 남음)
        </v-btn>
      </div>

      <!-- 필터 및 정렬 옵션 -->
      <div v-if="showFilters" class="filters-section mt-3">
        <v-divider class="mb-3" />
        <div class="d-flex align-center flex-wrap">
          <!-- 상태 필터 -->
          <v-select
            v-model="statusFilter"
            :items="statusFilterOptions"
            label="상태 필터"
            density="compact"
            variant="outlined"
            style="width: 150px;"
            class="mr-2 mb-2"
            clearable
          />

          <!-- 작업 타입 필터 -->
          <v-select
            v-model="jobTypeFilter"
            :items="jobTypeFilterOptions"
            label="작업 타입"
            density="compact"
            variant="outlined"
            style="width: 150px;"
            class="mr-2 mb-2"
            clearable
          />

          <!-- 정렬 옵션 -->
          <v-select
            v-model="sortBy"
            :items="sortOptions"
            label="정렬"
            density="compact"
            variant="outlined"
            style="width: 150px;"
            class="mr-2 mb-2"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';

export default {
  name: 'RecentExecutionsList',
  props: {
    executions: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    showHeader: {
      type: Boolean,
      default: true
    },
    showMetrics: {
      type: Boolean,
      default: true
    },
    showFilters: {
      type: Boolean,
      default: false
    },
    maxItems: {
      type: Number,
      default: 10
    }
  },
  emits: [
    'execution-click',
    'execution-details',
    'execution-logs',
    'execution-stop',
    'execution-retry',
    'refresh'
  ],
  setup(props, { emit }) {
    const refreshing = ref(false);
    const loadingMore = ref(false);
    const displayLimit = ref(props.maxItems);
    
    // 필터 및 정렬 상태
    const statusFilter = ref(null);
    const jobTypeFilter = ref(null);
    const sortBy = ref('startedAt_desc');

    // 필터 옵션
    const statusFilterOptions = [
      { title: '실행 중', value: 'running' },
      { title: '완료', value: 'completed' },
      { title: '실패', value: 'failed' },
      { title: '취소됨', value: 'cancelled' },
      { title: '대기 중', value: 'pending' }
    ];

    const jobTypeFilterOptions = computed(() => {
      const types = [...new Set(props.executions.map(e => e.jobType).filter(Boolean))];
      return types.map(type => ({ title: type, value: type }));
    });

    const sortOptions = [
      { title: '시작 시간 (최신순)', value: 'startedAt_desc' },
      { title: '시작 시간 (오래된순)', value: 'startedAt_asc' },
      { title: '완료 시간 (최신순)', value: 'completedAt_desc' },
      { title: '실행 시간 (긴순)', value: 'duration_desc' },
      { title: '처리량 (높은순)', value: 'recordsProcessed_desc' }
    ];

    // 필터링 및 정렬된 실행 목록
    const filteredExecutions = computed(() => {
      let filtered = [...props.executions];

      // 상태 필터 적용
      if (statusFilter.value) {
        filtered = filtered.filter(execution => execution.status === statusFilter.value);
      }

      // 작업 타입 필터 적용
      if (jobTypeFilter.value) {
        filtered = filtered.filter(execution => execution.jobType === jobTypeFilter.value);
      }

      // 정렬 적용
      const [field, direction] = sortBy.value.split('_');
      filtered.sort((a, b) => {
        let aVal = a[field];
        let bVal = b[field];

        if (field.includes('At')) {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }

        if (direction === 'desc') {
          return bVal - aVal;
        } else {
          return aVal - bVal;
        }
      });

      return filtered;
    });

    // 표시될 실행 목록
    const displayedExecutions = computed(() => {
      return filteredExecutions.value.slice(0, displayLimit.value);
    });

    // 더 보기 관련
    const hasMore = computed(() => {
      return filteredExecutions.value.length > displayLimit.value;
    });

    const remainingCount = computed(() => {
      return filteredExecutions.value.length - displayLimit.value;
    });

    // 상태별 색상 및 아이콘
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

    const getExecutionCardClass = (status) => {
      return `execution-card--${status}`;
    };

    // 메트릭 존재 여부 확인
    const hasMetrics = (execution) => {
      return execution.recordsProcessed || 
             execution.duration || 
             execution.errorCount > 0 || 
             execution.recordsPerSecond;
    };

    // 포맷팅 함수들
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return '';
      
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      
      if (diffMs < 60000) {
        return '방금 전';
      } else if (diffMs < 3600000) {
        return `${Math.floor(diffMs / 60000)}분 전`;
      } else if (diffMs < 86400000) {
        return `${Math.floor(diffMs / 3600000)}시간 전`;
      } else {
        return date.toLocaleDateString('ko-KR');
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

    const formatDuration = (duration) => {
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

    // 이벤트 핸들러
    const selectExecution = (execution) => {
      emit('execution-click', execution);
    };

    const viewDetails = (execution) => {
      emit('execution-details', execution);
    };

    const viewLogs = (execution) => {
      emit('execution-logs', execution);
    };

    const stopExecution = (execution) => {
      emit('execution-stop', execution);
    };

    const retryExecution = (execution) => {
      emit('execution-retry', execution);
    };

    const refreshList = async () => {
      refreshing.value = true;
      try {
        emit('refresh');
        // 실제로는 부모 컴포넌트에서 데이터를 다시 로드
        setTimeout(() => {
          refreshing.value = false;
        }, 1000);
      } catch (error) {
        console.error('목록 새로고침 실패:', error);
        refreshing.value = false;
      }
    };

    const loadMore = () => {
      loadingMore.value = true;
      displayLimit.value += props.maxItems;
      
      // 애니메이션을 위한 딜레이
      setTimeout(() => {
        loadingMore.value = false;
      }, 500);
    };

    // 필터 변경 시 표시 제한 초기화
    watch([statusFilter, jobTypeFilter, sortBy], () => {
      displayLimit.value = props.maxItems;
    });

    return {
      refreshing,
      loadingMore,
      statusFilter,
      jobTypeFilter,
      sortBy,
      statusFilterOptions,
      jobTypeFilterOptions,
      sortOptions,
      displayedExecutions,
      hasMore,
      remainingCount,
      getStatusColor,
      getStatusIcon,
      getExecutionCardClass,
      hasMetrics,
      formatTimestamp,
      formatNumber,
      formatDuration,
      selectExecution,
      viewDetails,
      viewLogs,
      stopExecution,
      retryExecution,
      refreshList,
      loadMore
    };
  }
};
</script>

<style scoped>
.recent-executions-list {
  width: 100%;
}

.executions-container {
  width: 100%;
}

.executions-list {
  max-height: 400px;
  overflow-y: auto;
}

.execution-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.execution-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.execution-card--running {
  border-left: 4px solid #1976d2;
}

.execution-card--completed {
  border-left: 4px solid #4caf50;
}

.execution-card--failed {
  border-left: 4px solid #f44336;
}

.execution-card--cancelled {
  border-left: 4px solid #ff9800;
}

.execution-card--pending {
  border-left: 4px solid #2196f3;
}

.execution-info {
  min-width: 0; /* flex 항목의 텍스트 오버플로우 방지 */
}

.execution-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-subtitle {
  line-height: 1.2;
  margin-top: 2px;
}

.execution-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.metric-chip {
  margin-right: 4px;
  margin-bottom: 2px;
}

.execution-error {
  margin-top: 8px;
}

.execution-actions {
  flex-shrink: 0;
}

.filters-section {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 12px;
}

/* 스크롤바 스타일링 */
.executions-list::-webkit-scrollbar {
  width: 6px;
}

.executions-list::-webkit-scrollbar-track {
  background: transparent;
}

.executions-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.executions-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .filters-section {
    background: rgba(255, 255, 255, 0.05);
  }
}

/* 반응형 디자인 */
@media (max-width: 600px) {
  .execution-metrics {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .metric-chip {
    margin-right: 0;
    margin-bottom: 4px;
  }
  
  .filters-section .d-flex {
    flex-direction: column;
  }
  
  .filters-section .v-select {
    width: 100% !important;
    margin-right: 0 !important;
  }
}

/* 로딩 애니메이션 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.execution-item {
  animation: fadeIn 0.3s ease-out;
}
</style>