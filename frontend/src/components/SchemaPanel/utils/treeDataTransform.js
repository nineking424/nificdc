/**
 * Transform schema data into tree structure for visualization
 * @param {Object} schema - Schema object with tables and columns
 * @returns {Array} Tree data array
 */
export function transformSchemaToTreeData(schema) {
  if (!schema || !schema.tables) {
    return []
  }

  return schema.tables.map((table, tableIndex) => {
    const tableNode = {
      id: `table-${schema.name}-${table.name}`,
      type: 'table',
      label: table.name,
      data: table,
      meta: `${table.columns?.length || 0} columns`,
      badges: [],
      children: []
    }

    // Add table type badge if not a regular table
    if (table.type && table.type !== 'table') {
      tableNode.badges.push({
        type: 'info',
        label: table.type,
        tooltip: `This is a ${table.type}`
      })
    }

    // Transform columns
    if (table.columns && Array.isArray(table.columns)) {
      tableNode.children = table.columns.map((column, columnIndex) => {
        const columnNode = {
          id: `field-${schema.name}-${table.name}-${column.name}`,
          type: 'field',
          label: column.name,
          data: {
            ...column,
            tableName: table.name,
            schemaName: schema.name
          },
          meta: formatDataType(column),
          badges: []
        }

        // Add badges for column properties
        if (column.isPrimaryKey) {
          columnNode.badges.push({
            type: 'primary',
            label: 'PK',
            tooltip: 'Primary Key'
          })
        }

        if (column.isForeignKey) {
          columnNode.badges.push({
            type: 'info',
            label: 'FK',
            tooltip: 'Foreign Key'
          })
        }

        if (column.isUnique) {
          columnNode.badges.push({
            type: 'unique',
            label: 'UQ',
            tooltip: 'Unique'
          })
        }

        if (!column.nullable) {
          columnNode.badges.push({
            type: 'required',
            label: 'NN',
            tooltip: 'Not Null'
          })
        }

        if (column.isIndexed) {
          columnNode.badges.push({
            type: 'indexed',
            label: 'IX',
            tooltip: 'Indexed'
          })
        }

        return columnNode
      })
    }

    return tableNode
  })
}

/**
 * Format data type for display
 * @param {Object} column - Column object
 * @returns {string} Formatted data type
 */
function formatDataType(column) {
  let type = column.dataType || column.type || 'unknown'
  
  // Add length/precision info if available
  if (column.length) {
    type += `(${column.length})`
  } else if (column.precision) {
    if (column.scale) {
      type += `(${column.precision},${column.scale})`
    } else {
      type += `(${column.precision})`
    }
  }

  return type.toLowerCase()
}

/**
 * Filter tree data based on search query
 * @param {Array} treeData - Original tree data
 * @param {string} query - Search query
 * @returns {Array} Filtered tree data
 */
export function filterTreeData(treeData, query) {
  if (!query) return treeData

  const lowerQuery = query.toLowerCase()
  const filteredData = []

  treeData.forEach(tableNode => {
    // Check if table name matches
    const tableMatches = tableNode.label.toLowerCase().includes(lowerQuery)
    
    // Filter columns
    const matchingColumns = tableNode.children.filter(columnNode => 
      columnNode.label.toLowerCase().includes(lowerQuery) ||
      columnNode.meta.toLowerCase().includes(lowerQuery)
    )

    // Include table if it matches or has matching columns
    if (tableMatches || matchingColumns.length > 0) {
      filteredData.push({
        ...tableNode,
        children: tableMatches ? tableNode.children : matchingColumns
      })
    }
  })

  return filteredData
}

/**
 * Get statistics from tree data
 * @param {Array} treeData - Tree data
 * @returns {Object} Statistics object
 */
export function getTreeStats(treeData) {
  let tableCount = 0
  let fieldCount = 0
  let primaryKeyCount = 0
  let foreignKeyCount = 0

  treeData.forEach(tableNode => {
    if (tableNode.type === 'table') {
      tableCount++
      
      tableNode.children.forEach(columnNode => {
        if (columnNode.type === 'field') {
          fieldCount++
          
          const column = columnNode.data
          if (column.isPrimaryKey) primaryKeyCount++
          if (column.isForeignKey) foreignKeyCount++
        }
      })
    }
  })

  return {
    tableCount,
    fieldCount,
    primaryKeyCount,
    foreignKeyCount
  }
}

/**
 * Find node by ID in tree data
 * @param {Array} treeData - Tree data
 * @param {string} nodeId - Node ID to find
 * @returns {Object|null} Found node or null
 */
export function findNodeById(treeData, nodeId) {
  for (const node of treeData) {
    if (node.id === nodeId) {
      return node
    }
    
    if (node.children) {
      const found = findNodeById(node.children, nodeId)
      if (found) return found
    }
  }
  
  return null
}

/**
 * Expand all nodes up to a certain level
 * @param {Array} treeData - Tree data
 * @param {number} maxLevel - Maximum level to expand
 * @returns {Set} Set of expanded node IDs
 */
export function expandToLevel(treeData, maxLevel = 1) {
  const expanded = new Set()
  
  function traverse(nodes, level = 0) {
    if (level >= maxLevel) return
    
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        expanded.add(node.id)
        traverse(node.children, level + 1)
      }
    })
  }
  
  traverse(treeData)
  return expanded
}

/**
 * Get all field nodes from tree data
 * @param {Array} treeData - Tree data
 * @returns {Array} Array of field nodes
 */
export function getAllFields(treeData) {
  const fields = []
  
  function traverse(nodes) {
    nodes.forEach(node => {
      if (node.type === 'field') {
        fields.push(node)
      } else if (node.children) {
        traverse(node.children)
      }
    })
  }
  
  traverse(treeData)
  return fields
}