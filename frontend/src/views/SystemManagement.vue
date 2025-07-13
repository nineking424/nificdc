<template>
  <AppLayout>
    <v-container fluid>
      <!-- 페이지 헤더 -->
      <div class="d-flex justify-space-between align-center mb-6">
        <div>
          <h1 class="text-h4 font-weight-bold">{{ $t('systems.title') }}</h1>
          <p class="text-body-1 text-medium-emphasis mt-2">
            시스템 연결 정보를 관리하고 상태를 모니터링합니다.
          </p>
        </div>
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-plus"
          @click="openCreateDialog"
        >
          {{ $t('systems.add') }}
        </v-btn>
      </div>

      <!-- 필터 및 검색 -->
      <v-card class="mb-6">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="filters.search"
                prepend-inner-icon="mdi-magnify"
                :label="$t('common.search')"
                hide-details
                variant="outlined"
                density="compact"
                @keyup.enter="loadSystems"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-select
                v-model="filters.type"
                :items="systemTypeOptions"
                :label="$t('systems.type')"
                hide-details
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="loadSystems"
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-select
                v-model="filters.isActive"
                :items="statusOptions"
                :label="$t('systems.isActive')"
                hide-details
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="loadSystems"
              />
            </v-col>
            <v-col cols="12" md="3">
              <div class="d-flex gap-2">
                <v-btn
                  color="primary"
                  variant="flat"
                  @click="loadSystems"
                >
                  {{ $t('common.search') }}
                </v-btn>
                <v-btn
                  variant="outlined"
                  @click="resetFilters"
                >
                  {{ $t('common.reset') }}
                </v-btn>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- 시스템 목록 테이블 -->
      <v-card>
        <v-data-table
          :headers="headers"
          :items="systems"
          :loading="loading"
          :items-per-page="itemsPerPage"
          :page="currentPage"
          :server-items-length="totalItems"
          @update:options="onTableOptionsUpdate"
        >
          <!-- 시스템 타입 -->
          <template #item.type="{ item }">
            <v-chip
              :color="getSystemTypeColor(item.type)"
              size="small"
              class="text-capitalize"
            >
              {{ $t(`systems.types.${item.type}`) }}
            </v-chip>
          </template>

          <!-- 연결 상태 -->
          <template #item.lastConnectionStatus="{ item }">
            <v-chip
              :color="getConnectionStatusColor(item.lastConnectionStatus)"
              size="small"
              :prepend-icon="getConnectionStatusIcon(item.lastConnectionStatus)"
            >
              {{ getConnectionStatusText(item.lastConnectionStatus) }}
            </v-chip>
          </template>

          <!-- 활성 상태 -->
          <template #item.isActive="{ item }">
            <v-switch
              :model-value="item.isActive"
              :loading="item.updating"
              color="primary"
              hide-details
              @update:model-value="toggleSystemStatus(item)"
            />
          </template>

          <!-- 마지막 연결 테스트 -->
          <template #item.lastConnectionTest="{ item }">
            <span v-if="item.lastConnectionTest">
              {{ formatDateTime(item.lastConnectionTest) }}
            </span>
            <span v-else class="text-medium-emphasis">
              테스트 없음
            </span>
          </template>

          <!-- 작업 버튼 -->
          <template #item.actions="{ item }">
            <div class="d-flex gap-1">
              <v-tooltip text="연결 테스트">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="success"
                    :loading="item.testing"
                    @click="testConnection(item)"
                  >
                    <v-icon>mdi-connection</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              
              <v-tooltip text="편집">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="primary"
                    @click="openEditDialog(item)"
                  >
                    <v-icon>mdi-pencil</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              
              <v-tooltip text="삭제">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="error"
                    @click="confirmDelete(item)"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
            </div>
          </template>

          <!-- 데이터 없음 -->
          <template #no-data>
            <div class="text-center py-8">
              <v-icon size="64" color="grey-lighten-1">mdi-database-off</v-icon>
              <div class="text-h6 mt-4">{{ $t('table.noData') }}</div>
              <div class="text-body-2 text-medium-emphasis mt-2">
                새로운 시스템을 추가하여 시작하세요.
              </div>
            </div>
          </template>
        </v-data-table>
      </v-card>

      <!-- 시스템 생성/편집 다이얼로그 (개발 중) -->
      <!-- SystemDialog 컴포넌트는 개발 중입니다 -->

      <!-- 삭제 확인 다이얼로그 -->
      <v-dialog
        v-model="showDeleteDialog"
        max-width="400"
      >
        <v-card>
          <v-card-title class="text-h6">
            시스템 삭제 확인
          </v-card-title>
          <v-card-text>
            정말로 '{{ systemToDelete?.name }}' 시스템을 삭제하시겠습니까?
            <br>
            <span class="text-error">이 작업은 되돌릴 수 없습니다.</span>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              variant="text"
              @click="showDeleteDialog = false"
            >
              {{ $t('common.cancel') }}
            </v-btn>
            <v-btn
              color="error"
              variant="flat"
              :loading="deleting"
              @click="deleteSystem"
            >
              {{ $t('common.delete') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </AppLayout>
</template>

<script setup>
import AppLayout from '@/components/AppLayout.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
// import { useSystemsStore } from '@/stores/systems'
import { useAuthStore } from '@/stores/auth'
// import SystemDialog from '@/components/SystemDialog.vue'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

// const { t } = useI18n()
const toast = useToast()
// const systemsStore = useSystemsStore()
const authStore = useAuthStore()

// 임시 t 함수
const t = (key) => {
  const translations = {
    'systems.title': '시스템 관리',
    'systems.add': '새 시스템 추가',
    'common.search': '검색',
    'systems.type': '시스템 타입',
    'systems.isActive': '활성 상태',
    'common.reset': '초기화',
    'systems.name': '시스템명',
    'systems.createdAt': '생성일',
    'table.actions': '작업',
    'table.noData': '데이터가 없습니다',
    'common.cancel': '취소',
    'common.delete': '삭제'
  }
  return translations[key] || key
}

// 반응형 데이터
const loading = ref(false)
const showDialog = ref(false)
const showDeleteDialog = ref(false)
const selectedSystem = ref(null)
const systemToDelete = ref(null)
const dialogMode = ref('create')
const deleting = ref(false)

// 필터 상태
const filters = reactive({
  search: '',
  type: '',
  isActive: ''
})

// 페이지네이션
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalItems = ref(0)

// 시스템 목록
const systems = ref([])

// 테이블 헤더
const headers = computed(() => [
  {
    title: t('systems.name'),
    key: 'name',
    sortable: true
  },
  {
    title: t('systems.type'),
    key: 'type',
    sortable: true
  },
  {
    title: '연결 상태',
    key: 'lastConnectionStatus',
    sortable: true
  },
  {
    title: t('systems.isActive'),
    key: 'isActive',
    sortable: true
  },
  {
    title: '마지막 테스트',
    key: 'lastConnectionTest',
    sortable: true
  },
  {
    title: t('systems.createdAt'),
    key: 'createdAt',
    sortable: true
  },
  {
    title: t('table.actions'),
    key: 'actions',
    sortable: false,
    width: '150px'
  }
])

// 시스템 타입 옵션
const systemTypeOptions = computed(() => [
  { title: 'Oracle Database', value: 'oracle' },
  { title: 'PostgreSQL', value: 'postgresql' },
  { title: 'MySQL', value: 'mysql' },
  { title: 'SQL Server', value: 'mssql' },
  { title: 'SQLite', value: 'sqlite' },
  { title: 'MongoDB', value: 'mongodb' },
  { title: 'Redis', value: 'redis' },
  { title: 'FTP Server', value: 'ftp' },
  { title: 'SFTP Server', value: 'sftp' },
  { title: 'Local File System', value: 'local_fs' },
  { title: 'Amazon S3', value: 'aws_s3' },
  { title: 'Azure Blob Storage', value: 'azure_blob' },
  { title: 'REST API', value: 'api_rest' },
  { title: 'Apache Kafka', value: 'kafka' }
])

// 상태 옵션
const statusOptions = computed(() => [
  { title: '활성', value: 'true' },
  { title: '비활성', value: 'false' }
])

// 메서드
const loadSystems = async () => {
  loading.value = true
  try {
    // 임시 더미 데이터
    systems.value = [
      {
        id: 1,
        name: 'PostgreSQL 메인',
        type: 'postgresql',
        lastConnectionStatus: 'success',
        isActive: true,
        lastConnectionTest: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        name: 'Redis 캐시',
        type: 'redis',
        lastConnectionStatus: 'success',
        isActive: true,
        lastConnectionTest: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    ]
    totalItems.value = systems.value.length
  } catch (error) {
    toast.error('시스템 목록 로드 실패: ' + error.message)
  } finally {
    loading.value = false
  }
}

const onTableOptionsUpdate = (options) => {
  currentPage.value = options.page
  itemsPerPage.value = options.itemsPerPage
  loadSystems()
}

const resetFilters = () => {
  filters.search = ''
  filters.type = ''
  filters.isActive = ''
  loadSystems()
}

const openCreateDialog = () => {
  selectedSystem.value = null
  dialogMode.value = 'create'
  showDialog.value = true
}

const openEditDialog = (system) => {
  selectedSystem.value = { ...system }
  dialogMode.value = 'edit'
  showDialog.value = true
}

const closeDialog = () => {
  showDialog.value = false
  selectedSystem.value = null
}

const onSystemSave = () => {
  closeDialog()
  loadSystems()
  toast.success(dialogMode.value === 'create' ? '시스템이 생성되었습니다.' : '시스템이 수정되었습니다.')
}

const testConnection = async (system) => {
  const index = systems.value.findIndex(s => s.id === system.id)
  if (index !== -1) {
    systems.value[index].testing = true
  }
  
  try {
    // 임시 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000))
    toast.success('연결 테스트 성공 (시뮬레이션)')
    if (index !== -1) {
      systems.value[index].lastConnectionStatus = 'success'
      systems.value[index].lastConnectionTest = new Date().toISOString()
    }
  } catch (error) {
    toast.error('연결 테스트 실패: ' + error.message)
    if (index !== -1) {
      systems.value[index].lastConnectionStatus = 'failed'
      systems.value[index].lastConnectionTest = new Date().toISOString()
    }
  } finally {
    if (index !== -1) {
      systems.value[index].testing = false
    }
  }
}

const toggleSystemStatus = async (system) => {
  const index = systems.value.findIndex(s => s.id === system.id)
  if (index !== -1) {
    systems.value[index].updating = true
  }
  
  try {
    const newStatus = !system.isActive
    // 임시 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (index !== -1) {
      systems.value[index].isActive = newStatus
    }
    
    toast.success(newStatus ? '시스템이 활성화되었습니다.' : '시스템이 비활성화되었습니다.')
  } catch (error) {
    toast.error('상태 변경 실패: ' + error.message)
  } finally {
    if (index !== -1) {
      systems.value[index].updating = false
    }
  }
}

const confirmDelete = (system) => {
  systemToDelete.value = system
  showDeleteDialog.value = true
}

const deleteSystem = async () => {
  deleting.value = true
  try {
    // 임시 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 시스템 목록에서 제거
    const index = systems.value.findIndex(s => s.id === systemToDelete.value.id)
    if (index !== -1) {
      systems.value.splice(index, 1)
      totalItems.value = systems.value.length
    }
    
    toast.success('시스템이 삭제되었습니다.')
    showDeleteDialog.value = false
  } catch (error) {
    toast.error('시스템 삭제 실패: ' + error.message)
  } finally {
    deleting.value = false
  }
}

// 유틸리티 메서드
const getSystemTypeColor = (type) => {
  const colors = {
    oracle: 'red',
    postgresql: 'blue',
    mysql: 'orange',
    mssql: 'purple',
    sqlite: 'green',
    mongodb: 'green',
    redis: 'red',
    ftp: 'brown',
    sftp: 'brown',
    local_fs: 'grey',
    aws_s3: 'orange',
    azure_blob: 'blue',
    api_rest: 'teal',
    kafka: 'black'
  }
  return colors[type] || 'grey'
}

const getConnectionStatusColor = (status) => {
  const colors = {
    success: 'success',
    failed: 'error',
    pending: 'warning'
  }
  return colors[status] || 'grey'
}

const getConnectionStatusIcon = (status) => {
  const icons = {
    success: 'mdi-check-circle',
    failed: 'mdi-alert-circle',
    pending: 'mdi-clock'
  }
  return icons[status] || 'mdi-help-circle'
}

const getConnectionStatusText = (status) => {
  const texts = {
    success: '성공',
    failed: '실패',
    pending: '대기'
  }
  return texts[status] || '알 수 없음'
}

const formatDateTime = (dateString) => {
  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: ko
  })
}

// 라이프사이클
onMounted(() => {
  loadSystems()
})
</script>

<style scoped>
.system-management {
  padding: 0;
}

.v-data-table {
  border-radius: 8px;
}

.v-chip {
  font-weight: 500;
}

.gap-1 {
  gap: 4px;
}

.gap-2 {
  gap: 8px;
}
</style>