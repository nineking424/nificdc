<template>
  <AppLayout>
    <div class="mapping-management">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">Mapping Management</h1>
          <p class="page-subtitle">Create and manage data transformation mappings between systems</p>
        </div>
        <div class="header-actions">
          <button @click="createNewMapping" class="btn-primary">
            <PlusIcon />
            Create New Mapping
          </button>
        </div>
      </div>

      <!-- Filters and Search -->
      <div class="filters-section">
        <div class="search-box">
          <SearchIcon />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search mappings..."
            @input="handleSearch"
          />
        </div>
        
        <div class="filters">
          <select v-model="statusFilter" @change="applyFilters" class="filter-select">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
            <option value="error">Error</option>
          </select>
          
          <select v-model="systemFilter" @change="applyFilters" class="filter-select">
            <option value="">All Systems</option>
            <option v-for="system in availableSystems" :key="system.id" :value="system.id">
              {{ system.name }}
            </option>
          </select>
          
          <button @click="refreshMappings" class="btn-icon" title="Refresh">
            <RefreshIcon :class="{ 'spin': loading }" />
          </button>
        </div>
      </div>

      <!-- Mappings List -->
      <div v-if="loading && mappings.length === 0" class="loading-state">
        <LoadingSpinner />
        <span>Loading mappings...</span>
      </div>

      <div v-else-if="error" class="error-state">
        <ErrorIcon />
        <span>{{ error }}</span>
        <button @click="refreshMappings" class="retry-button">Retry</button>
      </div>

      <div v-else-if="filteredMappings.length === 0" class="empty-state">
        <EmptyStateIcon />
        <h3>No mappings found</h3>
        <p v-if="searchQuery || statusFilter || systemFilter">
          Try adjusting your filters or search query
        </p>
        <p v-else>
          Create your first mapping to get started
        </p>
        <button @click="createNewMapping" class="btn-primary">
          <PlusIcon />
          Create New Mapping
        </button>
      </div>

      <div v-else class="mappings-grid">
        <div 
          v-for="mapping in paginatedMappings" 
          :key="mapping.id"
          class="mapping-card"
          :class="{ 'error': mapping.status === 'error' }"
        >
          <div class="card-header">
            <div class="mapping-info">
              <h3 class="mapping-name">{{ mapping.name }}</h3>
              <p class="mapping-description">{{ mapping.description || 'No description' }}</p>
            </div>
            <div class="status-badge" :class="mapping.status">
              {{ mapping.status }}
            </div>
          </div>
          
          <div class="card-body">
            <div class="system-flow">
              <div class="system-box source">
                <DatabaseIcon />
                <div>
                  <span class="system-label">Source</span>
                  <span class="system-name">{{ getSystemName(mapping.sourceSystemId) }}</span>
                </div>
              </div>
              
              <div class="flow-arrow">
                <ArrowRightIcon />
              </div>
              
              <div class="system-box target">
                <DatabaseIcon />
                <div>
                  <span class="system-label">Target</span>
                  <span class="system-name">{{ getSystemName(mapping.targetSystemId) }}</span>
                </div>
              </div>
            </div>
            
            <div class="mapping-stats">
              <div class="stat">
                <FieldIcon />
                <span>{{ mapping.fieldMappings?.length || 0 }} fields mapped</span>
              </div>
              <div class="stat">
                <ClockIcon />
                <span>{{ formatDate(mapping.updatedAt) }}</span>
              </div>
            </div>
          </div>
          
          <div class="card-actions">
            <button @click="editMapping(mapping.id)" class="btn-text">
              <EditIcon />
              Edit
            </button>
            <button @click="duplicateMapping(mapping.id)" class="btn-text">
              <CopyIcon />
              Duplicate
            </button>
            <button @click="testMapping(mapping.id)" class="btn-text" :disabled="mapping.status === 'draft'">
              <TestIcon />
              Test
            </button>
            <button @click="deleteMapping(mapping.id)" class="btn-text danger">
              <DeleteIcon />
              Delete
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
          Previous
        </button>
        
        <span class="page-info">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        
        <button 
          @click="currentPage++" 
          :disabled="currentPage === totalPages"
          class="page-button"
        >
          Next
        </button>
      </div>

      <!-- Statistics Summary -->
      <div class="statistics-summary">
        <div class="stat-card">
          <div class="stat-value">{{ totalMappings }}</div>
          <div class="stat-label">Total Mappings</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-success">{{ activeMappings }}</div>
          <div class="stat-label">Active</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-warning">{{ draftMappings }}</div>
          <div class="stat-label">Draft</div>
        </div>
        <div class="stat-card">
          <div class="stat-value text-danger">{{ errorMappings }}</div>
          <div class="stat-label">Errors</div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMappingStore } from '@/stores/mapping'
import { useSystemStore } from '@/stores/system'
import { useAppStore } from '@/stores/app'
import AppLayout from '@/components/AppLayout.vue'
import { mappingApi } from '@/services/api'
import {
  PlusIcon,
  SearchIcon,
  RefreshIcon,
  LoadingSpinner,
  ErrorIcon,
  EmptyStateIcon,
  DatabaseIcon,
  ArrowRightIcon,
  FieldIcon,
  ClockIcon,
  EditIcon,
  CopyIcon,
  TestIcon,
  DeleteIcon
} from '@/components/icons'

