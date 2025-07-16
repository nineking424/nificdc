import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { mappingService } from '@/services/mappingService'
import { useAppStore } from './app'

export const useMappingStore = defineStore('mapping', () => {
  // 앱 스토어 참조
  const appStore = useAppStore()

  // 상태 정의
  const mappings = ref([])
  const currentMapping = ref(null)
  const sourceSchema = ref(null)
  const targetSchema = ref(null)
  const fieldMappings = ref([])
  const draggedField = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const validationResult = ref(null)
  const previewData = ref(null)
  const executionHistory = ref([])
  const transformFunctions = ref([])
  const mappingTypes = ref([])
  const selectedFields = ref({
    source: [],
    target: []
  })
  
  // 페이지네이션 상태
  const pagination = reactive({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 필터 상태
  const filters = reactive({
    search: '',
    type: null,
    status: null,
    sourceSystem: null,
    targetSystem: null,
    tags: []
  })

  // 정렬 상태
  const sort = reactive({
    field: 'updatedAt',
    order: 'desc'
  })

  // 계산된 속성
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => !!error.value)
  const hasMappings = computed(() => mappings.value.length > 0)
  const hasCurrentMapping = computed(() => !!currentMapping.value)
  const isValidMapping = computed(() => validationResult.value?.valid === true)
  
  // 소스 필드 목록
  const sourceFields = computed(() => {
    if (!sourceSchema.value?.columns) return []
    return sourceSchema.value.columns.map(col => ({
      ...col,
      id: col.name,
      type: col.dataType || col.type
    }))
  })

  // 타겟 필드 목록
  const targetFields = computed(() => {
    if (!targetSchema.value?.columns) return []
    return targetSchema.value.columns.map(col => ({
      ...col,
      id: col.name,
      type: col.dataType || col.type
    }))
  })

  // 매핑된 필드 수
  const mappedFieldsCount = computed(() => {
    return fieldMappings.value.filter(mapping => mapping.targetField).length
  })

  // 매핑 진행률
  const mappingProgress = computed(() => {
    if (!targetFields.value.length) return 0
    return Math.round((mappedFieldsCount.value / targetFields.value.length) * 100)
  })

  // 필터된 매핑 목록
  const filteredMappings = computed(() => {
    let result = [...mappings.value]

    // 검색 필터
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter(mapping => 
        mapping.name?.toLowerCase().includes(searchLower) ||
        mapping.description?.toLowerCase().includes(searchLower) ||
        mapping.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    // 타입 필터
    if (filters.type) {
      result = result.filter(mapping => mapping.type === filters.type)
    }

    // 상태 필터
    if (filters.status !== null) {
      result = result.filter(mapping => mapping.isActive === filters.status)
    }

    // 소스 시스템 필터
    if (filters.sourceSystem) {
      result = result.filter(mapping => mapping.sourceSystemId === filters.sourceSystem)
    }

    // 타겟 시스템 필터
    if (filters.targetSystem) {
      result = result.filter(mapping => mapping.targetSystemId === filters.targetSystem)
    }

    // 태그 필터
    if (filters.tags.length > 0) {
      result = result.filter(mapping => 
        filters.tags.every(tag => mapping.tags?.includes(tag))
      )
    }

    return result
  })

  // 액션
  const setLoading = (value) => {
    loading.value = value
  }

  const setError = (errorData) => {
    error.value = errorData
    if (errorData) {
      appStore.addNotification({
        type: 'error',
        title: '오류',
        message: errorData.message || '알 수 없는 오류가 발생했습니다.'
      })
    }
  }

  const clearError = () => {
    error.value = null
  }

  // 매핑 목록 조회
  const fetchMappings = async (params = {}) => {
    setLoading(true)
    clearError()
    
    try {
      const queryParams = {
        page: pagination.page,
        limit: pagination.limit,
        sort: `${sort.order === 'desc' ? '-' : ''}${sort.field}`,
        ...filters,
        ...params
      }

      const response = await mappingService.getMappings(queryParams)
      
      if (response.data) {
        mappings.value = response.data.mappings || []
        pagination.total = response.data.total || 0
        pagination.totalPages = response.data.totalPages || 1
      }
    } catch (err) {
      setError({
        message: '매핑 목록을 불러오는데 실패했습니다.',
        details: err.message
      })
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 매핑 상세 조회
  const loadMapping = async (mappingId) => {
    setLoading(true)
    clearError()
    
    try {
      const response = await mappingService.getMapping(mappingId)
      
      if (response.data) {
        currentMapping.value = response.data
        sourceSchema.value = response.data.sourceSchema
        targetSchema.value = response.data.targetSchema
        fieldMappings.value = response.data.fieldMappings || []
      }
    } catch (err) {
      setError({
        message: '매핑 정보를 불러오는데 실패했습니다.',
        details: err.message
      })
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 매핑 생성
  const createMapping = async (mappingData) => {
    setLoading(true)
    clearError()
    
    try {
      const response = await mappingService.createMapping(mappingData)
      
      if (response.data) {
        currentMapping.value = response.data
        appStore.addNotification({
          type: 'success',
          title: '성공',
          message: '매핑이 생성되었습니다.'
        })
        return response.data
      }
    } catch (err) {
      setError({
        message: '매핑 생성에 실패했습니다.',
        details: err.message
      })
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 매핑 수정
  const updateMapping = async (mappingId, mappingData) => {
    setLoading(true)
    clearError()
    
    try {
      const response = await mappingService.updateMapping(mappingId, mappingData)
      
      if (response.data) {
        currentMapping.value = response.data
        appStore.addNotification({
          type: 'success',
          title: '성공',
          message: '매핑이 수정되었습니다.'
        })
        return response.data
      }
    } catch (err) {
      setError({
        message: '매핑 수정에 실패했습니다.',
        details: err.message
      })
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 매핑 삭제
  const deleteMapping = async (mappingId) => {
    setLoading(true)
    clearError()
    
    try {
      await mappingService.deleteMapping(mappingId)
      
      // 목록에서 제거
      const index = mappings.value.findIndex(m => m.id === mappingId)
      if (index > -1) {
        mappings.value.splice(index, 1)
      }
      
      // 현재 매핑이 삭제된 경우 초기화
      if (currentMapping.value?.id === mappingId) {
        resetCurrentMapping()
      }
      
      appStore.addNotification({
        type: 'success',
        title: '성공',
        message: '매핑이 삭제되었습니다.'
      })
    } catch (err) {
      setError({
        message: '매핑 삭제에 실패했습니다.',
        details: err.message
      })
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 매핑 실행
  const executeMapping = async (mappingId, executionData = {}) => {
    setLoading(true)
    clearError()
    
    try {
      const response = await mappingService.executeMapping(mappingId, executionData)
      
      if (response.data) {
        appStore.addNotification({
          type: 'success',
          title: '성공',
          message: '매핑 실행이 시작되었습니다.'
        })
        return response.data
      }
    } catch (err) {
      setError({
        message: '매핑 실행에 실패했습니다.',
        details: err.message
      })
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 매핑 검증
  const validateMapping = async (mappingId) => {
    setLoading(true)
    clearError()
    
    try {
      const response = await mappingService.validateMapping(mappingId)
      
      if (response.data) {
        validationResult.value = response.data
        return response.data
      }
    } catch (err) {
      setError({
        message: '매핑 검증에 실패했습니다.',
        details: err.message
      })
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 매핑 미리보기
  const previewMapping = async (mappingId, previewOptions) => {
    setLoading(true)
    clearError()
    
    try {
      const response = await mappingService.previewMapping(mappingId, previewOptions)
      
      if (response.data) {
        previewData.value = response.data
        return response.data
      }
    } catch (err) {
      setError({
        message: '매핑 미리보기에 실패했습니다.',
        details: err.message
      })
      throw err
    } finally {
      setLoading(false)
    }
  }

  // 필드 매핑 추가
  const addFieldMapping = (sourceField, targetField, transformations = []) => {
    const mapping = {
      id: Date.now() + Math.random(),
      sourceField,
      targetField,
      transformations,
      enabled: true
    }
    
    fieldMappings.value.push(mapping)
    return mapping
  }

  // 필드 매핑 수정
  const updateFieldMapping = (mappingId, updates) => {
    const index = fieldMappings.value.findIndex(m => m.id === mappingId)
    if (index > -1) {
      fieldMappings.value[index] = {
        ...fieldMappings.value[index],
        ...updates
      }
    }
  }

  // 필드 매핑 삭제
  const removeFieldMapping = (mappingId) => {
    const index = fieldMappings.value.findIndex(m => m.id === mappingId)
    if (index > -1) {
      fieldMappings.value.splice(index, 1)
    }
  }

  // 드래그 시작
  const startDrag = (field, type) => {
    draggedField.value = { field, type }
  }

  // 드래그 종료
  const endDrag = () => {
    draggedField.value = null
  }

  // 드롭 처리
  const handleDrop = (targetField) => {
    if (!draggedField.value) return
    
    if (draggedField.value.type === 'source' && targetField) {
      addFieldMapping(draggedField.value.field, targetField)
    }
    
    endDrag()
  }

  // 변환 함수 목록 조회
  const fetchTransformFunctions = async () => {
    try {
      const response = await mappingService.getTransformFunctions()
      if (response.data) {
        transformFunctions.value = response.data.functions || []
      }
    } catch (err) {
      console.error('변환 함수 목록 조회 실패:', err)
    }
  }

  // 매핑 타입 목록 조회
  const fetchMappingTypes = async () => {
    try {
      const response = await mappingService.getMappingTypes()
      if (response.data) {
        mappingTypes.value = response.data.types || []
      }
    } catch (err) {
      console.error('매핑 타입 목록 조회 실패:', err)
    }
  }

  // 실행 이력 조회
  const fetchExecutionHistory = async (mappingId, params = {}) => {
    try {
      const response = await mappingService.getMappingExecutionHistory(mappingId, params)
      if (response.data) {
        executionHistory.value = response.data.executions || []
        return response.data
      }
    } catch (err) {
      console.error('실행 이력 조회 실패:', err)
      throw err
    }
  }

  // 필터 초기화
  const resetFilters = () => {
    filters.search = ''
    filters.type = null
    filters.status = null
    filters.sourceSystem = null
    filters.targetSystem = null
    filters.tags = []
  }

  // 페이지 변경
  const changePage = (page) => {
    pagination.page = page
    fetchMappings()
  }

  // 페이지 크기 변경
  const changePageSize = (size) => {
    pagination.limit = size
    pagination.page = 1
    fetchMappings()
  }

  // 정렬 변경
  const changeSort = (field, order) => {
    sort.field = field
    sort.order = order
    fetchMappings()
  }

  // 현재 매핑 초기화
  const resetCurrentMapping = () => {
    currentMapping.value = null
    sourceSchema.value = null
    targetSchema.value = null
    fieldMappings.value = []
    validationResult.value = null
    previewData.value = null
    selectedFields.value = {
      source: [],
      target: []
    }
  }

  // 스토어 초기화
  const reset = () => {
    mappings.value = []
    resetCurrentMapping()
    executionHistory.value = []
    transformFunctions.value = []
    mappingTypes.value = []
    loading.value = false
    error.value = null
    resetFilters()
    pagination.page = 1
    pagination.total = 0
    pagination.totalPages = 0
  }

  return {
    // 상태
    mappings,
    currentMapping,
    sourceSchema,
    targetSchema,
    fieldMappings,
    draggedField,
    loading,
    error,
    validationResult,
    previewData,
    executionHistory,
    transformFunctions,
    mappingTypes,
    selectedFields,
    pagination,
    filters,
    sort,

    // 계산된 속성
    isLoading,
    hasError,
    hasMappings,
    hasCurrentMapping,
    isValidMapping,
    sourceFields,
    targetFields,
    mappedFieldsCount,
    mappingProgress,
    filteredMappings,

    // 액션
    setLoading,
    setError,
    clearError,
    fetchMappings,
    loadMapping,
    createMapping,
    updateMapping,
    deleteMapping,
    executeMapping,
    validateMapping,
    previewMapping,
    addFieldMapping,
    updateFieldMapping,
    removeFieldMapping,
    startDrag,
    endDrag,
    handleDrop,
    fetchTransformFunctions,
    fetchMappingTypes,
    fetchExecutionHistory,
    resetFilters,
    changePage,
    changePageSize,
    changeSort,
    resetCurrentMapping,
    reset
  }
})