// Icon components for the application
// Using inline SVG for better performance and customization

import { h } from 'vue'

// Base icon wrapper
const createIcon = (path, viewBox = '0 0 24 24') => {
  return {
    name: 'Icon',
    props: {
      size: {
        type: [Number, String],
        default: 20
      },
      color: {
        type: String,
        default: 'currentColor'
      }
    },
    render() {
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        width: this.size,
        height: this.size,
        viewBox,
        fill: 'none',
        stroke: this.color,
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }, [
        h('path', { d: path })
      ])
    }
  }
}

// Navigation icons
export const ChevronIcon = createIcon('M9 18l6-6-6-6')
export const SearchIcon = createIcon('M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z')
export const RefreshIcon = createIcon('M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15')

// Schema/Table icons
export const TableIcon = createIcon('M3 3h18v18H3zM3 9h18M9 3v18')
export const FieldIcon = createIcon('M3 10h18M3 14h18M8 6v12')
export const KeyIcon = createIcon('M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4')
export const IndexIcon = createIcon('M3 12h18m-9-9v18')

// Data type icons
export const TextIcon = createIcon('M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z M13 2v7h7')
export const NumberIcon = createIcon('M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7')
export const CalendarIcon = createIcon('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z')
export const ClockIcon = createIcon('M12 2a10 10 0 110 20 10 10 0 010-20z M12 6v6l4 2')
export const ToggleIcon = createIcon('M8 12h8M12 8v8')
export const JsonIcon = createIcon('M10 2v20M14 2v20M4 7h16M4 17h16')
export const BinaryIcon = createIcon('M10 20v-6m0 0V4m0 10h10m-10 0H4')
export const LocationIcon = createIcon('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 7a3 3 0 110 6 3 3 0 010-6z')
export const IdIcon = createIcon('M2 12h20M16 6l4 6-4 6M8 6l-4 6 4 6')
export const ArrayIcon = createIcon('M4 7h16M4 12h16M4 17h16')
export const ObjectIcon = createIcon('M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z')
export const UnknownIcon = createIcon('M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01')

// UI state icons
export const LoadingSpinner = {
  name: 'LoadingSpinner',
  props: {
    size: {
      type: [Number, String],
      default: 24
    }
  },
  render() {
    return h('svg', {
      class: 'loading-spinner',
      xmlns: 'http://www.w3.org/2000/svg',
      width: this.size,
      height: this.size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2
    }, [
      h('path', {
        d: 'M12 2a10 10 0 110 20 10 10 0 010-20z',
        'stroke-opacity': 0.2
      }),
      h('path', {
        d: 'M12 2a10 10 0 010 20',
        'stroke-linecap': 'round'
      })
    ])
  }
}

export const ErrorIcon = createIcon('M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01')
export const EmptyIcon = createIcon('M9 2a1 1 0 000 2h2a1 1 0 100-2H9z M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6h16V7a2 2 0 00-2-2 1 1 0 100-2 2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V5z')

// Add CSS for loading spinner animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    .loading-spinner {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}