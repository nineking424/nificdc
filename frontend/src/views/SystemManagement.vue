<template>
  <AppLayout>
    <v-container fluid class="pa-6">
      <!-- 페이지 헤더 정보 -->
      <v-row class="mb-6">
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center mb-4">
            <div>
              <p class="text-subtitle-1 text-medium-emphasis mb-3">
                시스템 연결 정보를 관리하고 실시간 상태를 모니터링합니다.
              </p>
              <div class="d-flex gap-4">
                <v-chip color="primary" variant="tonal">
                  <v-icon start>mdi-server</v-icon>
                  {{ systems.length }} 총 시스템
                </v-chip>
                <v-chip color="success" variant="tonal">
                  <v-icon start>mdi-check-circle</v-icon>
                  {{ activeSystemCount }} 활성 시스템
                </v-chip>
                <v-chip color="info" variant="tonal">
                  <v-icon start>mdi-heart-pulse</v-icon>
                  {{ healthySystemCount }} 정상 상태
                </v-chip>
              </div>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreateDialog">
              새 시스템 추가
            </v-btn>
          </div>
        </v-col>
      </v-row>

      <!-- 필터 섹션 -->
      <v-row class="mb-6">
        <v-col cols="12">
          <v-card>
            <v-card-title>
              <v-icon class="mr-2">mdi-filter-variant</v-icon>
              필터 & 검색
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="filters.search"
                    label="시스템명 또는 설명 검색"
                    prepend-inner-icon="mdi-magnify"
                    variant="outlined"
                    density="compact"
                    clearable
                    @keyup.enter="loadSystems"
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="filters.type"
                    :items="systemTypeOptions"
                    label="시스템 타입"
                    variant="outlined"
                    density="compact"
                    clearable
                    @update:model-value="loadSystems"
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="filters.isActive"
                    :items="statusOptions"
                    label="활성 상태"
                    variant="outlined"
                    density="compact"
                    clearable
                    @update:model-value="loadSystems"
                  />
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="12">
                  <div class="d-flex gap-2">
                    <v-btn color="primary" prepend-icon="mdi-magnify" @click="loadSystems">
                      검색
                    </v-btn>
                    <v-btn variant="outlined" prepend-icon="mdi-refresh" @click="resetFilters">
                      초기화
                    </v-btn>
                  </div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 시스템 목록 -->
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
              <div class="d-flex align-center">
                <v-icon class="mr-2">mdi-server-network</v-icon>
                시스템 목록
              </div>
              <div class="d-flex align-center gap-2">
                <v-btn-toggle
                  v-model="viewMode"
                  variant="outlined"
                  density="compact"
                  mandatory
                >
                  <v-btn value="table" size="small">
                    <v-icon>mdi-table</v-icon>
                  </v-btn>
                  <v-btn value="grid" size="small">
                    <v-icon>mdi-grid</v-icon>
                  </v-btn>
                </v-btn-toggle>
              </div>
            </v-card-title>
            
            <!-- 테이블 뷰 -->
            <div v-if="viewMode === 'table'">
              <v-data-table
                :headers="tableHeaders"
                :items="filteredSystems"
                :loading="loading"
                item-key="id"
                class="elevation-0"
                density="comfortable"
              >
                <template v-slot:item.name="{ item }">
                  <div class="d-flex align-center">
                    <v-icon :color="getTypeIcon(item.type).color" class="mr-2">
                      {{ getTypeIcon(item.type).icon }}
                    </v-icon>
                    <div>
                      <div class="font-weight-medium">{{ item.name }}</div>
                      <div class="text-caption text-medium-emphasis">{{ item.host }}:{{ item.port }}</div>
                    </div>
                  </div>
                </template>
                
                <template v-slot:item.type="{ item }">
                  <v-chip
                    :color="getTypeColor(item.type)"
                    size="small"
                    variant="tonal"
                  >
                    {{ item.type }}
                  </v-chip>
                </template>
                
                <template v-slot:item.description="{ item }">
                  <div class="text-body-2">{{ item.description || '-' }}</div>
                </template>
                
                <template v-slot:item.isActive="{ item }">
                  <v-switch
                    v-model="item.isActive"
                    color="primary"
                    density="compact"
                    hide-details
                    @update:model-value="updateSystemStatus(item)"
                  />
                </template>
                
                <template v-slot:item.connectionStatus="{ item }">
                  <v-chip
                    :color="getConnectionStatusColor(item.connectionStatus)"
                    size="small"
                    variant="tonal"
                  >
                    <v-icon start size="14">
                      {{ getConnectionStatusIcon(item.connectionStatus) }}
                    </v-icon>
                    {{ getConnectionStatusText(item.connectionStatus) }}
                  </v-chip>
                </template>
                
                <template v-slot:item.actions="{ item }">
                  <div class="d-flex align-center gap-1">
                    <v-btn
                      size="small"
                      variant="outlined"
                      color="primary"
                      @click="testConnection(item)"
                      :loading="item.testing"
                    >
                      <v-icon size="16">mdi-wifi</v-icon>
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="outlined"
                      color="warning"
                      @click="editSystem(item)"
                    >
                      <v-icon size="16">mdi-pencil</v-icon>
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="outlined"
                      color="error"
                      @click="deleteSystem(item)"
                    >
                      <v-icon size="16">mdi-delete</v-icon>
                    </v-btn>
                  </div>
                </template>
              </v-data-table>
            </div>
            
            <!-- 그리드 뷰 -->
            <div v-else class="pa-4">
              <v-row>
                <v-col
                  v-for="system in filteredSystems"
                  :key="system.id"
                  cols="12"
                  sm="6"
                  md="4"
                  lg="3"
                >
                  <v-card
                    class="system-card"
                    :elevation="2"
                    hover
                  >
                    <v-card-title class="d-flex align-center pa-4">
                      <v-icon 
                        :color="getTypeIcon(system.type).color" 
                        class="mr-3"
                        size="24"
                      >
                        {{ getTypeIcon(system.type).icon }}
                      </v-icon>
                      <div class="flex-grow-1">
                        <div class="font-weight-bold text-truncate">{{ system.name }}</div>
                        <div class="text-caption text-medium-emphasis">{{ system.host }}:{{ system.port }}</div>
                      </div>
                      <v-chip
                        :color="getConnectionStatusColor(system.connectionStatus)"
                        size="x-small"
                        variant="dot"
                      />
                    </v-card-title>
                    
                    <v-card-text class="pa-4">
                      <v-chip
                        :color="getTypeColor(system.type)"
                        size="small"
                        variant="tonal"
                        class="mb-3"
                      >
                        {{ system.type }}
                      </v-chip>
                      
                      <p class="text-body-2 mb-3">{{ system.description || '설명 없음' }}</p>
                      
                      <div class="d-flex align-center justify-space-between mb-3">
                        <span class="text-caption">활성 상태</span>
                        <v-switch
                          v-model="system.isActive"
                          color="primary"
                          density="compact"
                          hide-details
                          @update:model-value="updateSystemStatus(system)"
                        />
                      </div>
                      
                      <div v-if="system.connectionMessage" class="text-caption text-medium-emphasis">
                        {{ system.connectionMessage }}
                      </div>
                    </v-card-text>
                    
                    <v-card-actions class="pa-4">
                      <v-btn
                        size="small"
                        variant="outlined"
                        color="primary"
                        @click="testConnection(system)"
                        :loading="system.testing"
                        block
                      >
                        <v-icon size="16" class="mr-1">mdi-wifi</v-icon>
                        연결 테스트
                      </v-btn>
                    </v-card-actions>
                    
                    <v-card-actions class="pa-2 pt-0">
                      <v-btn
                        size="small"
                        variant="text"
                        color="warning"
                        @click="editSystem(system)"
                      >
                        <v-icon size="16">mdi-pencil</v-icon>
                      </v-btn>
                      <v-spacer />
                      <v-btn
                        size="small"
                        variant="text"
                        color="error"
                        @click="deleteSystem(system)"
                      >
                        <v-icon size="16">mdi-delete</v-icon>
                      </v-btn>
                    </v-card-actions>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Empty state for no data -->
      <v-row v-if="!loading && filteredSystems.length === 0">
        <v-col cols="12">
          <div class="text-center py-8">
            <v-icon size="80" color="grey-300">mdi-server-network-off</v-icon>
            <h3 class="text-h6 mt-4 mb-2">시스템이 없습니다</h3>
            <p class="text-body-2 text-medium-emphasis mb-4">새로운 시스템을 추가하여 데이터 동기화를 시작하세요.</p>
            <v-btn color="primary" @click="openCreateDialog">
              <v-icon class="mr-2">mdi-plus</v-icon>
              첫 번째 시스템 추가
            </v-btn>
          </div>
        </v-col>
      </v-row>
    </v-container>

    <!-- System Create/Edit Dialog -->
    <SystemDialog
      v-model="showDialog"
      :system="selectedSystem"
      :mode="dialogMode"
      @save="handleSave"
      @cancel="closeDialog"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h5">
          시스템 삭제 확인
        </v-card-title>
        <v-card-text>
          <p>정말로 이 시스템을 삭제하시겠습니까?</p>
          <p class="font-weight-bold mt-2">{{ systemToDelete?.name }}</p>
          <p class="text-caption text-medium-emphasis">이 작업은 되돌릴 수 없습니다.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDeleteDialog = false"
            :disabled="deleting"
          >
            취소
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            @click="confirmDelete"
            :loading="deleting"
          >
            삭제
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </AppLayout>
</template>

