<template>
  <div class="system-management-container">
    <!-- 모던 헤더 -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">
            <v-icon size="32" color="primary" class="mr-3">mdi-server-network</v-icon>
            {{ $t('systems.title') }}
          </h1>
          <p class="page-subtitle">
            시스템 연결 정보를 관리하고 실시간 상태를 모니터링합니다.
          </p>
          <div class="header-stats">
            <div class="stat-item">
              <div class="stat-number">{{ systems.length }}</div>
              <div class="stat-label">총 시스템</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ activeSystemCount }}</div>
              <div class="stat-label">활성 시스템</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ healthySystemCount }}</div>
              <div class="stat-label">정상 상태</div>
            </div>
          </div>
        </div>
        
        <div class="header-actions">
          <button
            class="action-button primary"
            @click="openCreateDialog"
          >
            <v-icon size="20" class="mr-2">mdi-plus</v-icon>
            새 시스템 추가
          </button>
        </div>
      </div>
    </header>

    <!-- 메인 콘텐츠 -->
    <main class="main-content">

      <!-- 모던 필터 섹션 -->
      <section class="filter-section">
        <div class="filter-card">
          <div class="filter-header">
            <h2 class="filter-title">
              <v-icon size="20" class="mr-2">mdi-filter-variant</v-icon>
              필터 & 검색
            </h2>
          </div>
          
          <div class="filter-content">
            <div class="search-group">
              <div class="modern-search-field">
                <input
                  v-model="filters.search"
                  type="text"
                  placeholder=" "
                  class="search-input"
                  @keyup.enter="loadSystems"
                />
                <label class="search-label">시스템명 또는 설명 검색</label>
                <div class="search-icon">
                  <v-icon size="20" color="gray-400">mdi-magnify</v-icon>
                </div>
              </div>
            </div>
            
            <div class="filter-group">
              <div class="filter-field">
                <v-select
                  v-model="filters.type"
                  :items="systemTypeOptions"
                  label="시스템 타입"
                  variant="outlined"
                  density="compact"
                  clearable
                  @update:model-value="loadSystems"
                />
              </div>
              
              <div class="filter-field">
                <v-select
                  v-model="filters.isActive"
                  :items="statusOptions"
                  label="활성 상태"
                  variant="outlined"
                  density="compact"
                  clearable
                  @update:model-value="loadSystems"
                />
              </div>
            </div>
            
            <div class="filter-actions">
              <button class="filter-button primary" @click="loadSystems">
                <v-icon size="18" class="mr-2">mdi-magnify</v-icon>
                검색
              </button>
              <button class="filter-button secondary" @click="resetFilters">
                <v-icon size="18" class="mr-2">mdi-refresh</v-icon>
                초기화
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 모던 시스템 카드 그리드 -->
      <section class="systems-section">
        <div class="systems-header">
          <h2 class="section-title">시스템 목록</h2>
          <div class="view-toggle">
            <button 
              class="toggle-btn"
              :class="{ active: viewMode === 'grid' }"
              @click="viewMode = 'grid'"
            >
              <v-icon size="20">mdi-view-grid</v-icon>
            </button>
            <button 
              class="toggle-btn"
              :class="{ active: viewMode === 'table' }"
              @click="viewMode = 'table'"
            >
              <v-icon size="20">mdi-table</v-icon>
            </button>
          </div>
        </div>

        <!-- 그리드 뷰 -->
        <div v-if="viewMode === 'grid'" class="systems-grid">
          <div
            v-for="system in systems"
            :key="system.id"
            class="system-card"
            @click="openEditDialog(system)"
          >
            <div class="card-header">
              <div class="system-info">
                <div class="system-icon">
                  <v-icon size="24" :color="getSystemTypeColor(system.type)">{{ getSystemTypeIcon(system.type) }}</v-icon>
                </div>
                <div class="system-details">
                  <h3 class="system-name">{{ system.name }}</h3>
                  <p class="system-type">{{ getSystemTypeLabel(system.type) }}</p>
                </div>
              </div>
              
              <div class="system-status">
                <div class="status-indicator" :class="getConnectionStatusClass(system.lastConnectionStatus)">
                  <v-icon size="16">{{ getConnectionStatusIcon(system.lastConnectionStatus) }}</v-icon>
                </div>
              </div>
            </div>
            
            <div class="card-content">
              <p class="system-description">{{ system.description || '설명 없음' }}</p>
              
              <div class="system-metrics">
                <div class="metric-item">
                  <span class="metric-label">상태</span>
                  <span class="metric-value" :class="system.isActive ? 'text-success' : 'text-warning'">
                    {{ system.isActive ? '활성' : '비활성' }}
                  </span>
                </div>
                <div class="metric-item" v-if="system.lastConnectionTest">
                  <span class="metric-label">마지막 테스트</span>
                  <span class="metric-value">{{ formatDateTime(system.lastConnectionTest) }}</span>
                </div>
              </div>
            </div>
            
            <div class="card-actions" @click.stop>
              <button
                class="action-btn test"
                :class="{ loading: system.testing }"
                @click="testConnection(system)"
              >
                <v-icon size="16">mdi-connection</v-icon>
              </button>
              <button
                class="action-btn edit"
                @click="openEditDialog(system)"
              >
                <v-icon size="16">mdi-pencil</v-icon>
              </button>
              <button
                class="action-btn delete"
                @click="confirmDelete(system)"
              >
                <v-icon size="16">mdi-delete</v-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- 테이블 뷰 -->
        <div v-else class="systems-table-container">
          <v-card class="modern-table-card">
            <v-data-table
              :headers="headers"
              :items="systems"
              :loading="loading"
              :items-per-page="itemsPerPage"
              :page="currentPage"
              :server-items-length="totalItems"
              class="modern-data-table"
              @update:options="onTableOptionsUpdate"
            >
          <!-- 설명 -->
          <template #item.description="{ item }">
            <span class="text-truncate" style="max-width: 200px; display: inline-block;" :title="item.description">
              {{ item.description || '설명 없음' }}
            </span>
          </template>

          <!-- 시스템 타입 -->
          <template #item.type="{ item }">
            <v-chip
              :color="getSystemTypeColor(item.type)"
              size="small"
              class="text-capitalize"
            >
              {{ getSystemTypeLabel(item.type) }}
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
                <div class="empty-state">
                  <div class="empty-icon">
                    <v-icon size="80" color="gray-300">mdi-server-network-off</v-icon>
                  </div>
                  <h3 class="empty-title">시스템이 없습니다</h3>
                  <p class="empty-description">새로운 시스템을 추가하여 데이터 동기화를 시작하세요.</p>
                  <button class="action-button primary" @click="openCreateDialog">
                    <v-icon size="20" class="mr-2">mdi-plus</v-icon>
                    첫 번째 시스템 추가
                  </button>
                </div>
              </template>
            </v-data-table>
          </v-card>
        </div>
      </section>
    </main>

    <!-- 모던 시스템 생성/편집 다이얼로그 -->
    <v-dialog
      v-model="showDialog"
      max-width="700"
      persistent
      @keydown.esc="closeDialog"
    >
      <v-card class="modern-dialog">
        <div class="dialog-header">
          <div class="dialog-title">
            <v-icon size="24" color="primary" class="mr-3">{{ dialogMode === 'create' ? 'mdi-plus-circle' : 'mdi-pencil-circle' }}</v-icon>
            <h2>{{ dialogMode === 'create' ? '새 시스템 추가' : '시스템 편집' }}</h2>
          </div>
          <button class="close-button" @click="closeDialog">
            <v-icon size="20">mdi-close</v-icon>
          </button>
        </div>
          <v-form ref="systemFormRef" v-model="formValid" @submit.prevent="saveSystem">
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="systemForm.name"
                    label="시스템명"
                    :rules="[v => !!v || '시스템명은 필수입니다']"
                    variant="outlined"
                    density="compact"
                    required
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="systemForm.type"
                    :items="systemTypeOptions"
                    label="시스템 타입"
                    :rules="[v => !!v || '시스템 타입은 필수입니다']"
                    variant="outlined"
                    density="compact"
                    required
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="systemForm.description"
                    label="설명"
                    variant="outlined"
                    density="compact"
                    rows="2"
                  />
                </v-col>
                <v-col cols="12">
                  <h4 class="mb-3">연결 정보</h4>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="systemForm.connectionInfo.host"
                    label="호스트"
                    :rules="[v => !!v || '호스트는 필수입니다']"
                    variant="outlined"
                    density="compact"
                    required
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="systemForm.connectionInfo.port"
                    label="포트"
                    type="number"
                    :rules="[
                      v => !!v || '포트는 필수입니다',
                      v => (v >= 1 && v <= 65535) || '포트는 1-65535 범위여야 합니다'
                    ]"
                    variant="outlined"
                    density="compact"
                    required
                  />
                </v-col>
                <v-col cols="12" md="6" v-if="isDatabaseType && systemForm.type !== 'oracle'">
                  <v-text-field
                    v-model="systemForm.connectionInfo.database"
                    label="데이터베이스명"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="6" v-if="systemForm.type === 'oracle'">
                  <v-text-field
                    v-model="systemForm.connectionInfo.serviceName"
                    label="서비스명 (예: ORCL, XE)"
                    variant="outlined"
                    density="compact"
                    :rules="[v => !!v || '서비스명은 필수입니다']"
                    required
                  />
                </v-col>
                <v-col cols="12" md="6" v-if="isDatabaseType">
                  <v-text-field
                    v-model="systemForm.connectionInfo.username"
                    label="사용자명"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="6" v-if="isDatabaseType">
                  <v-text-field
                    v-model="systemForm.connectionInfo.password"
                    label="비밀번호"
                    type="password"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" md="6" v-if="isDatabaseType">
                  <v-switch
                    v-model="systemForm.connectionInfo.ssl"
                    label="SSL 사용"
                    color="primary"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" v-if="isFileSystemType">
                  <v-text-field
                    v-model="systemForm.connectionInfo.rootPath"
                    label="루트 경로"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12" v-if="isApiType">
                  <v-text-field
                    v-model="systemForm.connectionInfo.endpoint"
                    label="API 엔드포인트"
                    variant="outlined"
                    density="compact"
                  />
                </v-col>
                <v-col cols="12">
                  <v-switch
                    v-model="systemForm.isActive"
                    label="활성 상태"
                    color="primary"
                    hide-details
                  />
                </v-col>
              </v-row>
            </v-card-text>
            <div class="dialog-actions">
              <button
                class="action-button test"
                :class="{ loading: testingConnection }"
                :disabled="!formValid || saving"
                @click="testConnectionInDialog"
              >
                <v-icon size="18" class="mr-2">mdi-connection</v-icon>
                <span v-if="!testingConnection">연결 테스트</span>
                <span v-else>테스트 중...</span>
              </button>
              
              <div class="action-group">
                <button
                  class="action-button secondary"
                  @click="closeDialog"
                >
                  취소
                </button>
                <button
                  class="action-button primary"
                  :class="{ loading: saving }"
                  :disabled="!formValid"
                  type="submit"
                >
                  <span v-if="!saving">{{ dialogMode === 'create' ? '생성' : '수정' }}</span>
                  <span v-else>{{ dialogMode === 'create' ? '생성 중...' : '수정 중...' }}</span>
                </button>
              </div>
            </div>
          </v-form>
        </v-card>
      </v-dialog>

    <!-- 모던 삭제 확인 다이얼로그 -->
    <v-dialog
      v-model="showDeleteDialog"
      max-width="500"
    >
      <v-card class="modern-dialog delete-dialog">
        <div class="dialog-header danger">
          <div class="dialog-title">
            <v-icon size="24" color="error" class="mr-3">mdi-alert-circle</v-icon>
            <h2>시스템 삭제 확인</h2>
          </div>
        </div>
        
        <div class="dialog-content">
          <div class="warning-content">
            <p class="warning-text">
              정말로 <strong>'{{ systemToDelete?.name }}'</strong> 시스템을 삭제하시겠습니까?
            </p>
            <div class="warning-notice">
              <v-icon size="20" color="warning" class="mr-2">mdi-alert</v-icon>
              <span>이 작업은 되돌릴 수 없습니다.</span>
            </div>
          </div>
        </div>
        
        <div class="dialog-actions">
          <button
            class="action-button secondary"
            @click="showDeleteDialog = false"
          >
            취소
          </button>
          <button
            class="action-button danger"
            :class="{ loading: deleting }"
            @click="deleteSystem"
          >
            <span v-if="!deleting">삭제</span>
            <span v-else>삭제 중...</span>
          </button>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import AppLayout from '@/components/AppLayout.vue'
