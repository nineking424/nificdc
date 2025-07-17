<template>
  <div class="schema-tree">
    <SchemaTreeNode
      v-for="item in items"
      :key="item.id"
      :item="item"
      :level="0"
      :draggable="draggable"
      :droppable="droppable"
      :expanded="expandedKeys.has(item.id)"
      :selected="selectedKeys.has(item.id)"
      @expand="handleExpand"
      @select="handleSelect"
      @drag-start="handleDragStart"
      @drag-end="handleDragEnd"
      @drop="handleDrop"
    />
  </div>
</template>

<script>
import { toRefs } from 'vue'
import SchemaTreeNode from './SchemaTreeNode.vue'

export default {
  name: 'SchemaTree',
  
  components: {
    SchemaTreeNode
  },

  props: {
    items: {
      type: Array,
      required: true
    },
    draggable: {
      type: Boolean,
      default: false
    },
    droppable: {
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

  emits: [
    'item-expand',
    'item-select',
    'item-drag-start',
    'item-drag-end',
    'item-drop'
  ],

  setup(props, { emit }) {
    const { expandedKeys, selectedKeys } = toRefs(props)

    const handleExpand = (item) => {
      emit('item-expand', item)
    }

    const handleSelect = (item) => {
      emit('item-select', item)
    }

    const handleDragStart = (event, item) => {
      emit('item-drag-start', event, item)
    }

    const handleDragEnd = (event, item) => {
      emit('item-drag-end', event, item)
    }

    const handleDrop = (event, item) => {
      emit('item-drop', event, item)
    }

    return {
      handleExpand,
      handleSelect,
      handleDragStart,
      handleDragEnd,
      handleDrop
    }
  }
}
</script>

<style scoped>
.schema-tree {
  font-family: var(--font-family-mono);
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text);
}
</style>