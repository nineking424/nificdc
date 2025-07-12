<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="700"
    scrollable
  >
    <v-card>
      <!-- 헤더 -->
      <v-card-title class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon class="mr-2">mdi-cog</v-icon>
          <div>대시보드 설정</div>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="$emit('update:modelValue', false)"
        />
      </v-card-title>

      <v-divider />

      <!-- 탭 네비게이션 -->
      <v-tabs v-model="activeTab" class="px-4">
        <v-tab value="general">일반</v-tab>
        <v-tab value="display">표시</v-tab>
        <v-tab value="alerts">알림</v-tab>
        <v-tab value="performance">성능</v-tab>
        <v-tab value="export">내보내기</v-tab>
      </v-tabs>

      <v-divider />

      <!-- 탭 컨텐츠 -->
      <v-card-text class="pa-0" style="height: 450px;">
        <v-tabs-window v-model="activeTab">
          <!-- 일반 설정 -->
          <v-tabs-window-item value="general" class="pa-4">
            <div class="settings-section">
              <h3 class="text-h6 mb-4">일반 설정</h3>
              
              <!-- 자동 새로고침 -->
              <v-row>
                <v-col cols="12">
                  <v-switch
                    v-model="localSettings.autoRefresh"
                    label="자동 새로고침"
                    color="primary"
                    density="compact"
                  />
                  <div class="text-caption text-disabled ml-8">
                    대시보드 데이터를 자동으로 새로고침합니다
                  </div>
                </v-col>
              </v-row>

              <!-- 새로고침 간격 -->
              <v-row v-if="localSettings.autoRefresh">
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localSettings.refreshInterval"
                    :items="refreshIntervalOptions"
                    label="새로고침 간격"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>

              <!-- 테마 설정 -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localSettings.theme"
                    :items="themeOptions"
                    label="테마"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>

              <!-- 언어 설정 -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localSettings.language"
                    :items="languageOptions"
                    label="언어"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>

              <!-- 컴팩트 모드 -->
              <v-row>
                <v-col cols="12">
                  <v-switch
                    v-model="localSettings.compactMode"
                    label="컴팩트 모드"
                    color="primary"
                    density="compact"
                  />
                  <div class="text-caption text-disabled ml-8">
                    더 작은 크기로 더 많은 정보를 표시합니다
                  </div>
                </v-col>
              </v-row>
            </div>
          </v-tabs-window-item>

          <!-- 표시 설정 -->
          <v-tabs-window-item value="display" class="pa-4">
            <div class="settings-section">
              <h3 class="text-h6 mb-4">표시 설정</h3>

              <!-- 위젯 표시 설정 -->
              <div class="widget-settings mb-4">
                <h4 class="text-subtitle1 mb-3">표시할 위젯</h4>
                <v-row>
                  <v-col cols="12" sm="6" md="4" v-for="widget in widgetOptions" :key="widget.key">
                    <v-checkbox
                      v-model="localSettings.visibleWidgets"
                      :value="widget.key"
                      :label="widget.title"
                      density="compact"
                    />
                  </v-col>
                </v-row>
              </div>

              <!-- 차트 설정 -->
              <div class="chart-settings mb-4">
                <h4 class="text-subtitle1 mb-3">차트 설정</h4>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="localSettings.defaultTimeRange"
                      :items="timeRangeOptions"
                      label="기본 시간 범위"
                      variant="outlined"
                      density="compact"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="localSettings.chartType"
                      :items="chartTypeOptions"
                      label="기본 차트 타입"
                      variant="outlined"
                      density="compact"
                    />
                  </v-col>
                </v-row>
                
                <v-row>
                  <v-col cols="12">
                    <v-switch
                      v-model="localSettings.showGridLines"
                      label="격자 라인 표시"
                      color="primary"
                      density="compact"
                    />
                  </v-col>
                </v-row>
                
                <v-row>
                  <v-col cols="12">
                    <v-switch
                      v-model="localSettings.animateCharts"
                      label="차트 애니메이션"
                      color="primary"
                      density="compact"
                    />
                  </v-col>
                </v-row>
              </div>

              <!-- 메트릭 카드 설정 -->
              <div class="metric-settings">
                <h4 class="text-subtitle1 mb-3">메트릭 카드 설정</h4>
                <v-row>
                  <v-col cols="12">
                    <v-switch
                      v-model="localSettings.showTrends"
                      label="트렌드 표시"
                      color="primary"
                      density="compact"
                    />
                  </v-col>
                </v-row>
                
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="localSettings.metricPrecision"
                      :items="precisionOptions"
                      label="소수점 자리수"
                      variant="outlined"
                      density="compact"
                    />
                  </v-col>
                </v-row>
              </div>
            </div>
          </v-tabs-window-item>

          <!-- 알림 설정 -->
          <v-tabs-window-item value="alerts" class="pa-4">
            <div class="settings-section">
              <h3 class="text-h6 mb-4">알림 설정</h3>

              <!-- 알림 활성화 -->
              <v-row>
                <v-col cols="12">
                  <v-switch
                    v-model="localSettings.alertsEnabled"
                    label="알림 활성화"
                    color="primary"
                    density="compact"
                  />
                </v-col>
              </v-row>

              <div v-if="localSettings.alertsEnabled">
                <!-- 알림 소리 -->
                <v-row>
                  <v-col cols="12">
                    <v-switch
                      v-model="localSettings.soundEnabled"
                      label="알림음"
                      color="primary"
                      density="compact"
                    />
                  </v-col>
                </v-row>

                <!-- 최소 심각도 수준 -->
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="localSettings.minAlertSeverity"
                      :items="severityOptions"
                      label="최소 심각도 수준"
                      variant="outlined"
                      density="compact"
                    />
                  </v-col>
                </v-row>

                <!-- 브라우저 알림 -->
                <v-row>
                  <v-col cols="12">
                    <v-switch
                      v-model="localSettings.browserNotifications"
                      label="브라우저 알림"
                      color="primary"
                      density="compact"
                      @change="handleBrowserNotificationChange"
                    />
                    <div class="text-caption text-disabled ml-8">
                      브라우저에서 데스크톱 알림을 표시합니다
                    </div>
                  </v-col>
                </v-row>

                <!-- 알림 지속시간 -->
                <v-row>
                  <v-col cols="12" md="6">
                    <v-slider
                      v-model="localSettings.alertDuration"
                      :min="1"
                      :max="30"
                      :step="1"
                      label="알림 지속시간"
                      suffix="초"
                      thumb-label="always"
                    />
                  </v-col>
                </v-row>

                <!-- 알림 카테고리 필터 -->
                <div class="alert-categories">
                  <h4 class="text-subtitle1 mb-3">알림 카테고리</h4>
                  <v-row>
                    <v-col cols="12" sm="6" md="4" v-for="category in alertCategories" :key="category.key">
                      <v-checkbox
                        v-model="localSettings.enabledAlertCategories"
                        :value="category.key"
                        :label="category.title"
                        density="compact"
                      />
                    </v-col>
                  </v-row>
                </div>
              </div>
            </div>
          </v-tabs-window-item>

          <!-- 성능 설정 -->
          <v-tabs-window-item value="performance" class="pa-4">
            <div class="settings-section">
              <h3 class="text-h6 mb-4">성능 설정</h3>

              <!-- 데이터 포인트 제한 -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-slider
                    v-model="localSettings.maxDataPoints"
                    :min="50"
                    :max="1000"
                    :step="50"
                    label="최대 데이터 포인트"
                    thumb-label="always"
                  />
                  <div class="text-caption text-disabled">
                    차트에 표시할 최대 데이터 포인트 수
                  </div>
                </v-col>
              </v-row>

              <!-- 메모리 사용량 제한 -->
              <v-row>
                <v-col cols="12" md="6">
                  <v-slider
                    v-model="localSettings.memoryLimit"
                    :min="100"
                    :max="1000"
                    :step="50"
                    label="메모리 제한"
                    suffix="MB"
                    thumb-label="always"
                  />
                  <div class="text-caption text-disabled">
                    대시보드가 사용할 최대 메모리
                  </div>
                </v-col>
              </v-row>

              <!-- 캐시 설정 -->
              <v-row>
                <v-col cols="12">
                  <v-switch
                    v-model="localSettings.enableCaching"
                    label="데이터 캐싱 활성화"
                    color="primary"
                    density="compact"
                  />
                  <div class="text-caption text-disabled ml-8">
                    성능 향상을 위해 데이터를 캐시합니다
                  </div>
                </v-col>
              </v-row>

              <!-- 캐시 만료 시간 -->
              <v-row v-if="localSettings.enableCaching">
                <v-col cols="12" md="6">
                  <v-select
                    v-model="localSettings.cacheExpiry"
                    :items="cacheExpiryOptions"
                    label="캐시 만료 시간"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
              </v-row>

              <!-- 성능 모니터링 -->
              <v-row>
                <v-col cols="12">
                  <v-switch
                    v-model="localSettings.performanceMonitoring"
                    label="성능 모니터링"
                    color="primary"
                    density="compact"
                  />
                  <div class="text-caption text-disabled ml-8">
                    대시보드 성능 메트릭을 수집합니다
                  </div>
                </v-col>
              </v-row>
            </div>
          </v-tabs-window-item>

          <!-- 내보내기 설정 -->
          <v-tabs-window-item value="export" class="pa-4">
            <div class="settings-section">
              <h3 class="text-h6 mb-4">내보내기 설정</h3>

              <!-- 설정 내보내기/가져오기 -->
              <div class="config-management mb-4">
                <h4 class="text-subtitle1 mb-3">설정 관리</h4>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-btn
                      variant="outlined"
                      block
                      @click="exportSettings"
                      prepend-icon="mdi-download"
                    >
                      설정 내보내기
                    </v-btn>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-file-input
                      ref="fileInput"
                      v-model="importFile"
                      label="설정 가져오기"
                      accept=".json"
                      variant="outlined"
                      density="compact"
                      @change="importSettings"
                    />
                  </v-col>
                </v-row>
              </div>

              <!-- 데이터 내보내기 -->
              <div class="data-export mb-4">
                <h4 class="text-subtitle1 mb-3">데이터 내보내기</h4>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="exportFormat"
                      :items="exportFormatOptions"
                      label="내보내기 형식"
                      variant="outlined"
                      density="compact"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="exportTimeRange"
                      :items="exportTimeRangeOptions"
                      label="시간 범위"
                      variant="outlined"
                      density="compact"
                    />
                  </v-col>
                </v-row>
                <v-row>
                  <v-col cols="12">
                    <v-btn
                      variant="outlined"
                      block
                      @click="exportData"
                      prepend-icon="mdi-export"
                      :loading="exportLoading"
                    >
                      데이터 내보내기
                    </v-btn>
                  </v-col>
                </v-row>
              </div>

              <!-- 리셋 옵션 -->
              <div class="reset-options">
                <h4 class="text-subtitle1 mb-3">리셋 옵션</h4>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-btn
                      variant="outlined"
                      color="warning"
                      block
                      @click="resetSettings"
                    >
                      설정 초기화
                    </v-btn>
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-btn
                      variant="outlined"
                      color="error"
                      block
                      @click="clearCache"
                    >
                      캐시 지우기
                    </v-btn>
                  </v-col>
                </v-row>
              </div>
            </div>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>

      <!-- 액션 버튼 -->
      <v-card-actions class="px-4 py-3">
        <v-btn @click="$emit('update:modelValue', false)">취소</v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          @click="saveSettings"
          :loading="saveLoading"
        >
          저장
        </v-btn>
      </v-card-actions>
    </v-card>

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
            :color="confirmDialog.color || 'primary'"
            @click="confirmDialog.action(); confirmDialog.show = false"
          >
            확인
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<script>
import { ref, reactive, watch, nextTick } from 'vue';

