<template>
  <div class="job-management">
    <v-container fluid>
      <!-- 헤더 -->
      <v-row class="mb-4">
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center">
            <div>
              <h1 class="text-h4 font-weight-bold">작업 관리</h1>
              <p class="text-subtitle-1 text-medium-emphasis">
                데이터 처리 작업의 생성, 스케줄링 및 모니터링을 관리합니다
              </p>
            </div>
            <div class="d-flex gap-2">
              <v-btn
                color="secondary"
                variant="outlined"
                prepend-icon="mdi-chart-line"
                @click="showDashboard = true"
              >
                대시보드
              </v-btn>
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                @click="openJobDialog"
                :loading="loading"
              >
                새 작업 추가
              </v-btn>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- 통계 카드 -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6" md="3">
          <v-card color="primary" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon size="40" class="mr-3">mdi-briefcase</v-icon>
                <div>
                  <div class="text-h4 font-weight-bold">{{ dashboardStats.summary?.totalJobs || 0 }}</div>
                  <div class="text-body-2">전체 작업</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card color="success" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon size="40" class="mr-3">mdi-play-circle</v-icon>
                <div>
                  <div class="text-h4 font-weight-bold">{{ dashboardStats.summary?.activeJobs || 0 }}</div>
                  <div class="text-body-2">활성 작업</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card color="orange" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon size="40" class="mr-3">mdi-cog</v-icon>
                <div>
                  <div class="text-h4 font-weight-bold">{{ dashboardStats.summary?.runningJobs || 0 }}</div>
                  <div class="text-body-2">실행 중</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card color="blue" variant="tonal">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon size="40" class="mr-3">mdi-clock</v-icon>
                <div>
                  <div class="text-h4 font-weight-bold">{{ dashboardStats.summary?.scheduledJobs || 0 }}</div>
                  <div class="text-body-2">예약됨</div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 필터 및 검색 -->
      <v-row class="mb-4">
        <v-col cols="12" md="3">
          <v-text-field
            v-model="filters.search"
            label="검색"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            hide-details
            clearable
            @keyup.enter="loadJobs"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-select
            v-model="filters.status"
            label="상태"
            :items="statusTypes"
            item-value="value"
            item-title="label"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-select
            v-model="filters.priority"
            label="우선순위"
            :items="priorityOptions"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-select
            v-model="filters.isActive"
            label="활성 상태"
            :items="[
              { value: 'true', title: '활성' },
              { value: 'false', title: '비활성' }
            ]"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-combobox
            v-model="filters.tags"
            label="태그"
            multiple
            chips
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
      </v-row>

      <!-- 작업 목록 -->
      <v-card>
        <v-card-title>
          <div class="d-flex justify-space-between align-center w-100">
            <span>작업 목록</span>
            <div class="d-flex gap-2">
              <v-btn
                variant="text"
                prepend-icon="mdi-refresh"
                @click="loadJobs"
                :loading="loading"
              >
                새로고침
              </v-btn>
              <v-btn
                v-if="selectedJobs.length > 0"
                variant="text"
                prepend-icon="mdi-delete"
                color="error"
                @click="deleteSelectedJobs"
              >
                선택 삭제
              </v-btn>
            </div>
          </div>
        </v-card-title>

        <v-data-table
          :headers="headers"
          :items="jobs"
          :loading="loading"
          :items-per-page="pagination.limit"
          :page="pagination.page"
          :server-items-length="pagination.total"
          @update:options="updatePagination"
          item-key="id"
          show-select
          v-model="selectedJobs"
        >
          <template #item.name="{ item }">
            <div class="d-flex align-center">
              <v-icon
                :color="getStatusColor(item.status)"
                class="mr-2"
              >
                {{ getStatusIcon(item.status) }}
              </v-icon>
              <div>
                <div class="font-weight-medium">{{ item.name }}</div>
                <div class="text-caption text-medium-emphasis">{{ item.description }}</div>
              </div>
            </div>
          </template>

          <template #item.mapping="{ item }">
            <div v-if="item.mapping">
              <div class="text-body-2">{{ item.mapping.name }}</div>
              <div class="text-caption d-flex align-center">
                <v-chip
                  size="x-small"
                  color="primary"
                  variant="outlined"
                  class="mr-1"
                >
                  {{ item.mapping.sourceSystem?.name }}
                </v-chip>
                <v-icon size="12" class="mx-1">mdi-arrow-right</v-icon>
                <v-chip
                  size="x-small"
                  color="secondary"
                  variant="outlined"
                >
                  {{ item.mapping.targetSystem?.name }}
                </v-chip>
              </div>
            </div>
          </template>

          <template #item.schedule="{ item }">
            <div>
              <v-chip
                size="small"
                :color="getScheduleTypeColor(item.scheduleConfig?.type)"
                variant="tonal"
                class="mb-1"
              >
                {{ getScheduleTypeLabel(item.scheduleConfig?.type) }}
              </v-chip>
              <div v-if="item.nextExecutionAt" class="text-caption">
                다음: {{ $filters.formatDate(item.nextExecutionAt) }}
              </div>
              <div v-else class="text-caption text-disabled">
                예약 없음
              </div>
            </div>
          </template>

          <template #item.priority="{ item }">
            <v-rating
              :model-value="item.priority"
              readonly
              density="compact"
              size="small"
              color="warning"
            />
          </template>

          <template #item.status="{ item }">
            <v-chip
              size="small"
              :color="getStatusColor(item.status)"
              variant="tonal"
            >
              {{ getStatusLabel(item.status) }}
            </v-chip>
          </template>

          <template #item.lastExecution="{ item }">
            <div v-if="item.recentExecution">
              <div class="text-caption">
                {{ $filters.formatDate(item.recentExecution.startedAt) }}
              </div>
              <v-chip
                size="x-small"
                :color="getExecutionStatusColor(item.recentExecution.status)"
                variant="tonal"
              >
                {{ getExecutionStatusLabel(item.recentExecution.status) }}
              </v-chip>
            </div>
            <span v-else class="text-disabled">실행 이력 없음</span>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex align-center">
              <v-tooltip text="실행">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-play"
                    size="small"
                    variant="text"
                    color="success"
                    @click="executeJob(item)"
                    :disabled="!item.isActive || item.status === 'running'"
                  />
                </template>
              </v-tooltip>
              
              <v-tooltip text="일시정지">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    :icon="item.status === 'paused' ? 'mdi-play' : 'mdi-pause'"
                    size="small"
                    variant="text"
                    color="warning"
                    @click="toggleJobPause(item)"
                    :disabled="!item.isActive"
                  />
                </template>
              </v-tooltip>
              
              <v-tooltip text="실행 이력">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-history"
                    size="small"
                    variant="text"
                    @click="showExecutionHistory(item)"
                  />
                </template>
              </v-tooltip>
              
              <v-tooltip text="편집">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    @click="editJob(item)"
                  />
                </template>
              </v-tooltip>
              
              <v-tooltip text="삭제">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    @click="deleteJob(item)"
                  />
                </template>
              </v-tooltip>
            </div>
          </template>
        </v-data-table>
      </v-card>

      <!-- 작업 대화상자 -->
      <JobDialog
        v-model="showJobDialog"
        :job="selectedJob"
        :mappings="mappings"
        @save="handleJobSave"
        @close="closeJobDialog"
      />

      <!-- 실행 이력 대화상자 -->
      <JobExecutionDialog
        v-model="showExecutionDialog"
        :job="selectedJob"
        @close="closeExecutionDialog"
      />

      <!-- 대시보드 대화상자 -->
      <JobDashboardDialog
        v-model="showDashboard"
        @close="showDashboard = false"
      />
    </v-container>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import JobDialog from '@/components/JobDialog.vue';
