/**
 * Schema Service
 * 
 * Provides comprehensive schema discovery and management functionality
 * with error handling, caching, and store integration
 */

import { schemaApi } from './api'
import { useAuthStore } from '@/stores/auth'
import { useMappingStore } from '@/stores/mapping'
import { useAppStore } from '@/stores/app'

// Cache for discovered schemas
const schemaCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

class SchemaService {
  /**
   * Discover schema from a system
   * @param {string} systemId - The system ID to discover schema from
   * @param {Object} options - Discovery options
   * @param {boolean} options.forceRefresh - Force refresh, ignore cache
   * @param {boolean} options.includeSystemSchemas - Include system schemas
   * @param {string} options.schemaPattern - Schema name pattern filter
   * @param {string} options.tablePattern - Table name pattern filter
   * @returns {Promise<Object>} Discovered schema data
   */
  async discoverSchema(systemId, options = {}) {
    const appStore = useAppStore()
    
    try {
      // Check cache first unless force refresh
      if (!options.forceRefresh) {
        const cached = this.getCachedSchema(systemId)
        if (cached) {
          console.log(`Returning cached schema for system ${systemId}`)
          return cached
        }
      }
      
      // Show loading state
      appStore.setLoading(true, 'Discovering schema...')
      
      // Call API
      const response = await schemaApi.discover(systemId, {
        forceRefresh: options.forceRefresh,
        includeSystemSchemas: options.includeSystemSchemas,
        schemaPattern: options.schemaPattern,
        tablePattern: options.tablePattern
      })
      
      // Cache the result
      this.cacheSchema(systemId, response.data)
      
      // Update mapping store
      const mappingStore = useMappingStore()
      mappingStore.setSystemSchema(systemId, response.data)
      
      appStore.setLoading(false)
      return response.data
      
    } catch (error) {
      appStore.setLoading(false)
      this.handleError(error, 'Failed to discover schema')
      throw error
    }
  }
  
  /**
   * Refresh schema (force re-discovery)
   * @param {string} systemId - The system ID
   * @returns {Promise<Object>} Refreshed schema data
   */
  async refreshSchema(systemId) {
    const appStore = useAppStore()
    
    try {
      appStore.setLoading(true, 'Refreshing schema...')
      
      // Clear cache
      this.clearCachedSchema(systemId)
      
      // Call refresh API
      await schemaApi.refresh(systemId)
      
      // Re-discover with fresh data
      return await this.discoverSchema(systemId, { forceRefresh: true })
      
    } catch (error) {
      appStore.setLoading(false)
      this.handleError(error, 'Failed to refresh schema')
      throw error
    }
  }
  
  /**
   * Get sample data for a table
   * @param {string} systemId - The system ID
   * @param {string} tableName - The table name
   * @param {number} limit - Number of rows to fetch
   * @returns {Promise<Array>} Sample data rows
   */
  async getSampleData(systemId, tableName, limit = 10) {
    try {
      const response = await schemaApi.getSampleData(systemId, tableName, limit)
      return response.data
    } catch (error) {
      this.handleError(error, `Failed to get sample data for ${tableName}`)
      throw error
    }
  }
  
  /**
   * Get table statistics
   * @param {string} systemId - The system ID
   * @param {string} tableName - The table name
   * @returns {Promise<Object>} Table statistics
   */
  async getTableStatistics(systemId, tableName) {
    try {
      const response = await schemaApi.getStatistics(systemId, tableName)
      return response.data
    } catch (error) {
      this.handleError(error, `Failed to get statistics for ${tableName}`)
      throw error
    }
  }
  
  /**
   * Compare schemas between two systems
   * @param {string} sourceSystemId - Source system ID
   * @param {string} targetSystemId - Target system ID
   * @returns {Promise<Object>} Schema comparison result
   */
  async compareSchemas(sourceSystemId, targetSystemId) {
    const appStore = useAppStore()
    
    try {
      appStore.setLoading(true, 'Comparing schemas...')
      
      const response = await schemaApi.compare(sourceSystemId, targetSystemId)
      
      appStore.setLoading(false)
      return response.data
      
    } catch (error) {
      appStore.setLoading(false)
      this.handleError(error, 'Failed to compare schemas')
      throw error
    }
  }
  
