<template>
  <div class="throughput-chart-container">
    <!-- 로딩 상태 -->
    <div v-if="loading" class="d-flex justify-center align-center" :style="{ height: height + 'px' }">
      <v-progress-circular
        indeterminate
        color="primary"
        size="40"
      />
      <span class="ml-3">차트 데이터 로딩 중...</span>
    </div>

    <!-- 데이터 없음 상태 -->
    <div v-else-if="!data || data.length === 0" class="d-flex justify-center align-center flex-column" :style="{ height: height + 'px' }">
      <v-icon size="48" color="grey-lighten-1">mdi-chart-line-variant</v-icon>
      <div class="text-subtitle1 text-disabled mt-2">표시할 데이터가 없습니다</div>
    </div>

    <!-- 차트 표시 -->
    <div v-else>
      <!-- 차트 헤더 (옵션 표시) -->
      <div v-if="showControls" class="d-flex justify-space-between align-center mb-3">
        <div class="d-flex align-center">
          <v-chip
            variant="outlined"
            size="small"
            class="mr-2"
          >
            총 {{ data.length }}개 데이터
          </v-chip>
          <v-chip
            v-if="currentThroughput"
            color="primary"
            variant="tonal"
            size="small"
          >
            현재: {{ formatValue(currentThroughput) }}/h
          </v-chip>
        </div>

        <div class="d-flex align-center">
          <!-- 시간 범위 선택 -->
          <v-btn-toggle
            v-model="selectedTimeRange"
            mandatory
            density="compact"
            size="small"
            class="mr-2"
          >
            <v-btn value="1h">1시간</v-btn>
            <v-btn value="6h">6시간</v-btn>
            <v-btn value="24h">24시간</v-btn>
          </v-btn-toggle>

          <!-- 차트 타입 선택 -->
          <v-menu>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-dots-vertical"
                variant="text"
                size="small"
              />
            </template>
            <v-list>
              <v-list-item @click="toggleGrid">
                <v-list-item-title>
                  <v-icon class="mr-2">{{ showGrid ? 'mdi-grid-off' : 'mdi-grid' }}</v-icon>
                  격자 {{ showGrid ? '숨기기' : '표시' }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="toggleDataPoints">
                <v-list-item-title>
                  <v-icon class="mr-2">{{ showDataPoints ? 'mdi-circle-off-outline' : 'mdi-circle-outline' }}</v-icon>
                  데이터 포인트 {{ showDataPoints ? '숨기기' : '표시' }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="exportData">
                <v-list-item-title>
                  <v-icon class="mr-2">mdi-download</v-icon>
                  데이터 내보내기
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
          class="throughput-chart"
        >
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

          <!-- 영역 차트 (Area) -->
          <path
            v-if="areaPath"
            :d="areaPath"
            class="area-fill"
            :fill="areaColor"
          />

          <!-- 라인 차트 -->
          <path
            v-if="linePath"
            :d="linePath"
            class="chart-line"
            :stroke="lineColor"
            fill="none"
          />

          <!-- 데이터 포인트 -->
          <g v-if="showDataPoints" class="data-points">
            <circle
              v-for="(point, index) in chartData"
              :key="index"
              :cx="point.x"
              :cy="point.y"
              r="3"
              class="data-point"
              :fill="lineColor"
              @mouseover="showTooltip($event, point.data)"
              @mouseout="hideTooltip"
            />
          </g>

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
            transform="rotate(-90 15 150)"
          >
            처리량 (건/시간)
          </text>
        </svg>

        <!-- 툴팁 -->
        <div
          v-if="tooltip.show"
          ref="tooltipEl"
          class="chart-tooltip"
          :style="{
            left: tooltip.x + 'px',
            top: tooltip.y + 'px'
          }"
        >
          <div class="tooltip-time">{{ tooltip.time }}</div>
          <div class="tooltip-value">{{ tooltip.value }}</div>
        </div>
      </div>

      <!-- 범례 및 통계 -->
      <div v-if="showStats" class="chart-stats mt-3">
        <v-row>
          <v-col cols="3">
            <div class="text-caption text-disabled">최대값</div>
            <div class="text-subtitle2">{{ formatValue(maxValue) }}/h</div>
          </v-col>
          <v-col cols="3">
            <div class="text-caption text-disabled">평균값</div>
            <div class="text-subtitle2">{{ formatValue(avgValue) }}/h</div>
          </v-col>
          <v-col cols="3">
            <div class="text-caption text-disabled">최소값</div>
            <div class="text-subtitle2">{{ formatValue(minValue) }}/h</div>
          </v-col>
          <v-col cols="3">
            <div class="text-caption text-disabled">표준편차</div>
            <div class="text-subtitle2">{{ formatValue(stdDev) }}</div>
          </v-col>
        </v-row>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

export default {
  name: 'ThroughputChart',
  props: {
    data: {
      type: Array,
      default: () => []
    },
    height: {
      type: Number,
      default: 300
    },
    timeRange: {
      type: String,
      default: '6h'
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
    lineColor: {
      type: String,
      default: '#1976d2'
    },
    areaColor: {
      type: String,
      default: 'rgba(25, 118, 210, 0.1)'
    }
  },
  emits: ['time-range-change', 'export-data'],
  setup(props, { emit }) {
    const chartSvg = ref(null);
    const tooltipEl = ref(null);
    const chartWidth = ref(800);
    const chartHeight = ref(300);
    const selectedTimeRange = ref(props.timeRange);
    const showGrid = ref(true);
    const showDataPoints = ref(false);

    // 차트 여백
    const padding = {
      top: 20,
      right: 20,
      bottom: 50,
      left: 60
    };

    // 툴팁 상태
    const tooltip = ref({
      show: false,
      x: 0,
      y: 0,
      time: '',
      value: ''
    });

    // 차트 크기 업데이트
    const updateChartSize = () => {
      if (chartSvg.value) {
        const container = chartSvg.value.parentElement;
        chartWidth.value = container.clientWidth;
        chartHeight.value = props.height;
      }
    };

    // 데이터 통계 계산
    const dataStats = computed(() => {
      if (!props.data || props.data.length === 0) {
        return { min: 0, max: 0, avg: 0, stdDev: 0 };
      }

      const values = props.data.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      
      const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      return { min, max, avg, stdDev };
    });

    const minValue = computed(() => dataStats.value.min);
    const maxValue = computed(() => dataStats.value.max);
    const avgValue = computed(() => dataStats.value.avg);
    const stdDev = computed(() => dataStats.value.stdDev);

    const currentThroughput = computed(() => {
      if (!props.data || props.data.length === 0) return 0;
      return props.data[props.data.length - 1].value;
    });

    // 스케일 계산
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

    const yScale = computed(() => {
      const max = Math.max(maxValue.value, 1);
      const min = Math.min(minValue.value, 0);
      const range = max - min;
      const padding_y = range * 0.1; // 10% 패딩
      
      return {
        domain: [min - padding_y, max + padding_y],
        range: [chartHeight.value - padding.bottom, padding.top],
        scale: (value) => {
          const normalizedValue = (value - (min - padding_y)) / (range + 2 * padding_y);
          return chartHeight.value - padding.bottom - normalizedValue * (chartHeight.value - padding.top - padding.bottom);
        }
      };
    });

    // 차트 데이터 포인트
    const chartData = computed(() => {
      if (!props.data || !xScale.value || !yScale.value) return [];
      
      return props.data.map(d => ({
        x: xScale.value.scale(d.timestamp),
        y: yScale.value.scale(d.value),
        data: d
      }));
    });

    // 라인 패스 생성
    const linePath = computed(() => {
      if (!chartData.value || chartData.value.length === 0) return '';
      
      return chartData.value.reduce((path, point, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${path} ${command} ${point.x} ${point.y}`;
      }, '');
    });

    // 영역 패스 생성
    const areaPath = computed(() => {
      if (!chartData.value || chartData.value.length === 0) return '';
      
      const bottomY = chartHeight.value - padding.bottom;
      let path = `M ${chartData.value[0].x} ${bottomY}`;
      
      // 위쪽 라인
      chartData.value.forEach(point => {
        path += ` L ${point.x} ${point.y}`;
      });
      
      // 아래쪽으로 닫기
      path += ` L ${chartData.value[chartData.value.length - 1].x} ${bottomY} Z`;
      
      return path;
    });

    // 축 눈금
    const xAxisTicks = computed(() => {
      if (!xScale.value) return [];
      
      const [minTime, maxTime] = xScale.value.domain;
      const timeRange = maxTime - minTime;
      const tickCount = Math.min(6, Math.max(3, Math.floor(chartWidth.value / 100)));
      
      const ticks = [];
      for (let i = 0; i < tickCount; i++) {
        const time = minTime + (timeRange / (tickCount - 1)) * i;
        const x = xScale.value.scale(new Date(time));
        const date = new Date(time);
        
        let label;
        if (timeRange < 2 * 60 * 60 * 1000) { // 2시간 미만
          label = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        } else if (timeRange < 24 * 60 * 60 * 1000) { // 24시간 미만
          label = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        } else {
          label = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
        
        ticks.push({ value: time, x, label });
      }
      
      return ticks;
    });

    const yAxisTicks = computed(() => {
      if (!yScale.value) return [];
      
      const [min, max] = yScale.value.domain;
      const tickCount = 5;
      const step = (max - min) / (tickCount - 1);
      
      const ticks = [];
      for (let i = 0; i < tickCount; i++) {
        const value = min + step * i;
        const y = yScale.value.scale(value);
        const label = formatValue(value);
        
        ticks.push({ value, y, label });
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

    // 값 포맷팅
    const formatValue = (value) => {
      if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
      } else if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      } else {
        return Math.round(value).toString();
      }
    };

    // 툴팁 표시
    const showTooltip = (event, data) => {
      const rect = chartSvg.value.getBoundingClientRect();
      tooltip.value = {
        show: true,
        x: event.clientX - rect.left + 10,
        y: event.clientY - rect.top - 10,
        time: new Date(data.timestamp).toLocaleString('ko-KR'),
        value: `${formatValue(data.value)}/h`
      };
    };

    const hideTooltip = () => {
      tooltip.value.show = false;
    };

    // 컨트롤 함수들
    const toggleGrid = () => {
      showGrid.value = !showGrid.value;
    };

    const toggleDataPoints = () => {
      showDataPoints.value = !showDataPoints.value;
    };

    const exportData = () => {
      emit('export-data', props.data);
    };

    // 시간 범위 변경 감지
    watch(selectedTimeRange, (newRange) => {
      emit('time-range-change', newRange);
    });

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
      tooltipEl,
      chartWidth,
      chartHeight,
      selectedTimeRange,
      showGrid,
      showDataPoints,
      padding,
      tooltip,
      chartData,
      linePath,
      areaPath,
      xAxisTicks,
      yAxisTicks,
      verticalGridLines,
      horizontalGridLines,
      minValue,
      maxValue,
      avgValue,
      stdDev,
      currentThroughput,
      formatValue,
      showTooltip,
      hideTooltip,
      toggleGrid,
      toggleDataPoints,
      exportData
    };
  }
};
</script>

<style scoped>
.throughput-chart-container {
  width: 100%;
}

.chart-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.throughput-chart {
  width: 100%;
  height: 100%;
}

/* SVG 스타일 */
.grid-line {
  stroke: #e0e0e0;
  stroke-width: 1;
  opacity: 0.5;
}

.area-fill {
  opacity: 0.3;
}

.chart-line {
  stroke-width: 2;
  fill: none;
}

.data-point {
  stroke: white;
  stroke-width: 2;
  cursor: pointer;
  transition: r 0.2s ease;
}

.data-point:hover {
  r: 5;
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
  font-size: 12px;
  fill: #666;
  font-family: 'Roboto', sans-serif;
}

.axis-title {
  font-size: 12px;
  fill: #666;
  font-family: 'Roboto', sans-serif;
  font-weight: 500;
}

/* 툴팁 스타일 */
.chart-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.tooltip-time {
  font-weight: normal;
  opacity: 0.8;
}

.tooltip-value {
  font-weight: bold;
  font-size: 14px;
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
  .tick-label {
    font-size: 10px;
  }
  
  .axis-title {
    font-size: 10px;
  }
}
</style>