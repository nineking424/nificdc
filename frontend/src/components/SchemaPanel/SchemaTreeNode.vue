<template>
  <div class="tree-node">
    <div 
      class="tree-node-content"
      :class="{
        'selected': selected,
        'draggable': isDraggable,
        'droppable': isDroppable,
        'drag-over': dragOver
      }"
      :style="{ paddingLeft: `${level * 20}px` }"
      @click="handleClick"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      :draggable="isDraggable"
    >
      <span 
        v-if="hasChildren"
        class="expand-icon"
        @click.stop="handleExpand"
      >
        <ChevronIcon :class="{ 'expanded': expanded }" />
      </span>
      <span v-else class="expand-spacer"></span>

      <component 
        :is="iconComponent"
        class="node-icon"
        :class="`icon-${item.type}`"
      />

      <span class="node-label">{{ item.label }}</span>

      <span v-if="item.meta" class="node-meta">
        {{ item.meta }}
      </span>

      <span v-if="item.badges && item.badges.length > 0" class="node-badges">
        <span 
          v-for="badge in item.badges"
          :key="badge.type"
          class="badge"
          :class="`badge-${badge.type}`"
          :title="badge.tooltip"
        >
          {{ badge.label }}
        </span>
      </span>
    </div>

    <div v-if="expanded && hasChildren" class="tree-node-children">
      <SchemaTreeNode
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :level="level + 1"
        :draggable="draggable"
        :droppable="droppable"
        :expanded="expandedKeys.has(child.id)"
        :selected="selectedKeys.has(child.id)"
        :expanded-keys="expandedKeys"
        :selected-keys="selectedKeys"
        @expand="$emit('expand', $event)"
        @select="$emit('select', $event)"
        @drag-start="$emit('drag-start', $event, child)"
        @drag-end="$emit('drag-end', $event, child)"
        @drop="$emit('drop', $event, child)"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { 
  ChevronIcon,
  TableIcon,
  FieldIcon,
  KeyIcon,
  IndexIcon
} from '@/components/icons'
import { getFieldIcon } from './utils/fieldIcons'

export default {
  name: 'SchemaTreeNode',
  
  components: {
    ChevronIcon,
    TableIcon,
    FieldIcon,
    KeyIcon,
    IndexIcon
  },

  props: {
    item: {
      type: Object,
      required: true
    },
    level: {
      type: Number,
      default: 0
    },
    draggable: {
      type: Boolean,
      default: false
    },
    droppable: {
      type: Boolean,
      default: false
    },
    expanded: {
      type: Boolean,
      default: false
    },
    selected: {
      type: Boolean,
      default: false
    },
    expandedKeys: {
      type: Set,
      default: () => new Set()
    },
    selectedKeys: {
      type: Set,
      default: () => new Set()
    }
  },

  emits: ['expand', 'select', 'drag-start', 'drag-end', 'drop'],

  setup(props, { emit }) {
    const dragOver = ref(false)

    const hasChildren = computed(() => {
      return props.item.children && props.item.children.length > 0
    })

    const isDraggable = computed(() => {
      return props.draggable && props.item.type === 'field'
    })

    const isDroppable = computed(() => {
      return props.droppable && props.item.type === 'field'
    })

    const iconComponent = computed(() => {
      if (props.item.type === 'table') {
        return TableIcon
      } else if (props.item.type === 'field') {
        return getFieldIcon(props.item.data?.dataType || props.item.data?.type)
      } else if (props.item.type === 'index') {
        return IndexIcon
      } else if (props.item.type === 'key') {
        return KeyIcon
      }
      return FieldIcon
    })

    const handleClick = () => {
      emit('select', props.item)
    }

    const handleExpand = () => {
      emit('expand', props.item)
    }

    const handleDragStart = (event) => {
      if (isDraggable.value) {
        event.dataTransfer.effectAllowed = 'copy'
        
        // Add visual feedback
        event.target.classList.add('dragging')
        
        // Set drag image (optional custom drag image)
        const dragImage = event.target.cloneNode(true)
        dragImage.style.position = 'absolute'
        dragImage.style.top = '-1000px'
        dragImage.style.opacity = '0.8'
        document.body.appendChild(dragImage)
        event.dataTransfer.setDragImage(dragImage, 0, 0)
        setTimeout(() => document.body.removeChild(dragImage), 0)
        
        emit('drag-start', event, props.item)
      }
    }

    const handleDragEnd = (event) => {
      event.target.classList.remove('dragging')
      emit('drag-end', event, props.item)
    }

    const handleDragOver = (event) => {
      if (isDroppable.value && canAcceptDrop(event)) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        dragOver.value = true
      }
    }

    const handleDragLeave = (event) => {
      // Only clear dragOver if we're actually leaving the element
      if (!event.currentTarget.contains(event.relatedTarget)) {
        dragOver.value = false
      }
    }

    const handleDrop = (event) => {
      if (isDroppable.value && canAcceptDrop(event)) {
        event.preventDefault()
        event.stopPropagation()
        dragOver.value = false
        emit('drop', event, props.item)
      }
    }
    
    // Helper to check if drop is acceptable
    const canAcceptDrop = (event) => {
      // Check if the drag data is compatible
      return event.dataTransfer.types.includes('application/json')
    }

    return {
      dragOver,
      hasChildren,
      isDraggable,
      isDroppable,
      iconComponent,
      handleClick,
      handleExpand,
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      handleDragLeave,
      handleDrop
    }
  }
}
</script>

<style scoped>
.tree-node {
  user-select: none;
}

.tree-node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.tree-node-content:hover {
  background: var(--color-background-mute);
}

.tree-node-content.selected {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.tree-node-content.draggable {
  cursor: move;
}

.tree-node-content.draggable:hover {
  background: var(--color-background-hover);
}

.tree-node-content.drag-over {
  background: var(--color-primary-soft);
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: transform 0.2s;
}

.expand-icon:hover {
  color: var(--color-text);
}

.expand-icon .expanded {
  transform: rotate(90deg);
}

.expand-spacer {
  width: 16px;
}

.node-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.node-icon.icon-table {
  color: var(--color-info);
}

.node-icon.icon-field {
  color: var(--color-text-secondary);
}

.node-label {
  flex: 1;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-left: auto;
  white-space: nowrap;
}

.node-badges {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 3px;
  white-space: nowrap;
}

.badge-primary {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.badge-required {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.badge-unique {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.badge-indexed {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.tree-node-children {
  margin-top: 2px;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .tree-node-content:hover {
    background: var(--color-background-mute-dark);
  }
  
  .tree-node-content.selected {
    background: var(--color-primary-soft-dark);
  }
}
</style>