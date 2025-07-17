<template>
  <AppLayout>
    <div class="mapping-container">
      <!-- Clean Header -->
      <div class="mapping-header">
        <div class="header-content">
          <h1 class="page-title">매핑 관리</h1>
          <p class="page-subtitle">시스템 간 데이터 변환 매핑을 생성하고 관리합니다</p>
        </div>
        <button class="clean-button clean-button-primary" @click="createNewMapping">
          <PlusIcon size="18" />
          새 매핑 생성
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon primary">
            <v-icon size="24">mdi-file-document-multiple</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ totalMappings }}</div>
            <div class="stat-label">전체 매핑</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success">
            <v-icon size="24">mdi-check-circle</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ activeMappings }}</div>
            <div class="stat-label">활성 매핑</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning">
            <v-icon size="24">mdi-file-document-edit</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ draftMappings }}</div>
            <div class="stat-label">작성 중</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon error">
            <v-icon size="24">mdi-alert-circle</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ errorMappings }}</div>
            <div class="stat-label">오류</div>
          </div>
        </div>
      </div>

      <!-- Filter Section -->
      <div class="filter-section clean-card">
        <div class="filter-content">
          <div class="search-box">
            <v-icon size="20">mdi-magnify</v-icon>
            <input 
              v-model="searchQuery" 
              type="text" 
              class="search-input"
              placeholder="매핑 검색..."
              @input="handleSearch"
            />
          </div>
          
          <div class="filter-controls">
            <select v-model="statusFilter" @change="applyFilters" class="clean-form-input">
              <option value="">모든 상태</option>
              <option value="active">활성</option>
              <option value="draft">작성 중</option>
              <option value="inactive">비활성</option>
              <option value="error">오류</option>
            </select>
            
            <select v-model="systemFilter" @change="applyFilters" class="clean-form-input">
              <option value="">모든 시스템</option>
              <option v-for="system in availableSystems" :key="system.id" :value="system.id">
                {{ system.name }}
              </option>
            </select>
            
            <button class="clean-button clean-button-secondary" @click="refreshMappings">
              <v-icon size="18" :class="{ 'spin': loading }">mdi-refresh</v-icon>
              새로고침
            </button>
          </div>
        </div>
      </div>

      <!-- Mappings List -->
      <div v-if="loading && mappings.length === 0" class="loading-state">
        <v-progress-circular indeterminate color="primary" />
        <span>매핑 목록을 불러오는 중...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <v-icon size="64" color="error">mdi-alert-circle</v-icon>
        <span>{{ error }}</span>
        <button @click="refreshMappings" class="clean-button clean-button-primary">재시도</button>
      </div>

      <div v-else-if="filteredMappings.length === 0" class="empty-state">
        <v-icon size="64" color="var(--gray-400)">mdi-file-document-off</v-icon>
        <h3 class="empty-state-title">매핑이 없습니다</h3>
        <p v-if="searchQuery || statusFilter || systemFilter" class="empty-state-text">
          검색 조건을 변경해보세요
        </p>
        <p v-else class="empty-state-text">
          첫 번째 매핑을 생성하여 시작하세요
        </p>
        <button @click="createNewMapping" class="clean-button clean-button-primary">
          <PlusIcon size="18" />
          새 매핑 생성
        </button>
      </div>

      <div v-else class="mappings-grid">
        <div 
          v-for="mapping in paginatedMappings" 
          :key="mapping.id"
          class="mapping-card clean-card"
        >
          <div class="card-header">
            <div class="mapping-info">
              <h3 class="mapping-name">{{ mapping.name }}</h3>
              <p class="mapping-description">{{ mapping.description || '설명 없음' }}</p>
            </div>
            <div class="status-badge" :class="'status-' + mapping.status">
              {{ getStatusText(mapping.status) }}
            </div>
          </div>
          
          <div class="card-body">
            <div class="system-flow">
              <div class="system-box">
                <v-icon size="20" color="primary">mdi-database-export</v-icon>
                <div>
                  <span class="system-label">소스</span>
                  <span class="system-name">{{ getSystemName(mapping.sourceSystemId) }}</span>
                </div>
              </div>
              
              <div class="flow-arrow">
                <v-icon size="24" color="var(--gray-400)">mdi-arrow-right</v-icon>
              </div>
              
              <div class="system-box">
                <v-icon size="20" color="primary">mdi-database-import</v-icon>
                <div>
                  <span class="system-label">타겟</span>
                  <span class="system-name">{{ getSystemName(mapping.targetSystemId) }}</span>
                </div>
              </div>
            </div>
            
            <div class="mapping-stats">
              <div class="stat">
                <v-icon size="16">mdi-table</v-icon>
                <span>{{ mapping.fieldMappings?.length || 0 }}개 필드 매핑</span>
              </div>
              <div class="stat">
                <v-icon size="16">mdi-clock-outline</v-icon>
                <span>{{ formatDate(mapping.updatedAt) }}</span>
              </div>
            </div>
          </div>
          
          <div class="card-footer">
            <button @click="editMapping(mapping.id)" class="action-button primary">
              <v-icon size="16">mdi-pencil</v-icon>
              편집
            </button>
            <button @click="duplicateMapping(mapping.id)" class="action-button">
              <v-icon size="16">mdi-content-copy</v-icon>
              복제
            </button>
            <button @click="testMapping(mapping.id)" class="action-button" :disabled="mapping.status === 'draft'">
              <v-icon size="16">mdi-play-circle</v-icon>
              테스트
            </button>
            <button @click="deleteMapping(mapping.id)" class="action-button danger">
              <v-icon size="16">mdi-delete</v-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button 
          @click="currentPage--" 
          :disabled="currentPage === 1"
          class="page-button"
        >
          <v-icon size="18">mdi-chevron-left</v-icon>
          이전
        </button>
        
        <div class="page-info">
          <span class="current-page">{{ currentPage }}</span>
          <span class="separator">/</span>
          <span class="total-pages">{{ totalPages }}</span>
        </div>
        
        <button 
          @click="currentPage++" 
          :disabled="currentPage === totalPages"
          class="page-button"
        >
          다음
          <v-icon size="18">mdi-chevron-right</v-icon>
        </button>
      </div>
    </div>
  
    <!-- Mapping Creation Wizard -->
    <MappingCreationWizard
      v-if="showWizard"
      @close="handleWizardClose"
      @created="handleWizardCreated"
    />
  </AppLayout>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMappingStore } from '@/stores/mapping'
