<template>
  <div class="alerts-panel">
    <!-- 로딩 상태 -->
    <div v-if="loading" class="d-flex justify-center align-center pa-4">
      <v-progress-circular
        indeterminate
        color="warning"
        size="32"
      />
      <span class="ml-3">알림 데이터 로딩 중...</span>
    </div>

    <!-- 알림 없음 상태 -->
    <div v-else-if="!alerts || alerts.length === 0" class="text-center pa-4">
      <v-icon size="48" color="success">mdi-check-circle</v-icon>
      <div class="text-subtitle2 text-disabled mt-2">활성 알림이 없습니다</div>
      <div class="text-caption text-disabled">시스템이 정상적으로 운영 중입니다</div>
    </div>

    <!-- 알림 목록 -->
    <div v-else class="alerts-container">
      <!-- 헤더 -->
      <div v-if="showHeader" class="alerts-header d-flex justify-space-between align-center mb-3">
        <div class="d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-bell</v-icon>
          <div>
            <div class="text-subtitle2">실시간 알림</div>
            <div class="text-caption text-disabled">
              {{ activeAlerts }}개 활성 / {{ totalAlerts }}개 전체
            </div>
          </div>
        </div>

        <div class="d-flex align-center">
          <!-- 필터 버튼 -->
          <v-btn-toggle
            v-model="severityFilter"
            multiple
            density="compact"
            size="small"
            class="mr-2"
          >
            <v-btn value="critical" color="error">치명적</v-btn>
            <v-btn value="high" color="warning">높음</v-btn>
            <v-btn value="medium" color="info">보통</v-btn>
            <v-btn value="low" color="success">낮음</v-btn>
          </v-btn-toggle>

          <!-- 전체 해제 버튼 -->
          <v-btn
            v-if="activeAlerts > 0"
            variant="outlined"
            size="small"
            @click="dismissAllAlerts"
            prepend-icon="mdi-check-all"
          >
            전체 해제
          </v-btn>
        </div>
      </div>

      <!-- 알림 목록 -->
      <div class="alerts-list">
        <div
          v-for="alert in filteredAlerts"
          :key="alert.id"
          class="alert-item"
          :class="[
            `alert-item--${alert.severity}`,
            { 'alert-acknowledged': alert.acknowledged }
          ]"
        >
          <div class="alert-content">
            <!-- 알림 헤더 -->
            <div class="alert-header d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <!-- 심각도 표시 -->
                <v-icon
                  :color="getSeverityColor(alert.severity)"
                  :icon="getSeverityIcon(alert.severity)"
                  size="20"
                  class="mr-2"
                />

                <!-- 제목 -->
                <div class="alert-title">{{ alert.title || getDefaultTitle(alert) }}</div>

                <!-- 상태 칩 -->
                <v-chip
                  :color="getSeverityColor(alert.severity)"
                  size="x-small"
                  variant="tonal"
                  class="ml-2"
                >
                  {{ getSeverityDisplayName(alert.severity) }}
                </v-chip>

                <!-- 확인됨 표시 -->
                <v-chip
                  v-if="alert.acknowledged"
                  color="success"
                  size="x-small"
                  variant="outlined"
                  class="ml-2"
                >
                  <v-icon size="12" class="mr-1">mdi-check</v-icon>
                  확인됨
                </v-chip>
              </div>

              <!-- 시간 표시 -->
              <div class="alert-time text-caption text-disabled">
                {{ formatTimestamp(alert.timestamp) }}
              </div>
            </div>

            <!-- 알림 메시지 -->
            <div class="alert-message text-body-2 mt-2">
              {{ alert.message }}
            </div>

            <!-- 제안된 조치 -->
            <div v-if="alert.suggestedAction" class="alert-action mt-2">
              <v-alert
                type="info"
                variant="tonal"
                density="compact"
                class="text-caption"
              >
                <strong>권장 조치:</strong> {{ alert.suggestedAction }}
              </v-alert>
            </div>

            <!-- 상세 정보 (확장 가능) -->
            <div v-if="alert.expanded && alert.details" class="alert-details mt-2">
              <v-divider class="mb-2" />
              <div class="details-grid">
                <div
                  v-for="(value, key) in alert.details"
                  :key="key"
                  class="detail-item"
                >
                  <span class="detail-label">{{ formatDetailKey(key) }}:</span>
                  <span class="detail-value">{{ value }}</span>
                </div>
              </div>
            </div>

            <!-- 액션 버튼들 -->
            <div class="alert-actions d-flex align-center justify-space-between mt-3">
              <div class="d-flex align-center">
                <!-- 확장/축소 버튼 -->
                <v-btn
                  v-if="alert.details"
                  variant="text"
                  size="small"
                  @click="toggleAlertExpansion(alert)"
                >
                  <v-icon>{{ alert.expanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                  {{ alert.expanded ? '간단히' : '상세히' }}
                </v-btn>

                <!-- 관련 링크 -->
                <v-btn
                  v-if="alert.relatedUrl"
                  variant="text"
                  size="small"
                  @click="openRelatedLink(alert.relatedUrl)"
                  prepend-icon="mdi-open-in-new"
                >
                  관련 정보
                </v-btn>
              </div>

              <div class="d-flex align-center">
                <!-- 확인 버튼 -->
                <v-btn
                  v-if="!alert.acknowledged"
                  variant="outlined"
                  size="small"
                  color="primary"
                  @click="acknowledgeAlert(alert)"
                  prepend-icon="mdi-check"
                  class="mr-2"
                >
                  확인
                </v-btn>

                <!-- 해제 버튼 -->
                <v-btn
                  variant="outlined"
                  size="small"
                  color="error"
                  @click="dismissAlert(alert)"
                  prepend-icon="mdi-close"
                >
                  해제
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 페이지네이션 -->
      <div v-if="totalPages > 1" class="alerts-pagination mt-3">
        <v-pagination
          v-model="currentPage"
          :length="totalPages"
          :total-visible="5"
          size="small"
        />
      </div>

      <!-- 알림 설정 -->
      <div v-if="showSettings" class="alerts-settings mt-3">
        <v-divider class="mb-3" />
        <div class="d-flex align-center justify-space-between">
          <div class="text-subtitle2">알림 설정</div>
          <v-switch
            v-model="alertsEnabled"
            label="알림 활성화"
            color="primary"
            density="compact"
            @change="toggleAlerts"
          />
        </div>
        
        <div class="settings-grid mt-2">
          <v-select
            v-model="minSeverityLevel"
            :items="severityLevels"
            label="최소 심각도 수준"
            density="compact"
            variant="outlined"
            @update:model-value="updateMinSeverity"
          />
          
          <v-switch
            v-model="soundEnabled"
            label="알림음"
            color="primary"
            density="compact"
            @change="toggleSound"
          />
        </div>
      </div>
    </div>

    <!-- 확인 대화상자 -->
    <v-dialog
      v-model="confirmDialog.show"
      max-width="400"
    >
      <v-card>
        <v-card-title>{{ confirmDialog.title }}</v-card-title>
        <v-card-text>{{ confirmDialog.message }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="confirmDialog.show = false">취소</v-btn>
          <v-btn
            color="primary"
            @click="confirmDialog.action(); confirmDialog.show = false"
          >
            확인
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';

export default {
  name: 'AlertsPanel',
  props: {
    alerts: {
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
    showSettings: {
      type: Boolean,
      default: false
    },
    itemsPerPage: {
      type: Number,
      default: 5
    }
  },
  emits: [
    'alert-acknowledge',
    'alert-dismiss',
    'alert-dismiss-all',
    'settings-change'
  ],
  setup(props, { emit }) {
    // 상태 관리
    const severityFilter = ref(['critical', 'high', 'medium', 'low']);
    const currentPage = ref(1);
    const alertsEnabled = ref(true);
    const soundEnabled = ref(false);
    const minSeverityLevel = ref('low');

    // 확인 대화상자
    const confirmDialog = ref({
      show: false,
      title: '',
      message: '',
      action: () => {}
    });

    // 심각도 수준 옵션
    const severityLevels = [
      { title: '낮음', value: 'low' },
      { title: '보통', value: 'medium' },
      { title: '높음', value: 'high' },
      { title: '치명적', value: 'critical' }
    ];

    // 필터링된 알림
    const filteredAlerts = computed(() => {
      return props.alerts
        .filter(alert => severityFilter.value.includes(alert.severity))
        .slice((currentPage.value - 1) * props.itemsPerPage, currentPage.value * props.itemsPerPage);
    });

    // 통계 계산
    const totalAlerts = computed(() => props.alerts.length);
    const activeAlerts = computed(() => props.alerts.filter(alert => !alert.acknowledged).length);
    const totalPages = computed(() => 
      Math.ceil(props.alerts.filter(alert => severityFilter.value.includes(alert.severity)).length / props.itemsPerPage)
    );

    // 심각도별 색상 및 아이콘
    const getSeverityColor = (severity) => {
      const colors = {
        'critical': 'error',
        'high': 'warning',
        'medium': 'info',
        'low': 'success'
      };
      return colors[severity] || 'grey';
    };

    const getSeverityIcon = (severity) => {
      const icons = {
        'critical': 'mdi-alert-octagon',
        'high': 'mdi-alert',
        'medium': 'mdi-information',
        'low': 'mdi-check-circle'
      };
      return icons[severity] || 'mdi-bell';
    };

    const getSeverityDisplayName = (severity) => {
      const names = {
        'critical': '치명적',
        'high': '높음',
        'medium': '보통',
        'low': '낮음'
      };
      return names[severity] || severity;
    };

    // 기본 제목 생성
    const getDefaultTitle = (alert) => {
      const titles = {
        'performance_alert': '성능 알림',
        'error_analysis': '에러 분석 알림',
        'system_status': '시스템 상태 알림',
        'security': '보안 알림',
        'maintenance': '유지보수 알림'
      };
      return titles[alert.type] || '시스템 알림';
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

    // 상세 정보 키 포맷팅
    const formatDetailKey = (key) => {
      const keyMap = {
        'source': '소스',
        'category': '카테고리',
        'severity': '심각도',
        'count': '발생 횟수',
        'threshold': '임계값',
        'current_value': '현재 값',
        'affected_systems': '영향받는 시스템'
      };
      return keyMap[key] || key;
    };

    // 알림 확장/축소
    const toggleAlertExpansion = (alert) => {
      alert.expanded = !alert.expanded;
    };

    // 관련 링크 열기
    const openRelatedLink = (url) => {
      window.open(url, '_blank');
    };

    // 알림 확인
    const acknowledgeAlert = (alert) => {
      confirmDialog.value = {
        show: true,
        title: '알림 확인',
        message: '이 알림을 확인하시겠습니까? 확인된 알림은 목록에서 회색으로 표시됩니다.',
        action: () => {
          emit('alert-acknowledge', alert.id);
          alert.acknowledged = true;
          alert.acknowledgedAt = new Date();
        }
      };
    };

    // 알림 해제
    const dismissAlert = (alert) => {
      confirmDialog.value = {
        show: true,
        title: '알림 해제',
        message: '이 알림을 해제하시겠습니까? 해제된 알림은 목록에서 제거됩니다.',
        action: () => {
          emit('alert-dismiss', alert.id);
        }
      };
    };

    // 전체 알림 해제
    const dismissAllAlerts = () => {
      confirmDialog.value = {
        show: true,
        title: '전체 알림 해제',
        message: `현재 ${activeAlerts.value}개의 활성 알림을 모두 해제하시겠습니까?`,
        action: () => {
          emit('alert-dismiss-all');
        }
      };
    };

    // 설정 변경
    const toggleAlerts = (enabled) => {
      emit('settings-change', {
        type: 'alerts_enabled',
        value: enabled
      });
    };

    const toggleSound = (enabled) => {
      emit('settings-change', {
        type: 'sound_enabled',
        value: enabled
      });
    };

    const updateMinSeverity = (severity) => {
      emit('settings-change', {
        type: 'min_severity',
        value: severity
      });
    };

    // 페이지 변경 시 맨 위로 스크롤
    watch(currentPage, () => {
      // 알림 목록 컨테이너를 찾아서 스크롤
      const alertsList = document.querySelector('.alerts-list');
      if (alertsList) {
        alertsList.scrollTop = 0;
      }
    });

    return {
      severityFilter,
      currentPage,
      alertsEnabled,
      soundEnabled,
      minSeverityLevel,
      confirmDialog,
      severityLevels,
      filteredAlerts,
      totalAlerts,
      activeAlerts,
      totalPages,
      getSeverityColor,
      getSeverityIcon,
      getSeverityDisplayName,
      getDefaultTitle,
      formatTimestamp,
      formatDetailKey,
      toggleAlertExpansion,
      openRelatedLink,
      acknowledgeAlert,
      dismissAlert,
      dismissAllAlerts,
      toggleAlerts,
      toggleSound,
      updateMinSeverity
    };
  }
};
</script>

<style scoped>
.alerts-panel {
  width: 100%;
}

.alerts-container {
  width: 100%;
}

.alerts-list {
  max-height: 500px;
  overflow-y: auto;
  padding-right: 8px;
}

.alert-item {
  padding: 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  border-left: 4px solid;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.alert-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.alert-item--critical {
  border-left-color: #f44336;
  background: linear-gradient(90deg, rgba(244, 67, 54, 0.05) 0%, white 20%);
}

.alert-item--high {
  border-left-color: #ff9800;
  background: linear-gradient(90deg, rgba(255, 152, 0, 0.05) 0%, white 20%);
}

.alert-item--medium {
  border-left-color: #2196f3;
  background: linear-gradient(90deg, rgba(33, 150, 243, 0.05) 0%, white 20%);
}

.alert-item--low {
  border-left-color: #4caf50;
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.05) 0%, white 20%);
}

.alert-acknowledged {
  opacity: 0.7;
  background: #f5f5f5 !important;
}

.alert-content {
  width: 100%;
}

.alert-header {
  width: 100%;
}

.alert-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
}

.alert-message {
  color: #555;
  line-height: 1.4;
}

.alert-action {
  margin-top: 8px;
}

.alert-details {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  padding: 12px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.detail-label {
  font-weight: 500;
  color: #666;
  margin-right: 8px;
}

.detail-value {
  font-family: monospace;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.alert-actions {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 12px;
  margin-top: 12px;
}

.alerts-settings {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
}

/* 스크롤바 스타일링 */
.alerts-list::-webkit-scrollbar {
  width: 6px;
}

.alerts-list::-webkit-scrollbar-track {
  background: transparent;
}

.alerts-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.alerts-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .alert-item {
    background: #2a2a2a;
    color: #fff;
  }
  
  .alert-acknowledged {
    background: #1a1a1a !important;
  }
  
  .alert-message {
    color: #ccc;
  }
  
  .alert-details {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .detail-value {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
  
  .alert-actions {
    border-top-color: rgba(255, 255, 255, 0.12);
  }
  
  .alerts-settings {
    background: rgba(255, 255, 255, 0.05);
  }
}

/* 반응형 디자인 */
@media (max-width: 600px) {
  .alert-item {
    padding: 12px;
    margin-bottom: 8px;
  }
  
  .alert-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .alert-time {
    margin-top: 4px;
  }
  
  .alert-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .alert-actions > div {
    margin-bottom: 8px;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }
  
  .detail-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

/* 애니메이션 */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.alert-item {
  animation: slideIn 0.3s ease-out;
}
</style>