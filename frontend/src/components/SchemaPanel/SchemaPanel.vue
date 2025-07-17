<template>
  <div class="schema-panel">
    <div class="schema-panel-header">
      <h3 class="schema-title">{{ title }}</h3>
      <div class="schema-actions">
        <button 
          v-if="searchable"
          @click="toggleSearch"
          class="icon-button"
          :title="searchVisible ? 'Hide search' : 'Show search'"
        >
          <SearchIcon />
        </button>
        <button 
          @click="refreshSchema"
          class="icon-button"
          title="Refresh schema"
          :disabled="loading"
        >
          <RefreshIcon :class="{ 'spin': loading }" />
        </button>
      </div>
    </div>

    <div v-if="searchVisible && searchable" class="schema-search">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search fields..."
        class="search-input"
        @input="handleSearch"
      />
    </div>

    <div class="schema-content">
      <div v-if="loading || internalLoading" class="loading-state">
        <LoadingSpinner />
        <span>Loading schema...</span>
      </div>

      <div v-else-if="error || internalError" class="error-state">
        <ErrorIcon />
        <span>{{ error || internalError }}</span>
        <button @click="refreshSchema" class="retry-button">Retry</button>
      </div>

      <div v-else-if="!treeData || treeData.length === 0" class="empty-state">
        <EmptyIcon />
        <span>No schema data available</span>
      </div>

      <div v-else class="tree-container">
        <SchemaTree
          :items="filteredTreeData"
          :draggable="draggable"
          :droppable="droppable"
          :expanded-keys="expandedKeys"
          :selected-keys="selectedKeys"
          @item-expand="handleItemExpand"
          @item-select="handleItemSelect"
          @item-drag-start="handleDragStart"
          @item-drag-end="handleDragEnd"
          @item-drop="handleDrop"
        />
      </div>
    </div>

    <div v-if="showStats" class="schema-footer">
      <span class="stat-item">
        <TableIcon />
        {{ tableCount }} {{ tableCount === 1 ? 'table' : 'tables' }}
      </span>
      <span class="stat-item">
        <FieldIcon />
        {{ fieldCount }} {{ fieldCount === 1 ? 'field' : 'fields' }}
      </span>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMappingStore } from '@/stores/mapping'
import SchemaTree from './SchemaTree.vue'
import schemaService from '@/services/schemaService'
import { 
  SearchIcon, 
  RefreshIcon, 
  LoadingSpinner, 
  ErrorIcon, 
  EmptyIcon,
  TableIcon,
  FieldIcon
} from '@/components/icons'
import { transformSchemaToTreeData, filterTreeData, getTreeStats } from './utils/treeDataTransform'