import { useSystemStore } from '@/stores/system'
import { useAppStore } from '@/stores/app'
import AppLayout from '@/components/AppLayout.vue'
import MappingCreationWizard from '@/components/MappingCreationWizard.vue'
import { mappingApi } from '@/services/api'
import {
  PlusIcon
} from '@/components/icons'

export default {
  name: 'MappingManagement',
  
  components: {
    AppLayout,
    MappingCreationWizard,
    PlusIcon
  },
  
  setup() {
    const router = useRouter()
    const mappingStore = useMappingStore()
    const systemStore = useSystemStore()
    const appStore = useAppStore()
    
    // State
    const mappings = ref([])
    const loading = ref(false)
    const error = ref(null)
    const searchQuery = ref('')
    const statusFilter = ref('')
    const systemFilter = ref('')
    const currentPage = ref(1)
    const itemsPerPage = ref(12)
    const showWizard = ref(false)
    
    // Computed
    const availableSystems = computed(() => systemStore.systems || [])
    
    const filteredMappings = computed(() => {
      let result = mappings.value
      
      // Search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(mapping => 
          mapping.name.toLowerCase().includes(query) ||
          (mapping.description && mapping.description.toLowerCase().includes(query))
        )
      }
      
      // Status filter
      if (statusFilter.value) {
        result = result.filter(mapping => mapping.status === statusFilter.value)
      }
      
      // System filter
      if (systemFilter.value) {
        result = result.filter(mapping => 
          mapping.sourceSystemId === systemFilter.value ||
          mapping.targetSystemId === systemFilter.value
        )
      }
      
      return result
    })
    
    const totalPages = computed(() => 
      Math.ceil(filteredMappings.value.length / itemsPerPage.value)
    )
    
    const paginatedMappings = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value
      const end = start + itemsPerPage.value
      return filteredMappings.value.slice(start, end)
    })
    
    // Statistics
    const totalMappings = computed(() => mappings.value.length)
    const activeMappings = computed(() => 
      mappings.value.filter(m => m.status === 'active').length
    )
    const draftMappings = computed(() => 
      mappings.value.filter(m => m.status === 'draft').length
    )
    const errorMappings = computed(() => 
      mappings.value.filter(m => m.status === 'error').length
    )
    
    // Methods
    const fetchMappings = async () => {
      loading.value = true
      error.value = null
      
      try {
        const response = await mappingApi.getList({
          page: 1,
          limit: 1000 // Get all for client-side filtering
        })
        mappings.value = response.data.items || []
      } catch (err) {
        error.value = err.message || '매핑 목록을 불러오는데 실패했습니다'
        mappings.value = []
      } finally {
        loading.value = false
      }
    }
    
    const refreshMappings = () => {
      fetchMappings()
    }
    
    const handleSearch = () => {
      currentPage.value = 1 // Reset to first page on search
    }
    
    const applyFilters = () => {
      currentPage.value = 1 // Reset to first page on filter change
    }
    
    const getSystemName = (systemId) => {
      const system = availableSystems.value.find(s => s.id === systemId)
      return system ? system.name : '알 수 없는 시스템'
    }
    
    const getStatusText = (status) => {
      const statusMap = {
        active: '활성',
        draft: '작성 중',
        inactive: '비활성',
        error: '오류'
      }
      return statusMap[status] || status
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return '없음'
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
    
    const createNewMapping = () => {
      showWizard.value = true
    }
    
    const handleWizardClose = () => {
      showWizard.value = false
    }
    
    const handleWizardCreated = (mapping) => {
      showWizard.value = false
      // Refresh the mappings list
      fetchMappings()
    }
    
    const editMapping = (id) => {
      router.push(`/mappings/${id}/edit`)
    }
    
    const duplicateMapping = async (id) => {
      try {
        const mapping = mappings.value.find(m => m.id === id)
        if (!mapping) return
        
        const duplicated = {
          ...mapping,
          name: `${mapping.name} (사본)`,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        delete duplicated.id
        
        const response = await mappingApi.create(duplicated)
        appStore.showSuccess('매핑이 복제되었습니다')
        
        // Refresh list
        await fetchMappings()
        
      } catch (error) {
        appStore.showError('매핑 복제에 실패했습니다')
      }
    }
    
    const testMapping = async (id) => {
      try {
        appStore.setLoading(true, '매핑 테스트 중...')
        await mappingApi.validate(id)
        appStore.setLoading(false)
        appStore.showSuccess('매핑 테스트가 성공적으로 완료되었습니다')
      } catch (error) {
        appStore.setLoading(false)
        appStore.showError('매핑 테스트 실패: ' + error.message)
      }
    }
    
    const deleteMapping = async (id) => {
      if (!confirm('정말로 이 매핑을 삭제하시겠습니까?')) {
        return
      }
      
      try {
        await mappingApi.delete(id)
        appStore.showSuccess('매핑이 삭제되었습니다')
        
        // Remove from local list
        mappings.value = mappings.value.filter(m => m.id !== id)
        
      } catch (error) {
        appStore.showError('매핑 삭제에 실패했습니다')
      }
    }
    
    // Lifecycle
    onMounted(async () => {
      await systemStore.fetchSystems()
      await fetchMappings()
    })
    
    // Watch for page changes
    watch(currentPage, () => {
      window.scrollTo(0, 0)
    })
    
    return {
      // State
      mappings,
      loading,
      error,
      searchQuery,
      statusFilter,
      systemFilter,
      currentPage,
      showWizard,
      
      // Computed
      availableSystems,
      filteredMappings,
      paginatedMappings,
      totalPages,
      totalMappings,
      activeMappings,
      draftMappings,
      errorMappings,
      
      // Methods
      refreshMappings,
      handleSearch,
      applyFilters,
      getSystemName,
      getStatusText,
      formatDate,
      createNewMapping,
      handleWizardClose,
      handleWizardCreated,
      editMapping,
      duplicateMapping,
      testMapping,
      deleteMapping
    }
  }
}
</script>