<script setup>
import AppLayout from '@/components/AppLayout.vue'
import SystemDialog from '@/components/SystemDialog.vue'
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const toast = useToast()
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
const deleting = ref(false)
const saving = ref(false)
const formValid = ref(false)
const testingConnection = ref(false)

// 필터 상태
const filters = reactive({
  search: '',
  type: '',
  isActive: ''
})

// 시스템 목록
const systems = ref([])

// 테이블 헤더
const tableHeaders = computed(() => [
  {
    title: '시스템명',
    key: 'name',
    sortable: true,
    width: '200px'
  },
  {
    title: '설명',
    key: 'description',
    sortable: false,
    width: '200px'
  },
  {
    title: '타입',
    key: 'type',
    sortable: true,
    width: '120px'
  },
  {
    title: '활성',
    key: 'isActive',
    sortable: true,
    width: '80px'
  },
  {
    title: '연결 상태',
    key: 'connectionStatus',
    sortable: true,
    width: '120px'
  },
  {
    title: '작업',
    key: 'actions',
    sortable: false,
    width: '180px'
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

// 필터링된 시스템 목록
const filteredSystems = computed(() => {
  let filtered = [...systems.value]
  
  // 검색 필터
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    filtered = filtered.filter(system => 
      system.name.toLowerCase().includes(searchTerm) ||
      (system.description && system.description.toLowerCase().includes(searchTerm))
    )
  }
  
  // 타입 필터
  if (filters.type) {
    filtered = filtered.filter(system => system.type === filters.type)
  }
  
  // 활성 상태 필터
  if (filters.isActive !== '') {
    const isActive = filters.isActive === 'true'
    filtered = filtered.filter(system => system.isActive === isActive)
  }
  
  return filtered
})

// 시스템 통계 computed 속성들
const activeSystemCount = computed(() => {
  return systems.value.filter(system => system.isActive).length
})

const healthySystemCount = computed(() => {
  return systems.value.filter(system => system.connectionStatus === 'success').length
})

// 타입별 아이콘 및 색상 함수
const getTypeIcon = (type) => {
  const iconMap = {
    postgresql: { icon: 'mdi-elephant', color: 'blue' },
    mysql: { icon: 'mdi-database', color: 'orange' },
    oracle: { icon: 'mdi-database-outline', color: 'red' },
    mongodb: { icon: 'mdi-leaf', color: 'green' },
    redis: { icon: 'mdi-database-cog', color: 'red' },
    sqlite: { icon: 'mdi-database-sync', color: 'green' },
    ftp: { icon: 'mdi-folder-network', color: 'brown' },
    sftp: { icon: 'mdi-folder-lock', color: 'brown' },
    local_fs: { icon: 'mdi-harddisk', color: 'grey' },
    aws_s3: { icon: 'mdi-aws', color: 'orange' },
    azure_blob: { icon: 'mdi-microsoft-azure', color: 'blue' },
    api: { icon: 'mdi-api', color: 'teal' },
    api_rest: { icon: 'mdi-web', color: 'teal' },
    kafka: { icon: 'mdi-transit-connection-variant', color: 'black' }
  }
  return iconMap[type] || { icon: 'mdi-server', color: 'grey' }
}

const getTypeColor = (type) => {
  return getTypeIcon(type).color
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

// 다이얼로그 관련 함수들
const openCreateDialog = () => {
  selectedSystem.value = null
  dialogMode.value = 'create'
  showDialog.value = true
}

const editSystem = (system) => {
  selectedSystem.value = { ...system }
  dialogMode.value = 'edit'
  showDialog.value = true
}

const deleteSystem = (system) => {
  systemToDelete.value = system
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (!systemToDelete.value) return
  
  deleting.value = true
  try {
    const api = (await import('@/utils/api')).default
    const response = await api.delete(`/systems/${systemToDelete.value.id}`)
    
    if (response.data.success) {
      toast.success('시스템이 삭제되었습니다.')
      // 목록에서 제거
      const index = systems.value.findIndex(s => s.id === systemToDelete.value.id)
      if (index !== -1) {
        systems.value.splice(index, 1)
      }
      showDeleteDialog.value = false
      systemToDelete.value = null
    }
  } catch (error) {
    console.error('Delete system error:', error)
    toast.error('시스템 삭제 실패: ' + (error.response?.data?.error || error.message))
  } finally {
    deleting.value = false
  }
}

const updateSystemStatus = async (system) => {
  const index = systems.value.findIndex(s => s.id === system.id)
  if (index === -1) return
  
  const originalStatus = system.isActive
  
  try {
    const api = (await import('@/utils/api')).default
    const response = await api.put(`/systems/${system.id}`, {
      isActive: system.isActive
    })
    
    if (response.data.success) {
      toast.success(`시스템이 ${system.isActive ? '활성화' : '비활성화'}되었습니다.`)
      // Update the system data with the response
      systems.value[index] = {
        ...systems.value[index],
        ...response.data.data
      }
    }
  } catch (error) {
    console.error('Update system status error:', error)
    // Revert the status on error
    system.isActive = originalStatus
    systems.value[index].isActive = originalStatus
    toast.error('시스템 상태 변경 실패: ' + (error.response?.data?.error || error.message))
  }
}

const handleSave = async () => {
  showDialog.value = false
  await loadSystems() // Reload the systems list
}

const closeDialog = () => {
  showDialog.value = false
  selectedSystem.value = null
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
        host: system.connectionInfo?.host || '',
        port: system.connectionInfo?.port || '',
        connectionStatus: system.lastConnectionStatus || 'pending',
        connectionMessage: system.lastConnectionMessage || '',
        lastConnectionStatus: system.lastConnectionStatus || 'pending',
        isActive: system.isActive,
        lastConnectionTest: system.lastConnectionTest,
        lastConnectionMessage: system.lastConnectionMessage,
        lastConnectionLatency: system.lastConnectionLatency,
        createdAt: system.createdAt,
        updatedAt: system.updatedAt,
        connectionInfo: system.connectionInfo,
        testing: false,
        updating: false
      }))
    } else {
      throw new Error(response.data.error || '시스템 목록을 불러올 수 없습니다')
    }
  } catch (error) {
    console.error('Load systems error:', error)
    toast.error('시스템 목록 로드 실패: ' + (error.response?.data?.error || error.message))
    systems.value = []
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.search = ''
  filters.type = ''
  filters.isActive = ''
  loadSystems()
}

