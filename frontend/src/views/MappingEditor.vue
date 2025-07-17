<template>
  <div class="mapping-editor">
    <!-- Header -->
    <div class="editor-header">
      <div class="header-left">
        <button @click="handleBack" class="back-button">
          <ArrowLeftIcon />
          <span>Back to Mappings</span>
        </button>
        <h1 class="editor-title">
          {{ isEditMode ? 'Edit Mapping' : 'Create New Mapping' }}
        </h1>
      </div>
      
      <div class="header-actions">
        <button 
          @click="handleSave" 
          class="btn-primary"
          :disabled="!canSave || saving"
        >
          <SaveIcon />
          {{ saving ? 'Saving...' : 'Save Mapping' }}
        </button>
        <button @click="handleCancel" class="btn-secondary">
          Cancel
        </button>
      </div>
    </div>

    <!-- Mapping Configuration -->
    <div class="mapping-config">
      <div class="config-row">
        <div class="config-field">
          <label>Mapping Name</label>
          <input 
            v-model="mappingName" 
            type="text" 
            placeholder="Enter mapping name"
            class="input-field"
          />
        </div>
        <div class="config-field">
          <label>Description</label>
          <input 
            v-model="mappingDescription" 
            type="text" 
            placeholder="Optional description"
            class="input-field"
          />
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="editor-content">
      <!-- Source Panel -->
      <div class="schema-column source-column">
        <div class="column-header">
          <h2>Source System</h2>
          <select 
            v-model="sourceSystemId" 
            @change="handleSourceSystemChange"
            class="system-select"
          >
            <option value="">Select source system...</option>
            <option 
              v-for="system in availableSystems" 
              :key="system.id"
              :value="system.id"
            >
              {{ system.name }} ({{ system.type }})
            </option>
          </select>
        </div>
        
        <SchemaPanel
          v-if="sourceSystemId"
          :key="`source-${sourceSystemId}`"
          title="Source Schema"
          :system-id="sourceSystemId"
          :schema="sourceSchema"
          type="source"
          :loading="sourceLoading"
          :error="sourceError"
          :searchable="true"
          :draggable="true"
          :droppable="false"
          :show-stats="true"
          @refresh="refreshSourceSchema"
          @field-select="handleFieldSelect"
          @field-drag-start="handleFieldDragStart"
          @field-drag-end="handleFieldDragEnd"
        />
        
        <div v-else class="empty-panel">
          <EmptyStateIcon />
          <p>Select a source system to view schema</p>
        </div>
      </div>

      <!-- Mapping Canvas (Placeholder for Task 13) -->
      <div class="mapping-canvas">
        <div class="canvas-header">
          <h3>Field Mappings</h3>
          <button @click="autoMap" class="btn-small" :disabled="!canAutoMap">
            <AutoMapIcon />
            Auto Map
          </button>
        </div>
        
        <div class="canvas-content">
          <!-- This will be replaced with the actual Mapping Canvas component in Task 13 -->
          <div class="mapping-list">
            <div v-if="mappings.length === 0" class="no-mappings">
              <InfoIcon />
              <p>Drag fields from source to target to create mappings</p>
            </div>
            
            <div v-else class="mapping-items">
              <div 
                v-for="(mapping, index) in mappings" 
                :key="index"
                class="mapping-item"
              >
                <div class="mapping-source">
                  <FieldIcon />
                  {{ mapping.source.tableName }}.{{ mapping.source.name }}
                </div>
                <div class="mapping-arrow">→</div>
                <div class="mapping-target">
                  <FieldIcon />
                  {{ mapping.target.tableName }}.{{ mapping.target.name }}
                </div>
                <button 
                  @click="removeMapping(index)" 
                  class="remove-mapping"
                  title="Remove mapping"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
          </div>
          
          <div class="mapping-stats">
            <span>{{ mappings.length }} field mapping(s)</span>
            <span v-if="unmappedSourceFields > 0" class="warning">
              {{ unmappedSourceFields }} unmapped source fields
            </span>
          </div>
        </div>
      </div>

      <!-- Target Panel -->
      <div class="schema-column target-column">
        <div class="column-header">
          <h2>Target System</h2>
          <select 
            v-model="targetSystemId" 
            @change="handleTargetSystemChange"
            class="system-select"
          >
            <option value="">Select target system...</option>
            <option 
              v-for="system in availableSystems" 
              :key="system.id"
              :value="system.id"
              :disabled="system.id === sourceSystemId"
            >
              {{ system.name }} ({{ system.type }})
            </option>
          </select>
        </div>
        
        <SchemaPanel
          v-if="targetSystemId"
          :key="`target-${targetSystemId}`"
          title="Target Schema"
          :system-id="targetSystemId"
          :schema="targetSchema"
          type="target"
          :loading="targetLoading"
          :error="targetError"
          :searchable="true"
          :draggable="false"
          :droppable="true"
          :show-stats="true"
          @refresh="refreshTargetSchema"
          @field-select="handleFieldSelect"
          @field-drop="handleFieldDrop"
        />
        
        <div v-else class="empty-panel">
          <EmptyStateIcon />
          <p>Select a target system to view schema</p>
        </div>
      </div>
    </div>

    <!-- Footer Status Bar -->
    <div class="editor-footer">
      <div class="footer-status">
        <span v-if="lastSaved">
          Last saved: {{ formatTime(lastSaved) }}
        </span>
        <span v-else>Unsaved changes</span>
      </div>
      
      <div class="footer-actions">
        <button @click="validateMapping" class="btn-small">
          <ValidateIcon />
          Validate
        </button>
        <button @click="previewMapping" class="btn-small" :disabled="mappings.length === 0">
          <PreviewIcon />
          Preview
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMappingStore } from '@/stores/mapping'
import { useSystemStore } from '@/stores/system'
import { useAppStore } from '@/stores/app'
import SchemaPanel from '@/components/SchemaPanel/SchemaPanel.vue'
import schemaService from '@/services/schemaService'
import { mappingApi } from '@/services/api'
import {
  ArrowLeftIcon,
  SaveIcon,
  EmptyStateIcon,
  AutoMapIcon,
  InfoIcon,
  FieldIcon,
  CloseIcon,
  ValidateIcon,
  PreviewIcon
} from '@/components/icons'

