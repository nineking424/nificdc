<template>
  <div class="error-analysis-chart">
    <!-- 로딩 상태 -->
    <div v-if="loading" class="d-flex justify-center align-center" :style="{ height: height + 'px' }">
      <v-progress-circular
        indeterminate
        color="error"
        size="40"
      />
      <span class="ml-3">에러 분석 데이터 로딩 중...</span>
    </div>

    <!-- 데이터 없음 상태 -->
    <div v-else-if="!data || Object.keys(data).length === 0" class="d-flex justify-center align-center flex-column" :style="{ height: height + 'px' }">
      <v-icon size="48" color="success">mdi-check-circle</v-icon>
      <div class="text-subtitle1 text-disabled mt-2">에러가 발생하지 않았습니다</div>
      <div class="text-caption text-disabled">시스템이 정상적으로 동작 중입니다</div>
    </div>

    <!-- 차트 표시 -->
    <div v-else>
      <!-- 차트 헤더 -->
      <div v-if="showControls" class="d-flex justify-space-between align-center mb-3">
        <div class="d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-alert-circle</v-icon>
          <div>
            <div class="text-subtitle2">에러 분석</div>
            <div class="text-caption text-disabled">
              총 {{ totalErrors }}개 에러 ({{ Object.keys(data.byCategory || {}).length }}개 카테고리)
            </div>
          </div>
        </div>

        <div class="d-flex align-center">
          <!-- 차트 타입 선택 -->
          <v-btn-toggle
            v-model="chartType"
            mandatory
            density="compact"
            size="small"
            class="mr-2"
          >
            <v-btn value="category">카테고리</v-btn>
            <v-btn value="severity">심각도</v-btn>
            <v-btn value="timeline">시간대별</v-btn>
          </v-btn-toggle>

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
              <v-list-item @click="toggleLabels">
                <v-list-item-title>
                  <v-icon class="mr-2" size="small">{{ showLabels ? 'mdi-label-off' : 'mdi-label' }}</v-icon>
                  라벨 {{ showLabels ? '숨기기' : '표시' }}
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="togglePercentage">
                <v-list-item-title>
                  <v-icon class="mr-2" size="small">mdi-percent</v-icon>
                  {{ showPercentage ? '개수' : '백분율' }} 표시
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>

      <!-- 차트 컨테이너 -->
      <div class="chart-container" :style="{ height: height + 'px' }">
        <!-- 도넛 차트 (카테고리/심각도) -->
        <div v-if="chartType !== 'timeline'" class="d-flex">
          <!-- SVG 도넛 차트 -->
          <div class="chart-svg-container">
            <svg
              ref="chartSvg"
              :width="chartSize"
              :height="chartSize"
              class="donut-chart"
            >
              <!-- 도넛 세그먼트 -->
              <g :transform="`translate(${chartSize/2}, ${chartSize/2})`">
                <path
                  v-for="(segment, index) in chartSegments"
                  :key="index"
                  :d="segment.path"
                  :fill="segment.color"
                  class="chart-segment"
                  :class="{ 'segment-highlighted': segment.highlighted }"
                  @mouseover="highlightSegment(index)"
                  @mouseout="unhighlightSegment(index)"
                  @click="selectSegment(segment)"
                />
                
                <!-- 중앙 텍스트 -->
                <text
                  text-anchor="middle"
                  dy="0.35em"
                  class="center-text-primary"
                >
                  {{ totalErrors }}
                </text>
                <text
                  text-anchor="middle"
                  dy="1.5em"
                  class="center-text-secondary"
                >
                  총 에러
                </text>
              </g>

              <!-- 라벨 (선택적) -->
              <g v-if="showLabels" :transform="`translate(${chartSize/2}, ${chartSize/2})`">
                <g
                  v-for="(segment, index) in chartSegments"
                  :key="`label-${index}`"
                  class="segment-label"
                >
                  <line
                    :x1="segment.labelLine.x1"
                    :y1="segment.labelLine.y1"
                    :x2="segment.labelLine.x2"
                    :y2="segment.labelLine.y2"
                    stroke="#666"
                    stroke-width="1"
                  />
                  <text
                    :x="segment.labelPosition.x"
                    :y="segment.labelPosition.y"
                    :text-anchor="segment.labelPosition.anchor"
                    class="label-text"
                    dy="0.35em"
                  >
                    {{ segment.label }}
                  </text>
                  <text
                    :x="segment.labelPosition.x"
                    :y="segment.labelPosition.y + 12"
                    :text-anchor="segment.labelPosition.anchor"
                    class="label-value"
                    dy="0.35em"
                  >
                    {{ showPercentage ? segment.percentage + '%' : segment.value }}
                  </text>
                </g>
              </g>
            </svg>
          </div>

          <!-- 범례 -->
          <div class="chart-legend">
            <div class="legend-title text-subtitle2 mb-2">
              {{ chartType === 'category' ? '에러 카테고리' : '심각도별 분류' }}
            </div>
            <div
              v-for="(segment, index) in chartSegments"
              :key="`legend-${index}`"
              class="legend-item"
              :class="{ 'legend-highlighted': segment.highlighted }"
              @mouseover="highlightSegment(index)"
              @mouseout="unhighlightSegment(index)"
              @click="selectSegment(segment)"
            >
              <div
                class="legend-color"
                :style="{ backgroundColor: segment.color }"
              />
              <div class="legend-content">
                <div class="legend-label">{{ segment.label }}</div>
                <div class="legend-value">
                  {{ segment.value }}개
                  <span class="legend-percentage">({{ segment.percentage }}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 시간대별 차트 -->
        <div v-else class="timeline-chart">
          <svg
            ref="timelineChartSvg"
            :width="timelineChartWidth"
            :height="timelineChartHeight"
            class="timeline-chart-svg"
          >
            <!-- 막대 차트 -->
            <g class="bars" :transform="`translate(${timelinePadding.left}, ${timelinePadding.top})`">
              <rect
                v-for="(bar, index) in timelineBars"
                :key="index"
                :x="bar.x"
                :y="bar.y"
                :width="bar.width"
                :height="bar.height"
                :fill="bar.color"
                class="timeline-bar"
                @mouseover="showTimelineTooltip($event, bar.data)"
                @mouseout="hideTimelineTooltip"
              />
            </g>

            <!-- X축 -->
            <g class="x-axis" :transform="`translate(${timelinePadding.left}, ${timelineChartHeight - timelinePadding.bottom})`">
              <line
                :x1="0"
                :y1="0"
                :x2="timelineChartWidth - timelinePadding.left - timelinePadding.right"
                :y2="0"
                class="axis-line"
              />
              <g
                v-for="tick in timelineXTicks"
                :key="tick.value"
                class="tick"
              >
                <line
                  :x1="tick.x"
                  :y1="0"
                  :x2="tick.x"
                  :y2="5"
                  class="tick-line"
                />
                <text
                  :x="tick.x"
                  :y="18"
                  class="tick-label"
                  text-anchor="middle"
                >
                  {{ tick.label }}
                </text>
              </g>
            </g>

            <!-- Y축 -->
            <g class="y-axis" :transform="`translate(${timelinePadding.left}, ${timelinePadding.top})`">
              <line
                :x1="0"
                :y1="0"
                :x2="0"
                :y2="timelineChartHeight - timelinePadding.top - timelinePadding.bottom"
                class="axis-line"
              />
              <g
                v-for="tick in timelineYTicks"
                :key="tick.value"
                class="tick"
              >
                <line
                  :x1="-5"
                  :y1="tick.y"
                  :x2="0"
                  :y2="tick.y"
                  class="tick-line"
                />
                <text
                  :x="-10"
                  :y="tick.y + 4"
                  class="tick-label"
                  text-anchor="end"
                >
                  {{ tick.label }}
                </text>
              </g>
            </g>
          </svg>

          <!-- 시간대별 툴팁 -->
          <div
            v-if="timelineTooltip.show"
            ref="timelineTooltipEl"
            class="timeline-tooltip"
            :style="{
              left: timelineTooltip.x + 'px',
              top: timelineTooltip.y + 'px'
            }"
          >
            <div class="tooltip-time">{{ timelineTooltip.time }}</div>
            <div class="tooltip-value">{{ timelineTooltip.value }}개 에러</div>
          </div>
        </div>
      </div>

      <!-- 상세 정보 패널 -->
      <div v-if="selectedSegment && showDetails" class="selected-details mt-3">
        <v-card variant="outlined">
          <v-card-title class="d-flex align-center">
            <div
              class="detail-color-indicator"
              :style="{ backgroundColor: selectedSegment.color }"
            />
            {{ selectedSegment.label }} 상세 정보
          </v-card-title>
          <v-card-text>
            <div class="details-grid">
              <div class="detail-item">
                <div class="detail-label">에러 수</div>
                <div class="detail-value">{{ selectedSegment.value }}개</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">비율</div>
                <div class="detail-value">{{ selectedSegment.percentage }}%</div>
              </div>
              <div v-if="selectedSegment.description" class="detail-item">
                <div class="detail-label">설명</div>
                <div class="detail-value">{{ selectedSegment.description }}</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- 빈번한 에러 패턴 -->
      <div v-if="data.topErrors && data.topErrors.length > 0" class="top-errors mt-3">
        <v-card variant="outlined">
          <v-card-title>빈번한 에러 패턴</v-card-title>
          <v-card-text>
            <div
              v-for="(error, index) in data.topErrors.slice(0, 5)"
              :key="index"
              class="error-pattern-item"
            >
              <div class="d-flex align-center justify-space-between">
                <div class="error-sample">{{ error.sample }}</div>
                <v-chip
                  :color="getSeverityColor(error.severity)"
                  size="small"
                  variant="tonal"
                >
                  {{ error.count }}회
                </v-chip>
              </div>
              <div class="text-caption text-disabled mt-1">
                {{ error.category }} · {{ error.classification }}
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from 'vue';