const testConnection = async (system) => {
  const index = systems.value.findIndex(s => s.id === system.id)
  if (index !== -1) {
    systems.value[index].testing = true
  }
  
  try {
    const api = (await import('@/utils/api')).default
    const response = await api.post(`/systems/${system.id}/test`)
    
    // API 응답이 성공적이고 테스트 결과도 성공인 경우
    if (response.data.success) {
      if (response.data.data && response.data.data.success) {
        toast.success('연결 테스트 성공')
        // 해당 시스템의 상태를 성공으로 업데이트
        if (index !== -1) {
          systems.value[index].connectionStatus = 'success'
          systems.value[index].lastConnectionStatus = 'success'
          systems.value[index].lastConnectionTest = new Date().toISOString()
          systems.value[index].connectionMessage = response.data.data.message || ''
          systems.value[index].lastConnectionMessage = response.data.data.message || ''
          systems.value[index].lastConnectionLatency = response.data.data.latency || null
        }
      } else {
        // API는 성공했지만 연결 테스트는 실패한 경우
        const errorMessage = response.data.data?.message || response.data.data?.error || '연결 테스트 실패'
        toast.error('연결 테스트 실패: ' + errorMessage)
        // 해당 시스템의 상태를 실패로 업데이트
        if (index !== -1) {
          systems.value[index].connectionStatus = 'failed'
          systems.value[index].lastConnectionStatus = 'failed'
          systems.value[index].lastConnectionTest = new Date().toISOString()
          systems.value[index].connectionMessage = errorMessage
          systems.value[index].lastConnectionMessage = errorMessage
          systems.value[index].lastConnectionLatency = null
        }
      }
    } else {
      // API 응답 자체가 실패인 경우
      const errorMessage = response.data.error || '연결 테스트 요청 실패'
      toast.error('연결 테스트 실패: ' + errorMessage)
      if (index !== -1) {
        systems.value[index].connectionStatus = 'failed'
        systems.value[index].lastConnectionStatus = 'failed'
        systems.value[index].lastConnectionTest = new Date().toISOString()
        systems.value[index].connectionMessage = errorMessage
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
      systems.value[index].connectionStatus = 'failed'
      systems.value[index].lastConnectionStatus = 'failed'
      systems.value[index].lastConnectionTest = new Date().toISOString()
      systems.value[index].connectionMessage = errorMessage
      systems.value[index].lastConnectionMessage = errorMessage
      systems.value[index].lastConnectionLatency = null
    }
  } finally {
    if (index !== -1) {
      systems.value[index].testing = false
    }
  }
}

// 뷰 모드 전환 시 로컬 스토리지에 저장
watch(viewMode, (newMode) => {
  localStorage.setItem('systemManagementViewMode', newMode)
})

// 라이프사이클
onMounted(() => {
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
.system-card {
  transition: all 0.2s ease;
}

.system-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>