import JobExecutionDialog from '@/components/JobExecutionDialog.vue';
import JobDashboardDialog from '@/components/JobDashboardDialog.vue';
import { jobService } from '@/services/jobService';
import { mappingService } from '@/services/mappingService';

export default {
  name: 'JobManagement',
  components: {
    JobDialog,
    JobExecutionDialog,
    JobDashboardDialog
  },
  setup() {
    const router = useRouter();
    const appStore = useAppStore();

    // 반응형 상태
    const loading = ref(false);
    const jobs = ref([]);
    const mappings = ref([]);
    const selectedJobs = ref([]);
    const selectedJob = ref(null);
    const showJobDialog = ref(false);
    const showExecutionDialog = ref(false);
    const showDashboard = ref(false);
    const statusTypes = ref([]);
    const scheduleTypes = ref([]);
    const dashboardStats = ref({});

    // 필터 상태
    const filters = reactive({
      search: '',
      status: '',
      priority: '',
      isActive: '',
      tags: []
    });

    // 페이지네이션 상태
    const pagination = reactive({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    });

    // 우선순위 옵션
    const priorityOptions = ref([
      { value: 1, title: '1 (최저)' },
      { value: 2, title: '2' },
      { value: 3, title: '3' },
      { value: 4, title: '4' },
      { value: 5, title: '5 (보통)' },
      { value: 6, title: '6' },
      { value: 7, title: '7' },
      { value: 8, title: '8' },
      { value: 9, title: '9' },
      { value: 10, title: '10 (최고)' }
    ]);

    // 테이블 헤더
    const headers = [
      { title: '작업명', key: 'name', sortable: true },
      { title: '매핑', key: 'mapping', sortable: false },
      { title: '스케줄', key: 'schedule', sortable: false },
      { title: '우선순위', key: 'priority', sortable: true },
      { title: '상태', key: 'status', sortable: true },
      { title: '마지막 실행', key: 'lastExecution', sortable: false },
      { title: '작업', key: 'actions', sortable: false, width: '200px' }
    ];

    // 계산된 속성
    const hasSelectedJobs = computed(() => selectedJobs.value.length > 0);

    // 작업 목록 로드
    const loadJobs = async () => {
      loading.value = true;
      try {
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          ...filters,
          tags: filters.tags.join(',')
        };
        
        const response = await jobService.getJobs(params);
        jobs.value = response.data.jobs;
        pagination.total = response.data.pagination.total;
        pagination.totalPages = response.data.pagination.totalPages;
      } catch (error) {
        console.error('작업 목록 로드 실패:', error);
        appStore.showNotification({
          type: 'error',
          message: '작업 목록을 불러오는데 실패했습니다.'
        });
      } finally {
        loading.value = false;
      }
    };

    // 매핑 목록 로드
    const loadMappings = async () => {
      try {
        const response = await mappingService.getMappings({ limit: 1000 });
        mappings.value = response.data.mappings;
      } catch (error) {
        console.error('매핑 목록 로드 실패:', error);
      }
    };

    // 메타데이터 로드
    const loadMetadata = async () => {
      try {
        const [statusResponse, scheduleResponse] = await Promise.all([
          jobService.getStatusTypes(),
          jobService.getScheduleTypes()
        ]);
        
        statusTypes.value = statusResponse.data.statusTypes;
        scheduleTypes.value = scheduleResponse.data.scheduleTypes;
      } catch (error) {
        console.error('메타데이터 로드 실패:', error);
      }
    };

    // 대시보드 통계 로드
    const loadDashboardStats = async () => {
      try {
        const response = await jobService.getDashboard();
        dashboardStats.value = response.data;
      } catch (error) {
        console.error('대시보드 통계 로드 실패:', error);
      }
    };

    // 작업 대화상자 열기
    const openJobDialog = () => {
      selectedJob.value = null;
      showJobDialog.value = true;
    };

    // 작업 대화상자 닫기
    const closeJobDialog = () => {
      showJobDialog.value = false;
      selectedJob.value = null;
    };

    // 작업 편집
    const editJob = (job) => {
      selectedJob.value = job;
      showJobDialog.value = true;
    };

    // 작업 저장 처리
    const handleJobSave = async (jobData) => {
      try {
        if (selectedJob.value) {
          await jobService.updateJob(selectedJob.value.id, jobData);
          appStore.showNotification({
            type: 'success',
            message: '작업이 성공적으로 수정되었습니다.'
          });
        } else {
          await jobService.createJob(jobData);
          appStore.showNotification({
            type: 'success',
            message: '작업이 성공적으로 생성되었습니다.'
          });
        }
        
        closeJobDialog();
        await Promise.all([loadJobs(), loadDashboardStats()]);
      } catch (error) {
        console.error('작업 저장 실패:', error);
        appStore.showNotification({
          type: 'error',
          message: '작업 저장에 실패했습니다.'
        });
      }
    };

    // 작업 삭제
    const deleteJob = async (job) => {
      if (await appStore.showConfirmDialog({
        title: '작업 삭제',
        message: `"${job.name}" 작업을 삭제하시겠습니까?`,
        confirmText: '삭제',
        cancelText: '취소'
      })) {
        try {
          await jobService.deleteJob(job.id);
          appStore.showNotification({
            type: 'success',
            message: '작업이 성공적으로 삭제되었습니다.'
          });
          await Promise.all([loadJobs(), loadDashboardStats()]);
        } catch (error) {
          console.error('작업 삭제 실패:', error);
          appStore.showNotification({
            type: 'error',
            message: '작업 삭제에 실패했습니다.'
          });
        }
      }
    };

    // 선택된 작업 삭제
    const deleteSelectedJobs = async () => {
      const count = selectedJobs.value.length;
      if (await appStore.showConfirmDialog({
        title: '작업 삭제',
        message: `선택된 ${count}개의 작업을 삭제하시겠습니까?`,
        confirmText: '삭제',
        cancelText: '취소'
      })) {
        try {
          await Promise.all(
            selectedJobs.value.map(job => jobService.deleteJob(job.id))
          );
          
          appStore.showNotification({
            type: 'success',
            message: `${count}개의 작업이 성공적으로 삭제되었습니다.`
          });
          
          selectedJobs.value = [];
          await Promise.all([loadJobs(), loadDashboardStats()]);
        } catch (error) {
          console.error('작업 삭제 실패:', error);
          appStore.showNotification({
            type: 'error',
            message: '작업 삭제에 실패했습니다.'
          });
        }
      }
    };

    // 작업 실행
    const executeJob = async (job) => {
      try {
        await jobService.executeJob(job.id);
        appStore.showNotification({
          type: 'success',
          message: '작업이 실행 대기열에 추가되었습니다.'
        });
        await Promise.all([loadJobs(), loadDashboardStats()]);
      } catch (error) {
        console.error('작업 실행 실패:', error);
        appStore.showNotification({
          type: 'error',
          message: '작업 실행에 실패했습니다.'
        });
      }
    };

    // 작업 일시정지/재개
    const toggleJobPause = async (job) => {
      try {
        const paused = job.status !== 'paused';
        await jobService.pauseJob(job.id, paused);
        
        appStore.showNotification({
          type: 'success',
          message: `작업이 ${paused ? '일시정지' : '재개'}되었습니다.`
        });
        
        await Promise.all([loadJobs(), loadDashboardStats()]);
      } catch (error) {
        console.error('작업 일시정지/재개 실패:', error);
        appStore.showNotification({
          type: 'error',
          message: '작업 상태 변경에 실패했습니다.'
        });
      }
    };

    // 실행 이력 표시
    const showExecutionHistory = (job) => {
      selectedJob.value = job;
      showExecutionDialog.value = true;
    };

    // 실행 이력 대화상자 닫기
    const closeExecutionDialog = () => {
      showExecutionDialog.value = false;
      selectedJob.value = null;
    };

    // 페이지네이션 업데이트
    const updatePagination = (options) => {
      pagination.page = options.page;
      pagination.limit = options.itemsPerPage;
      loadJobs();
    };

    // 상태 색상 가져오기
    const getStatusColor = (status) => {
      const colors = {
        'inactive': 'grey',
        'scheduled': 'blue',
        'running': 'orange',
        'paused': 'yellow',
        'completed': 'green',
        'failed': 'red'
      };
      return colors[status] || 'grey';
    };

    // 상태 아이콘 가져오기
    const getStatusIcon = (status) => {
      const icons = {
        'inactive': 'mdi-stop-circle',
        'scheduled': 'mdi-clock-outline',
        'running': 'mdi-play-circle',
        'paused': 'mdi-pause-circle',
        'completed': 'mdi-check-circle',
        'failed': 'mdi-close-circle'
      };
      return icons[status] || 'mdi-help-circle';
    };

    // 상태 라벨 가져오기
    const getStatusLabel = (status) => {
      const statusType = statusTypes.value.find(st => st.value === status);
      return statusType ? statusType.label : status;
    };

    // 스케줄 타입 색상 가져오기
    const getScheduleTypeColor = (type) => {
      const colors = {
        'manual': 'grey',
        'immediate': 'red',
        'once': 'blue',
        'recurring': 'green',
        'cron': 'purple'
      };
      return colors[type] || 'grey';
    };

    // 스케줄 타입 라벨 가져오기
    const getScheduleTypeLabel = (type) => {
      const scheduleType = scheduleTypes.value.find(st => st.value === type);
      return scheduleType ? scheduleType.label : type;
    };

    // 실행 상태 색상 가져오기
    const getExecutionStatusColor = (status) => {
      const colors = {
        'queued': 'grey',
        'running': 'orange',
        'completed': 'green',
        'failed': 'red',
        'cancelled': 'yellow',
        'timeout': 'red'
      };
      return colors[status] || 'grey';
    };

    // 실행 상태 라벨 가져오기
    const getExecutionStatusLabel = (status) => {
      const labels = {
        'queued': '대기',
        'running': '실행 중',
        'completed': '완료',
        'failed': '실패',
        'cancelled': '취소',
        'timeout': '시간 초과'
      };
      return labels[status] || status;
    };

    // 필터 변경 감지
    watch(filters, () => {
      pagination.page = 1;
      loadJobs();
    }, { deep: true });

    // 컴포넌트 마운트 시 초기화
    onMounted(async () => {
      await Promise.all([
        loadJobs(),
        loadMappings(),
        loadMetadata(),
        loadDashboardStats()
      ]);
      
      // 주기적 업데이트 (30초마다)
      setInterval(() => {
        loadDashboardStats();
      }, 30000);
    });

    return {
      // 반응형 상태
      loading,
      jobs,
      mappings,
      selectedJobs,
      selectedJob,
      showJobDialog,
      showExecutionDialog,
      showDashboard,
      statusTypes,
      scheduleTypes,
      dashboardStats,
      filters,
      pagination,
      headers,
      priorityOptions,
      
      // 계산된 속성
      hasSelectedJobs,
      
      // 메서드
      loadJobs,
      openJobDialog,
      closeJobDialog,
      editJob,
      handleJobSave,
      deleteJob,
      deleteSelectedJobs,
      executeJob,
      toggleJobPause,
      showExecutionHistory,
      closeExecutionDialog,
      updatePagination,
      getStatusColor,
      getStatusIcon,
      getStatusLabel,
      getScheduleTypeColor,
      getScheduleTypeLabel,
      getExecutionStatusColor,
      getExecutionStatusLabel
    };
  }
};
</script>

<style scoped>
.job-management {
  padding: 20px;
}

.v-data-table {
  background: transparent;
}

.v-card {
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.v-chip {
  font-size: 0.75rem;
}

.text-caption {
  font-size: 0.75rem;
  line-height: 1.2;
}

.gap-2 {
  gap: 8px;
}
</style>