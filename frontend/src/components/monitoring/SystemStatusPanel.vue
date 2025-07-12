<template>
  <div class="system-status-panel">
    <!-- 로딩 상태 -->
    <div v-if="loading" class="d-flex justify-center align-center pa-4">
      <v-progress-circular
        indeterminate
        color="primary"
        size="32"
      />
      <span class="ml-3">시스템 상태 확인 중...</span>
    </div>

    <!-- 데이터 없음 상태 -->
    <div v-else-if="!systems || systems.length === 0" class="text-center pa-4">
      <v-icon size="48" color="grey-lighten-1">mdi-server-off</v-icon>
      <div class="text-subtitle2 text-disabled mt-2">시스템 상태 데이터가 없습니다</div>
    </div>

    <!-- 시스템 상태 목록 -->
    <div v-else class="systems-list">
      <!-- 전체 상태 요약 -->
      <div class="status-summary mb-3">
        <div class="d-flex justify-space-between align-center">
          <div class="text-subtitle2">전체 시스템 상태</div>
          <v-chip
            :color="overallStatusColor"
            variant="tonal"
            size="small"
          >
            {{ overallStatusText }}
          </v-chip>
        </div>
        <div class="text-caption text-disabled mt-1">
          {{ healthySystems }}개 정상 / {{ totalSystems }}개 전체
        </div>
      </div>

      <v-divider class="mb-3" />

      <!-- 개별 시스템 상태 -->
      <div class="systems-grid">
        <v-card
          v-for="system in systems"
          :key="system.name"
          class="system-card mb-2"
          :class="getSystemCardClass(system.status)"
          variant="outlined"
          @click="showSystemDetails(system)"
        >
          <v-card-text class="pa-3">
            <div class="d-flex align-center justify-space-between">
              <!-- 시스템 정보 -->
              <div class="d-flex align-center flex-grow-1">
                <v-avatar
                  :color="getStatusColor(system.status)"
                  size="32"
                  class="mr-3"
                >
                  <v-icon
                    :icon="getSystemIcon(system.name)"
                    color="white"
                    size="18"
                  />
                </v-avatar>
                
                <div class="flex-grow-1">
                  <div class="text-subtitle2 font-weight-medium">
                    {{ getSystemDisplayName(system.name) }}
                  </div>
                  <div class="text-caption text-disabled">
                    {{ system.description || getSystemDescription(system.name) }}
                  </div>
                </div>
              </div>

              <!-- 상태 표시 -->
              <div class="text-right">
                <v-chip
                  :color="getStatusColor(system.status)"
                  variant="flat"
                  size="small"
                  class="mb-1"
                >
                  {{ getStatusDisplayName(system.status) }}
                </v-chip>
                
                <!-- 응답 시간 -->
                <div v-if="system.responseTime" class="text-caption text-disabled">
                  {{ system.responseTime }}ms
                </div>
              </div>
            </div>

            <!-- 추가 메트릭 (확장된 상태) -->
            <div v-if="system.expanded || showDetails" class="mt-3">
              <v-divider class="mb-2" />
              
              <div class="metrics-grid">
                <!-- CPU 사용률 -->
                <div v-if="system.cpu" class="metric-item">
                  <div class="d-flex align-center justify-space-between">
                    <span class="text-caption">CPU</span>
                    <span class="text-caption font-weight-medium">{{ system.cpu }}%</span>
                  </div>
                  <v-progress-linear
                    :model-value="system.cpu"
                    :color="getMetricColor(system.cpu, 80, 90)"
                    height="4"
                    class="mt-1"
                  />
                </div>

                <!-- 메모리 사용률 -->
                <div v-if="system.memory" class="metric-item">
                  <div class="d-flex align-center justify-space-between">
                    <span class="text-caption">Memory</span>
                    <span class="text-caption font-weight-medium">{{ system.memory }}%</span>
                  </div>
                  <v-progress-linear
                    :model-value="system.memory"
                    :color="getMetricColor(system.memory, 80, 90)"
                    height="4"
                    class="mt-1"
                  />
                </div>

                <!-- 디스크 사용률 -->
                <div v-if="system.disk" class="metric-item">
                  <div class="d-flex align-center justify-space-between">
                    <span class="text-caption">Disk</span>
                    <span class="text-caption font-weight-medium">{{ system.disk }}%</span>
                  </div>
                  <v-progress-linear
                    :model-value="system.disk"
                    :color="getMetricColor(system.disk, 85, 95)"
                    height="4"
                    class="mt-1"
                  />
                </div>

                <!-- 연결 수 -->
                <div v-if="system.connections" class="metric-item">
                  <div class="d-flex align-center justify-space-between">
                    <span class="text-caption">Connections</span>
                    <span class="text-caption font-weight-medium">{{ system.connections }}</span>
                  </div>
                </div>
              </div>

              <!-- 마지막 체크 시간 -->
              <div v-if="system.lastCheck" class="text-caption text-disabled mt-2">
                마지막 확인: {{ formatTimestamp(system.lastCheck) }}
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- 새로고침 버튼 -->
      <div class="text-center mt-3">
        <v-btn
          variant="outlined"
          size="small"
          @click="refreshStatus"
          :loading="refreshing"
          prepend-icon="mdi-refresh"
        >
          새로고침
        </v-btn>
      </div>
    </div>

    <!-- 시스템 상세 대화상자 -->
    <v-dialog
      v-model="detailsDialog"
      max-width="600"
    >
      <v-card v-if="selectedSystem">
        <v-card-title class="d-flex align-center">
          <v-icon :icon="getSystemIcon(selectedSystem.name)" class="mr-2" />
          {{ getSystemDisplayName(selectedSystem.name) }} 상세 정보
        </v-card-title>
        
        <v-divider />
        
        <v-card-text class="pa-4">
          <!-- 기본 정보 -->
          <div class="mb-4">
            <h4 class="text-h6 mb-2">기본 정보</h4>
            <v-row>
              <v-col cols="6">
                <div class="text-caption text-disabled">상태</div>
                <v-chip
                  :color="getStatusColor(selectedSystem.status)"
                  variant="tonal"
                  size="small"
                >
                  {{ getStatusDisplayName(selectedSystem.status) }}
                </v-chip>
              </v-col>
              <v-col cols="6" v-if="selectedSystem.responseTime">
                <div class="text-caption text-disabled">응답 시간</div>
                <div class="text-subtitle2">{{ selectedSystem.responseTime }}ms</div>
              </v-col>
            </v-row>
          </div>

          <!-- 성능 메트릭 -->
          <div v-if="hasPerformanceMetrics(selectedSystem)" class="mb-4">
            <h4 class="text-h6 mb-2">성능 메트릭</h4>
            <div class="metrics-detail">
              <div v-if="selectedSystem.cpu" class="metric-row">
                <div class="d-flex align-center justify-space-between mb-1">
                  <span>CPU 사용률</span>
                  <span class="font-weight-medium">{{ selectedSystem.cpu }}%</span>
                </div>
                <v-progress-linear
                  :model-value="selectedSystem.cpu"
                  :color="getMetricColor(selectedSystem.cpu, 80, 90)"
                  height="8"
                />
              </div>

              <div v-if="selectedSystem.memory" class="metric-row">
                <div class="d-flex align-center justify-space-between mb-1">
                  <span>메모리 사용률</span>
                  <span class="font-weight-medium">{{ selectedSystem.memory }}%</span>
                </div>
                <v-progress-linear
                  :model-value="selectedSystem.memory"
                  :color="getMetricColor(selectedSystem.memory, 80, 90)"
                  height="8"
                />
              </div>

              <div v-if="selectedSystem.disk" class="metric-row">
                <div class="d-flex align-center justify-space-between mb-1">
                  <span>디스크 사용률</span>
                  <span class="font-weight-medium">{{ selectedSystem.disk }}%</span>
                </div>
                <v-progress-linear
                  :model-value="selectedSystem.disk"
                  :color="getMetricColor(selectedSystem.disk, 85, 95)"
                  height="8"
                />
              </div>
            </div>
          </div>

          <!-- 추가 정보 -->
          <div v-if="selectedSystem.details" class="mb-4">
            <h4 class="text-h6 mb-2">추가 정보</h4>
            <div
              v-for="(value, key) in selectedSystem.details"
              :key="key"
              class="d-flex justify-space-between py-1"
            >
              <span class="text-capitalize">{{ key }}</span>
              <span class="font-weight-medium">{{ value }}</span>
            </div>
          </div>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn @click="detailsDialog = false">닫기</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { ref, computed } from 'vue';

