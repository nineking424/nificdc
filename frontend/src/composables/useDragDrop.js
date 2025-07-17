import { ref, computed } from 'vue'

/**
 * Composable for handling drag and drop operations
 * @param {Object} options - Configuration options
 * @returns {Object} Drag and drop handlers and state
 */
export function useDragDrop(options = {}) {
  const {
    onDragStart = null,
    onDragEnd = null,
    onDrop = null,
    acceptTypes = null,
    dataTransferFormat = 'application/json'
  } = options

  // State
  const isDragging = ref(false)
  const dragData = ref(null)
  const dragOver = ref(false)
  const dropTarget = ref(null)

  // Drag source handlers
  const handleDragStart = (event, data) => {
    isDragging.value = true
    dragData.value = data

    // Set drag effect
    event.dataTransfer.effectAllowed = 'copy'
    
    // Set drag data
    if (dataTransferFormat === 'application/json') {
      event.dataTransfer.setData(dataTransferFormat, JSON.stringify(data))
    } else {
      event.dataTransfer.setData(dataTransferFormat, data)
    }

    // Add dragging class to body for global styling
    document.body.classList.add('dragging')

    // Call custom handler
    if (onDragStart) {
      onDragStart(event, data)
    }
  }

  const handleDragEnd = (event) => {
    isDragging.value = false
    dragData.value = null
    dragOver.value = false
    dropTarget.value = null

    // Remove dragging class from body
    document.body.classList.remove('dragging')

    // Call custom handler
    if (onDragEnd) {
      onDragEnd(event)
    }
  }

  // Drop target handlers
  const handleDragEnter = (event, target) => {
    if (canAcceptDrop(event)) {
      event.preventDefault()
      dragOver.value = true
      dropTarget.value = target
    }
  }

  const handleDragOver = (event) => {
    if (canAcceptDrop(event)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDragLeave = (event) => {
    // Check if we're leaving the drop zone entirely
    if (!event.currentTarget.contains(event.relatedTarget)) {
      dragOver.value = false
      dropTarget.value = null
    }
  }

  const handleDrop = (event, target) => {
    event.preventDefault()
    event.stopPropagation()

    if (!canAcceptDrop(event)) {
      return
    }

    dragOver.value = false
    dropTarget.value = null

    // Get drag data
    let data
    try {
      if (dataTransferFormat === 'application/json') {
        const rawData = event.dataTransfer.getData(dataTransferFormat)
        data = JSON.parse(rawData)
      } else {
        data = event.dataTransfer.getData(dataTransferFormat)
      }
    } catch (error) {
      console.error('Failed to parse drag data:', error)
      return
    }

    // Call custom handler
    if (onDrop) {
      onDrop(event, data, target)
    }
  }

  // Helper functions
  const canAcceptDrop = (event) => {
    if (!acceptTypes) {
      return true
    }

    // Check if any of the accepted types are present
    const types = event.dataTransfer.types
    if (Array.isArray(acceptTypes)) {
      return acceptTypes.some(type => types.includes(type))
    } else {
      return types.includes(acceptTypes)
    }
  }

  // Create draggable props
  const createDraggableProps = (data) => {
    return {
      draggable: true,
      onDragstart: (event) => handleDragStart(event, data),
      onDragend: handleDragEnd
    }
  }

  // Create droppable props
  const createDroppableProps = (target) => {
    return {
      onDragenter: (event) => handleDragEnter(event, target),
      onDragover: handleDragOver,
      onDragleave: handleDragLeave,
      onDrop: (event) => handleDrop(event, target)
    }
  }

  return {
    // State
    isDragging: computed(() => isDragging.value),
    dragData: computed(() => dragData.value),
    dragOver: computed(() => dragOver.value),
    dropTarget: computed(() => dropTarget.value),
    
    // Handlers
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    
    // Helper functions
    createDraggableProps,
    createDroppableProps
  }
}

/**
 * Global drag and drop styles
 */
export function initDragDropStyles() {
  if (typeof document === 'undefined') return

  const styleId = 'drag-drop-styles'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    /* Global dragging state */
    body.dragging {
      cursor: grabbing !important;
    }
    
    /* Dragging source */
    [draggable="true"] {
      cursor: grab;
      user-select: none;
    }
    
    [draggable="true"]:active {
      cursor: grabbing;
    }
    
    /* Drag ghost image */
    [draggable="true"]:focus {
      outline: none;
    }
    
    /* Drop targets during drag */
    body.dragging [data-droppable="true"] {
      position: relative;
    }
    
    body.dragging [data-droppable="true"]::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px dashed transparent;
      border-radius: 4px;
      pointer-events: none;
      transition: all 0.2s;
    }
    
    body.dragging [data-droppable="true"].drag-over::after {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
      opacity: 0.1;
    }
  `
  document.head.appendChild(style)
}