import { ref, reactive, computed, onMounted, watch } from 'vue'
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
const viewMode = ref('table') // 'grid' or 'table' - default to table for better list view
// 폼 초기값
const getInitialFormData = () => ({
  name: '',
  type: '',
  description: '',
  isActive: true,
  connectionInfo: {
    host: '',
    port: null,
    database: '',
    serviceName: '', // Oracle용
    username: '',
    password: '',
    ssl: false,
    rootPath: '',
    endpoint: ''
  }
})

const deleting = ref(false)
const saving = ref(false)
const formValid = ref(false)
const testingConnection = ref(false)
const systemForm = ref(getInitialFormData())

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

// 테이블 헤더 - Enhanced for better column layout
const headers = computed(() => [
  {
    title: t('systems.name'),
    key: 'name',
    sortable: true,
    width: '200px'
  },
  {
    title: '설명',
    key: 'description',
    sortable: false,
    width: '250px'
  },
  {
    title: t('systems.type'),
    key: 'type',
    sortable: true,
    width: '140px'
  },
  {
    title: '연결 상태',
    key: 'lastConnectionStatus',
    sortable: true,
    width: '120px'
  },
  {
    title: t('systems.isActive'),
    key: 'isActive',
    sortable: true,
    width: '100px'
  },
  {
    title: '마지막 테스트',
    key: 'lastConnectionTest',
    sortable: true,
    width: '160px'
  },
  {
    title: t('table.actions'),
    key: 'actions',
    sortable: false,
    width: '140px'
  }
])

