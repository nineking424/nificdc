<template>
  <div class="mapping-management">
    <v-container fluid>
      <!-- 헤더 -->
      <v-row class="mb-4">
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center">
            <div>
              <h1 class="text-h4 font-weight-bold">매핑 관리</h1>
              <p class="text-subtitle-1 text-medium-emphasis">데이터 변환 매핑 규칙을 관리합니다</p>
            </div>
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              @click="openMappingDialog"
              :loading="loading"
            >
              새 매핑 추가
            </v-btn>
          </div>
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
            @keyup.enter="loadMappings"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="filters.sourceSystemId"
            label="소스 시스템"
            :items="systems"
            item-value="id"
            item-title="name"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="filters.targetSystemId"
            label="타겟 시스템"
            :items="systems"
            item-value="id"
            item-title="name"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select
            v-model="filters.mappingType"
            label="매핑 타입"
            :items="mappingTypes"
            item-value="value"
            item-title="label"
            variant="outlined"
            hide-details
            clearable
          />
        </v-col>
      </v-row>

      <!-- 매핑 목록 -->
      <v-card>
        <v-card-title>
          <div class="d-flex justify-space-between align-center w-100">
            <span>매핑 목록</span>
            <v-btn
              variant="text"
              prepend-icon="mdi-refresh"
              @click="loadMappings"
              :loading="loading"
            >
              새로고침
            </v-btn>
          </div>
        </v-card-title>

        <v-data-table
          :headers="headers"
          :items="mappings"
          :loading="loading"
          :items-per-page="pagination.limit"
          :page="pagination.page"
          :server-items-length="pagination.total"
          @update:options="updatePagination"
          item-key="id"
          show-select
          v-model="selectedMappings"
        >
          <template #item.name="{ item }">
            <div class="d-flex align-center">
              <v-icon
                :color="item.isActive ? 'success' : 'grey'"
                class="mr-2"
              >
                {{ item.isActive ? 'mdi-check-circle' : 'mdi-pause-circle' }}
              </v-icon>
              <span class="font-weight-medium">{{ item.name }}</span>
            </div>
          </template>

          <template #item.systems="{ item }">
            <div class="d-flex align-center">
              <v-chip
                size="small"
                color="primary"
                variant="outlined"
                class="mr-2"
              >
                {{ item.sourceSystem?.name }}
              </v-chip>
              <v-icon size="small" class="mx-1">mdi-arrow-right</v-icon>
              <v-chip
                size="small"
                color="secondary"
                variant="outlined"
              >
                {{ item.targetSystem?.name }}
              </v-chip>
            </div>
          </template>

          <template #item.mappingType="{ item }">
            <v-chip
              size="small"
              :color="getMappingTypeColor(item.mappingType)"
              variant="tonal"
            >
              {{ getMappingTypeLabel(item.mappingType) }}
            </v-chip>
          </template>

          <template #item.statistics="{ item }">
            <div class="text-caption">
              <div>규칙: {{ item.statistics?.totalRules || 0 }}개</div>
              <div>복잡도: {{ item.statistics?.complexity || 0 }}</div>
            </div>
          </template>

          <template #item.lastExecutedAt="{ item }">
            <div v-if="item.lastExecutedAt" class="text-caption">
              <div>{{ $filters.formatDate(item.lastExecutedAt) }}</div>
              <v-chip
                size="x-small"
                :color="getExecutionStatusColor(item.lastExecutionStatus)"
                variant="tonal"
              >
                {{ getExecutionStatusLabel(item.lastExecutionStatus) }}
              </v-chip>
            </div>
            <span v-else class="text-disabled">실행 이력 없음</span>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex align-center">
              <v-tooltip text="미리보기">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-eye"
                    size="small"
                    variant="text"
                    @click="previewMapping(item)"
                  />
                </template>
              </v-tooltip>
              
              <v-tooltip text="검증">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-check-circle-outline"
                    size="small"
                    variant="text"
                    @click="validateMapping(item)"
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
                    @click="editMapping(item)"
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
                    @click="deleteMapping(item)"
                  />
                </template>
              </v-tooltip>
            </div>
          </template>
        </v-data-table>
      </v-card>

      <!-- 매핑 대화상자 -->
      <MappingDialog
        v-model="showMappingDialog"
        :mapping="selectedMapping"
        :systems="systems"
        :schemas="schemas"
        @save="handleMappingSave"
        @close="closeMappingDialog"
      />

      <!-- 미리보기 대화상자 -->
      <MappingPreviewDialog
        v-model="showPreviewDialog"
        :mapping="selectedMapping"
        @close="closePreviewDialog"
      />

      <!-- 검증 결과 대화상자 -->
      <MappingValidationDialog
        v-model="showValidationDialog"
        :mapping="selectedMapping"
        :validation-result="validationResult"
        @close="closeValidationDialog"
      />
    </v-container>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { useSystemsStore } from '@/stores/systems';
