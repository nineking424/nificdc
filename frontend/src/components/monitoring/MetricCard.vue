<template>
  <v-card
    class="metric-card"
    :class="{ 'loading-pulse': loading }"
    elevation="2"
    height="160"
  >
    <v-card-text class="d-flex flex-column justify-space-between h-100 pa-4">
      <!-- 헤더 섹션 -->
      <div class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon
            :color="color"
            size="28"
            class="mr-3"
          >
            {{ icon }}
          </v-icon>
          <div>
            <div class="text-subtitle2 text-medium-emphasis">{{ title }}</div>
            <div v-if="subtitle" class="text-caption text-disabled">{{ subtitle }}</div>
          </div>
        </div>
        
        <!-- 트렌드 표시 -->
        <div v-if="trend && !loading" class="text-right">
          <v-chip
            :color="getTrendColor(trend.direction)"
            size="small"
            variant="tonal"
            class="trend-chip"
          >
            <v-icon
              :icon="getTrendIcon(trend.direction)"
              size="12"
              class="mr-1"
            />
            {{ trend.percentage }}%
          </v-chip>
        </div>
      </div>

      <!-- 값 표시 섹션 -->
      <div class="text-center my-2">
        <div v-if="loading" class="d-flex justify-center">
          <v-progress-circular
            indeterminate
            :color="color"
            size="24"
          />
        </div>
        <div v-else class="metric-value-container">
          <div class="metric-value" :class="[`text-${color}`]">
            {{ formattedValue }}
            <span v-if="unit" class="metric-unit">{{ unit }}</span>
          </div>
          <div v-if="previousValue" class="text-caption text-disabled">
            이전: {{ formatValue(previousValue) }}{{ unit }}
          </div>
        </div>
      </div>

      <!-- 추가 정보 섹션 -->
      <div v-if="details && !loading" class="metric-details">
        <div class="d-flex justify-space-between text-caption text-medium-emphasis">
          <span v-if="details.min !== undefined">최소: {{ formatValue(details.min) }}</span>
          <span v-if="details.max !== undefined">최대: {{ formatValue(details.max) }}</span>
          <span v-if="details.avg !== undefined">평균: {{ formatValue(details.avg) }}</span>
        </div>
      </div>

      <!-- 상태 표시 -->
      <div v-if="status && !loading" class="d-flex align-center justify-space-between mt-2">
        <v-chip
          :color="getStatusColor(status)"
          size="x-small"
          variant="flat"
        >
          {{ getStatusText(status) }}
        </v-chip>
        <div v-if="lastUpdated" class="text-caption text-disabled">
          {{ formatTimestamp(lastUpdated) }}
        </div>
      </div>
    </v-card-text>

    <!-- 프로그레스 바 (선택적) -->
    <v-progress-linear
      v-if="progress !== undefined && !loading"
      :model-value="progress"
      :color="color"
      height="3"
      class="mt-auto"
    />
  </v-card>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'MetricCard',
  props: {
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      default: ''
    },
    value: {
      type: [Number, String],
      required: true
    },
    previousValue: {
      type: [Number, String],
      default: null
    },
    unit: {
      type: String,
      default: ''
    },
    icon: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: 'primary'
    },
    loading: {
      type: Boolean,
      default: false
    },
    trend: {
      type: Object,
      default: null
      // { direction: 'up|down|stable', percentage: number }
    },
    details: {
      type: Object,
      default: null
      // { min: number, max: number, avg: number }
    },
    status: {
      type: String,
      default: null
      // 'good', 'warning', 'error'
    },
    lastUpdated: {
      type: [Date, String],
      default: null
    },
    progress: {
      type: Number,
      default: undefined
    },
    precision: {
      type: Number,
      default: 1
    }
  },
  setup(props) {
    const formattedValue = computed(() => {
      return props.loading ? '-' : formatValue(props.value, props.precision);
    });

    const formatValue = (value, precision = 1) => {
      if (value === null || value === undefined) return '-';
      
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(num)) return value;

      // 큰 숫자 포맷팅
      if (num >= 1000000) {
        return (num / 1000000).toFixed(precision) + 'M';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(precision) + 'K';
      } else if (num >= 1) {
        return num.toFixed(precision);
      } else if (num > 0) {
        return num.toFixed(precision + 1);
      }
      
      return num.toString();
    };

    const getTrendIcon = (direction) => {
      const icons = {
        up: 'mdi-trending-up',
        down: 'mdi-trending-down',
        stable: 'mdi-trending-neutral'
      };
      return icons[direction] || 'mdi-minus';
    };

    const getTrendColor = (direction) => {
      const colors = {
        up: 'success',
        down: 'error',
        stable: 'info'
      };
      return colors[direction] || 'grey';
    };

    const getStatusColor = (status) => {
      const colors = {
        good: 'success',
        warning: 'warning',
        error: 'error',
        info: 'info'
      };
      return colors[status] || 'grey';
    };

    const getStatusText = (status) => {
      const texts = {
        good: '정상',
        warning: '주의',
        error: '오류',
        info: '정보'
      };
      return texts[status] || status;
    };

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

    return {
      formattedValue,
      formatValue,
      getTrendIcon,
      getTrendColor,
      getStatusColor,
      getStatusText,
      formatTimestamp
    };
  }
};
</script>

<style scoped>
.metric-card {
  transition: all 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}

.metric-value-container {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.metric-value {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.metric-unit {
  font-size: 1rem;
  font-weight: 400;
  opacity: 0.8;
  margin-left: 4px;
}

.trend-chip {
  font-size: 0.75rem;
  font-weight: 500;
}

.metric-details {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 8px;
  margin-top: 8px;
}

.loading-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .metric-details {
    border-top-color: rgba(255, 255, 255, 0.12);
  }
}

/* 반응형 디자인 */
@media (max-width: 600px) {
  .metric-value {
    font-size: 1.5rem;
  }
  
  .metric-unit {
    font-size: 0.875rem;
  }
}
</style>