// 시스템 타입 옵션 - 백엔드와 동기화
const systemTypeOptions = computed(() => [
  { title: 'PostgreSQL', value: 'postgresql' },
  { title: 'MySQL', value: 'mysql' },
  { title: 'Oracle Database', value: 'oracle' },
  { title: 'SQLite', value: 'sqlite' },
  { title: 'MongoDB', value: 'mongodb' },
  { title: 'Redis', value: 'redis' },
  { title: 'SFTP Server', value: 'sftp' },
  { title: 'FTP Server', value: 'ftp' },
  { title: 'Local File System', value: 'local_fs' },
  { title: 'Amazon S3', value: 'aws_s3' },
  { title: 'Azure Blob Storage', value: 'azure_blob' },
  { title: 'REST API', value: 'api' },
  { title: 'REST API (Legacy)', value: 'api_rest' },
  { title: 'Apache Kafka', value: 'kafka' }
])

// 상태 옵션
const statusOptions = computed(() => [
  { title: '활성', value: 'true' },
  { title: '비활성', value: 'false' }
])

// 시스템 통계 computed 속성들
const activeSystemCount = computed(() => {
  return systems.value.filter(system => system.isActive).length
})

const healthySystemCount = computed(() => {
  return systems.value.filter(system => system.lastConnectionStatus === 'success').length
})