import MappingDialog from '@/components/MappingDialog.vue';
import MappingPreviewDialog from '@/components/MappingPreviewDialog.vue';
import MappingValidationDialog from '@/components/MappingValidationDialog.vue';
import { mappingService } from '@/services/mappingService';
import { schemaService } from '@/services/schemaService';

export default {
  name: 'MappingManagement',
  components: {
    MappingDialog,
    MappingPreviewDialog,
    MappingValidationDialog
  },
  setup() {
    const router = useRouter();
    const appStore = useAppStore();
    const systemsStore = useSystemsStore();
    const { systems } = storeToRefs(systemsStore);

    // 반응형 상태
    const loading = ref(false);
    const mappings = ref([]);
    const schemas = ref([]);
    const selectedMappings = ref([]);
    const selectedMapping = ref(null);
    const showMappingDialog = ref(false);
    const showPreviewDialog = ref(false);
    const showValidationDialog = ref(false);
    const validationResult = ref(null);
    const mappingTypes = ref([]);

    // 필터 상태
    const filters = reactive({
      search: '',
      sourceSystemId: '',
      targetSystemId: '',
      mappingType: '',
      isActive: ''
    });

    // 페이지네이션 상태
    const pagination = reactive({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    });

    // 테이블 헤더
    const headers = [
      { title: '이름', key: 'name', sortable: true },
      { title: '시스템', key: 'systems', sortable: false },
      { title: '매핑 타입', key: 'mappingType', sortable: true },
      { title: '통계', key: 'statistics', sortable: false },
      { title: '마지막 실행', key: 'lastExecutedAt', sortable: true },
      { title: '작업', key: 'actions', sortable: false, width: '200px' }
    ];

    // 계산된 속성
    const hasSelectedMappings = computed(() => selectedMappings.value.length > 0);

    // 매핑 목록 로드
    const loadMappings = async () => {
      loading.value = true;
      try {
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          ...filters
        };
        
        const response = await mappingService.getMappings(params);
        mappings.value = response.data.mappings;
        pagination.total = response.data.pagination.total;
        pagination.totalPages = response.data.pagination.totalPages;
      } catch (error) {
        console.error('매핑 목록 로드 실패:', error);
        appStore.showNotification({
          type: 'error',
          message: '매핑 목록을 불러오는데 실패했습니다.'
        });
      } finally {
        loading.value = false;
      }
    };

    // 스키마 목록 로드
    const loadSchemas = async () => {
      try {
        const response = await schemaService.getSchemas({ limit: 1000 });
        schemas.value = response.data.schemas;
      } catch (error) {
        console.error('스키마 목록 로드 실패:', error);
      }
    };

    // 매핑 타입 목록 로드
    const loadMappingTypes = async () => {
      try {
        const response = await mappingService.getMappingTypes();
        mappingTypes.value = response.data.mappingTypes;
      } catch (error) {
        console.error('매핑 타입 목록 로드 실패:', error);
      }
    };

    // 매핑 대화상자 열기
    const openMappingDialog = () => {
      selectedMapping.value = null;
      showMappingDialog.value = true;
    };

    // 매핑 대화상자 닫기
    const closeMappingDialog = () => {
      showMappingDialog.value = false;
      selectedMapping.value = null;
    };

    // 매핑 편집
    const editMapping = (mapping) => {
      selectedMapping.value = mapping;
      showMappingDialog.value = true;
    };

    // 매핑 저장 처리
    const handleMappingSave = async (mappingData) => {
      try {
        if (selectedMapping.value) {
          await mappingService.updateMapping(selectedMapping.value.id, mappingData);
          appStore.showNotification({
            type: 'success',
            message: '매핑이 성공적으로 수정되었습니다.'
          });
        } else {
          await mappingService.createMapping(mappingData);
          appStore.showNotification({
            type: 'success',
            message: '매핑이 성공적으로 생성되었습니다.'
          });
        }
        
        closeMappingDialog();
        await loadMappings();
      } catch (error) {
        console.error('매핑 저장 실패:', error);
        appStore.showNotification({
          type: 'error',
          message: '매핑 저장에 실패했습니다.'
        });
      }
    };

    // 매핑 삭제
    const deleteMapping = async (mapping) => {
      if (await appStore.showConfirmDialog({
        title: '매핑 삭제',
        message: `"${mapping.name}" 매핑을 삭제하시겠습니까?`,
        confirmText: '삭제',
        cancelText: '취소'
      })) {
        try {
          await mappingService.deleteMapping(mapping.id);
          appStore.showNotification({
            type: 'success',
            message: '매핑이 성공적으로 삭제되었습니다.'
          });
          await loadMappings();
        } catch (error) {
          console.error('매핑 삭제 실패:', error);
          appStore.showNotification({
            type: 'error',
            message: '매핑 삭제에 실패했습니다.'
          });
        }
      }
    };

    // 매핑 미리보기
    const previewMapping = (mapping) => {
      selectedMapping.value = mapping;
      showPreviewDialog.value = true;
    };

    // 미리보기 대화상자 닫기
    const closePreviewDialog = () => {
      showPreviewDialog.value = false;
      selectedMapping.value = null;
    };

    // 매핑 검증
    const validateMapping = async (mapping) => {
      try {
        const response = await mappingService.validateMapping(mapping.id);
        validationResult.value = response.data;
        selectedMapping.value = mapping;
        showValidationDialog.value = true;
      } catch (error) {
        console.error('매핑 검증 실패:', error);
        appStore.showNotification({
          type: 'error',
          message: '매핑 검증에 실패했습니다.'
        });
      }
    };

    // 검증 결과 대화상자 닫기
    const closeValidationDialog = () => {
      showValidationDialog.value = false;
      selectedMapping.value = null;
      validationResult.value = null;
    };

    // 페이지네이션 업데이트
    const updatePagination = (options) => {
      pagination.page = options.page;
      pagination.limit = options.itemsPerPage;
      loadMappings();
    };

    // 매핑 타입 색상 가져오기
    const getMappingTypeColor = (type) => {
      const colors = {
        'one_to_one': 'blue',
        'one_to_many': 'green',
        'many_to_one': 'orange',
        'many_to_many': 'purple'
      };
      return colors[type] || 'grey';
    };

    // 매핑 타입 라벨 가져오기
    const getMappingTypeLabel = (type) => {
      const mapping = mappingTypes.value.find(mt => mt.value === type);
      return mapping ? mapping.label : type;
    };

    // 실행 상태 색상 가져오기
    const getExecutionStatusColor = (status) => {
      const colors = {
        'success': 'success',
        'failed': 'error',
        'partial': 'warning'
      };
      return colors[status] || 'grey';
    };

    // 실행 상태 라벨 가져오기
    const getExecutionStatusLabel = (status) => {
      const labels = {
        'success': '성공',
        'failed': '실패',
        'partial': '부분 성공'
      };
      return labels[status] || '알 수 없음';
    };

    // 필터 변경 감지
    watch(filters, () => {
      pagination.page = 1;
      loadMappings();
    }, { deep: true });

    // 컴포넌트 마운트 시 초기화
    onMounted(async () => {
      await Promise.all([
        systemsStore.loadSystems(),
        loadMappings(),
        loadSchemas(),
        loadMappingTypes()
      ]);
    });

    return {
      // 반응형 상태
      loading,
      mappings,
      schemas,
      selectedMappings,
      selectedMapping,
      showMappingDialog,
      showPreviewDialog,
      showValidationDialog,
      validationResult,
      mappingTypes,
      filters,
      pagination,
      headers,
      systems,
      
      // 계산된 속성
      hasSelectedMappings,
      
      // 메서드
      loadMappings,
      openMappingDialog,
      closeMappingDialog,
      editMapping,
      handleMappingSave,
      deleteMapping,
      previewMapping,
      closePreviewDialog,
      validateMapping,
      closeValidationDialog,
      updatePagination,
      getMappingTypeColor,
      getMappingTypeLabel,
      getExecutionStatusColor,
      getExecutionStatusLabel
    };
  }
};
</script>

<style scoped>
.mapping-management {
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
</style>