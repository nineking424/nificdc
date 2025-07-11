import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/utils/api'
import { useToast } from 'vue-toastification'

export const useSystemsStore = defineStore('systems', () => {
  const toast = useToast()
  
  // 상태
  const systems = ref([])
  const currentSystem = ref(null)
  const isLoading = ref(false)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const filters = ref({
    search: '',
    type: '',
    status: '',
    isActive: null
  })
  const sortBy = ref('name')
  const sortOrder = ref('asc')
  
  // 시스템 타입 정의
  const systemTypes = ref([
    { value: 'oracle', text: 'Oracle Database', icon: 'mdi-database' },
    { value: 'postgresql', text: 'PostgreSQL', icon: 'mdi-elephant' },
    { value: 'mysql', text: 'MySQL', icon: 'mdi-database' },
    { value: 'mssql', text: 'SQL Server', icon: 'mdi-microsoft' },
    { value: 'sqlite', text: 'SQLite', icon: 'mdi-database' },
    { value: 'ftp', text: 'FTP Server', icon: 'mdi-folder-network' },
    { value: 'sftp', text: 'SFTP Server', icon: 'mdi-folder-lock' },
    { value: 'local_fs', text: 'Local File System', icon: 'mdi-folder' },
    { value: 'aws_s3', text: 'Amazon S3', icon: 'mdi-aws' },
    { value: 'azure_blob', text: 'Azure Blob Storage', icon: 'mdi-microsoft-azure' }
  ])
  
  // 계산된 속성
  const filteredSystems = computed(() => {
    let filtered = systems.value
    
    if (filters.value.search) {
      const searchLower = filters.value.search.toLowerCase()
      filtered = filtered.filter(system => 
        system.name.toLowerCase().includes(searchLower) ||
        system.description?.toLowerCase().includes(searchLower)
      )
    }
    
    if (filters.value.type) {
      filtered = filtered.filter(system => system.type === filters.value.type)
    }
    
    if (filters.value.isActive !== null) {
      filtered = filtered.filter(system => system.isActive === filters.value.isActive)
    }
    
    return filtered
  })
  
  const sortedSystems = computed(() => {
    const sorted = [...filteredSystems.value]
    
    sorted.sort((a, b) => {
      let aVal = a[sortBy.value]
      let bVal = b[sortBy.value]
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      
      if (sortOrder.value === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
      }
    })
    
    return sorted
  })
  
  const systemsByType = computed(() => {
    const grouped = {}
    systems.value.forEach(system => {
      if (!grouped[system.type]) {
        grouped[system.type] = []
      }
      grouped[system.type].push(system)
    })
    return grouped
  })
  
  const activeSystems = computed(() => 
    systems.value.filter(system => system.isActive)
  )
  
  const systemStats = computed(() => ({
    total: systems.value.length,
    active: activeSystems.value.length,
    inactive: systems.value.filter(s => !s.isActive).length,
    byType: systemsByType.value
  }))
  
  // 액션
  const getSystems = async (params = {}) => {
    try {
      isLoading.value = true
      
      const response = await api.get('/systems', { params })
      
      // 백엔드 API 응답 구조에 맞춤
      return response.data
    } catch (error) {
      console.error('Failed to fetch systems:', error)
      toast.error('시스템 목록을 불러오는데 실패했습니다.')
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const fetchSystems = async (options = {}) => {
    try {
      isLoading.value = true
      
      const params = {
        page: options.page || pagination.value.page,
        limit: options.limit || pagination.value.limit,
        search: filters.value.search,
        type: filters.value.type,
        isActive: filters.value.isActive,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value
      }
      
      const response = await api.get('/systems', { params })
      
      // 백엔드 API 응답 구조에 맞춤
      systems.value = response.data.systems
      pagination.value = {
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages
      }
    } catch (error) {
      console.error('Failed to fetch systems:', error)
      toast.error('시스템 목록을 불러오는데 실패했습니다.')
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const fetchSystem = async (id) => {
    try {
      isLoading.value = true
      
      const response = await api.get(`/systems/${id}`)
      
      if (response.data.success) {
        currentSystem.value = response.data.system
        return response.data.system
      }
    } catch (error) {
      console.error('Failed to fetch system:', error)
      toast.error('시스템 정보를 불러오는데 실패했습니다.')
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const createSystem = async (systemData) => {
    try {
      isLoading.value = true
      
      const response = await api.post('/systems', systemData)
      
      // 백엔드 API 응답 구조에 맞춤
      if (response.data.system) {
        systems.value.push(response.data.system)
        toast.success(response.data.message || '시스템이 성공적으로 생성되었습니다.')
        return response.data.system
      }
    } catch (error) {
      console.error('Failed to create system:', error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || '시스템 생성에 실패했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const updateSystem = async (id, systemData) => {
    try {
      isLoading.value = true
      
      const response = await api.put(`/systems/${id}`, systemData)
      
      if (response.data.success) {
        const index = systems.value.findIndex(s => s.id === id)
        if (index > -1) {
          systems.value[index] = response.data.system
        }
        
        if (currentSystem.value?.id === id) {
          currentSystem.value = response.data.system
        }
        
        toast.success('시스템이 성공적으로 업데이트되었습니다.')
        return response.data.system
      }
    } catch (error) {
      console.error('Failed to update system:', error)
      const errorMessage = error.response?.data?.message || '시스템 업데이트에 실패했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const deleteSystem = async (id) => {
    try {
      isLoading.value = true
      
      const response = await api.delete(`/systems/${id}`)
      
      if (response.data.success) {
        const index = systems.value.findIndex(s => s.id === id)
        if (index > -1) {
          systems.value.splice(index, 1)
        }
        
        if (currentSystem.value?.id === id) {
          currentSystem.value = null
        }
        
        toast.success('시스템이 성공적으로 삭제되었습니다.')
        return true
      }
    } catch (error) {
      console.error('Failed to delete system:', error)
      const errorMessage = error.response?.data?.message || '시스템 삭제에 실패했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  const testConnection = async (id) => {
    try {
      const response = await api.post(`/systems/${id}/test-connection`)
      
      // 백엔드 API 응답 구조에 맞춤
      const result = response.data.result
      
      if (result.success) {
        toast.success(response.data.message || '연결 테스트가 성공했습니다.')
      } else {
        toast.error(response.data.message || '연결 테스트가 실패했습니다.')
      }
      
      return result
    } catch (error) {
      console.error('Failed to test connection:', error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || '연결 테스트에 실패했습니다.'
      toast.error(errorMessage)
      throw error
    }
  }
  
  const toggleSystemStatus = async (id) => {
    try {
      const system = systems.value.find(s => s.id === id)
      if (!system) return
      
      const response = await api.patch(`/systems/${id}/status`, {
        isActive: !system.isActive
      })
      
      if (response.data.success) {
        system.isActive = !system.isActive
        
        if (currentSystem.value?.id === id) {
          currentSystem.value.isActive = system.isActive
        }
        
        const message = system.isActive ? '시스템이 활성화되었습니다.' : '시스템이 비활성화되었습니다.'
        toast.success(message)
        
        return system
      }
    } catch (error) {
      console.error('Failed to toggle system status:', error)
      const errorMessage = error.response?.data?.message || '시스템 상태 변경에 실패했습니다.'
      toast.error(errorMessage)
      throw error
    }
  }
  
  const setFilters = (newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
  }
  
  const setSorting = (field, order) => {
    sortBy.value = field
    sortOrder.value = order
  }
  
  const setPagination = (page, limit) => {
    pagination.value.page = page
    if (limit) {
      pagination.value.limit = limit
    }
  }
  
  const clearFilters = () => {
    filters.value = {
      search: '',
      type: '',
      status: '',
      isActive: null
    }
  }
  
  const refreshSystems = async () => {
    await fetchSystems()
  }
  
  const validateConnection = async (type, connectionInfo) => {
    try {
      isLoading.value = true
      
      const response = await api.post('/systems/validate-connection', {
        type,
        connectionInfo
      })
      
      return response.data
    } catch (error) {
      console.error('Failed to validate connection:', error)
      const errorMessage = error.response?.data?.error || error.response?.data?.message || '연결 정보 검증에 실패했습니다.'
      toast.error(errorMessage)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const getSystemTypeInfo = (type) => {
    return systemTypes.value.find(t => t.value === type) || { 
      value: type, 
      text: type, 
      icon: 'mdi-help-circle' 
    }
  }
  
  return {
    // 상태
    systems,
    currentSystem,
    isLoading,
    pagination,
    filters,
    sortBy,
    sortOrder,
    systemTypes,
    
    // 계산된 속성
    filteredSystems,
    sortedSystems,
    systemsByType,
    activeSystems,
    systemStats,
    
    // 액션
    getSystems,
    fetchSystems,
    fetchSystem,
    createSystem,
    updateSystem,
    deleteSystem,
    testConnection,
    validateConnection,
    toggleSystemStatus,
    setFilters,
    setSorting,
    setPagination,
    clearFilters,
    refreshSystems,
    getSystemTypeInfo
  }
})