export default {
  name: 'MappingEditor',
  
  components: {
    SchemaPanel,
    ArrowLeftIcon,
    SaveIcon,
    EmptyStateIcon,
    AutoMapIcon,
    InfoIcon,
    FieldIcon,
    CloseIcon,
    ValidateIcon,
    PreviewIcon
  },
  
  setup() {
    const route = useRoute()
    const router = useRouter()
    const mappingStore = useMappingStore()
    const systemStore = useSystemStore()
    const appStore = useAppStore()
    
    // State
    const mappingId = ref(route.params.id || null)
    const isEditMode = computed(() => !!mappingId.value)
    
    // Mapping configuration
    const mappingName = ref('')
    const mappingDescription = ref('')
    const sourceSystemId = ref('')
    const targetSystemId = ref('')
    
    // Schema states
    const sourceSchema = ref(null)
    const targetSchema = ref(null)
    const sourceLoading = ref(false)
    const targetLoading = ref(false)
    const sourceError = ref(null)
    const targetError = ref(null)
    
    // Mappings
    const mappings = ref([])
    const draggedField = ref(null)
    
    // UI states
    const saving = ref(false)
    const lastSaved = ref(null)
    const hasUnsavedChanges = ref(false)
    
    // Computed
    const availableSystems = computed(() => systemStore.systems || [])
    
    const canSave = computed(() => {
      return mappingName.value && 
             sourceSystemId.value && 
             targetSystemId.value && 
             mappings.value.length > 0
    })
    
    const canAutoMap = computed(() => {
      return sourceSchema.value && targetSchema.value
    })
    
    const unmappedSourceFields = computed(() => {
      if (!sourceSchema.value) return 0
      
      const mappedFields = new Set(mappings.value.map(m => 
        `${m.source.tableName}.${m.source.name}`
      ))
      
      let totalFields = 0
      sourceSchema.value.tables?.forEach(table => {
        table.columns?.forEach(column => {
          const fieldKey = `${table.name}.${column.name}`
          if (!mappedFields.has(fieldKey)) {
            totalFields++
          }
        })
      })
      
      return totalFields
    })
    
    // Methods
    const handleBack = () => {
      if (hasUnsavedChanges.value) {
        if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
          return
        }
      }
      router.push('/mappings')
    }
    
    const handleSourceSystemChange = async () => {
      if (!sourceSystemId.value) {
        sourceSchema.value = null
        return
      }
      
      sourceLoading.value = true
      sourceError.value = null
      
      try {
        sourceSchema.value = await schemaService.discoverSchema(sourceSystemId.value)
      } catch (error) {
        sourceError.value = error.message
        sourceSchema.value = null
      } finally {
        sourceLoading.value = false
      }
    }
    
    const handleTargetSystemChange = async () => {
      if (!targetSystemId.value) {
        targetSchema.value = null
        return
      }
      
      targetLoading.value = true
      targetError.value = null
      
      try {
        targetSchema.value = await schemaService.discoverSchema(targetSystemId.value)
      } catch (error) {
        targetError.value = error.message
        targetSchema.value = null
      } finally {
        targetLoading.value = false
      }
    }
    
    const refreshSourceSchema = async () => {
      sourceLoading.value = true
      sourceError.value = null
      
      try {
        sourceSchema.value = await schemaService.refreshSchema(sourceSystemId.value)
      } catch (error) {
        sourceError.value = error.message
      } finally {
        sourceLoading.value = false
      }
    }
    
    const refreshTargetSchema = async () => {
      targetLoading.value = true
      targetError.value = null
      
      try {
        targetSchema.value = await schemaService.refreshSchema(targetSystemId.value)
      } catch (error) {
        targetError.value = error.message
      } finally {
        targetLoading.value = false
      }
    }
    
    const handleFieldSelect = (data) => {
      console.log('Field selected:', data)
    }
    
    const handleFieldDragStart = (data) => {
      draggedField.value = data.field
    }
    
    const handleFieldDragEnd = () => {
      draggedField.value = null
    }
    
    const handleFieldDrop = (data) => {
      if (draggedField.value && data.targetField) {
        // Check if mapping already exists
        const exists = mappings.value.some(m => 
          m.source.tableName === draggedField.value.tableName &&
          m.source.name === draggedField.value.name &&
          m.target.tableName === data.targetField.tableName &&
          m.target.name === data.targetField.name
        )
        
        if (!exists) {
          mappings.value.push({
            source: draggedField.value,
            target: data.targetField,
            transformations: []
          })
          hasUnsavedChanges.value = true
        }
      }
      draggedField.value = null
    }
    
    const removeMapping = (index) => {
      mappings.value.splice(index, 1)
      hasUnsavedChanges.value = true
    }
    
    const autoMap = async () => {
      if (!sourceSchema.value || !targetSchema.value) return
      
      // Simple auto-mapping based on field names
      const newMappings = []
      
      sourceSchema.value.tables?.forEach(sourceTable => {
        targetSchema.value.tables?.forEach(targetTable => {
          sourceTable.columns?.forEach(sourceColumn => {
            targetTable.columns?.forEach(targetColumn => {
              // Match by name (case insensitive)
              if (sourceColumn.name.toLowerCase() === targetColumn.name.toLowerCase()) {
                // Check if mapping already exists
                const exists = mappings.value.some(m => 
                  m.source.tableName === sourceTable.name &&
                  m.source.name === sourceColumn.name &&
                  m.target.tableName === targetTable.name &&
                  m.target.name === targetColumn.name
                )
                
                if (!exists) {
                  newMappings.push({
                    source: {
                      ...sourceColumn,
                      tableName: sourceTable.name
                    },
                    target: {
                      ...targetColumn,
                      tableName: targetTable.name
                    },
                    transformations: []
                  })
                }
              }
            })
          })
        })
      })
      
      if (newMappings.length > 0) {
        mappings.value.push(...newMappings)
        hasUnsavedChanges.value = true
        appStore.showSuccess(`Auto-mapped ${newMappings.length} fields`)
      } else {
        appStore.showWarning('No matching fields found for auto-mapping')
      }
    }
    
    const validateMapping = async () => {
      // This will be implemented with backend validation
      appStore.showInfo('Mapping validation will be implemented with backend integration')
    }
    
    const previewMapping = async () => {
      // This will be implemented to show mapping preview
      appStore.showInfo('Mapping preview will be implemented with transformation editor')
    }
    
    const handleSave = async () => {
      if (!canSave.value) return
      
      saving.value = true
      
      try {
        const mappingData = {
          name: mappingName.value,
          description: mappingDescription.value,
          sourceSystemId: sourceSystemId.value,
          targetSystemId: targetSystemId.value,
          fieldMappings: mappings.value,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        if (isEditMode.value) {
          await mappingApi.update(mappingId.value, mappingData)
          appStore.showSuccess('Mapping updated successfully')
        } else {
          const response = await mappingApi.create(mappingData)
          mappingId.value = response.data.id
          appStore.showSuccess('Mapping created successfully')
          
          // Navigate to edit mode
          router.replace(`/mappings/${mappingId.value}/edit`)
        }
        
        lastSaved.value = new Date()
        hasUnsavedChanges.value = false
        
      } catch (error) {
        appStore.showError(error.message || 'Failed to save mapping')
      } finally {
        saving.value = false
      }
    }
    
    const handleCancel = () => {
      handleBack()
    }
    
    const formatTime = (date) => {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date)
    }
    
    // Load existing mapping in edit mode
    const loadMapping = async () => {
      if (!isEditMode.value) return
      
      try {
        const response = await mappingApi.getById(mappingId.value)
        const mapping = response.data
        
        mappingName.value = mapping.name
        mappingDescription.value = mapping.description || ''
        sourceSystemId.value = mapping.sourceSystemId
        targetSystemId.value = mapping.targetSystemId
        mappings.value = mapping.fieldMappings || []
        
        // Load schemas
        await Promise.all([
          handleSourceSystemChange(),
          handleTargetSystemChange()
        ])
        
      } catch (error) {
        appStore.showError('Failed to load mapping')
        router.push('/mappings')
      }
    }
    
    // Lifecycle
    onMounted(async () => {
      // Load systems
      await systemStore.fetchSystems()
      
      // Load mapping if in edit mode
      if (isEditMode.value) {
        await loadMapping()
      }
    })
    
    // Warn about unsaved changes
    onBeforeUnmount(() => {
      if (hasUnsavedChanges.value) {
        return confirm('You have unsaved changes. Are you sure you want to leave?')
      }
    })
    
    // Watch for changes
    watch([mappingName, mappingDescription, sourceSystemId, targetSystemId], () => {
      if (mappingName.value || mappingDescription.value || sourceSystemId.value || targetSystemId.value) {
        hasUnsavedChanges.value = true
      }
    })
    
    return {
      // State
      isEditMode,
      mappingName,
      mappingDescription,
      sourceSystemId,
      targetSystemId,
      sourceSchema,
      targetSchema,
      sourceLoading,
      targetLoading,
      sourceError,
      targetError,
      mappings,
      saving,
      lastSaved,
      hasUnsavedChanges,
      
      // Computed
      availableSystems,
      canSave,
      canAutoMap,
      unmappedSourceFields,
      
      // Methods
      handleBack,
      handleSourceSystemChange,
      handleTargetSystemChange,
      refreshSourceSchema,
      refreshTargetSchema,
      handleFieldSelect,
      handleFieldDragStart,
      handleFieldDragEnd,
      handleFieldDrop,
      removeMapping,
      autoMap,
      validateMapping,
      previewMapping,
      handleSave,
      handleCancel,
      formatTime
    }
  }
}
</script>