export default {
  name: 'SchemaPanel',
  
  components: {
    SchemaTree,
    SearchIcon,
    RefreshIcon,
    LoadingSpinner,
    ErrorIcon,
    EmptyIcon,
    TableIcon,
    FieldIcon
  },

  props: {
    title: {
      type: String,
      default: 'Schema'
    },
    schema: {
      type: Object,
      default: null
    },
    systemId: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      validator: (value) => ['source', 'target'].includes(value)
    },
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    },
    searchable: {
      type: Boolean,
      default: true
    },
    draggable: {
      type: Boolean,
      default: false
    },
    droppable: {
      type: Boolean,
      default: false
    },
    showStats: {
      type: Boolean,
      default: true
    },
    defaultExpanded: {
      type: Boolean,
      default: false
    }
  },

  emits: [
    'refresh',
    'field-select',
    'field-drag-start',
    'field-drag-end',
    'field-drop'
  ],

  setup(props, { emit }) {
    const mappingStore = useMappingStore()
    
    // State
    const searchVisible = ref(false)
    const searchQuery = ref('')
    const expandedKeys = ref(new Set())
    const selectedKeys = ref(new Set())
    const treeData = ref([])
    const filteredTreeData = ref([])
    const internalLoading = ref(false)
    const internalError = ref(null)
    const loadedSchema = ref(null)

    // Use internal schema if loaded from API, otherwise use prop
    const currentSchema = computed(() => loadedSchema.value || props.schema)

    // Computed
    const tableCount = computed(() => {
      if (!currentSchema.value?.tables) return 0
      return currentSchema.value.tables.length
    })

    const fieldCount = computed(() => {
      if (!currentSchema.value?.tables) return 0
      return currentSchema.value.tables.reduce((count, table) => {
        return count + (table.columns?.length || 0)
      }, 0)
    })

    // Methods
    const toggleSearch = () => {
      searchVisible.value = !searchVisible.value
      if (!searchVisible.value) {
        searchQuery.value = ''
        handleSearch()
      }
    }

    const refreshSchema = async () => {
      if (!props.systemId) {
        emit('refresh', props.systemId)
        return
      }
      
      internalLoading.value = true
      internalError.value = null
      
      try {
        const schema = await schemaService.refreshSchema(props.systemId)
        loadedSchema.value = schema
        emit('refresh', props.systemId)
      } catch (error) {
        internalError.value = error.message
      } finally {
        internalLoading.value = false
      }
    }
    
    const loadSchema = async () => {
      if (!props.systemId || props.schema) {
        // If schema is provided via prop, don't load from API
        return
      }
      
      internalLoading.value = true
      internalError.value = null
      
      try {
        const schema = await schemaService.discoverSchema(props.systemId)
        loadedSchema.value = schema
      } catch (error) {
        internalError.value = error.message
      } finally {
        internalLoading.value = false
      }
    }

    const handleSearch = () => {
      if (!searchQuery.value) {
        filteredTreeData.value = treeData.value
      } else {
        filteredTreeData.value = filterTreeData(treeData.value, searchQuery.value)
        // Expand all nodes that contain search results
        expandNodesWithResults(filteredTreeData.value)
      }
    }

    const expandNodesWithResults = (nodes) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          expandedKeys.value.add(node.id)
          expandNodesWithResults(node.children)
        }
      })
    }

    const handleItemExpand = (item) => {
      if (expandedKeys.value.has(item.id)) {
        expandedKeys.value.delete(item.id)
      } else {
        expandedKeys.value.add(item.id)
      }
    }

    const handleItemSelect = (item) => {
      selectedKeys.value.clear()
      selectedKeys.value.add(item.id)
      
      if (item.type === 'field') {
        emit('field-select', {
          field: item.data,
          schemaType: props.type
        })
      }
    }

    const handleDragStart = (event, item) => {
      if (item.type === 'field') {
        // Store drag data in mapping store
        mappingStore.startDrag(item.data, props.type)
        
        // Set drag data
        event.dataTransfer.effectAllowed = 'copy'
        event.dataTransfer.setData('application/json', JSON.stringify({
          field: item.data,
          schemaType: props.type
        }))
        
        emit('field-drag-start', {
          field: item.data,
          schemaType: props.type
        })
      }
    }

    const handleDragEnd = () => {
      mappingStore.endDrag()
      emit('field-drag-end')
    }

    const handleDrop = (event, item) => {
      event.preventDefault()
      
      if (item.type === 'field' && props.droppable) {
        try {
          const dragData = JSON.parse(event.dataTransfer.getData('application/json'))
          
          // Only allow drops from opposite schema type
          if (dragData.schemaType !== props.type) {
            mappingStore.handleDrop(item.data, props.type)
            
            emit('field-drop', {
              sourceField: dragData.field,
              targetField: item.data,
              sourceType: dragData.schemaType,
              targetType: props.type
            })
          }
        } catch (error) {
          console.error('Error handling drop:', error)
        }
      }
    }

    // Initialize and update tree data
    const updateTreeData = () => {
      if (currentSchema.value) {
        treeData.value = transformSchemaToTreeData(currentSchema.value)
        filteredTreeData.value = treeData.value
        
        // Expand all tables by default if specified
        if (props.defaultExpanded) {
          treeData.value.forEach(node => {
            if (node.type === 'table') {
              expandedKeys.value.add(node.id)
            }
          })
        }
      } else {
        treeData.value = []
        filteredTreeData.value = []
      }
    }

    // Watchers
    watch(currentSchema, updateTreeData, { immediate: true })
    
    // Load schema when systemId changes
    watch(() => props.systemId, async (newSystemId, oldSystemId) => {
      if (newSystemId && newSystemId !== oldSystemId) {
        await loadSchema()
      }
    })

    // Lifecycle
    onMounted(async () => {
      await loadSchema()
      updateTreeData()
    })

    return {
      searchVisible,
      searchQuery,
      expandedKeys,
      selectedKeys,
      treeData,
      filteredTreeData,
      internalLoading,
      internalError,
      tableCount,
      fieldCount,
      toggleSearch,
      refreshSchema,
      handleSearch,
      handleItemExpand,
      handleItemSelect,
      handleDragStart,
      handleDragEnd,
      handleDrop
    }
  }
}
</script>

<style scoped>
.schema-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.schema-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
}

.schema-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.schema-actions {
  display: flex;
  gap: 8px;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-button:hover:not(:disabled) {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.icon-button:disabled {
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

.schema-search {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text);
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.search-input::placeholder {
  color: var(--color-text-secondary);
}

.schema-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tree-container {
  height: 100%;
  overflow-y: auto;
  padding: 8px;
}

/* Loading, Error, and Empty States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  padding: 32px;
  color: var(--color-text-secondary);
}

.error-state {
  color: var(--color-danger);
}

.retry-button {
  padding: 6px 16px;
  background: var(--color-danger);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.2s;
}

.retry-button:hover {
  opacity: 0.9;
}

.schema-footer {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-top: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .schema-panel {
    background: var(--color-background-dark);
  }
  
  .schema-panel-header {
    background: var(--color-background-soft-dark);
  }
}
</style>