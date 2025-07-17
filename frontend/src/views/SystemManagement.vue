<template>
  <AppLayout>
    <div class="system-container">
      <!-- Clean Header -->
      <div class="system-header">
        <div class="header-content">
          <h1 class="page-title">시스템 관리</h1>
          <p class="page-subtitle">시스템 연결 정보를 관리하고 실시간 상태를 모니터링합니다</p>
        </div>
        <button class="clean-button clean-button-primary" @click="openCreateDialog">
          <v-icon size="18">mdi-plus</v-icon>
          새 시스템 추가
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon primary">
            <v-icon size="24">mdi-server</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ systems.length }}</div>
            <div class="stat-label">총 시스템</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">
            <v-icon size="24">mdi-check-circle</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ activeSystemCount }}</div>
            <div class="stat-label">활성 시스템</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon info">
            <v-icon size="24">mdi-heart-pulse</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ healthySystemCount }}</div>
            <div class="stat-label">정상 상태</div>
          </div>
        </div>
      </div>

      <!-- Filter Section -->
      <div class="filter-section clean-card">
        <div class="section-header">
          <h2 class="section-title">필터 & 검색</h2>
        </div>
        <div class="filter-content">
          <div class="filter-grid">
            <div class="filter-item">
              <input
                v-model="filters.search"
                type="text"
                class="clean-form-input"
                placeholder="시스템명 또는 설명 검색"
                @keyup.enter="loadSystems"
              >
            </div>
            <div class="filter-item">
              <select v-model="filters.type" class="clean-form-input" @change="loadSystems">
                <option value="">모든 타입</option>
                <option v-for="option in systemTypeOptions" :key="option.value" :value="option.value">
                  {{ option.title }}
                </option>
              </select>
            </div>
            <div class="filter-item">
              <select v-model="filters.isActive" class="clean-form-input" @change="loadSystems">
                <option value="">모든 상태</option>
                <option value="true">활성</option>
                <option value="false">비활성</option>
              </select>
            </div>
          </div>
          <div class="filter-actions">
            <button class="clean-button clean-button-primary" @click="loadSystems">
              <v-icon size="18">mdi-magnify</v-icon>
              검색
            </button>
            <button class="clean-button clean-button-secondary" @click="resetFilters">
              <v-icon size="18">mdi-refresh</v-icon>
              초기화
            </button>
          </div>
        </div>
      </div>

      <!-- System List -->
      <div class="system-list-section clean-card">
        <div class="section-header">
          <h2 class="section-title">시스템 목록</h2>
          <div class="view-toggle">
            <button 
              class="view-button" 
              :class="{ active: viewMode === 'table' }"
              @click="viewMode = 'table'"
            >
              <v-icon size="20">mdi-table</v-icon>
            </button>
            <button 
              class="view-button" 
              :class="{ active: viewMode === 'grid' }"
              @click="viewMode = 'grid'"
            >
              <v-icon size="20">mdi-grid</v-icon>
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <v-progress-circular indeterminate color="primary" />
          <p>시스템 목록을 불러오는 중...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="!loading && filteredSystems.length === 0" class="empty-state">
          <v-icon size="64" color="var(--gray-400)">mdi-server-network-off</v-icon>
          <h3 class="empty-state-title">시스템이 없습니다</h3>
          <p class="empty-state-text">새로운 시스템을 추가하여 데이터 동기화를 시작하세요.</p>
          <button class="clean-button clean-button-primary" @click="openCreateDialog">
            <v-icon size="18">mdi-plus</v-icon>
            첫 번째 시스템 추가
          </button>
        </div>

        <!-- Table View -->
        <div v-else-if="viewMode === 'table'" class="table-container">
          <table class="clean-table">
            <thead>
              <tr>
                <th>시스템명</th>
                <th>설명</th>
                <th>타입</th>
                <th>활성</th>
                <th>연결 상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="system in filteredSystems" :key="system.id">
                <td>
                  <div class="system-name">
                    <v-icon :color="getTypeIcon(system.type).color" size="20">
                      {{ getTypeIcon(system.type).icon }}
                    </v-icon>
                    <div>
                      <div class="name">{{ system.name }}</div>
                      <div class="host">{{ system.host }}:{{ system.port }}</div>
                    </div>
                  </div>
                </td>
                <td>{{ system.description || '-' }}</td>
                <td>
                  <span class="type-badge" :class="'type-' + system.type">
                    {{ system.type }}
                  </span>
                </td>
                <td>
                  <label class="switch">
                    <input 
                      type="checkbox" 
                      v-model="system.isActive"
                      @change="updateSystemStatus(system)"
                    >
                    <span class="slider"></span>
                  </label>
                </td>
                <td>
                  <span class="status-badge" :class="'status-' + system.connectionStatus">
                    <v-icon size="14">{{ getConnectionStatusIcon(system.connectionStatus) }}</v-icon>
                    {{ getConnectionStatusText(system.connectionStatus) }}
                  </span>
                </td>
                <td>
                  <div class="table-actions">
                    <button 
                      class="action-button test"
                      @click="testConnection(system)"
                      :disabled="system.testing"
                    >
                      <v-icon size="16">mdi-wifi</v-icon>
                    </button>
                    <button 
                      class="action-button edit"
                      @click="editSystem(system)"
                    >
                      <v-icon size="16">mdi-pencil</v-icon>
                    </button>
                    <button 
                      class="action-button delete"
                      @click="deleteSystem(system)"
                    >
                      <v-icon size="16">mdi-delete</v-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Grid View -->
        <div v-else class="grid-container">
          <div class="system-grid">
            <div 
              v-for="system in filteredSystems" 
              :key="system.id"
              class="system-card"
            >
              <div class="card-header">
                <v-icon :color="getTypeIcon(system.type).color" size="32">
                  {{ getTypeIcon(system.type).icon }}
                </v-icon>
                <div class="card-status" :class="'status-' + system.connectionStatus"></div>
              </div>
              <div class="card-body">
                <h3 class="card-title">{{ system.name }}</h3>
                <p class="card-subtitle">{{ system.host }}:{{ system.port }}</p>
                <span class="type-badge" :class="'type-' + system.type">
                  {{ system.type }}
                </span>
                <p class="card-description">{{ system.description || '설명 없음' }}</p>
                <div class="card-status-row">
                  <span class="status-label">활성 상태</span>
                  <label class="switch small">
                    <input 
                      type="checkbox" 
                      v-model="system.isActive"
                      @change="updateSystemStatus(system)"
                    >
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
              <div class="card-footer">
                <button 
                  class="clean-button clean-button-primary test-button"
                  @click="testConnection(system)"
                  :disabled="system.testing"
                >
                  <v-icon size="16">mdi-wifi</v-icon>
                  연결 테스트
                </button>
                <div class="card-actions">
                  <button class="icon-button edit" @click="editSystem(system)">
                    <v-icon size="16">mdi-pencil</v-icon>
                  </button>
                  <button class="icon-button delete" @click="deleteSystem(system)">
                    <v-icon size="16">mdi-delete</v-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

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
.system-container {
  padding: var(--space-6);
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.system-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-8);
}