<style scoped>
.mapping-container {
  padding: var(--space-6);
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.mapping-header {
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

.stat-icon.warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.stat-icon.error {
  background: var(--error-soft);
  color: var(--error);
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
  padding: var(--space-5);
}

.filter-content {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.search-box {
  flex: 1;
  position: relative;
}

.search-box v-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-400);
}

.search-input {
  width: 100%;
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-10);
  background: var(--white);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.filter-controls {
  display: flex;
  gap: var(--space-3);
}

/* Mappings Grid */
.mappings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.mapping-card {
  display: flex;
  flex-direction: column;
  transition: all var(--transition-base);
}

.mapping-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-5);
  border-bottom: 1px solid var(--gray-100);
}

.mapping-info {
  flex: 1;
  min-width: 0;
}

.mapping-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mapping-description {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.status-badge.status-active {
  background: var(--success-soft);
  color: var(--success);
}

.status-badge.status-draft {
  background: var(--warning-soft);
  color: var(--warning);
}

.status-badge.status-inactive {
  background: var(--gray-100);
  color: var(--gray-600);
}

.status-badge.status-error {
  background: var(--error-soft);
  color: var(--error);
}

.card-body {
  padding: var(--space-5);
  flex: 1;
}

.system-flow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.system-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-base);
}

.system-box > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.system-label {
  font-size: var(--font-size-xs);
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.system-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--gray-900);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
}

.mapping-stats {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

.mapping-stats .stat {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.card-footer {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  background: var(--gray-50);
  border-top: 1px solid var(--gray-100);
}

.action-button {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--white);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-base);
}

.action-button:hover {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.action-button.primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--white);
}

.action-button.primary:hover {
  background: var(--primary-dark);
}

.action-button.danger {
  color: var(--error);
  border-color: var(--error);
}

.action-button.danger:hover {
  background: var(--error-soft);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading/Error/Empty States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  color: var(--gray-600);
}

.error-state {
  color: var(--error);
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-top: var(--space-6);
}

.page-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--white);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-base);
}

.page-button:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

.current-page {
  font-weight: var(--font-semibold);
  color: var(--gray-900);
}

/* Utilities */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .filter-content {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-controls {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: var(--space-3);
  }
}

@media (max-width: 768px) {
  .mapping-container {
    padding: var(--space-4);
  }
  
  .mapping-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .mappings-grid {
    grid-template-columns: 1fr;
  }
  
  .system-flow {
    flex-direction: column;
  }
  
  .flow-arrow {
    transform: rotate(90deg);
  }
  
  .card-footer {
    flex-wrap: wrap;
  }
  
  .filter-controls {
    grid-template-columns: 1fr;
  }
}
</style>