export default {
  name: 'DashboardSettingsDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    settings: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['update:modelValue', 'save'],
  setup(props, { emit }) {
    const activeTab = ref('general');
    const saveLoading = ref(false);
    const exportLoading = ref(false);
    const fileInput = ref(null);
    const importFile = ref(null);
    const exportFormat = ref('json');
    const exportTimeRange = ref('24h');

    // 로컬 설정 상태
    const localSettings = reactive({
      // 일반 설정
      autoRefresh: true,
      refreshInterval: 5000,
      theme: 'auto',
      language: 'ko',
      compactMode: false,
      
      // 표시 설정
      visibleWidgets: ['metrics', 'throughput', 'status', 'resources', 'errors', 'executions', 'alerts'],
      defaultTimeRange: '6h',
      chartType: 'line',
      showGridLines: true,
      animateCharts: true,
      showTrends: true,
      metricPrecision: 1,
      
      // 알림 설정
      alertsEnabled: true,
      soundEnabled: false,
      minAlertSeverity: 'medium',
      browserNotifications: false,
      alertDuration: 5,
      enabledAlertCategories: ['system', 'performance', 'errors', 'security'],
      
      // 성능 설정
      maxDataPoints: 200,
      memoryLimit: 500,
      enableCaching: true,
      cacheExpiry: 300000,
      performanceMonitoring: false
    });

    // 확인 대화상자
    const confirmDialog = ref({
      show: false,
      title: '',
      message: '',
      color: 'primary',
      action: () => {}
    });

    // 옵션 데이터
    const refreshIntervalOptions = [
      { title: '1초', value: 1000 },
      { title: '2초', value: 2000 },
      { title: '5초', value: 5000 },
      { title: '10초', value: 10000 },
      { title: '30초', value: 30000 },
      { title: '1분', value: 60000 }
    ];

    const themeOptions = [
      { title: '자동', value: 'auto' },
      { title: '라이트', value: 'light' },
      { title: '다크', value: 'dark' }
    ];

    const languageOptions = [
      { title: '한국어', value: 'ko' },
      { title: 'English', value: 'en' },
      { title: '日本語', value: 'ja' }
    ];

    const widgetOptions = [
      { key: 'metrics', title: '메트릭 카드' },
      { key: 'throughput', title: '처리량 차트' },
      { key: 'status', title: '시스템 상태' },
      { key: 'resources', title: '리소스 차트' },
      { key: 'errors', title: '에러 분석' },
      { key: 'executions', title: '실행 이력' },
      { key: 'alerts', title: '알림 패널' }
    ];

    const timeRangeOptions = [
      { title: '1시간', value: '1h' },
      { title: '6시간', value: '6h' },
      { title: '24시간', value: '24h' },
      { title: '7일', value: '7d' }
    ];

    const chartTypeOptions = [
      { title: '라인 차트', value: 'line' },
      { title: '영역 차트', value: 'area' },
      { title: '막대 차트', value: 'bar' }
    ];

    const precisionOptions = [
      { title: '0자리', value: 0 },
      { title: '1자리', value: 1 },
      { title: '2자리', value: 2 },
      { title: '3자리', value: 3 }
    ];

    const severityOptions = [
      { title: '낮음', value: 'low' },
      { title: '보통', value: 'medium' },
      { title: '높음', value: 'high' },
      { title: '치명적', value: 'critical' }
    ];

    const alertCategories = [
      { key: 'system', title: '시스템' },
      { key: 'performance', title: '성능' },
      { key: 'errors', title: '에러' },
      { key: 'security', title: '보안' },
      { key: 'maintenance', title: '유지보수' }
    ];

    const cacheExpiryOptions = [
      { title: '30초', value: 30000 },
      { title: '1분', value: 60000 },
      { title: '5분', value: 300000 },
      { title: '10분', value: 600000 },
      { title: '30분', value: 1800000 }
    ];

    const exportFormatOptions = [
      { title: 'JSON', value: 'json' },
      { title: 'CSV', value: 'csv' },
      { title: 'Excel', value: 'xlsx' }
    ];

    const exportTimeRangeOptions = [
      { title: '지난 1시간', value: '1h' },
      { title: '지난 24시간', value: '24h' },
      { title: '지난 7일', value: '7d' },
      { title: '지난 30일', value: '30d' }
    ];

    // 초기 설정 로드
    const loadSettings = () => {
      Object.assign(localSettings, props.settings);
    };

    // 브라우저 알림 권한 처리
    const handleBrowserNotificationChange = async (enabled) => {
      if (enabled) {
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            localSettings.browserNotifications = false;
            // 권한 거부됨 알림
          }
        } else {
          localSettings.browserNotifications = false;
          // 브라우저가 알림을 지원하지 않음
        }
      }
    };

    // 설정 저장
    const saveSettings = async () => {
      saveLoading.value = true;
      try {
        emit('save', { ...localSettings });
        await new Promise(resolve => setTimeout(resolve, 500)); // 시뮬레이션
        emit('update:modelValue', false);
      } finally {
        saveLoading.value = false;
      }
    };

    // 설정 내보내기
    const exportSettings = () => {
      const dataStr = JSON.stringify(localSettings, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-settings-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    };

    // 설정 가져오기
    const importSettings = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedSettings = JSON.parse(text);
        
        confirmDialog.value = {
          show: true,
          title: '설정 가져오기',
          message: '현재 설정을 가져온 설정으로 교체하시겠습니까?',
          action: () => {
            Object.assign(localSettings, importedSettings);
          }
        };
      } catch (error) {
        console.error('설정 파일 가져오기 실패:', error);
        // 에러 알림 표시
      }
    };

    // 데이터 내보내기
    const exportData = async () => {
      exportLoading.value = true;
      try {
        // 실제로는 API 호출로 데이터를 가져옴
        const mockData = {
          exportTime: new Date().toISOString(),
          timeRange: exportTimeRange.value,
          format: exportFormat.value,
          data: {
            metrics: [],
            executions: [],
            alerts: []
          }
        };

        let dataStr, mimeType, extension;
        
        if (exportFormat.value === 'json') {
          dataStr = JSON.stringify(mockData, null, 2);
          mimeType = 'application/json';
          extension = 'json';
        } else if (exportFormat.value === 'csv') {
          dataStr = 'timestamp,metric,value\n'; // CSV 헤더
          mimeType = 'text/csv';
          extension = 'csv';
        } else {
          // Excel 형식은 실제로는 라이브러리 필요
          dataStr = JSON.stringify(mockData, null, 2);
          mimeType = 'application/json';
          extension = 'json';
        }

        const blob = new Blob([dataStr], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dashboard-data-${exportTimeRange.value}-${new Date().toISOString().split('T')[0]}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
      } finally {
        exportLoading.value = false;
      }
    };

    // 설정 초기화
    const resetSettings = () => {
      confirmDialog.value = {
        show: true,
        title: '설정 초기화',
        message: '모든 설정을 기본값으로 초기화하시겠습니까?',
        color: 'warning',
        action: () => {
          // 기본값으로 리셋
          Object.assign(localSettings, {
            autoRefresh: true,
            refreshInterval: 5000,
            theme: 'auto',
            language: 'ko',
            compactMode: false,
            visibleWidgets: ['metrics', 'throughput', 'status', 'resources', 'errors', 'executions', 'alerts'],
            defaultTimeRange: '6h',
            chartType: 'line',
            showGridLines: true,
            animateCharts: true,
            showTrends: true,
            metricPrecision: 1,
            alertsEnabled: true,
            soundEnabled: false,
            minAlertSeverity: 'medium',
            browserNotifications: false,
            alertDuration: 5,
            enabledAlertCategories: ['system', 'performance', 'errors', 'security'],
            maxDataPoints: 200,
            memoryLimit: 500,
            enableCaching: true,
            cacheExpiry: 300000,
            performanceMonitoring: false
          });
        }
      };
    };

    // 캐시 지우기
    const clearCache = () => {
      confirmDialog.value = {
        show: true,
        title: '캐시 지우기',
        message: '모든 캐시된 데이터를 삭제하시겠습니까?',
        color: 'error',
        action: () => {
          // 캐시 지우기 로직
          localStorage.removeItem('dashboardCache');
          sessionStorage.clear();
        }
      };
    };

    // props.settings 변경 감지
    watch(() => props.settings, loadSettings, { deep: true, immediate: true });

    // 다이얼로그가 열릴 때 첫 번째 탭으로 리셋
    watch(() => props.modelValue, async (newValue) => {
      if (newValue) {
        activeTab.value = 'general';
        await nextTick();
        loadSettings();
      }
    });

    return {
      activeTab,
      saveLoading,
      exportLoading,
      fileInput,
      importFile,
      exportFormat,
      exportTimeRange,
      localSettings,
      confirmDialog,
      refreshIntervalOptions,
      themeOptions,
      languageOptions,
      widgetOptions,
      timeRangeOptions,
      chartTypeOptions,
      precisionOptions,
      severityOptions,
      alertCategories,
      cacheExpiryOptions,
      exportFormatOptions,
      exportTimeRangeOptions,
      handleBrowserNotificationChange,
      saveSettings,
      exportSettings,
      importSettings,
      exportData,
      resetSettings,
      clearCache
    };
  }
};
</script>

<style scoped>
.settings-section {
  max-height: 400px;
  overflow-y: auto;
}

.widget-settings,
.chart-settings,
.metric-settings,
.config-management,
.data-export,
.reset-options,
.alert-categories {
  margin-bottom: 24px;
}

.widget-settings:last-child,
.chart-settings:last-child,
.metric-settings:last-child,
.config-management:last-child,
.data-export:last-child,
.reset-options:last-child,
.alert-categories:last-child {
  margin-bottom: 0;
}

/* 스크롤바 스타일링 */
.settings-section::-webkit-scrollbar {
  width: 6px;
}

.settings-section::-webkit-scrollbar-track {
  background: transparent;
}

.settings-section::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.settings-section::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 반응형 디자인 */
@media (max-width: 600px) {
  .settings-section {
    max-height: 350px;
  }
}
</style>