  /**
   * Get cached schema
   * @private
   * @param {string} systemId - The system ID
   * @returns {Object|null} Cached schema or null
   */
  getCachedSchema(systemId) {
    const cached = schemaCache.get(systemId)
    if (cached) {
      const age = Date.now() - cached.timestamp
      if (age < CACHE_TTL) {
        return cached.data
      }
      // Cache expired
      schemaCache.delete(systemId)
    }
    return null
  }
  
  /**
   * Cache schema data
   * @private
   * @param {string} systemId - The system ID
   * @param {Object} data - Schema data to cache
   */
  cacheSchema(systemId, data) {
    schemaCache.set(systemId, {
      data,
      timestamp: Date.now()
    })
  }
  
  /**
   * Clear cached schema
   * @private
   * @param {string} systemId - The system ID
   */
  clearCachedSchema(systemId) {
    schemaCache.delete(systemId)
  }
  
  /**
   * Clear all cached schemas
   */
  clearAllCache() {
    schemaCache.clear()
  }
  
  /**
   * Handle API errors
   * @private
   * @param {Error} error - The error object
   * @param {string} defaultMessage - Default error message
   */
  handleError(error, defaultMessage) {
    const appStore = useAppStore()
    
    let message = defaultMessage
    
    if (error.response) {
      // Server responded with error
      if (error.response.status === 401) {
        message = 'Authentication required. Please login again.'
        // Trigger logout
        const authStore = useAuthStore()
        authStore.logout()
      } else if (error.response.status === 403) {
        message = 'You do not have permission to perform this action.'
      } else if (error.response.status === 404) {
        message = 'The requested resource was not found.'
      } else if (error.response.data?.message) {
        message = error.response.data.message
      }
    } else if (error.request) {
      // Request made but no response
      message = 'Unable to connect to server. Please check your connection.'
    }
    
    appStore.showError(message)
    console.error('Schema Service Error:', error)
  }
  
  /**
   * Transform schema data for tree view
   * @param {Object} schema - Raw schema data
   * @returns {Array} Transformed tree data
   */
  transformForTreeView(schema) {
    if (!schema || !schema.tables) {
      return []
    }
    
    return schema.tables.map((table, tableIndex) => ({
      id: `table-${tableIndex}`,
      name: table.name,
      type: 'table',
      icon: 'table',
      data: table,
      children: table.columns?.map((column, columnIndex) => ({
        id: `table-${tableIndex}-column-${columnIndex}`,
        name: column.name,
        type: 'field',
        dataType: column.dataType,
        icon: this.getFieldIcon(column.dataType),
        data: {
          ...column,
          tableName: table.name
        },
        nullable: column.nullable,
        isPrimaryKey: column.isPrimaryKey,
        isForeignKey: column.isForeignKey,
        isUnique: column.isUnique
      })) || []
    }))
  }
  
  /**
   * Get appropriate icon for field data type
   * @private
   * @param {string} dataType - The field data type
   * @returns {string} Icon name
   */
  getFieldIcon(dataType) {
    const type = dataType.toLowerCase()
    
    if (type.includes('int') || type.includes('number')) return 'number'
    if (type.includes('varchar') || type.includes('text') || type.includes('string')) return 'text'
    if (type.includes('date') || type.includes('time')) return 'calendar'
    if (type.includes('bool')) return 'boolean'
    if (type.includes('decimal') || type.includes('float') || type.includes('money')) return 'currency'
    if (type.includes('json')) return 'json'
    if (type.includes('blob') || type.includes('binary')) return 'binary'
    
    return 'field'
  }
}

// Export singleton instance
export default new SchemaService()