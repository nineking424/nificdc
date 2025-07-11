<template>
  <div class="monitoring-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <div class="chart-controls">
        <v-btn-toggle
          v-if="showTimeControls"
          v-model="selectedPeriod"
          variant="outlined"
          density="compact"
          @update:model-value="updatePeriod"
        >
          <v-btn value="1h">1시간</v-btn>
          <v-btn value="6h">6시간</v-btn>
          <v-btn value="24h">24시간</v-btn>
          <v-btn value="7d">7일</v-btn>
        </v-btn-toggle>
        <v-btn
          v-if="showRefresh"
          icon="mdi-refresh"
          size="small"
          variant="text"
          @click="refreshChart"
          :loading="loading"
        />
      </div>
    </div>
    
    <div class="chart-container" :style="{ height: chartHeight }">
      <canvas ref="chartCanvas"></canvas>
    </div>
    
    <div v-if="showLegend" class="chart-legend">
      <div
        v-for="(item, index) in legendItems"
        :key="index"
        class="legend-item"
      >
        <div
          class="legend-color"
          :style="{ backgroundColor: item.color }"
        />
        <span class="legend-label">{{ item.label }}</span>
        <span v-if="item.value" class="legend-value">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import Chart from 'chart.js/auto';

export default {
  name: 'MonitoringChart',
  props: {
    title: {
      type: String,
      default: '차트'
    },
    chartType: {
      type: String,
      default: 'line',
      validator: value => ['line', 'bar', 'pie', 'doughnut', 'area'].includes(value)
    },
    data: {
      type: Object,
      required: true
    },
    options: {
      type: Object,
      default: () => ({})
    },
    chartHeight: {
      type: String,
      default: '300px'
    },
    showTimeControls: {
      type: Boolean,
      default: false
    },
    showRefresh: {
      type: Boolean,
      default: false
    },
    showLegend: {
      type: Boolean,
      default: false
    },
    autoRefresh: {
      type: Boolean,
      default: false
    },
    refreshInterval: {
      type: Number,
      default: 30000 // 30초
    }
  },
  emits: ['refresh', 'period-changed'],
  setup(props, { emit }) {
    const chartCanvas = ref(null);
    const chart = ref(null);
    const loading = ref(false);
    const selectedPeriod = ref('24h');
    const legendItems = ref([]);
    
    let refreshTimer = null;

    // 차트 초기화
    const initChart = async () => {
      await nextTick();
      
      if (!chartCanvas.value) return;
      
      const ctx = chartCanvas.value.getContext('2d');
      
      // 기존 차트 제거
      if (chart.value) {
        chart.value.destroy();
      }
      
      // 차트 옵션 설정
      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false // 커스텀 범례 사용
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: true
          }
        },
        scales: props.chartType === 'pie' || props.chartType === 'doughnut' ? {} : {
          x: {
            display: true,
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        },
        ...props.options
      };
      
      // 차트 생성
      chart.value = new Chart(ctx, {
        type: props.chartType === 'area' ? 'line' : props.chartType,
        data: processChartData(props.data),
        options: chartOptions
      });
      
      // 범례 업데이트
      updateLegend();
    };

    // 차트 데이터 처리
    const processChartData = (data) => {
      const processedData = JSON.parse(JSON.stringify(data));
      
      // 색상 팔레트
      const colors = [
        '#2196F3', '#4CAF50', '#FF9800', '#F44336', '#9C27B0',
        '#00BCD4', '#8BC34A', '#FFEB3B', '#795548', '#607D8B'
      ];
      
      // 데이터셋에 색상 적용
      if (processedData.datasets) {
        processedData.datasets.forEach((dataset, index) => {
          const color = colors[index % colors.length];
          
          if (props.chartType === 'line' || props.chartType === 'area') {
            dataset.borderColor = color;
            dataset.backgroundColor = props.chartType === 'area' 
              ? `${color}20` 
              : `${color}10`;
            dataset.pointBackgroundColor = color;
            dataset.pointBorderColor = '#fff';
            dataset.pointBorderWidth = 2;
            dataset.pointRadius = 4;
            dataset.tension = 0.4;
            
            if (props.chartType === 'area') {
              dataset.fill = true;
            }
          } else if (props.chartType === 'bar') {
            dataset.backgroundColor = color;
            dataset.borderColor = color;
            dataset.borderWidth = 1;
          } else if (props.chartType === 'pie' || props.chartType === 'doughnut') {
            dataset.backgroundColor = colors.slice(0, dataset.data.length);
            dataset.borderColor = '#fff';
            dataset.borderWidth = 2;
          }
        });
      }
      
      return processedData;
    };

    // 범례 업데이트
    const updateLegend = () => {
      if (!chart.value || !props.showLegend) return;
      
      const legend = chart.value.legend;
      if (legend && legend.legendItems) {
        legendItems.value = legend.legendItems.map(item => ({
          label: item.text,
          color: item.fillStyle || item.strokeStyle,
          value: null // 필요시 값 추가
        }));
      }
    };

    // 차트 업데이트
    const updateChart = () => {
      if (!chart.value) return;
      
      chart.value.data = processChartData(props.data);
      chart.value.update('active');
      updateLegend();
    };

    // 차트 새로고침
    const refreshChart = () => {
      loading.value = true;
      emit('refresh');
      
      setTimeout(() => {
        loading.value = false;
      }, 1000);
    };

    // 기간 변경
    const updatePeriod = (period) => {
      selectedPeriod.value = period;
      emit('period-changed', period);
    };

    // 자동 새로고침 설정
    const setupAutoRefresh = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      
      if (props.autoRefresh) {
        refreshTimer = setInterval(() => {
          refreshChart();
        }, props.refreshInterval);
      }
    };

    // 반응형 처리
    const handleResize = () => {
      if (chart.value) {
        chart.value.resize();
      }
    };

    // 데이터 변경 감지
    watch(() => props.data, updateChart, { deep: true });
    
    // 자동 새로고침 설정 변경 감지
    watch(() => props.autoRefresh, setupAutoRefresh);
    watch(() => props.refreshInterval, setupAutoRefresh);

    // 컴포넌트 마운트 시 초기화
    onMounted(() => {
      initChart();
      setupAutoRefresh();
      
      // 윈도우 리사이즈 이벤트 리스너
      window.addEventListener('resize', handleResize);
    });

    // 컴포넌트 언마운트 시 정리
    onUnmounted(() => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      
      if (chart.value) {
        chart.value.destroy();
      }
      
      window.removeEventListener('resize', handleResize);
    });

    return {
      chartCanvas,
      loading,
      selectedPeriod,
      legendItems,
      refreshChart,
      updatePeriod
    };
  }
};
</script>

<style scoped>
.monitoring-chart {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chart-container {
  position: relative;
  width: 100%;
  min-height: 200px;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  font-size: 0.875rem;
  color: #666;
}

.legend-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #333;
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .monitoring-chart {
    background: #1e1e1e;
    color: #fff;
  }
  
  .chart-title {
    color: #fff;
  }
  
  .legend-label {
    color: #ccc;
  }
  
  .legend-value {
    color: #fff;
  }
  
  .chart-legend {
    border-top-color: #333;
  }
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .monitoring-chart {
    padding: 16px;
  }
  
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .chart-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .chart-legend {
    flex-direction: column;
    gap: 8px;
  }
}
</style>