.page-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin: 0;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--gray-600);
  margin-top: var(--space-2);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.stat-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  transition: all var(--transition-base);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon.primary {
  background: var(--primary-soft);
  color: var(--primary);
}

.stat-icon.success {
  background: var(--success-soft);
  color: var(--success);
}

.stat-icon.info {
  background: var(--info-soft);
  color: var(--info);
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

/* Filter Section */
.filter-section {
  margin-bottom: var(--space-6);
}

.filter-content {
  padding: var(--space-6);
}

.filter-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.filter-actions {
  display: flex;
  gap: var(--space-3);
}

/* System List Section */
.system-list-section {
  min-height: 400px;
}

.view-toggle {
  display: flex;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-base);
  overflow: hidden;
}

.view-button {
  padding: var(--space-2) var(--space-3);
  background: var(--white);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-button:not(:last-child) {
  border-right: 1px solid var(--gray-300);
}

.view-button:hover {
  background: var(--gray-50);
}

.view-button.active {
  background: var(--primary);
  color: var(--white);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  color: var(--gray-600);
}

/* Table Styles */
.table-container {
  overflow-x: auto;
}

.clean-table {
  width: 100%;
  background: var(--white);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.clean-table th {
  background: var(--gray-50);
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: var(--font-semibold);
  text-align: left;
  color: var(--gray-700);
  border-bottom: 2px solid var(--gray-200);
}

.clean-table td {
  padding: var(--space-4);
  border-bottom: 1px solid var(--gray-100);
}

.clean-table tr:last-child td {
  border-bottom: none;
}

.clean-table tr:hover td {
  background: var(--gray-50);
}

.system-name {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.system-name .name {
  font-weight: var(--font-medium);
  color: var(--gray-900);
}

.system-name .host {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

/* Type Badge */
.type-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  background: var(--gray-100);
  color: var(--gray-700);
}

.type-badge.type-postgresql { background: #E3F2FD; color: #1976D2; }
.type-badge.type-mysql { background: #FFF3E0; color: #F57C00; }
.type-badge.type-oracle { background: #FFEBEE; color: #D32F2F; }
.type-badge.type-mongodb { background: #E8F5E9; color: #388E3C; }
.type-badge.type-redis { background: #FFEBEE; color: #D32F2F; }
.type-badge.type-sqlite { background: #E8F5E9; color: #388E3C; }

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
}

.status-badge.status-success {
  background: var(--success-soft);
  color: var(--success);
}

.status-badge.status-failed {
  background: var(--error-soft);
  color: var(--error);
}

.status-badge.status-pending {
  background: var(--warning-soft);
  color: var(--warning);
}

/* Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch.small {
  width: 36px;
  height: 20px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--gray-300);
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.switch.small .slider:before {
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
}

input:checked + .slider {
  background-color: var(--primary);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.switch.small input:checked + .slider:before {
  transform: translateX(16px);
}

/* Table Actions */
.table-actions {
  display: flex;
  gap: var(--space-2);
}

.action-button {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-base);
  border: 1px solid;
  background: var(--white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.action-button.test {
  border-color: var(--primary);
  color: var(--primary);
}

.action-button.test:hover {
  background: var(--primary);
  color: var(--white);
}

.action-button.edit {
  border-color: var(--warning);
  color: var(--warning);
}

.action-button.edit:hover {
  background: var(--warning);
  color: var(--white);
}

.action-button.delete {
  border-color: var(--error);
  color: var(--error);
}

.action-button.delete:hover {
  background: var(--error);
  color: var(--white);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Grid View */
.system-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-6);
  padding: var(--space-6);
}

.system-card {
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-100);
  transition: all var(--transition-base);
  overflow: hidden;
}

.system-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-header {
  position: relative;
  padding: var(--space-6);
  background: var(--gray-50);
  text-align: center;
}

.card-status {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--gray-400);
}

.card-status.status-success { background: var(--success); }
.card-status.status-failed { background: var(--error); }
.card-status.status-pending { background: var(--warning); }

.card-body {
  padding: var(--space-6);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-1);
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin-bottom: var(--space-3);
}

.card-description {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin: var(--space-3) 0;
  min-height: 40px;
}

.card-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) 0;
  border-top: 1px solid var(--gray-100);
  margin-top: var(--space-3);
}

.status-label {
  font-size: var(--font-size-sm);
  color: var(--gray-700);
}

.card-footer {
  padding: var(--space-4) var(--space-6);
  background: var(--gray-50);
  border-top: 1px solid var(--gray-100);
}

.test-button {
  width: 100%;
  margin-bottom: var(--space-2);
}

.card-actions {
  display: flex;
  justify-content: space-between;
}

.icon-button {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-base);
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.icon-button.edit {
  color: var(--warning);
}

.icon-button.edit:hover {
  background: var(--warning-soft);
}

.icon-button.delete {
  color: var(--error);
}

.icon-button.delete:hover {
  background: var(--error-soft);
}

/* Responsive */
@media (max-width: 1024px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .system-container {
    padding: var(--space-4);
  }
  
  .system-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
  
  .table-container {
    overflow-x: scroll;
  }
  
  .clean-table {
    min-width: 700px;
  }
  
  .system-grid {
    grid-template-columns: 1fr;
    padding: var(--space-4);
  }
}
</style>