// 폼 관련 computed 속성들
const isDatabaseType = computed(() => {
  const dbTypes = ['postgresql', 'mysql', 'oracle', 'sqlite', 'mongodb', 'redis']
  return dbTypes.includes(systemForm.value.type)
})

const isFileSystemType = computed(() => {
  const fileTypes = ['ftp', 'sftp', 'local_fs', 'aws_s3', 'azure_blob']
  return fileTypes.includes(systemForm.value.type)
})

const isApiType = computed(() => {
  const apiTypes = ['api', 'api_rest']
  return apiTypes.includes(systemForm.value.type)
})

// 시스템 타입별 기본 포트 설정
const setDefaultPort = () => {
  const defaultPorts = {
    postgresql: 5432,
    mysql: 3306,
    oracle: 1521,
    mongodb: 27017,
    redis: 6379,
    sftp: 22,
    ftp: 21
  }
  
  if (systemForm.value.type && defaultPorts[systemForm.value.type]) {
    systemForm.value.connectionInfo.port = defaultPorts[systemForm.value.type]
  }
}

// 메서드
const loadSystems = async () => {
  loading.value = true
  try {
    // 실제 API 호출
    const api = (await import('@/utils/api')).default
    const response = await api.get('/systems')
    
    if (response.data.success) {
      // API 응답을 프론트엔드 형식으로 변환
      systems.value = response.data.data.map(system => ({
        id: system.id,
        name: system.name,
        type: system.type,
        description: system.description,
        lastConnectionStatus: system.lastConnectionStatus || 'pending',
        isActive: system.isActive,
        lastConnectionTest: system.lastConnectionTest,
        lastConnectionMessage: system.lastConnectionMessage,
        lastConnectionLatency: system.lastConnectionLatency,
        createdAt: system.createdAt,
        updatedAt: system.updatedAt,
        connectionInfo: system.connectionInfo
      }))
      totalItems.value = response.data.total || systems.value.length
    } else {
      throw new Error(response.data.error || '시스템 목록을 불러올 수 없습니다')
    }
  } catch (error) {
    console.error('Load systems error:', error)
    toast.error('시스템 목록 로드 실패: ' + (error.response?.data?.error || error.message))
    systems.value = []
    totalItems.value = 0
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
  systemForm.value = getInitialFormData()
  showDialog.value = true
}

const openEditDialog = (system) => {
  selectedSystem.value = { ...system }
  dialogMode.value = 'edit'
  
  // connectionInfo 파싱 (문자열인 경우)
  let connectionInfo = system.connectionInfo || {}
  
  if (typeof connectionInfo === 'string') {
    try {
      connectionInfo = JSON.parse(connectionInfo)
    } catch (e) {
      connectionInfo = {}
    }
  }
  
  systemForm.value = {
    name: system.name || '',
    type: system.type || '',
    description: system.description || '',
    isActive: system.isActive !== undefined ? system.isActive : false,
    connectionInfo: {
      host: connectionInfo.host || '',
      port: connectionInfo.port || null,
      database: connectionInfo.database || '',
      serviceName: connectionInfo.serviceName || '', // Oracle 전용
      username: connectionInfo.username || '',
      password: connectionInfo.password || '',
      ssl: connectionInfo.ssl || false,
      rootPath: connectionInfo.rootPath || '',
      endpoint: connectionInfo.endpoint || ''
    }
  }
  
  showDialog.value = true
}

const closeDialog = () => {
  showDialog.value = false
  selectedSystem.value = null
  systemForm.value = getInitialFormData()
}

const saveSystem = async () => {
  saving.value = true
  try {
    const api = (await import('@/utils/api')).default
    
    // connectionInfo 정리 (빈 값 제거)
    const connectionInfo = {}
    Object.keys(systemForm.value.connectionInfo).forEach(key => {
      const value = systemForm.value.connectionInfo[key]
      if (value !== null && value !== '' && value !== undefined) {
        connectionInfo[key] = value
      }
    })
    
    const systemData = {
      name: systemForm.value.name,
      type: systemForm.value.type,
      description: systemForm.value.description,
      isActive: systemForm.value.isActive,
      connectionInfo: connectionInfo // 객체로 직접 전송 (백엔드에서 처리)
    }
    
    let response
    if (dialogMode.value === 'create') {
      response = await api.post('/systems', systemData)
    } else {
      response = await api.put(`/systems/${selectedSystem.value.id}`, systemData)
    }
    
    if (response.data.success) {
      closeDialog()
      loadSystems()
      toast.success(dialogMode.value === 'create' ? '시스템이 생성되었습니다.' : '시스템이 수정되었습니다.')
    } else {
      throw new Error(response.data.error || '시스템 저장 실패')
    }
  } catch (error) {
    console.error('Save system error:', error)
    // 더 자세한 오류 메시지 표시
    let errorMessage = '시스템 저장 실패: '
    if (error.response?.data?.details) {
      // 유효성 검증 오류인 경우
      if (Array.isArray(error.response.data.details)) {
        errorMessage += error.response.data.details.map(detail => `${detail.field}: ${detail.message}`).join(', ')
      } else {
        errorMessage += error.response.data.details.message || error.response.data.error
      }
    } else {
      errorMessage += error.response?.data?.error || error.message
    }
    toast.error(errorMessage)
  } finally {
    saving.value = false
  }
}

const testConnection = async (system) => {
  const index = systems.value.findIndex(s => s.id === system.id)
  if (index !== -1) {
    systems.value[index].testing = true
  }
  
  try {
    const api = (await import('@/utils/api')).default
    const response = await api.post(`/systems/${system.id}/test`)
    
    // Debug: 응답 데이터 상세 로깅
    console.log('Connection test response for', system.name, ':', response.data)
    
    // API 응답이 성공적이고 테스트 결과도 성공인 경우
    if (response.data.success) {
      if (response.data.data && response.data.data.success) {
        toast.success('연결 테스트 성공')
        // 해당 시스템의 상태를 성공으로 업데이트
        if (index !== -1) {
          systems.value[index].lastConnectionStatus = 'success'
          systems.value[index].lastConnectionTest = new Date().toISOString()
          systems.value[index].lastConnectionMessage = response.data.data.message || ''
          systems.value[index].lastConnectionLatency = response.data.data.latency || null
        }
      } else {
        // API는 성공했지만 연결 테스트는 실패한 경우
        const errorMessage = response.data.data?.message || response.data.data?.error || '연결 테스트 실패'
        toast.error('연결 테스트 실패: ' + errorMessage)
        // 해당 시스템의 상태를 실패로 업데이트
        if (index !== -1) {
          systems.value[index].lastConnectionStatus = 'failed'
          systems.value[index].lastConnectionTest = new Date().toISOString()
          systems.value[index].lastConnectionMessage = errorMessage
          systems.value[index].lastConnectionLatency = null
        }
      }
    } else {
      // API 응답 자체가 실패인 경우
      const errorMessage = response.data.error || '연결 테스트 요청 실패'
      toast.error('연결 테스트 실패: ' + errorMessage)
      if (index !== -1) {
        systems.value[index].lastConnectionStatus = 'failed'
        systems.value[index].lastConnectionTest = new Date().toISOString()
        systems.value[index].lastConnectionMessage = errorMessage
        systems.value[index].lastConnectionLatency = null
      }
    }
  } catch (error) {
    console.error('Connection test error:', error)
    // 네트워크 오류나 기타 예외 처리
    const errorMessage = error.response?.data?.error || error.message || '연결 테스트 중 오류 발생'
    toast.error('연결 테스트 실패: ' + errorMessage)
    if (index !== -1) {
      systems.value[index].lastConnectionStatus = 'failed'
      systems.value[index].lastConnectionTest = new Date().toISOString()
      systems.value[index].lastConnectionMessage = errorMessage
      systems.value[index].lastConnectionLatency = null
    }
  } finally {
    if (index !== -1) {
      systems.value[index].testing = false
    }
    // 순서 유지를 위해 전체 새로고침 대신 해당 시스템만 업데이트 완료
    // loadSystems() 호출을 제거하여 순서 변경 방지
  }
}

const toggleSystemStatus = async (system) => {
  const index = systems.value.findIndex(s => s.id === system.id)
  if (index !== -1) {
    systems.value[index].updating = true
  }
  
  try {
    const newStatus = !system.isActive
    const api = (await import('@/utils/api')).default
    const response = await api.put(`/systems/${system.id}`, {
      isActive: newStatus
    })
    
    if (response.data.success) {
      if (index !== -1) {
        systems.value[index].isActive = newStatus
      }
      toast.success(newStatus ? '시스템이 활성화되었습니다.' : '시스템이 비활성화되었습니다.')
    } else {
      throw new Error(response.data.error || '상태 변경 실패')
    }
  } catch (error) {
    console.error('Toggle status error:', error)
    toast.error('상태 변경 실패: ' + (error.response?.data?.error || error.message))
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
    const api = (await import('@/utils/api')).default
    const response = await api.delete(`/systems/${systemToDelete.value.id}`)
    
    if (response.data.success) {
      // 시스템 목록에서 제거
      const index = systems.value.findIndex(s => s.id === systemToDelete.value.id)
      if (index !== -1) {
        systems.value.splice(index, 1)
        totalItems.value = systems.value.length
      }
      
      toast.success('시스템이 삭제되었습니다.')
      showDeleteDialog.value = false
    } else {
      throw new Error(response.data.error || '시스템 삭제 실패')
    }
  } catch (error) {
    console.error('Delete system error:', error)
    toast.error('시스템 삭제 실패: ' + (error.response?.data?.error || error.message))
  } finally {
    deleting.value = false
  }
}

const testConnectionInDialog = async () => {
  testingConnection.value = true
  try {
    const api = (await import('@/utils/api')).default
    
    // connectionInfo 정리 (빈 값 제거)
    const connectionInfo = {}
    Object.keys(systemForm.value.connectionInfo).forEach(key => {
      const value = systemForm.value.connectionInfo[key]
      if (value !== null && value !== '' && value !== undefined) {
        connectionInfo[key] = value
      }
    })
    
    // 임시 시스템 데이터로 연결 테스트 (저장하지 않고)
    const testData = {
      name: systemForm.value.name,
      type: systemForm.value.type,
      description: systemForm.value.description,
      isActive: systemForm.value.isActive,
      connectionInfo: connectionInfo
    }
    
    // 항상 현재 폼의 데이터로 연결 테스트 수행 (편집 모드에서도 변경된 값으로 테스트)
    const response = await api.post('/systems/test-connection', testData)
    
    if (response.data.success && response.data.data.success) {
      toast.success('연결 테스트 성공!')
    } else {
      const errorMessage = response.data.data?.message || response.data.data?.error || '연결 테스트 실패'
      throw new Error(errorMessage)
    }
  } catch (error) {
    console.error('Connection test error:', error)
    toast.error('연결 테스트 실패: ' + (error.response?.data?.error || error.message))
  } finally {
    testingConnection.value = false
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

const getConnectionStatusClass = (status) => {
  const classes = {
    success: 'success',
    failed: 'error',
    pending: 'warning'
  }
  return classes[status] || 'neutral'
}

const getSystemTypeIcon = (type) => {
  const icons = {
    postgresql: 'mdi-elephant',
    mysql: 'mdi-database',
    oracle: 'mdi-database-outline',
    mongodb: 'mdi-leaf',
    redis: 'mdi-database-cog',
    sqlite: 'mdi-database-sync',
    ftp: 'mdi-folder-network',
    sftp: 'mdi-folder-lock',
    local_fs: 'mdi-harddisk',
    aws_s3: 'mdi-aws',
    azure_blob: 'mdi-microsoft-azure',
    api: 'mdi-api',
    api_rest: 'mdi-web',
    kafka: 'mdi-transit-connection-variant'
  }
  return icons[type] || 'mdi-server'
}

const getSystemTypeLabel = (type) => {
  const option = systemTypeOptions.value.find(opt => opt.value === type)
  return option ? option.title : type
}

const formatDateTime = (dateString) => {
  return formatDistanceToNow(new Date(dateString), {
    addSuffix: true,
    locale: ko
  })
}

// 시스템 타입 변경 시 기본 포트 설정
watch(() => systemForm.value.type, (newType) => {
  if (newType && dialogMode.value === 'create') {
    setDefaultPort()
  }
})

// 뷰 모드 전환 시 로컬 스토리지에 저장
watch(viewMode, (newMode) => {
  localStorage.setItem('systemManagementViewMode', newMode)
})

// 라이프사이클
onMounted(() => {
  systemForm.value = getInitialFormData()
  // 저장된 뷰 모드 복원 (기본값은 'table')
  const savedViewMode = localStorage.getItem('systemManagementViewMode')
  if (savedViewMode && ['grid', 'table'].includes(savedViewMode)) {
    viewMode.value = savedViewMode
  } else {
    // 기본값을 table로 설정하고 저장
    viewMode.value = 'table'
    localStorage.setItem('systemManagementViewMode', 'table')
  }
  loadSystems()
})
</script>

<style scoped>
/* 시스템 관리 메인 컨테이너 */
.system-management-container {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--gray-50) 0%, var(--primary-50) 100%);
  padding: 0;
}

/* 모던 헤더 */
.page-header {
  background: white;
  border-bottom: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.header-info {
  flex: 1;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--gray-900);
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
}

.page-subtitle {
  font-size: 1.125rem;
  color: var(--gray-600);
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
}

.header-stats {
  display: flex;
  gap: 2rem;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 1.75rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--primary-600), var(--primary-800));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