export default {
  name: 'SystemStatusPanel',
  props: {
    systems: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    showDetails: {
      type: Boolean,
      default: false
    }
  },
  emits: ['refresh', 'system-click'],
  setup(props, { emit }) {
    const refreshing = ref(false);
    const detailsDialog = ref(false);
    const selectedSystem = ref(null);

    // 전체 상태 계산
    const totalSystems = computed(() => props.systems.length);
    
    const healthySystems = computed(() => 
      props.systems.filter(system => system.status === 'healthy' || system.status === 'up').length
    );

    const overallStatusColor = computed(() => {
      const healthyRatio = healthySystems.value / totalSystems.value;
      if (healthyRatio === 1) return 'success';
      if (healthyRatio >= 0.8) return 'warning';
      return 'error';
    });

    const overallStatusText = computed(() => {
      const healthyRatio = healthySystems.value / totalSystems.value;
      if (healthyRatio === 1) return '모든 시스템 정상';
      if (healthyRatio >= 0.8) return '일부 시스템 주의';
      return '시스템 오류 발생';
    });

    // 시스템 아이콘 매핑
    const getSystemIcon = (systemName) => {
      const iconMap = {
        'database': 'mdi-database',
        'api': 'mdi-api',
        'nifi': 'mdi-water-pump',
        'web': 'mdi-web',
        'cache': 'mdi-cached',
        'queue': 'mdi-view-list',
        'storage': 'mdi-harddisk',
        'network': 'mdi-network',
        'auth': 'mdi-shield-account'
      };
      
      // 키워드 기반 매칭
      for (const [key, icon] of Object.entries(iconMap)) {
        if (systemName.toLowerCase().includes(key)) {
          return icon;
        }
      }
      
      return 'mdi-server';
    };

    // 시스템 표시 이름
    const getSystemDisplayName = (systemName) => {
      const nameMap = {
        'database': '데이터베이스',
        'api': 'API 서버',
        'nifi': 'NiFi 클러스터',
        'web': '웹 서버',
        'cache': '캐시 서버',
        'queue': '메시지 큐',
        'storage': '스토리지',
        'network': '네트워크',
        'auth': '인증 서버'
      };
      
      return nameMap[systemName] || systemName;
    };

    // 시스템 설명
    const getSystemDescription = (systemName) => {
      const descMap = {
        'database': '데이터 저장 및 관리',
        'api': 'REST API 엔드포인트',
        'nifi': '데이터 플로우 처리',
        'web': '웹 애플리케이션 서버',
        'cache': '데이터 캐싱',
        'queue': '비동기 메시지 처리',
        'storage': '파일 저장소',
        'network': '네트워크 연결',
        'auth': '사용자 인증'
      };
      
      return descMap[systemName] || '시스템 구성 요소';
    };

    // 상태 색상
    const getStatusColor = (status) => {
      const colorMap = {
        'healthy': 'success',
        'up': 'success',
        'warning': 'warning',
        'down': 'error',
        'error': 'error',
        'maintenance': 'info',
        'unknown': 'grey'
      };
      
      return colorMap[status] || 'grey';
    };

    // 상태 표시 이름
    const getStatusDisplayName = (status) => {
      const nameMap = {
        'healthy': '정상',
        'up': '정상',
        'warning': '주의',
        'down': '오류',
        'error': '오류',
        'maintenance': '점검중',
        'unknown': '알 수 없음'
      };
      
      return nameMap[status] || status;
    };

    // 시스템 카드 클래스
    const getSystemCardClass = (status) => {
      return `system-card--${status}`;
    };

    // 메트릭 색상 (임계값 기반)
    const getMetricColor = (value, warningThreshold, errorThreshold) => {
      if (value >= errorThreshold) return 'error';
      if (value >= warningThreshold) return 'warning';
      return 'success';
    };

    // 성능 메트릭 존재 여부
    const hasPerformanceMetrics = (system) => {
      return system.cpu || system.memory || system.disk || system.connections;
    };

    // 시간 포맷팅
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

    // 시스템 상세 보기
    const showSystemDetails = (system) => {
      selectedSystem.value = system;
      detailsDialog.value = true;
      emit('system-click', system);
    };

    // 상태 새로고침
    const refreshStatus = async () => {
      refreshing.value = true;
      try {
        emit('refresh');
        // 2초 후 로딩 해제 (실제로는 이벤트 기반으로 처리)
        setTimeout(() => {
          refreshing.value = false;
        }, 2000);
      } catch (error) {
        console.error('상태 새로고침 실패:', error);
        refreshing.value = false;
      }
    };

    return {
      refreshing,
      detailsDialog,
      selectedSystem,
      totalSystems,
      healthySystems,
      overallStatusColor,
      overallStatusText,
      getSystemIcon,
      getSystemDisplayName,
      getSystemDescription,
      getStatusColor,
      getStatusDisplayName,
      getSystemCardClass,
      getMetricColor,
      hasPerformanceMetrics,
      formatTimestamp,
      showSystemDetails,
      refreshStatus
    };
  }
};
</script>

<style scoped>
.system-status-panel {
  width: 100%;
}

.status-summary {
  padding: 12px 0;
}

.systems-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.system-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 8px;
}

.system-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
}

.system-card--healthy {
  border-left: 4px solid #4caf50;
}

.system-card--up {
  border-left: 4px solid #4caf50;
}

.system-card--warning {
  border-left: 4px solid #ff9800;
}

.system-card--down {
  border-left: 4px solid #f44336;
}

.system-card--error {
  border-left: 4px solid #f44336;
}

.system-card--maintenance {
  border-left: 4px solid #2196f3;
}

.system-card--unknown {
  border-left: 4px solid #9e9e9e;
}

.metrics-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.metric-item {
  width: 100%;
}

.metrics-detail .metric-row {
  margin-bottom: 16px;
}

.metrics-detail .metric-row:last-child {
  margin-bottom: 0;
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .system-card {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

/* 반응형 디자인 */
@media (max-width: 600px) {
  .systems-grid {
    gap: 6px;
  }
  
  .system-card {
    margin-bottom: 4px;
  }
}
</style>