export default {
  name: 'ErrorAnalysisChart',
  props: {
    data: {
      type: Object,
      default: () => ({})
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
    showDetails: {
      type: Boolean,
      default: true
    }
  },
  emits: ['segment-select'],
  setup(props, { emit }) {
    const chartSvg = ref(null);
    const timelineChartSvg = ref(null);
    const timelineTooltipEl = ref(null);
    
    const chartType = ref('category');
    const showLabels = ref(false);
    const showPercentage = ref(false);
    const selectedSegment = ref(null);
    
    // 차트 크기 설정
    const chartSize = computed(() => Math.min(props.height, 220));
    const radius = computed(() => chartSize.value / 2 - 20);
    const innerRadius = computed(() => radius.value * 0.6);
    
    // 시간대별 차트 설정
    const timelineChartWidth = ref(600);
    const timelineChartHeight = computed(() => props.height);
    const timelinePadding = {
      top: 20,
      right: 20,
      bottom: 40,
      left: 60
    };
    
    // 툴팁 상태
    const timelineTooltip = ref({
      show: false,
      x: 0,
      y: 0,
      time: '',
      value: ''
    });

    // 색상 팔레트
    const categoryColors = {
      'network': '#f44336',
      'security': '#e91e63',
      'data': '#9c27b0',
      'resource': '#673ab7',
      'system': '#3f51b5',
      'unknown': '#9e9e9e'
    };
    
    const severityColors = {
      'critical': '#d32f2f',
      'high': '#f57c00',
      'medium': '#1976d2',
      'low': '#388e3c'
    };

    // 총 에러 수 계산
    const totalErrors = computed(() => {
      if (chartType.value === 'category') {
        return Object.values(props.data.byCategory || {}).reduce((sum, count) => sum + count, 0);
      } else if (chartType.value === 'severity') {
        return Object.values(props.data.bySeverity || {}).reduce((sum, count) => sum + count, 0);
      } else {
        return props.data.totalErrors || 0;
      }
    });

    // 차트 세그먼트 계산
    const chartSegments = computed(() => {
      let dataSource;
      let colors;
      
      if (chartType.value === 'category') {
        dataSource = props.data.byCategory || {};
        colors = categoryColors;
      } else {
        dataSource = props.data.bySeverity || {};
        colors = severityColors;
      }
      
      const entries = Object.entries(dataSource);
      const total = totalErrors.value;
      
      if (total === 0) return [];
      
      let currentAngle = -Math.PI / 2; // 시작 각도 (12시 방향)
      
      return entries.map(([key, value], index) => {
        const percentage = Math.round((value / total) * 100);
        const angle = (value / total) * 2 * Math.PI;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        
        // 호 경로 생성
        const largeArcFlag = angle > Math.PI ? 1 : 0;
        const x1 = Math.cos(startAngle) * radius.value;
        const y1 = Math.sin(startAngle) * radius.value;
        const x2 = Math.cos(endAngle) * radius.value;
        const y2 = Math.sin(endAngle) * radius.value;
        const x3 = Math.cos(endAngle) * innerRadius.value;
        const y3 = Math.sin(endAngle) * innerRadius.value;
        const x4 = Math.cos(startAngle) * innerRadius.value;
        const y4 = Math.sin(startAngle) * innerRadius.value;
        
        const path = [
          `M ${x1} ${y1}`,
          `A ${radius.value} ${radius.value} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${innerRadius.value} ${innerRadius.value} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
          'Z'
        ].join(' ');
        
        // 라벨 위치 계산
        const labelAngle = startAngle + angle / 2;
        const labelRadius = radius.value + 30;
        const labelX = Math.cos(labelAngle) * labelRadius;
        const labelY = Math.sin(labelAngle) * labelRadius;
        
        const segment = {
          key,
          label: getDisplayName(key),
          value,
          percentage,
          color: colors[key] || '#9e9e9e',
          path,
          highlighted: false,
          labelPosition: {
            x: labelX,
            y: labelY,
            anchor: labelX > 0 ? 'start' : 'end'
          },
          labelLine: {
            x1: Math.cos(labelAngle) * radius.value,
            y1: Math.sin(labelAngle) * radius.value,
            x2: Math.cos(labelAngle) * (radius.value + 20),
            y2: Math.sin(labelAngle) * (radius.value + 20)
          },
          description: getDescription(key, chartType.value)
        };
        
        currentAngle = endAngle;
        return segment;
      });
    });

    // 시간대별 차트 데이터
    const timelineBars = computed(() => {
      if (!props.data.timeline) return [];
      
      const timeline = props.data.timeline;
      const maxValue = Math.max(...timeline.map(t => t.count));
      const barWidth = (timelineChartWidth.value - timelinePadding.left - timelinePadding.right) / timeline.length;
      const chartHeight = timelineChartHeight.value - timelinePadding.top - timelinePadding.bottom;
      
      return timeline.map((item, index) => {
        const height = maxValue > 0 ? (item.count / maxValue) * chartHeight : 0;
        return {
          x: index * barWidth,
          y: chartHeight - height,
          width: barWidth * 0.8,
          height,
          color: '#f44336',
          data: item
        };
      });
    });

    // 시간대별 차트 축
    const timelineXTicks = computed(() => {
      if (!props.data.timeline) return [];
      
      const timeline = props.data.timeline;
      const barWidth = (timelineChartWidth.value - timelinePadding.left - timelinePadding.right) / timeline.length;
      
      return timeline.map((item, index) => ({
        value: item.timestamp,
        x: index * barWidth + barWidth / 2,
        label: new Date(item.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      }));
    });

    const timelineYTicks = computed(() => {
      if (!props.data.timeline) return [];
      
      const maxValue = Math.max(...props.data.timeline.map(t => t.count));
      const tickCount = 5;
      const chartHeight = timelineChartHeight.value - timelinePadding.top - timelinePadding.bottom;
      
      const ticks = [];
      for (let i = 0; i <= tickCount; i++) {
        const value = Math.round((maxValue / tickCount) * i);
        const y = chartHeight - (i / tickCount) * chartHeight;
        ticks.push({ value, y, label: value.toString() });
      }
      
      return ticks;
    });

    // 헬퍼 함수들
    const getDisplayName = (key) => {
      const names = {
        'network': '네트워크',
        'security': '보안',
        'data': '데이터',
        'resource': '리소스',
        'system': '시스템',
        'critical': '치명적',
        'high': '높음',
        'medium': '보통',
        'low': '낮음',
        'unknown': '알 수 없음'
      };
      return names[key] || key;
    };

    const getDescription = (key, type) => {
      if (type === 'category') {
        const descriptions = {
          'network': '네트워크 연결 및 통신 관련 오류',
          'security': '인증, 권한 및 보안 관련 오류',
          'data': '데이터 유효성 검사 및 변환 오류',
          'resource': '메모리, CPU, 디스크 등 시스템 자원 부족',
          'system': '내부 시스템 오류 및 예외상황'
        };
        return descriptions[key];
      } else {
        const descriptions = {
          'critical': '즉시 대응이 필요한 치명적 오류',
          'high': '빠른 대응이 필요한 심각한 오류',
          'medium': '주의가 필요한 일반적 오류',
          'low': '참고용 경미한 오류'
        };
        return descriptions[key];
      }
    };

    const getSeverityColor = (severity) => {
      return severityColors[severity] || '#9e9e9e';
    };

    // 이벤트 핸들러
    const highlightSegment = (index) => {
      chartSegments.value.forEach((segment, i) => {
        segment.highlighted = i === index;
      });
    };

    const unhighlightSegment = () => {
      chartSegments.value.forEach(segment => {
        segment.highlighted = false;
      });
    };

    const selectSegment = (segment) => {
      selectedSegment.value = segment;
      emit('segment-select', segment);
    };

    const showTimelineTooltip = (event, data) => {
      const rect = timelineChartSvg.value.getBoundingClientRect();
      timelineTooltip.value = {
        show: true,
        x: event.clientX - rect.left + 10,
        y: event.clientY - rect.top - 10,
        time: new Date(data.timestamp).toLocaleString('ko-KR'),
        value: data.count.toString()
      };
    };

    const hideTimelineTooltip = () => {
      timelineTooltip.value.show = false;
    };

    // 컨트롤 함수들
    const toggleLabels = () => {
      showLabels.value = !showLabels.value;
    };

    const togglePercentage = () => {
      showPercentage.value = !showPercentage.value;
    };

    // 차트 크기 업데이트
    const updateChartSize = () => {
      if (timelineChartSvg.value) {
        const container = timelineChartSvg.value.parentElement;
        timelineChartWidth.value = container.clientWidth;
      }
    };

    onMounted(async () => {
      await nextTick();
      updateChartSize();
      window.addEventListener('resize', updateChartSize);
    });

    return {
      chartSvg,
      timelineChartSvg,
      timelineTooltipEl,
      chartType,
      showLabels,
      showPercentage,
      selectedSegment,
      chartSize,
      timelineChartWidth,
      timelineChartHeight,
      timelinePadding,
      timelineTooltip,
      totalErrors,
      chartSegments,
      timelineBars,
      timelineXTicks,
      timelineYTicks,
      getSeverityColor,
      highlightSegment,
      unhighlightSegment,
      selectSegment,
      showTimelineTooltip,
      hideTimelineTooltip,
      toggleLabels,
      togglePercentage
    };
  }
};
</script>

<style scoped>
.error-analysis-chart {
  width: 100%;
}

.chart-container {
  width: 100%;
  position: relative;
}

.chart-svg-container {
  flex: 0 0 auto;
}

.chart-legend {
  flex: 1;
  padding-left: 24px;
  max-height: 250px;
  overflow-y: auto;
}

.legend-title {
  color: #666;
  margin-bottom: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  padding: 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.legend-item:hover,
.legend-highlighted {
  background-color: rgba(0, 0, 0, 0.04);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 8px;
  flex-shrink: 0;
}

.legend-content {
  flex: 1;
}

.legend-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
}

.legend-value {
  font-size: 12px;
  color: #666;
  line-height: 1.2;
}

.legend-percentage {
  opacity: 0.7;
}

/* SVG 스타일 */
.donut-chart {
  overflow: visible;
}

.chart-segment {
  cursor: pointer;
  transition: opacity 0.2s;
}

.chart-segment:hover,
.segment-highlighted {
  opacity: 0.8;
}

.center-text-primary {
  font-size: 24px;
  font-weight: bold;
  fill: #333;
}

.center-text-secondary {
  font-size: 12px;
  fill: #666;
}

.label-text {
  font-size: 11px;
  fill: #333;
  font-weight: 500;
}

.label-value {
  font-size: 10px;
  fill: #666;
}

/* 시간대별 차트 스타일 */
.timeline-chart {
  width: 100%;
  position: relative;
}

.timeline-chart-svg {
  width: 100%;
}

.timeline-bar {
  cursor: pointer;
  transition: opacity 0.2s;
}

.timeline-bar:hover {
  opacity: 0.8;
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

/* 툴팁 스타일 */
.timeline-tooltip {
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

/* 상세 정보 스타일 */
.detail-color-indicator {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  margin-right: 8px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.detail-value {
  font-size: 14px;
  font-weight: 500;
}

/* 빈번한 에러 패턴 스타일 */
.error-pattern-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.error-pattern-item:last-child {
  border-bottom: none;
}

.error-sample {
  flex: 1;
  font-family: monospace;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .legend-item:hover,
  .legend-highlighted {
    background-color: rgba(255, 255, 255, 0.08);
  }
  
  .center-text-primary {
    fill: #fff;
  }
  
  .center-text-secondary,
  .label-text,
  .label-value {
    fill: #bbb;
  }
  
  .axis-line,
  .tick-line {
    stroke: #bbb;
  }
  
  .tick-label {
    fill: #bbb;
  }
  
  .error-pattern-item {
    border-bottom-color: rgba(255, 255, 255, 0.12);
  }
}

/* 반응형 디자인 */
@media (max-width: 960px) {
  .chart-legend {
    padding-left: 16px;
  }
}

@media (max-width: 600px) {
  .d-flex {
    flex-direction: column;
  }
  
  .chart-legend {
    padding-left: 0;
    padding-top: 16px;
    max-height: none;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }
}
</style>