<style scoped>
.mapping-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-background);
}

/* Header */
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.editor-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Mapping Configuration */
.mapping-config {
  padding: 20px 24px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
}

.config-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.config-field label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.input-field {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text);
  transition: border-color 0.2s;
}

.input-field:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Main Content */
.editor-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 300px 1fr;
  gap: 0;
  overflow: hidden;
}

.schema-column {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
}

.target-column {
  border-right: none;
  border-left: 1px solid var(--color-border);
}

.column-header {
  padding: 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
}

.column-header h2 {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.system-select {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text);
  cursor: pointer;
}

.empty-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.empty-panel svg {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
}

/* Mapping Canvas */
.mapping-canvas {
  display: flex;
  flex-direction: column;
  background: var(--color-background-mute);
}

.canvas-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
}

.canvas-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.canvas-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mapping-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.no-mappings {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-secondary);
  text-align: center;
}

.no-mappings svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.mapping-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mapping-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
}

.mapping-source,
.mapping-target {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.mapping-arrow {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.remove-mapping {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-mapping:hover {
  background: var(--color-danger);
  color: white;
}

.mapping-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-top: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.mapping-stats .warning {
  color: var(--color-warning);
}

/* Footer */
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--color-background-soft);
  border-top: 1px solid var(--color-border);
}

.footer-status {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-small {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
  background: transparent;
  border: 1px solid var(--color-border);
}

.btn-small:hover:not(:disabled) {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .mapping-editor {
    background: var(--color-background-dark);
  }
  
  .editor-header,
  .mapping-config,
  .column-header,
  .canvas-header {
    background: var(--color-background-soft-dark);
  }
  
  .mapping-canvas {
    background: var(--color-background-mute-dark);
  }
}

/* Responsive */
@media (max-width: 1200px) {
  .editor-content {
    grid-template-columns: 1fr 250px 1fr;
  }
}

@media (max-width: 900px) {
  .editor-content {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto 1fr;
  }
  
  .schema-column {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
  
  .target-column {
    border-left: none;
    border-top: 1px solid var(--color-border);
  }
}
</style>