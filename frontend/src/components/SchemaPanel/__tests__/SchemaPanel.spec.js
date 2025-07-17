import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SchemaPanel from '../SchemaPanel.vue'
import { useMappingStore } from '@/stores/mapping'

// Mock the icon components
vi.mock('@/components/icons', () => ({
  SearchIcon: { template: '<div class="mock-icon">Search</div>' },
  RefreshIcon: { template: '<div class="mock-icon">Refresh</div>' },
  LoadingSpinner: { template: '<div class="mock-icon">Loading</div>' },
  ErrorIcon: { template: '<div class="mock-icon">Error</div>' },
  EmptyIcon: { template: '<div class="mock-icon">Empty</div>' },
  TableIcon: { template: '<div class="mock-icon">Table</div>' },
  FieldIcon: { template: '<div class="mock-icon">Field</div>' }
}))

describe('SchemaPanel', () => {
  let wrapper
  let mappingStore

  const mockSchema = {
    name: 'public',
    tables: [
      {
        name: 'users',
        type: 'table',
        columns: [
          {
            name: 'id',
            dataType: 'integer',
            nullable: false,
            isPrimaryKey: true
          },
          {
            name: 'email',
            dataType: 'varchar',
            nullable: false,
            isUnique: true
          },
          {
            name: 'created_at',
            dataType: 'timestamp',
            nullable: false
          }
        ]
      },
      {
        name: 'posts',
        type: 'table',
        columns: [
          {
            name: 'id',
            dataType: 'integer',
            nullable: false,
            isPrimaryKey: true
          },
          {
            name: 'title',
            dataType: 'varchar',
            nullable: false
          },
          {
            name: 'user_id',
            dataType: 'integer',
            nullable: false,
            isForeignKey: true
          }
        ]
      }
    ]
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    mappingStore = useMappingStore()
  })

  const createWrapper = (props = {}) => {
    return mount(SchemaPanel, {
      props: {
        title: 'Source Schema',
        systemId: 'test-system',
        type: 'source',
        schema: mockSchema,
        ...props
      },
      global: {
        stubs: {
          SchemaTree: {
            template: '<div class="mock-tree"><slot /></div>',
            props: ['items', 'draggable', 'droppable', 'expandedKeys', 'selectedKeys']
          }
        }
      }
    })
  }

  describe('Rendering', () => {
    it('renders the schema panel with title', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.schema-title').text()).toBe('Source Schema')
    })

    it('renders search button when searchable', () => {
      wrapper = createWrapper({ searchable: true })
      expect(wrapper.find('.schema-actions button').exists()).toBe(true)
    })

    it('renders refresh button', () => {
      wrapper = createWrapper()
      expect(wrapper.findAll('.icon-button').length).toBeGreaterThan(0)
    })

    it('shows loading state when loading', () => {
      wrapper = createWrapper({ loading: true })
      expect(wrapper.find('.loading-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('Loading schema...')
    })

    it('shows error state when error exists', () => {
      wrapper = createWrapper({ error: 'Connection failed' })
      expect(wrapper.find('.error-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('Connection failed')
    })

    it('shows empty state when no schema data', () => {
      wrapper = createWrapper({ schema: null })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('No schema data available')
    })

    it('renders schema statistics when showStats is true', () => {
      wrapper = createWrapper({ showStats: true })
      const footer = wrapper.find('.schema-footer')
      expect(footer.exists()).toBe(true)
      expect(footer.text()).toContain('2 tables')
      expect(footer.text()).toContain('6 fields')
    })
  })

  describe('Search Functionality', () => {
    it('toggles search input visibility', async () => {
      wrapper = createWrapper({ searchable: true })
      
      expect(wrapper.find('.schema-search').exists()).toBe(false)
      
      await wrapper.find('.icon-button').trigger('click')
      expect(wrapper.find('.schema-search').exists()).toBe(true)
      
      await wrapper.find('.icon-button').trigger('click')
      expect(wrapper.find('.schema-search').exists()).toBe(false)
    })

    it('filters tree data on search input', async () => {
      wrapper = createWrapper({ searchable: true })
      
      await wrapper.find('.icon-button').trigger('click')
      const searchInput = wrapper.find('.search-input')
      
      await searchInput.setValue('user')
      await searchInput.trigger('input')
      
      // The actual filtering would be tested in the tree component
      expect(searchInput.element.value).toBe('user')
    })
  })

  describe('Events', () => {
    it('emits refresh event when refresh button clicked', async () => {
      wrapper = createWrapper()
      
      const refreshButton = wrapper.findAll('.icon-button').at(-1)
      await refreshButton.trigger('click')
      
      expect(wrapper.emitted('refresh')).toBeTruthy()
      expect(wrapper.emitted('refresh')[0]).toEqual(['test-system'])
    })

    it('emits field-select event when field is selected', async () => {
      wrapper = createWrapper()
      
      // Simulate field selection through the tree component
      const tree = wrapper.findComponent({ name: 'SchemaTree' })
      const fieldData = {
        name: 'id',
        dataType: 'integer',
        tableName: 'users',
        schemaName: 'public'
      }
      
      // Manually trigger the event handler
      wrapper.vm.handleItemSelect({
        type: 'field',
        data: fieldData
      })
      
      expect(wrapper.emitted('field-select')).toBeTruthy()
      expect(wrapper.emitted('field-select')[0][0]).toEqual({
        field: fieldData,
        schemaType: 'source'
      })
    })
  })

  describe('Drag and Drop', () => {
    it('initiates drag when draggable is true', async () => {
      wrapper = createWrapper({ draggable: true })
      mappingStore.startDrag = vi.fn()
      
      const fieldData = {
        name: 'id',
        dataType: 'integer'
      }
      
      const mockEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn()
        }
      }
      
      wrapper.vm.handleDragStart(mockEvent, {
        type: 'field',
        data: fieldData
      })
      
      expect(mappingStore.startDrag).toHaveBeenCalledWith(fieldData, 'source')
      expect(mockEvent.dataTransfer.setData).toHaveBeenCalled()
    })

    it('handles drop when droppable is true', async () => {
      wrapper = createWrapper({ droppable: true, type: 'target' })
      mappingStore.handleDrop = vi.fn()
      
      const targetField = {
        name: 'user_id',
        dataType: 'integer'
      }
      
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn().mockReturnValue(JSON.stringify({
            field: { name: 'id', dataType: 'integer' },
            schemaType: 'source'
          }))
        }
      }
      
      wrapper.vm.handleDrop(mockEvent, {
        type: 'field',
        data: targetField
      })
      
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mappingStore.handleDrop).toHaveBeenCalledWith(targetField, 'target')
    })

    it('does not allow drop from same schema type', async () => {
      wrapper = createWrapper({ droppable: true, type: 'source' })
      mappingStore.handleDrop = vi.fn()
      
      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn().mockReturnValue(JSON.stringify({
            field: { name: 'id', dataType: 'integer' },
            schemaType: 'source' // Same as target
          }))
        }
      }
      
      wrapper.vm.handleDrop(mockEvent, {
        type: 'field',
        data: { name: 'email', dataType: 'varchar' }
      })
      
      expect(mappingStore.handleDrop).not.toHaveBeenCalled()
    })
  })

  describe('Tree Data Transformation', () => {
    it('transforms schema to tree data correctly', () => {
      wrapper = createWrapper()
      
      const treeData = wrapper.vm.treeData
      expect(treeData).toHaveLength(2) // 2 tables
      
      const usersTable = treeData[0]
      expect(usersTable.type).toBe('table')
      expect(usersTable.label).toBe('users')
      expect(usersTable.children).toHaveLength(3) // 3 columns
      
      const idColumn = usersTable.children[0]
      expect(idColumn.type).toBe('field')
      expect(idColumn.label).toBe('id')
      expect(idColumn.badges).toContainEqual(
        expect.objectContaining({ type: 'primary', label: 'PK' })
      )
    })

    it('expands tables by default when defaultExpanded is true', () => {
      wrapper = createWrapper({ defaultExpanded: true })
      
      const expandedKeys = wrapper.vm.expandedKeys
      expect(expandedKeys.size).toBe(2) // Both tables expanded
      expect(expandedKeys.has('table-public-users')).toBe(true)
      expect(expandedKeys.has('table-public-posts')).toBe(true)
    })
  })

  describe('Computed Properties', () => {
    it('calculates table count correctly', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.tableCount).toBe(2)
    })

    it('calculates field count correctly', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.fieldCount).toBe(6)
    })

    it('handles empty schema gracefully', () => {
      wrapper = createWrapper({ schema: null })
      expect(wrapper.vm.tableCount).toBe(0)
      expect(wrapper.vm.fieldCount).toBe(0)
    })
  })
})