/* 메인 콘텐츠 */
.main-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* 모던 필터 섹션 */
.filter-section {
  margin-bottom: 1rem;
}

.filter-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: 2rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
}

.filter-header {
  margin-bottom: 1.5rem;
}

.filter-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
  display: flex;
  align-items: center;
}

.filter-content {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
  gap: 2rem;
  align-items: end;
}

.search-group {
  display: flex;
  flex-direction: column;
}

.modern-search-field {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 1rem 3rem 1rem 3rem;
  border: 2px solid var(--gray-300);
  border-radius: var(--radius-xl);
  font-size: 1rem;
  transition: all 0.2s ease;
  background: white;
  font-family: inherit;
}

.search-input:focus {
  border-color: var(--primary-500);
  outline: none;
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.search-label {
  position: absolute;
  left: 3rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1rem;
  color: var(--gray-500);
  transition: all 0.2s ease;
  pointer-events: none;
  background: white;
  padding: 0 0.5rem;
}

.search-input:focus + .search-label,
.search-input:not(:placeholder-shown) + .search-label {
  top: 0;
  font-size: 0.75rem;
  color: var(--primary-600);
  font-weight: 500;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.filter-group {
  display: flex;
  gap: 1rem;
}

.filter-field {
  flex: 1;
}

.filter-actions {
  display: flex;
  gap: 1rem;
}

/* 시스템 섹션 */
.systems-section {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
  overflow: hidden;
}

.systems-header {
  padding: 2rem 2rem 1rem 2rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.view-toggle {
  display: flex;
  background: var(--gray-100);
  border-radius: var(--radius-lg);
  padding: 0.25rem;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--gray-600);
}

.toggle-btn.active {
  background: white;
  color: var(--primary-600);
  box-shadow: var(--shadow-sm);
}

/* 시스템 그리드 */
.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
}

.system-card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.system-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary-400), var(--primary-600));
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.system-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--primary-200);
}

