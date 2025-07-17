<template>
  <div class="mapping-wizard-overlay">
    <div class="mapping-wizard">
      <!-- Wizard Header -->
      <div class="wizard-header">
        <div class="wizard-title">
          <h1>Create New Mapping</h1>
          <p>Follow these steps to create a new data mapping</p>
        </div>
        <button @click="closeWizard" class="close-button">
          <v-icon size="24">mdi-close</v-icon>
        </button>
      </div>

      <!-- Progress Steps -->
      <div class="wizard-progress">
        <div 
          v-for="(step, index) in wizardSteps" 
          :key="index"
          class="progress-step"
          :class="{ 
            'active': currentStep === index,
            'completed': index < currentStep,
            'disabled': index > currentStep
          }"
        >
          <div class="step-circle">
            <v-icon v-if="index < currentStep" size="16">mdi-check</v-icon>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <div class="step-info">
            <div class="step-title">{{ step.title }}</div>
            <div class="step-description">{{ step.description }}</div>
          </div>
        </div>
      </div>

      <!-- Wizard Content -->
      <div class="wizard-content">
        <!-- Step 1: Template Selection -->
        <div v-if="currentStep === 0" class="wizard-step">
          <div class="step-header">
            <h2>Choose How to Start</h2>
            <p>Select a template for quick setup or start from scratch</p>
          </div>
          
          <div class="template-options">
            <div class="template-section">
              <h3>📋 Quick Start Templates</h3>
              <div class="template-grid">
                <div 
                  v-for="template in mappingTemplates" 
                  :key="template.id"
                  class="template-card"
                  :class="{ 'selected': selectedTemplate === template.id }"
                  @click="selectTemplate(template.id)"
                >
                  <div class="template-icon">
                    <v-icon size="32">{{ template.icon }}</v-icon>
                  </div>
                  <div class="template-info">
                    <h4>{{ template.name }}</h4>
                    <p>{{ template.description }}</p>
                    <div class="template-tags">
                      <span 
                        v-for="tag in template.tags" 
                        :key="tag"
                        class="template-tag"
                      >
                        {{ tag }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="template-section">
              <h3>🛠️ Custom Setup</h3>
              <div class="custom-option">
                <div 
                  class="template-card"
                  :class="{ 'selected': selectedTemplate === 'custom' }"
                  @click="selectTemplate('custom')"
                >
                  <div class="template-icon">
                    <v-icon size="32">mdi-cog</v-icon>
                  </div>
                  <div class="template-info">
                    <h4>Start from Scratch</h4>
                    <p>Create a completely custom mapping with full control over every aspect</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Basic Information -->
        <div v-if="currentStep === 1" class="wizard-step">
          <div class="step-header">
            <h2>Basic Information</h2>
            <p>Provide basic details about your mapping</p>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">
                Mapping Name <span class="required">*</span>
              </label>
              <input 
                v-model="mappingForm.name" 
                type="text" 
                class="clean-form-input"
                placeholder="e.g., User Data Sync"
                @input="validateStep2"
              />
              <div v-if="errors.name" class="error-message">
                <v-icon size="16">mdi-alert-circle</v-icon>
                {{ errors.name }}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea 
                v-model="mappingForm.description" 
                class="clean-form-input"
                placeholder="Describe what this mapping does..."
                rows="3"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Purpose</label>
              <select v-model="mappingForm.purpose" class="clean-form-input">
                <option value="">Select purpose...</option>
                <option value="data-sync">Data Synchronization</option>
                <option value="migration">Data Migration</option>
                <option value="integration">System Integration</option>
                <option value="backup">Backup/Archive</option>
                <option value="analytics">Analytics/Reporting</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Frequency</label>
              <select v-model="mappingForm.frequency" class="clean-form-input">
                <option value="">Select frequency...</option>
                <option value="real-time">Real-time</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="on-demand">On-demand</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Step 3: Source System -->
        <div v-if="currentStep === 2" class="wizard-step">
          <div class="step-header">
            <h2>Source System</h2>
            <p>Select where your data will come from</p>
          </div>
          
          <div class="system-selection">
            <div class="system-grid">
              <div 
                v-for="system in availableSystems" 
                :key="system.id"
                class="system-card"
                :class="{ 
                  'selected': mappingForm.sourceSystemId === system.id,
                  'disabled': system.status !== 'connected'
                }"
                @click="selectSourceSystem(system)"
              >
                <div class="system-icon">
                  <v-icon size="32">{{ getSystemIcon(system.type) }}</v-icon>
                </div>
                <div class="system-info">
                  <h4>{{ system.name }}</h4>
                  <p class="system-type">{{ system.type }}</p>
                  <p class="system-url">{{ system.connectionUrl }}</p>
                  <div class="system-status" :class="system.status">
                    <v-icon size="16">{{ getStatusIcon(system.status) }}</v-icon>
                    {{ getStatusText(system.status) }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="mappingForm.sourceSystemId" class="system-preview">
              <h4>📊 Source System Preview</h4>
              <div class="preview-stats">
                <div class="stat-item">
                  <span class="stat-label">Tables:</span>
                  <span class="stat-value">{{ sourceSystemStats.tables || 0 }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Estimated Records:</span>
                  <span class="stat-value">{{ formatNumber(sourceSystemStats.records || 0) }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Last Updated:</span>
                  <span class="stat-value">{{ formatDate(sourceSystemStats.lastUpdated) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Target System -->
        <div v-if="currentStep === 3" class="wizard-step">
          <div class="step-header">
            <h2>Target System</h2>
            <p>Select where your data will go</p>
          </div>
          
          <div class="system-selection">
            <div class="system-grid">
              <div 
                v-for="system in availableTargetSystems" 
                :key="system.id"
                class="system-card"
                :class="{ 
                  'selected': mappingForm.targetSystemId === system.id,
                  'disabled': system.status !== 'connected'
                }"
                @click="selectTargetSystem(system)"
              >
                <div class="system-icon">
                  <v-icon size="32">{{ getSystemIcon(system.type) }}</v-icon>
                </div>
                <div class="system-info">
                  <h4>{{ system.name }}</h4>
                  <p class="system-type">{{ system.type }}</p>
                  <p class="system-url">{{ system.connectionUrl }}</p>
                  <div class="system-status" :class="system.status">
                    <v-icon size="16">{{ getStatusIcon(system.status) }}</v-icon>
                    {{ getStatusText(system.status) }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="mappingForm.targetSystemId" class="system-preview">
              <h4>🎯 Target System Preview</h4>
              <div class="preview-stats">
                <div class="stat-item">
                  <span class="stat-label">Tables:</span>
                  <span class="stat-value">{{ targetSystemStats.tables || 0 }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Available Space:</span>
                  <span class="stat-value">{{ targetSystemStats.availableSpace || 'Unlimited' }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Write Performance:</span>
                  <span class="stat-value">{{ targetSystemStats.writePerformance || 'Good' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 5: Mapping Strategy -->
        <div v-if="currentStep === 4" class="wizard-step">
          <div class="step-header">
            <h2>Mapping Strategy</h2>
            <p>Choose how to create field mappings</p>
          </div>
          
          <div class="strategy-options">
            <div 
              v-for="strategy in mappingStrategies" 
              :key="strategy.id"
              class="strategy-card"
              :class="{ 'selected': mappingForm.strategy === strategy.id }"
              @click="selectStrategy(strategy.id)"
            >
              <div class="strategy-icon">
                <v-icon size="32">{{ strategy.icon }}</v-icon>
              </div>
              <div class="strategy-info">
                <h4>{{ strategy.name }}</h4>
                <p>{{ strategy.description }}</p>
                <div class="strategy-features">
                  <div 
                    v-for="feature in strategy.features" 
                    :key="feature"
                    class="strategy-feature"
                  >
                    <v-icon size="16">mdi-check</v-icon>
                    {{ feature }}
                  </div>
                </div>
                <div class="strategy-recommendation">
                  <span class="recommendation-label">Best for:</span>
                  {{ strategy.bestFor }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 6: Review & Create -->
        <div v-if="currentStep === 5" class="wizard-step">
          <div class="step-header">
            <h2>Review & Create</h2>
            <p>Review your mapping configuration before creating</p>
          </div>
          
          <div class="review-sections">
            <div class="review-section">
              <h4>📋 Basic Information</h4>
              <div class="review-grid">
                <div class="review-item">
                  <span class="review-label">Name:</span>
                  <span class="review-value">{{ mappingForm.name }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Description:</span>
                  <span class="review-value">{{ mappingForm.description || 'No description' }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Purpose:</span>
                  <span class="review-value">{{ formatPurpose(mappingForm.purpose) }}</span>
                </div>
                <div class="review-item">
                  <span class="review-label">Frequency:</span>
                  <span class="review-value">{{ formatFrequency(mappingForm.frequency) }}</span>
                </div>
              </div>
            </div>

            <div class="review-section">
              <h4>🔄 Systems</h4>
              <div class="systems-flow">
                <div class="system-box source">
                  <div class="system-icon">
                    <v-icon size="24">{{ getSystemIcon(sourceSystem?.type) }}</v-icon>
                  </div>
                  <div class="system-details">
                    <h5>{{ sourceSystem?.name }}</h5>
                    <p>{{ sourceSystem?.type }}</p>
                  </div>
                </div>
                <div class="flow-arrow">
                  <v-icon size="24">mdi-arrow-right</v-icon>
                </div>
                <div class="system-box target">
                  <div class="system-icon">
                    <v-icon size="24">{{ getSystemIcon(targetSystem?.type) }}</v-icon>
                  </div>
                  <div class="system-details">
                    <h5>{{ targetSystem?.name }}</h5>
                    <p>{{ targetSystem?.type }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="review-section">
              <h4>⚙️ Strategy</h4>
              <div class="strategy-summary">
                <div class="strategy-icon">
                  <v-icon size="24">{{ selectedStrategyDetails?.icon }}</v-icon>
                </div>
                <div class="strategy-details">
                  <h5>{{ selectedStrategyDetails?.name }}</h5>
                  <p>{{ selectedStrategyDetails?.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Wizard Footer -->
      <div class="wizard-footer">
        <div class="footer-left">
          <button 
            v-if="currentStep > 0" 
            @click="previousStep" 
            class="clean-button clean-button-secondary"
          >
            <v-icon size="18">mdi-arrow-left</v-icon>
            Previous
          </button>
        </div>
        
        <div class="footer-right">
          <button 
            v-if="currentStep < wizardSteps.length - 1" 
            @click="nextStep" 
            class="clean-button clean-button-primary"
            :disabled="!canProceed"
          >
            Next
            <v-icon size="18">mdi-arrow-right</v-icon>
          </button>
          
          <button 
            v-if="currentStep === wizardSteps.length - 1" 
            @click="createMapping" 
            class="clean-button clean-button-primary"
            :disabled="creating"
          >
            <v-icon v-if="!creating" size="18">mdi-check</v-icon>
            <v-progress-circular v-else indeterminate size="16" width="2" />
            {{ creating ? 'Creating...' : 'Create Mapping' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/stores/system'
import { useAppStore } from '@/stores/app'
import { mappingApi } from '@/services/api'

export default {
  name: 'MappingCreationWizard',
  
  emits: ['close', 'created'],
  
  setup(props, { emit }) {
    const router = useRouter()
    const systemStore = useSystemStore()
    const appStore = useAppStore()
    
    // Wizard state
    const currentStep = ref(0)
    const creating = ref(false)
    const selectedTemplate = ref(null)
    
    // Form data
    const mappingForm = ref({
      name: '',
      description: '',
      purpose: '',
      frequency: '',
      sourceSystemId: '',
      targetSystemId: '',
      strategy: ''
    })
    
    // Validation errors
    const errors = ref({})
    
    // System stats
    const sourceSystemStats = ref({})
    const targetSystemStats = ref({})
    
    // Wizard steps configuration
    const wizardSteps = ref([
      {
        title: 'Template',
        description: 'Choose starting point'
      },
      {
        title: 'Basic Info',
        description: 'Name and purpose'
      },
      {
        title: 'Source',
        description: 'Data source system'
      },
      {
        title: 'Target',
        description: 'Data destination'
      },
      {
        title: 'Strategy',
        description: 'Mapping approach'
      },
      {
        title: 'Review',
        description: 'Final confirmation'
      }
    ])
    
    // Mapping templates
    const mappingTemplates = ref([
      {
        id: 'db-to-db',
        name: 'Database to Database',
        description: 'Copy data between relational databases',
        icon: 'mdi-database-sync',
        tags: ['SQL', 'PostgreSQL', 'MySQL'],
        config: {
          purpose: 'data-sync',
          frequency: 'daily',
          strategy: 'auto-smart'
        }
      },
      {
        id: 'api-to-db',
        name: 'API to Database',
        description: 'Import data from REST APIs to database',
        icon: 'mdi-api',
        tags: ['REST', 'JSON', 'Import'],
        config: {
          purpose: 'integration',
          frequency: 'hourly',
          strategy: 'manual'
        }
      },
      {
        id: 'file-to-db',
        name: 'File to Database',
        description: 'Load data from files (CSV, JSON, XML)',
        icon: 'mdi-file-upload',
        tags: ['CSV', 'JSON', 'XML'],
        config: {
          purpose: 'migration',
          frequency: 'on-demand',
          strategy: 'auto-smart'
        }
      },
      {
        id: 'realtime-sync',
        name: 'Real-time Sync',
        description: 'Live data synchronization with CDC',
        icon: 'mdi-sync',
        tags: ['Real-time', 'CDC', 'Streaming'],
        config: {
          purpose: 'data-sync',
          frequency: 'real-time',
          strategy: 'auto-smart'
        }
      }
    ])
    
    // Mapping strategies
    const mappingStrategies = ref([
      {
        id: 'auto-smart',
        name: 'Smart Auto-mapping',
        description: 'AI-powered field matching with manual review',
        icon: 'mdi-brain',
        features: [
          'Automatic field matching',
          'Type conversion suggestions',
          'Conflict resolution',
          'Manual override options'
        ],
        bestFor: 'Similar schemas with some differences'
      },
      {
        id: 'manual',
        name: 'Manual Mapping',
        description: 'Full control over every field mapping',
        icon: 'mdi-hand-pointing-up',
        features: [
          'Drag & drop interface',
          'Custom transformations',
          'Field validation',
          'Preview functionality'
        ],
        bestFor: 'Complex transformations and custom logic'
      },
      {
        id: 'hybrid',
        name: 'Hybrid Approach',
        description: 'Start with auto-mapping, then customize',
        icon: 'mdi-cog-sync',
        features: [
          'Auto-mapping foundation',
          'Manual refinement',
          'Incremental improvement',
          'Best of both worlds'
        ],
        bestFor: 'Balanced approach for most scenarios'
      }
    ])
    
    // Computed properties
    const availableSystems = computed(() => systemStore.systems || [])
    
    const availableTargetSystems = computed(() => {
      return availableSystems.value.filter(system => 
        system.id !== mappingForm.value.sourceSystemId
      )
    })
    
    const sourceSystem = computed(() => {
      return availableSystems.value.find(s => s.id === mappingForm.value.sourceSystemId)
    })
    
    const targetSystem = computed(() => {
      return availableSystems.value.find(s => s.id === mappingForm.value.targetSystemId)
    })
    
    const selectedStrategyDetails = computed(() => {
      return mappingStrategies.value.find(s => s.id === mappingForm.value.strategy)
    })
    
    const canProceed = computed(() => {
      switch (currentStep.value) {
        case 0:
          return selectedTemplate.value !== null
        case 1:
          return mappingForm.value.name && !errors.value.name
        case 2:
          return mappingForm.value.sourceSystemId
        case 3:
          return mappingForm.value.targetSystemId
        case 4:
          return mappingForm.value.strategy
        case 5:
          return true
        default:
          return false
      }
    })
    
    // Methods
    const closeWizard = () => {
      emit('close')
    }
    
    const selectTemplate = (templateId) => {
      selectedTemplate.value = templateId
      
      if (templateId !== 'custom') {
        const template = mappingTemplates.value.find(t => t.id === templateId)
        if (template) {
          // Apply template configuration
          Object.assign(mappingForm.value, template.config)
        }
      }
    }
    
    const validateStep2 = () => {
      errors.value = {}
      
      if (!mappingForm.value.name) {
        errors.value.name = 'Mapping name is required'
      } else if (mappingForm.value.name.length < 3) {
        errors.value.name = 'Mapping name must be at least 3 characters'
      }
    }
    
    const selectSourceSystem = (system) => {
      if (system.status !== 'connected') return
      
      mappingForm.value.sourceSystemId = system.id
      loadSystemStats(system.id, 'source')
    }
    
    const selectTargetSystem = (system) => {
      if (system.status !== 'connected') return
      
      mappingForm.value.targetSystemId = system.id
      loadSystemStats(system.id, 'target')
    }
    
    const selectStrategy = (strategyId) => {
      mappingForm.value.strategy = strategyId
    }
    
    const loadSystemStats = async (systemId, type) => {
      try {
        // Mock system stats - in real implementation, this would be an API call
        const mockStats = {
          tables: Math.floor(Math.random() * 20) + 5,
          records: Math.floor(Math.random() * 1000000) + 10000,
          lastUpdated: new Date(),
          availableSpace: '500 GB',
          writePerformance: 'Excellent'
        }
        
        if (type === 'source') {
          sourceSystemStats.value = mockStats
        } else {
          targetSystemStats.value = mockStats
        }
      } catch (error) {
        console.error('Failed to load system stats:', error)
      }
    }
    
    const previousStep = () => {
      if (currentStep.value > 0) {
        currentStep.value--
      }
    }
    
    const nextStep = () => {
      if (currentStep.value < wizardSteps.value.length - 1) {
        currentStep.value++
      }
    }
    
    const createMapping = async () => {
      creating.value = true
      
      try {
        const mappingData = {
          name: mappingForm.value.name,
          description: mappingForm.value.description,
          purpose: mappingForm.value.purpose,
          frequency: mappingForm.value.frequency,
          sourceSystemId: mappingForm.value.sourceSystemId,
          targetSystemId: mappingForm.value.targetSystemId,
          strategy: mappingForm.value.strategy,
          template: selectedTemplate.value,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        const response = await mappingApi.create(mappingData)
        
        appStore.showSuccess('Mapping created successfully!')
        
        // Navigate to the mapping editor
        router.push(`/mappings/${response.data.id}/edit`)
        
        emit('created', response.data)
        closeWizard()
        
      } catch (error) {
        appStore.showError(error.message || 'Failed to create mapping')
      } finally {
        creating.value = false
      }
    }
    
    // Utility functions
    const getSystemIcon = (type) => {
      const icons = {
        'postgresql': 'mdi-database',
        'mysql': 'mdi-database',
        'oracle': 'mdi-database',
        'sqlite': 'mdi-database-outline',
        'mongodb': 'mdi-leaf',
        'redis': 'mdi-memory',
        'api': 'mdi-api',
        'file': 'mdi-file',
        'sftp': 'mdi-folder-network',
        'ftp': 'mdi-folder-network',
        's3': 'mdi-aws',
        'azure': 'mdi-microsoft-azure'
      }
      return icons[type] || 'mdi-database'
    }
    
    const getStatusIcon = (status) => {
      const icons = {
        'connected': 'mdi-check-circle',
        'disconnected': 'mdi-alert-circle',
        'error': 'mdi-close-circle'
      }
      return icons[status] || 'mdi-help-circle'
    }
    
    const getStatusText = (status) => {
      const texts = {
        'connected': 'Connected',
        'disconnected': 'Disconnected',
        'error': 'Error'
      }
      return texts[status] || 'Unknown'
    }
    
    const formatNumber = (num) => {
      return new Intl.NumberFormat().format(num)
    }
    
    const formatDate = (date) => {
      if (!date) return 'Never'
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(date))
    }
    
    const formatPurpose = (purpose) => {
      const purposes = {
        'data-sync': 'Data Synchronization',
        'migration': 'Data Migration',
        'integration': 'System Integration',
        'backup': 'Backup/Archive',
        'analytics': 'Analytics/Reporting'
      }
      return purposes[purpose] || purpose
    }
    
    const formatFrequency = (frequency) => {
      const frequencies = {
        'real-time': 'Real-time',
        'hourly': 'Hourly',
        'daily': 'Daily',
        'weekly': 'Weekly',
        'monthly': 'Monthly',
        'on-demand': 'On-demand'
      }
      return frequencies[frequency] || frequency
    }
    
    // Lifecycle
    onMounted(async () => {
      // Load systems
      await systemStore.fetchSystems()
    })
    
    return {
      // State
      currentStep,
      creating,
      selectedTemplate,
      mappingForm,
      errors,
      sourceSystemStats,
      targetSystemStats,
      wizardSteps,
      mappingTemplates,
      mappingStrategies,
      
      // Computed
      availableSystems,
      availableTargetSystems,
      sourceSystem,
      targetSystem,
      selectedStrategyDetails,
      canProceed,
      
      // Methods
      closeWizard,
      selectTemplate,
      validateStep2,
      selectSourceSystem,
      selectTargetSystem,
      selectStrategy,
      previousStep,
      nextStep,
      createMapping,
      
      // Utilities
      getSystemIcon,
      getStatusIcon,
      getStatusText,
      formatNumber,
      formatDate,
      formatPurpose,
      formatFrequency
    }
  }
}
</script>

<style scoped>
.mapping-wizard-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.mapping-wizard {
  background: var(--white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2xl);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

/* Wizard Header */
.wizard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-100);
}

.wizard-title h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin: 0;
}

.wizard-title p {
  color: var(--gray-600);
  margin: var(--space-1) 0 0;
}

.close-button {
  background: none;
  border: none;
  padding: var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-base);
  color: var(--gray-400);
  transition: all var(--transition-base);
}

.close-button:hover {
  background: var(--gray-100);
  color: var(--gray-600);
}

/* Progress Steps */
.wizard-progress {
  display: flex;
  justify-content: space-between;
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-100);
  overflow-x: auto;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 120px;
  opacity: 0.5;
  transition: opacity var(--transition-base);
}

.progress-step.active,
.progress-step.completed {
  opacity: 1;
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-semibold);
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  transition: all var(--transition-base);
}

.progress-step.active .step-circle {
  background: var(--primary);
  color: var(--white);
}

.progress-step.completed .step-circle {
  background: var(--success);
  color: var(--white);
}

.step-info {
  flex: 1;
  min-width: 0;
}

.step-title {
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  font-size: var(--font-size-sm);
}

.step-description {
  color: var(--gray-600);
  font-size: var(--font-size-xs);
  margin-top: var(--space-1);
}

/* Wizard Content */
.wizard-content {
  flex: 1;
  padding: var(--space-6);
  overflow-y: auto;
}

.wizard-step {
  max-width: 100%;
}

.step-header {
  margin-bottom: var(--space-8);
  text-align: center;
}

.step-header h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.step-header p {
  color: var(--gray-600);
  margin: 0;
}

/* Template Selection */
.template-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.template-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-4);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
}

.template-card {
  background: var(--white);
  border: 2px solid var(--gray-100);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  gap: var(--space-4);
}

.template-card:hover {
  border-color: var(--primary-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.template-card.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.template-icon {
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--primary-soft);
  border-radius: var(--radius-base);
  flex-shrink: 0;
}

.template-info {
  flex: 1;
}

.template-info h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.template-info p {
  color: var(--gray-600);
  margin: 0 0 var(--space-3);
  line-height: 1.5;
}

.template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.template-tag {
  background: var(--gray-100);
  color: var(--gray-700);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
}

.custom-option {
  max-width: 400px;
}

/* Form Styles */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-weight: var(--font-semibold);
  color: var(--gray-700);
  font-size: var(--font-size-sm);
}

.required {
  color: var(--error);
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--error);
  font-size: var(--font-size-sm);
}

/* System Selection */
.system-selection {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.system-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-4);
}

.system-card {
  background: var(--white);
  border: 2px solid var(--gray-100);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  gap: var(--space-3);
}

.system-card:hover:not(.disabled) {
  border-color: var(--primary-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.system-card.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.system-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.system-icon {
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--primary-soft);
  border-radius: var(--radius-base);
  flex-shrink: 0;
}

.system-info {
  flex: 1;
}

.system-info h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-1);
}

.system-type {
  color: var(--gray-600);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-1);
  text-transform: uppercase;
  font-weight: var(--font-medium);
}

.system-url {
  color: var(--gray-500);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-2);
  font-family: var(--font-mono);
}

.system-status {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.system-status.connected {
  color: var(--success);
}

.system-status.disconnected {
  color: var(--warning);
}

.system-status.error {
  color: var(--error);
}

.system-preview {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.system-preview h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-3);
}

.preview-stats {
  display: flex;
  gap: var(--space-6);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

.stat-value {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
}

/* Strategy Options */
.strategy-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.strategy-card {
  background: var(--white);
  border: 2px solid var(--gray-100);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  gap: var(--space-4);
}

.strategy-card:hover {
  border-color: var(--primary-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.strategy-card.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.strategy-icon {
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--primary-soft);
  border-radius: var(--radius-base);
  flex-shrink: 0;
}

.strategy-info {
  flex: 1;
}

.strategy-info h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.strategy-info p {
  color: var(--gray-600);
  margin: 0 0 var(--space-3);
  line-height: 1.5;
}

.strategy-features {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.strategy-feature {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--gray-700);
}

.strategy-feature .v-icon {
  color: var(--success);
}

.strategy-recommendation {
  background: var(--gray-50);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-base);
  font-size: var(--font-size-sm);
}

.recommendation-label {
  font-weight: var(--font-semibold);
  color: var(--gray-700);
}

/* Review Section */
.review-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.review-section {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.review-section h4 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-4);
}

.review-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.review-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--gray-200);
}

.review-item:last-child {
  border-bottom: none;
}

.review-label {
  font-weight: var(--font-semibold);
  color: var(--gray-700);
}

.review-value {
  color: var(--gray-900);
  text-align: right;
}

.systems-flow {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.system-box {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-base);
  padding: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
}

.system-box.source {
  border-color: var(--primary-light);
}

.system-box.target {
  border-color: var(--success-light);
}

.system-details h5 {
  font-size: var(--font-size-sm);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0;
}

.system-details p {
  font-size: var(--font-size-xs);
  color: var(--gray-600);
  margin: 0;
  text-transform: uppercase;
}

.flow-arrow {
  color: var(--gray-400);
}

.strategy-summary {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-base);
  padding: var(--space-3);
}

.strategy-details h5 {
  font-size: var(--font-size-sm);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0;
}

.strategy-details p {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin: 0;
}

/* Wizard Footer */
.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-top: 1px solid var(--gray-100);
}

.footer-left,
.footer-right {
  display: flex;
  gap: var(--space-3);
}

/* Responsive */
@media (max-width: 768px) {
  .mapping-wizard {
    max-width: 100%;
    margin: var(--space-4);
  }
  
  .wizard-progress {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .progress-step {
    min-width: auto;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .template-grid {
    grid-template-columns: 1fr;
  }
  
  .system-grid {
    grid-template-columns: 1fr;
  }
  
  .preview-stats {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .review-grid {
    grid-template-columns: 1fr;
  }
  
  .systems-flow {
    flex-direction: column;
  }
  
  .flow-arrow {
    transform: rotate(90deg);
  }
}
</style>