export default {
  name: 'MappingManagement',
  
  components: {
    AppLayout,
    PlusIcon,
    SearchIcon,
    RefreshIcon,
    LoadingSpinner,
    ErrorIcon,
    EmptyStateIcon,
    DatabaseIcon,
    ArrowRightIcon,
    FieldIcon,
    ClockIcon,
    EditIcon,
    CopyIcon,
    TestIcon,
    DeleteIcon
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
        error.value = err.message || 'Failed to load mappings'
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
      return system ? system.name : 'Unknown System'
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return 'Never'
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    const createNewMapping = () => {
      router.push('/mappings/new')
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
          name: `${mapping.name} (Copy)`,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        delete duplicated.id
        
        const response = await mappingApi.create(duplicated)
        appStore.showSuccess('Mapping duplicated successfully')
        
        // Refresh list
        await fetchMappings()
        
      } catch (error) {
        appStore.showError('Failed to duplicate mapping')
      }
    }
    
    const testMapping = async (id) => {
      try {
        appStore.setLoading(true, 'Testing mapping...')
        await mappingApi.validate(id)
        appStore.setLoading(false)
        appStore.showSuccess('Mapping test completed successfully')
      } catch (error) {
        appStore.setLoading(false)
        appStore.showError('Mapping test failed: ' + error.message)
      }
    }
    
    const deleteMapping = async (id) => {
      if (!confirm('Are you sure you want to delete this mapping?')) {
        return
      }
      
      try {
        await mappingApi.delete(id)
        appStore.showSuccess('Mapping deleted successfully')
        
        // Remove from local list
        mappings.value = mappings.value.filter(m => m.id !== id)
        
      } catch (error) {
        appStore.showError('Failed to delete mapping')
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
      formatDate,
      createNewMapping,
      editMapping,
      duplicateMapping,
      testMapping,
      deleteMapping
    }
  }
}
</script>

<style scoped>
.mapping-management {
  padding: 24px;
}

/* Header */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 32px;
}

.header-content {
  flex: 1;
}

.page-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 600;
  color: var(--color-text);
}

.page-subtitle {
  margin: 0;
  font-size: 16px;
  color: var(--color-text-secondary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Filters */
.filters-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.search-box {
  flex: 1;
  position: relative;
}

.search-box svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--color-text-secondary);
}

.search-box input {
  width: 100%;
  padding: 10px 12px 10px 40px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text);
  transition: border-color 0.2s;
}

.search-box input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filters {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 10px 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.2s;
}

.filter-select:hover {
  border-color: var(--color-border-hover);
}

/* Mappings Grid */
.mappings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.mapping-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.mapping-card:hover {
  border-color: var(--color-border-hover);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.mapping-card.error {
  border-color: var(--color-danger);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid var(--color-border);
}

.mapping-info {
  flex: 1;
  min-width: 0;
}

.mapping-name {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mapping-description {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.active {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status-badge.draft {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.status-badge.inactive {
  background: var(--color-text-soft);
  color: var(--color-text-secondary);
}

.status-badge.error {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.card-body {
  padding: 20px;
}

.system-flow {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.system-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.system-box svg {
  width: 24px;
  height: 24px;
  color: var(--color-primary);
}

.system-box > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.system-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.system-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-arrow {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
}

.mapping-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat svg {
  width: 16px;
  height: 16px;
}

.card-actions {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-top: 1px solid var(--color-border);
}

/* Loading States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px;
  text-align: center;
}

.loading-state svg,
.error-state svg,
.empty-state svg {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

.error-state {
  color: var(--color-danger);
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
}

.empty-state p {
  margin: 0 0 24px;
  color: var(--color-text-secondary);
}

.retry-button {
  margin-top: 16px;
  padding: 8px 16px;
  background: var(--color-danger);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.retry-button:hover {
  opacity: 0.9;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 32px;
}

.page-button {
  padding: 8px 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
}

.page-button:hover:not(:disabled) {
  background: var(--color-background-soft);
  border-color: var(--color-border-hover);
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* Statistics */
.statistics-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 24px;
  background: var(--color-background-soft);
  border-radius: 12px;
}

.stat-card {
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.stat-value.text-success {
  color: var(--color-success);
}

.stat-value.text-warning {
  color: var(--color-warning);
}

.stat-value.text-danger {
  color: var(--color-danger);
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* Buttons */
.btn-primary,
.btn-icon,
.btn-text {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-icon {
  padding: 10px;
  background: transparent;
  border: 1px solid var(--color-border);
}

.btn-icon:hover {
  background: var(--color-background-soft);
  border-color: var(--color-border-hover);
}

.btn-text {
  padding: 6px 12px;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
}

.btn-text:hover {
  background: var(--color-background-mute);
}

.btn-text.danger {
  color: var(--color-danger);
}

.btn-text.danger:hover {
  background: var(--color-danger-soft);
}

.btn-text:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .mapping-card {
    background: var(--color-background-dark);
  }
  
  .filter-select,
  .search-box input {
    background: var(--color-background-dark);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filters {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr auto;
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
}
</style>