.system-card:hover::before {
  transform: scaleX(1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.system-info {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex: 1;
}

.system-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.system-details {
  flex: 1;
  min-width: 0;
}

.system-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 0.25rem 0;
  word-wrap: break-word;
}

.system-type {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0;
}

.system-status {
  flex-shrink: 0;
}

.status-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid;
}

.status-indicator.success {
  background: var(--success-100);
  border-color: var(--success-500);
  color: var(--success-700);
}

.status-indicator.error {
  background: var(--error-100);
  border-color: var(--error-500);
  color: var(--error-700);
}

.status-indicator.warning {
  background: var(--warning-100);
  border-color: var(--warning-500);
  color: var(--warning-700);
}

.status-indicator.neutral {
  background: var(--gray-100);
  border-color: var(--gray-400);
  color: var(--gray-600);
}

.card-content {
  margin-bottom: 1.5rem;
}

.system-description {
  font-size: 0.875rem;
  color: var(--gray-600);
  line-height: 1.5;
  margin: 0 0 1rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.system-metrics {
  display: flex;
  gap: 1.5rem;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-800);
}

.text-success {
  color: var(--success-600) !important;
}

.text-warning {
  color: var(--warning-600) !important;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--gray-100);
  color: var(--gray-600);
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn.test:hover {
  background: var(--success-100);
  color: var(--success-700);
}

