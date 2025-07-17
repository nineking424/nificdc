<template>
  <div class="schema-panel-demo">
    <h1>Schema Panel Demo</h1>
    
    <div class="demo-controls">
      <label>
        <input type="checkbox" v-model="searchable"> Searchable
      </label>
      <label>
        <input type="checkbox" v-model="draggable"> Draggable (Source)
      </label>
      <label>
        <input type="checkbox" v-model="droppable"> Droppable (Target)
      </label>
      <label>
        <input type="checkbox" v-model="showStats"> Show Stats
      </label>
      <label>
        <input type="checkbox" v-model="defaultExpanded"> Default Expanded
      </label>
      <button @click="simulateLoading">Simulate Loading</button>
      <button @click="simulateError">Simulate Error</button>
    </div>

    <div class="panels-container">
      <div class="panel-wrapper">
        <SchemaPanel
          title="Source Database"
          :schema="sourceSchema"
          system-id="source-db"
          type="source"
          :loading="loading"
          :error="error"
          :searchable="searchable"
          :draggable="draggable"
          :droppable="false"
          :show-stats="showStats"
          :default-expanded="defaultExpanded"
          @refresh="handleRefresh"
          @field-select="handleFieldSelect"
          @field-drag-start="handleDragStart"
          @field-drag-end="handleDragEnd"
        />
      </div>

      <div class="panel-wrapper">
        <SchemaPanel
          title="Target Database"
          :schema="targetSchema"
          system-id="target-db"
          type="target"
          :loading="loading"
          :error="error"
          :searchable="searchable"
          :draggable="false"
          :droppable="droppable"
          :show-stats="showStats"
          :default-expanded="defaultExpanded"
          @refresh="handleRefresh"
          @field-select="handleFieldSelect"
          @field-drop="handleFieldDrop"
        />
      </div>
    </div>

    <div class="event-log">
      <h3>Event Log</h3>
      <div class="log-entries">
        <div v-for="(log, index) in eventLogs" :key="index" class="log-entry">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-event">{{ log.event }}</span>
          <span class="log-data">{{ log.data }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import SchemaPanel from './SchemaPanel.vue'

export default {
  name: 'SchemaPanelDemo',
  
  components: {
    SchemaPanel
  },

  setup() {
    // Demo state
    const loading = ref(false)
    const error = ref(null)
    const searchable = ref(true)
    const draggable = ref(true)
    const droppable = ref(true)
    const showStats = ref(true)
    const defaultExpanded = ref(false)
    const eventLogs = ref([])

    // Sample schemas
    const sourceSchema = ref({
      name: 'ecommerce',
      tables: [
        {
          name: 'customers',
          type: 'table',
          columns: [
            { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'email', dataType: 'varchar(255)', nullable: false, isUnique: true },
            { name: 'first_name', dataType: 'varchar(100)', nullable: false },
            { name: 'last_name', dataType: 'varchar(100)', nullable: false },
            { name: 'phone', dataType: 'varchar(20)', nullable: true },
            { name: 'created_at', dataType: 'timestamp', nullable: false },
            { name: 'updated_at', dataType: 'timestamp', nullable: false }
          ]
        },
        {
          name: 'orders',
          type: 'table',
          columns: [
            { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'customer_id', dataType: 'integer', nullable: false, isForeignKey: true },
            { name: 'order_number', dataType: 'varchar(50)', nullable: false, isUnique: true },
            { name: 'status', dataType: 'varchar(20)', nullable: false },
            { name: 'total_amount', dataType: 'decimal(10,2)', nullable: false },
            { name: 'order_date', dataType: 'date', nullable: false },
            { name: 'shipped_date', dataType: 'date', nullable: true }
          ]
        },
        {
          name: 'products',
          type: 'table',
          columns: [
            { name: 'id', dataType: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'sku', dataType: 'varchar(50)', nullable: false, isUnique: true },
            { name: 'name', dataType: 'varchar(255)', nullable: false },
            { name: 'description', dataType: 'text', nullable: true },
            { name: 'price', dataType: 'decimal(10,2)', nullable: false },
            { name: 'stock_quantity', dataType: 'integer', nullable: false },
            { name: 'category', dataType: 'varchar(100)', nullable: true },
            { name: 'is_active', dataType: 'boolean', nullable: false }
          ]
        }
      ]
    })

    const targetSchema = ref({
      name: 'analytics',
      tables: [
        {
          name: 'dim_customers',
          type: 'table',
          columns: [
            { name: 'customer_key', dataType: 'bigint', nullable: false, isPrimaryKey: true },
            { name: 'customer_id', dataType: 'integer', nullable: false },
            { name: 'email_address', dataType: 'varchar(500)', nullable: true },
            { name: 'full_name', dataType: 'varchar(500)', nullable: true },
            { name: 'phone_number', dataType: 'varchar(50)', nullable: true },
            { name: 'created_date', dataType: 'date', nullable: true },
            { name: 'last_updated', dataType: 'timestamp', nullable: false }
          ]
        },
        {
          name: 'fact_orders',
          type: 'table',
          columns: [
            { name: 'order_key', dataType: 'bigint', nullable: false, isPrimaryKey: true },
            { name: 'customer_key', dataType: 'bigint', nullable: false, isForeignKey: true },
            { name: 'order_id', dataType: 'varchar(100)', nullable: false },
            { name: 'order_status', dataType: 'varchar(50)', nullable: true },
            { name: 'total_revenue', dataType: 'numeric(15,2)', nullable: true },
            { name: 'order_date_key', dataType: 'integer', nullable: true },
            { name: 'ship_date_key', dataType: 'integer', nullable: true }
          ]
        }
      ]
    })

    // Event handlers
    const logEvent = (event, data) => {
      eventLogs.value.unshift({
        time: new Date().toLocaleTimeString(),
        event,
        data: JSON.stringify(data)
      })
      if (eventLogs.value.length > 10) {
        eventLogs.value.pop()
      }
    }

    const handleRefresh = (systemId) => {
      logEvent('refresh', { systemId })
    }

    const handleFieldSelect = (data) => {
      logEvent('field-select', data)
    }

    const handleDragStart = (data) => {
      logEvent('drag-start', data)
    }

    const handleDragEnd = () => {
      logEvent('drag-end', {})
    }

    const handleFieldDrop = (data) => {
      logEvent('field-drop', data)
    }

    const simulateLoading = () => {
      loading.value = true
      setTimeout(() => {
        loading.value = false
      }, 2000)
    }

    const simulateError = () => {
      error.value = 'Failed to connect to database'
      setTimeout(() => {
        error.value = null
      }, 3000)
    }

    return {
      loading,
      error,
      searchable,
      draggable,
      droppable,
      showStats,
      defaultExpanded,
      sourceSchema,
      targetSchema,
      eventLogs,
      handleRefresh,
      handleFieldSelect,
      handleDragStart,
      handleDragEnd,
      handleFieldDrop,
      simulateLoading,
      simulateError
    }
  }
}
</script>

<style scoped>
.schema-panel-demo {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.demo-controls {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.demo-controls label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.demo-controls button {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.demo-controls button:hover {
  background: #0056b3;
}

.panels-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.panel-wrapper {
  height: 600px;
}

.event-log {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
}

.event-log h3 {
  margin-top: 0;
}

.log-entries {
  font-family: monospace;
  font-size: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  display: grid;
  grid-template-columns: 80px 120px 1fr;
  gap: 10px;
  padding: 5px;
  border-bottom: 1px solid #dee2e6;
}

.log-time {
  color: #6c757d;
}

.log-event {
  color: #007bff;
  font-weight: bold;
}

.log-data {
  color: #495057;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>