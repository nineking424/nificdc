<template>
  <div class="resource-chart-container">
    <!-- 로딩 상태 -->
    <div v-if="loading" class="d-flex justify-center align-center" :style="{ height: height + 'px' }">
      <v-progress-circular
        indeterminate
        color="primary"
        size="40"
      />
      <span class="ml-3">리소스 데이터 로딩 중...</span>
    </div>

    <!-- 데이터 없음 상태 -->
    <div v-else-if="!data || data.length === 0" class="d-flex justify-center align-center flex-column" :style="{ height: height + 'px' }">
      <v-icon size="48" color="grey-lighten-1">{{ getTypeIcon() }}</v-icon>
      <div class="text-subtitle1 text-disabled mt-2">{{ getTypeDisplayName() }} 데이터가 없습니다</div>
    </div>

    <!-- 차트 표시 -->
    <div v-else>
      <!-- 차트 헤더 -->
      <div v-if="showControls" class="d-flex justify-space-between align-center mb-3">
        <div class="d-flex align-center">
          <v-icon :color="currentColor" class="mr-2">{{ getTypeIcon() }}</v-icon>
          <div>
            <div class="text-subtitle2">{{ getTypeDisplayName() }}</div>
            <div class="text-caption text-disabled">현재: {{ currentValue }}{{ getUnit() }}</div>
          </div>
        </div>

        <div class="d-flex align-center">
          <!-- 임계값 표시 -->
          <v-chip
            v-if="showThreshold"
            :color="getThresholdColor()"
            variant="outlined"
            size="small"
            class="mr-2"
          >
            임계값: {{ warningThreshold }}{{ getUnit() }}
          </v-chip>

          <!-- 차트 옵션 -->
          <v-menu>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-dots-vertical"
                variant="text"
                size="small"
              />
            </template>
            <v-list density="compact">
              <v-list-item @click="toggleFill">
                <v-list-item-title>
                  <v-icon class="mr-2" size="small">{{ showFill ? 'mdi-format-color-fill' : 'mdi-border-color' }}</v-icon>
                  {{ showFill ? '채우기 해제' : '영역 채우기' }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="toggleGrid">
                <v-list-item-title>
                  <v-icon class="mr-2" size="small">{{ showGrid ? 'mdi-grid-off' : 'mdi-grid' }}</v-icon>
                  격자 {{ showGrid ? '숨기기' : '표시' }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="toggleThreshold" v-if="type !== 'network'">
                <v-list-item-title>
                  <v-icon class="mr-2" size="small">mdi-alert-outline</v-icon>
                  임계값 {{ showThreshold ? '숨기기' : '표시' }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <!-- SVG 차트 -->
      <div class="chart-wrapper" :style="{ height: height + 'px' }">
        <svg
          ref="chartSvg"
          :width="chartWidth"
          :height="chartHeight"
          class="resource-chart"
        >
          <!-- 정의 -->
          <defs>
            <linearGradient :id="`gradient-${type}`" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" :stop-color="currentColor" stop-opacity="0.3"/>
              <stop offset="100%" :stop-color="currentColor" stop-opacity="0.1"/>
            </linearGradient>
          </defs>

          <!-- 그리드 -->
          <g v-if="showGrid" class="grid">
            <!-- 수직 그리드 라인 -->
            <line
              v-for="x in verticalGridLines"
              :key="`v-${x}`"
              :x1="x"
              :y1="padding.top"
              :x2="x"
              :y2="chartHeight - padding.bottom"
              class="grid-line"
            />
            <!-- 수평 그리드 라인 -->
            <line
              v-for="y in horizontalGridLines"
              :key="`h-${y}`"
              :x1="padding.left"
              :y1="y"
              :x2="chartWidth - padding.right"
              :y2="y"
              class="grid-line"
            />
          </g>

          <!-- 임계값 라인 -->
          <g v-if="showThreshold && warningThreshold && type !== 'network'">
            <line
              :x1="padding.left"
              :y1="getThresholdY(warningThreshold)"
              :x2="chartWidth - padding.right"
              :y2="getThresholdY(warningThreshold)"
              class="threshold-line warning"
              stroke="#ff9800"
              stroke-width="2"
              stroke-dasharray="5,5"
            />
            <text
              :x="chartWidth - padding.right - 5"
              :y="getThresholdY(warningThreshold) - 5"
              class="threshold-label"
              text-anchor="end"
              fill="#ff9800"
            >
              Warning: {{ warningThreshold }}{{ getUnit() }}
            </text>
          </g>

          <g v-if="showThreshold && criticalThreshold && type !== 'network'">
            <line
              :x1="padding.left"
              :y1="getThresholdY(criticalThreshold)"
              :x2="chartWidth - padding.right"
              :y2="getThresholdY(criticalThreshold)"
              class="threshold-line critical"
              stroke="#f44336"
              stroke-width="2"
              stroke-dasharray="5,5"
            />
            <text
              :x="chartWidth - padding.right - 5"
              :y="getThresholdY(criticalThreshold) - 5"
              class="threshold-label"
              text-anchor="end"
              fill="#f44336"
            >
              Critical: {{ criticalThreshold }}{{ getUnit() }}
            </text>
          </g>

          <!-- 영역 차트 (조건부) -->
          <path
            v-if="showFill && areaPath"
            :d="areaPath"
            :fill="`url(#gradient-${type})`"
            class="area-fill"
          />

          <!-- 라인 차트 -->
          <path
            v-if="linePath"
            :d="linePath"
            class="chart-line"
            :stroke="currentColor"
            stroke-width="2"
            fill="none"
          />

          <!-- X축 -->
          <g class="x-axis">
            <line
              :x1="padding.left"
              :y1="chartHeight - padding.bottom"
              :x2="chartWidth - padding.right"
              :y2="chartHeight - padding.bottom"
              class="axis-line"
            />
            <g
              v-for="tick in xAxisTicks"
              :key="tick.value"
              class="tick"
            >
              <line
                :x1="tick.x"
                :y1="chartHeight - padding.bottom"
                :x2="tick.x"
                :y2="chartHeight - padding.bottom + 5"
                class="tick-line"
              />
              <text
                :x="tick.x"
                :y="chartHeight - padding.bottom + 18"
                class="tick-label"
                text-anchor="middle"
              >
                {{ tick.label }}
              </text>
            </g>
          </g>

          <!-- Y축 -->
          <g class="y-axis">
            <line
              :x1="padding.left"
              :y1="padding.top"
              :x2="padding.left"
              :y2="chartHeight - padding.bottom"
              class="axis-line"
            />
            <g
              v-for="tick in yAxisTicks"
              :key="tick.value"
              class="tick"
            >
              <line
                :x1="padding.left - 5"
                :y1="tick.y"
                :x2="padding.left"
                :y2="tick.y"
                class="tick-line"
              />
              <text
                :x="padding.left - 10"
                :y="tick.y + 4"
                class="tick-label"
                text-anchor="end"
              >
                {{ tick.label }}
              </text>
            </g>
          </g>

          <!-- Y축 라벨 -->
          <text
            :x="15"
            :y="padding.top + (chartHeight - padding.top - padding.bottom) / 2"
            class="axis-title"
            text-anchor="middle"
            :transform="`rotate(-90 15 ${padding.top + (chartHeight - padding.top - padding.bottom) / 2})`"
          >
            {{ getTypeDisplayName() }} ({{ getUnit() }})
          </text>
        </svg>

        <!-- 현재 값 표시 (오버레이) -->
        <div class="current-value-overlay">
          <v-chip
            :color="getCurrentValueColor()"
            variant="tonal"
            size="small"
          >
            {{ currentValue }}{{ getUnit() }}
          </v-chip>
        </div>
      </div>

      <!-- 차트 통계 -->
      <div v-if="showStats" class="chart-stats mt-3">
        <v-row dense>
          <v-col cols="4" sm="3">
            <div class="text-caption text-disabled">현재</div>
            <div class="text-subtitle2 font-weight-bold" :style="{ color: currentColor }">
              {{ currentValue }}{{ getUnit() }}
            </div>
          </v-col>
          <v-col cols="4" sm="3">
            <div class="text-caption text-disabled">평균</div>
            <div class="text-subtitle2">{{ avgValue }}{{ getUnit() }}</div>
          </v-col>
          <v-col cols="4" sm="3">
            <div class="text-caption text-disabled">최대</div>
            <div class="text-subtitle2">{{ maxValue }}{{ getUnit() }}</div>
          </v-col>
          <v-col cols="12" sm="3">
            <div class="text-caption text-disabled">상태</div>
            <v-chip
              :color="getCurrentValueColor()"
              variant="tonal"
              size="x-small"
            >
              {{ getStatusText() }}
            </v-chip>
          </v-col>
        </v-row>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

export default {
  name: 'ResourceChart',
  props: {
    data: {
      type: Array,
      default: () => []
    },
    type: {
      type: String,
      required: true,
      validator: value => ['cpu', 'memory', 'disk', 'network'].includes(value)
    },
    height: {
      type: Number,
      default: 250
    },
    loading: {
      type: Boolean,
      default: false
    },
    showControls: {
      type: Boolean,
      default: true
    },
    showStats: {
      type: Boolean,
      default: true
    },
    warningThreshold: {
      type: Number,
      default: null
    },
    criticalThreshold: {
      type: Number,
      default: null
    }
  },
  setup(props) {
    const chartSvg = ref(null);
    const chartWidth = ref(600);
    const chartHeight = ref(250);
    const showFill = ref(true);
    const showGrid = ref(true);
    const showThreshold = ref(true);

    // 차트 여백
    const padding = {
      top: 20,
      right: 20,
      bottom: 40,
      left: 50
    };

    // 타입별 설정
    const typeConfig = {
      cpu: {
        icon: 'mdi-chip',
        displayName: 'CPU 사용률',
        unit: '%',
        color: '#2196f3',
        max: 100,
        warningDefault: 70,
        criticalDefault: 90
      },
      memory: {
        icon: 'mdi-memory',
        displayName: '메모리 사용률',
        unit: '%',
        color: '#4caf50',
        max: 100,
        warningDefault: 80,
        criticalDefault: 95
      },
      disk: {
        icon: 'mdi-harddisk',
        displayName: '디스크 사용률',
        unit: '%',
        color: '#ff9800',
        max: 100,
        warningDefault: 85,
        criticalDefault: 95
      },
      network: {
        icon: 'mdi-network',
        displayName: '네트워크 사용률',
        unit: 'Mbps',
        color: '#9c27b0',
        max: null,
        warningDefault: null,
        criticalDefault: null
      }
    };

    // 현재 타입 설정
    const currentConfig = computed(() => typeConfig[props.type] || typeConfig.cpu);
    const currentColor = computed(() => currentConfig.value.color);

    // 차트 크기 업데이트
    const updateChartSize = () => {
      if (chartSvg.value) {
        const container = chartSvg.value.parentElement;
        chartWidth.value = container.clientWidth;
        chartHeight.value = props.height;
      }
    };

    // 데이터 통계
    const dataStats = computed(() => {
      if (!props.data || props.data.length === 0) {
        return { min: 0, max: 0, avg: 0, current: 0 };
      }

      const values = props.data.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      const current = values[values.length - 1];

      return { min, max, avg, current };
    });

    const currentValue = computed(() => Math.round(dataStats.value.current * 10) / 10);
    const avgValue = computed(() => Math.round(dataStats.value.avg * 10) / 10);
    const maxValue = computed(() => Math.round(dataStats.value.max * 10) / 10);

    // 실제 임계값 (기본값 사용)
    const actualWarningThreshold = computed(() => 
      props.warningThreshold ?? currentConfig.value.warningDefault
    );
    const actualCriticalThreshold = computed(() => 
      props.criticalThreshold ?? currentConfig.value.criticalDefault
    );

    // 스케일 계산
    const yScale = computed(() => {
      const maxData = dataStats.value.max;
      const configMax = currentConfig.value.max;
      
      let maxY;
      if (configMax !== null) {
        maxY = Math.max(maxData, configMax);
      } else {
        maxY = maxData * 1.1; // 10% 여유
      }

      return {
        domain: [0, maxY],
        range: [chartHeight.value - padding.bottom, padding.top],
        scale: (value) => {
          const ratio = value / maxY;
          return chartHeight.value - padding.bottom - ratio * (chartHeight.value - padding.top - padding.bottom);
        }
      };
    });

    const xScale = computed(() => {
      if (!props.data || props.data.length === 0) return null;
      
      const minTime = new Date(props.data[0].timestamp).getTime();
      const maxTime = new Date(props.data[props.data.length - 1].timestamp).getTime();
      const timeRange = maxTime - minTime;
      
      return {
        domain: [minTime, maxTime],
        range: [padding.left, chartWidth.value - padding.right],
        scale: (time) => {
          const t = new Date(time).getTime();
          return padding.left + ((t - minTime) / timeRange) * (chartWidth.value - padding.left - padding.right);
        }
      };
    });

    // 차트 경로 생성
    const chartData = computed(() => {
      if (!props.data || !xScale.value || !yScale.value) return [];
      
      return props.data.map(d => ({
        x: xScale.value.scale(d.timestamp),
        y: yScale.value.scale(d.value),
        value: d.value,
        timestamp: d.timestamp
      }));
    });

    const linePath = computed(() => {
      if (!chartData.value || chartData.value.length === 0) return '';
      
      return chartData.value.reduce((path, point, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${path} ${command} ${point.x} ${point.y}`;
      }, '');
    });

    const areaPath = computed(() => {
      if (!chartData.value || chartData.value.length === 0) return '';
      
      const bottomY = chartHeight.value - padding.bottom;
      let path = `M ${chartData.value[0].x} ${bottomY}`;
      
      chartData.value.forEach(point => {
        path += ` L ${point.x} ${point.y}`;
      });
      
      path += ` L ${chartData.value[chartData.value.length - 1].x} ${bottomY} Z`;
      
      return path;
    });

    // 축 눈금
    const yAxisTicks = computed(() => {
      if (!yScale.value) return [];
      
      const [min, max] = yScale.value.domain;
      const tickCount = 5;
      const step = (max - min) / (tickCount - 1);
      
      const ticks = [];
      for (let i = 0; i < tickCount; i++) {
        const value = min + step * i;
        const y = yScale.value.scale(value);
        const label = Math.round(value).toString();
        
        ticks.push({ value, y, label });
      }
      
      return ticks;
    });

    const xAxisTicks = computed(() => {
      if (!xScale.value) return [];
      
      const [minTime, maxTime] = xScale.value.domain;
      const timeRange = maxTime - minTime;
      const tickCount = Math.min(5, Math.max(3, Math.floor(chartWidth.value / 80)));
      
      const ticks = [];
      for (let i = 0; i < tickCount; i++) {
        const time = minTime + (timeRange / (tickCount - 1)) * i;
        const x = xScale.value.scale(new Date(time));
        const date = new Date(time);
        const label = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        
        ticks.push({ value: time, x, label });
      }
      
      return ticks;
    });

    // 그리드 라인
    const verticalGridLines = computed(() => {
      return xAxisTicks.value.map(tick => tick.x);
    });

    const horizontalGridLines = computed(() => {
      return yAxisTicks.value.map(tick => tick.y);
    });

    // 헬퍼 함수들
    const getTypeIcon = () => currentConfig.value.icon;
    const getTypeDisplayName = () => currentConfig.value.displayName;
    const getUnit = () => currentConfig.value.unit;

    const getCurrentValueColor = () => {
      const value = currentValue.value;
      if (actualCriticalThreshold.value && value >= actualCriticalThreshold.value) {
        return 'error';
      }
      if (actualWarningThreshold.value && value >= actualWarningThreshold.value) {
        return 'warning';
      }
      return 'success';
    };

    const getStatusText = () => {
      const value = currentValue.value;
      if (actualCriticalThreshold.value && value >= actualCriticalThreshold.value) {
        return '위험';
      }
      if (actualWarningThreshold.value && value >= actualWarningThreshold.value) {
        return '주의';
      }
      return '정상';
    };

    const getThresholdColor = () => {
      return getCurrentValueColor() === 'success' ? 'success' : 'warning';
    };

    const getThresholdY = (threshold) => {
      return yScale.value ? yScale.value.scale(threshold) : 0;
    };

    // 컨트롤 함수들
    const toggleFill = () => {
      showFill.value = !showFill.value;
    };

    const toggleGrid = () => {
      showGrid.value = !showGrid.value;
    };

    const toggleThreshold = () => {
      showThreshold.value = !showThreshold.value;
    };

    // 리사이즈 이벤트 처리
    const handleResize = () => {
      updateChartSize();
    };

    onMounted(async () => {
      await nextTick();
      updateChartSize();
      window.addEventListener('resize', handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
    });

    return {
      chartSvg,
      chartWidth,
      chartHeight,
      showFill,
      showGrid,
      showThreshold,
      padding,
      currentColor,
      currentValue,
      avgValue,
      maxValue,
      actualWarningThreshold,
      actualCriticalThreshold,
      chartData,
      linePath,
      areaPath,
      yAxisTicks,
      xAxisTicks,
      verticalGridLines,
      horizontalGridLines,
      getTypeIcon,
      getTypeDisplayName,
      getUnit,
      getCurrentValueColor,
      getStatusText,
      getThresholdColor,
      getThresholdY,
      toggleFill,
      toggleGrid,
      toggleThreshold
    };
  }
};
</script>

<style scoped>
.resource-chart-container {
  width: 100%;
  position: relative;
}

.chart-wrapper {
  position: relative;
  width: 100%;
}

.resource-chart {
  width: 100%;
  height: 100%;
}

.current-value-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 5;
}

/* SVG 스타일 */
.grid-line {
  stroke: #e0e0e0;
  stroke-width: 1;
  opacity: 0.5;
}

.chart-line {
  stroke-width: 2;
  fill: none;
}

.area-fill {
  opacity: 0.3;
}

.threshold-line {
  opacity: 0.8;
}

.threshold-label {
  font-size: 11px;
  font-weight: 500;
}

.axis-line {
  stroke: #666;
  stroke-width: 1;
}

.tick-line {
  stroke: #666;
  stroke-width: 1;
}

.tick-label {
  font-size: 11px;
  fill: #666;
  font-family: 'Roboto', sans-serif;
}

.axis-title {
  font-size: 11px;
  fill: #666;
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
}

/* 통계 영역 */
.chart-stats {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 12px;
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .grid-line {
    stroke: #424242;
  }
  
  .axis-line,
  .tick-line {
    stroke: #bbb;
  }
  
  .tick-label,
  .axis-title {
    fill: #bbb;
  }
  
  .chart-stats {
    background: rgba(255, 255, 255, 0.05);
  }
}

/* 반응형 디자인 */
@media (max-width: 600px) {
  .tick-label,
  .axis-title,
  .threshold-label {
    font-size: 10px;
  }
  
  .current-value-overlay {
    top: 5px;
    right: 5px;
  }
}
</style>