.action-btn.edit:hover {
  background: var(--primary-100);
  color: var(--primary-700);
}

.action-btn.delete:hover {
  background: var(--error-100);
  color: var(--error-700);
}

.action-btn.loading {
  pointer-events: none;
  opacity: 0.7;
}

/* 테이블 뷰 */
.systems-table-container {
  padding: 0;
}

.modern-table-card {
  border-radius: 0 !important;
  box-shadow: none !important;
  border: none !important;
}

.modern-data-table {
  background: transparent;
}

/* 빈 상태 */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  margin-bottom: 1.5rem;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 0.5rem 0;
}

.empty-description {
  font-size: 1rem;
  color: var(--gray-600);
  margin: 0 0 2rem 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

/* 공통 버튼 스타일 */
.action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-lg);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  position: relative;
  overflow: hidden;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.action-button.primary {
  background: var(--primary-600);
  color: white;
}

.action-button.primary:hover:not(:disabled) {
  background: var(--primary-700);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.action-button.secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
}

.action-button.secondary:hover:not(:disabled) {
  background: var(--gray-200);
  transform: translateY(-1px);
}

.action-button.test {
  background: var(--success-100);
  color: var(--success-700);
  border: 1px solid var(--success-300);
}

.action-button.test:hover:not(:disabled) {
  background: var(--success-200);
  transform: translateY(-1px);
}

