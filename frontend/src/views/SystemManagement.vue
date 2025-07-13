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

      <!-- 시스템 생성/편집 다이얼로그 -->
      <v-dialog
        v-model="showDialog"
        max-width="600"
        persistent
      >
        <v-card>
          <v-card-title class="text-h6">
            {{ dialogMode === 'create' ? '새 시스템 추가' : '시스템 편집' }}
          </v-card-title>
          <v-form ref="systemFormRef" v-model="formValid" @submit.prevent="saveSystem">
            <v-card-text>
              <!-- 디버그 정보 -->
              <v-alert type="info" density="compact" class="mb-4" style="font-size: 12px;">
                <strong>디버그:</strong><br>
                모드: {{ dialogMode }}<br>
                이름: {{ systemForm.name }}<br>
                타입: {{ systemForm.type }}<br>
                활성: {{ systemForm.isActive }}<br>
                호스트: {{ systemForm.connectionInfo.host }}<br>
                포트: {{ systemForm.connectionInfo.port }}
              </v-alert>
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
            <v-card-actions>
              <v-spacer />
              <v-btn
                variant="text"
                @click="closeDialog"
              >
                취소
              </v-btn>
              <v-btn
                color="primary"
                variant="flat"
                :loading="saving"
                :disabled="!formValid"
                type="submit"
              >
                {{ dialogMode === 'create' ? '생성' : '수정' }}
              </v-btn>
            </v-card-actions>
          </v-form>
        </v-card>
      </v-dialog>

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
      console.log('Raw API response for systems:', response.data.data)
      // API 응답을 프론트엔드 형식으로 변환
      systems.value = response.data.data.map(system => {
        console.log('Processing system:', system)
        const mappedSystem = {
          id: system.id,
          name: system.name,
          type: system.type,
          description: system.description,
          lastConnectionStatus: system.status === 'active' ? 'success' : 'pending',
          isActive: system.isActive,
          lastConnectionTest: system.updatedAt,
          createdAt: system.createdAt,
          updatedAt: system.updatedAt,
          connectionInfo: system.connectionInfo
        }
        console.log('Mapped system:', mappedSystem)
        return mappedSystem
      })
      totalItems.value = response.data.total || systems.value.length
      console.log('Final systems array:', systems.value)
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
  console.log('Opening edit dialog for system:', system)
  selectedSystem.value = { ...system }
  dialogMode.value = 'edit'
  
  // connectionInfo 파싱 (문자열인 경우)
  let connectionInfo = system.connectionInfo || {}
  console.log('Original connectionInfo:', connectionInfo, 'Type:', typeof connectionInfo)
  
  if (typeof connectionInfo === 'string') {
    try {
      connectionInfo = JSON.parse(connectionInfo)
      console.log('Parsed connectionInfo:', connectionInfo)
    } catch (e) {
      console.warn('Failed to parse connectionInfo:', e)
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
  
  console.log('SystemForm populated with:', systemForm.value)
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
    
    if (response.data.success) {
      toast.success('연결 테스트 성공')
      if (index !== -1) {
        systems.value[index].lastConnectionStatus = 'success'
        systems.value[index].lastConnectionTest = new Date().toISOString()
      }
    } else {
      throw new Error(response.data.error || '연결 테스트 실패')
    }
  } catch (error) {
    console.error('Connection test error:', error)
    toast.error('연결 테스트 실패: ' + (error.response?.data?.error || error.message))
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

// 시스템 타입 변경 시 기본 포트 설정
watch(() => systemForm.value.type, (newType) => {
  if (newType && dialogMode.value === 'create') {
    setDefaultPort()
  }
})

// 라이프사이클
onMounted(() => {
  systemForm.value = getInitialFormData()
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