.action-button.danger {
  background: var(--error-600);
  color: white;
}

.action-button.danger:hover:not(:disabled) {
  background: var(--error-700);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.action-button.loading {
  pointer-events: none;
}

.filter-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: var(--radius-lg);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-button.primary {
  background: var(--primary-600);
  color: white;
}

.filter-button.primary:hover {
  background: var(--primary-700);
}

.filter-button.secondary {
  background: var(--gray-200);
  color: var(--gray-700);
}

.filter-button.secondary:hover {
  background: var(--gray-300);
}

/* 모던 다이얼로그 */
.modern-dialog {
  border-radius: var(--radius-2xl) !important;
  overflow: hidden;
}

.dialog-header {
  padding: 2rem 2rem 1rem 2rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header.danger {
  border-bottom-color: var(--error-200);
  background: var(--error-50);
}

.dialog-title {
  display: flex;
  align-items: center;
}

.dialog-title h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--gray-600);
}

.close-button:hover {
  background: var(--gray-200);
  color: var(--gray-800);
}

.dialog-content {
  padding: 2rem;
}

.warning-content {
  text-align: center;
}

.warning-text {
  font-size: 1rem;
  color: var(--gray-700);
  margin: 0 0 1rem 0;
  line-height: 1.6;
}

.warning-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--warning-50);
  border: 1px solid var(--warning-200);
  border-radius: var(--radius-lg);
  color: var(--warning-800);
  font-size: 0.875rem;
  font-weight: 500;
}

.dialog-actions {
  padding: 1rem 2rem 2rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-group {
  display: flex;
  gap: 1rem;
}

/* 반응형 디자인 */
@media (max-width: 1024px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 2rem;
  }
  
  .header-stats {
    justify-content: flex-start;
  }
  
  .filter-content {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .systems-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 1rem;
  }
  
  .header-content {
    padding: 1.5rem 1rem;
  }
  
  .page-title {
    font-size: 1.75rem;
  }
  
  .header-stats {
    gap: 1rem;
  }
  
  .stat-number {
    font-size: 1.5rem;
  }
  
  .filter-card {
    padding: 1.5rem;
  }
  
  .filter-group {
    flex-direction: column;
  }
  
  .filter-actions {
    flex-direction: column;
  }
  
  .systems-grid {
    grid-template-columns: 1fr;
    padding: 1rem;
  }
  
  .system-card {
    padding: 1rem;
  }
  
  .systems-header {
    padding: 1.5rem 1rem 1rem 1rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .action-button {
    padding: 0.625rem 1.25rem;
    font-size: 0.9rem;
    min-height: 44px; /* 터치 친화적 크기 */
  }
  
  .dialog-header {
    padding: 1.5rem 1rem 1rem 1rem;
  }
  
  .dialog-content {
    padding: 1.5rem 1rem;
  }
  
  .dialog-actions {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
  }
  
  .action-group {
    width: 100%;
    justify-content: space-between;
  }
  
  /* 모바일 최적화 개선 */
  .page-header {
    padding: 1rem;
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .page-subtitle {
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  
  .header-stats {
    gap: 0.75rem;
  }
  
  .stat-item {
    padding: 0.75rem;
    min-width: 80px;
  }
  
  .stat-number {
    font-size: 1.25rem;
  }
  
  .stat-label {
    font-size: 0.75rem;
  }
  
  .system-card {
    padding: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .system-header {
    margin-bottom: 0.75rem;
  }
  
  .system-name {
    font-size: 1.125rem;
  }
  
  .system-actions .action-button {
    padding: 0.5rem;
    min-width: 40px;
    min-height: 40px;
  }
  
  .filter-card {
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

/* 작은 모바일 디바이스 */
@media (max-width: 375px) {
  .page-header {
    padding: 0.75rem;
  }
  
  .page-title {
    font-size: 1.25rem;
  }
  
  .header-stats {
    flex-direction: column;
    width: 100%;
  }
  
  .stat-item {
    text-align: center;
    width: 100%;
  }
  
  .action-button {
    font-size: 0.85rem;
    padding: 0.5rem 1rem;
  }
  
  .systems-grid {
    padding: 0.5rem;
  }
}

/* 터치 디바이스 최적화 */
@media (hover: none) and (pointer: coarse) {
  .action-button,
  .system-actions .action-button,
  .filter-button,
  .clickable {
    min-height: 44px;
    min-width: 44px;
  }
  
  .system-card:hover {
    transform: none;
  }
  
  .action-button:hover {
    transform: none;
  }
}
</style>