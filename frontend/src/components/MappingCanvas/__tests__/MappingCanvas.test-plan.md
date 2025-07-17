# Mapping Canvas Component Test Plan

## Overview
This document outlines the test plan for Task 13: Mapping Canvas Component implementation. Since the component hasn't been implemented yet, this serves as a test-driven development (TDD) guide.

## Test Categories

### 1. Component Setup and Rendering Tests
- [ ] Component mounts without errors
- [ ] SVG canvas is rendered with correct dimensions
- [ ] Canvas responds to container resize events
- [ ] Initial state is empty when no mappings provided

### 2. SVG Canvas Structure Tests (Subtask 1)
- [ ] SVG element has proper viewBox attribute
- [ ] PreserveAspectRatio is set correctly
- [ ] ResizeObserver is attached and functioning
- [ ] Canvas dimensions update on container resize
- [ ] Coordinate system is properly initialized

### 3. Bezier Curve Path Calculation Tests (Subtask 2)
- [ ] getPath() returns valid SVG path string
- [ ] Control points are calculated correctly
- [ ] Path adjusts based on source/target positions
- [ ] Handles edge cases (same Y position, crossing paths)
- [ ] Performance with 100+ mappings

### 4. Mapping Line Rendering Tests (Subtask 3)
- [ ] Each mapping creates a path element
- [ ] Path elements have correct stroke properties
- [ ] Arrow markers are rendered at endpoints
- [ ] Lines have proper z-index ordering
- [ ] Selected state applies correct CSS class

### 5. Interactive Selection Tests (Subtask 4)
- [ ] Click on path selects the mapping
- [ ] Selected mapping has visual highlight
- [ ] Only one mapping selected at a time
- [ ] Click on empty space deselects
- [ ] Selection state syncs with Pinia store

### 6. Delete and Context Menu Tests (Subtask 5)
- [ ] Delete key removes selected mapping
- [ ] Right-click shows context menu
- [ ] Context menu has delete option
- [ ] Delete confirmation dialog appears
- [ ] Deletion updates Pinia store

### 7. Animation Tests (Subtask 6)
- [ ] New mappings fade in smoothly
- [ ] Deleted mappings fade out
- [ ] Hover effect shows animated dash
- [ ] Transitions have correct duration
- [ ] No performance issues with animations

## Test Implementation Strategy

### Unit Tests (Vitest)
```javascript
describe('MappingCanvas', () => {
  describe('Rendering', () => {
    it('renders SVG canvas with correct dimensions')
    it('updates dimensions on resize')
    it('renders mapping lines for each mapping')
  })
  
  describe('Path Calculation', () => {
    it('calculates bezier curve path correctly')
    it('handles edge cases in path calculation')
  })
  
  describe('Interactions', () => {
    it('selects mapping on click')
    it('deletes mapping on delete key')
    it('shows context menu on right click')
  })
  
  describe('Animations', () => {
    it('animates new mapping creation')
    it('animates mapping deletion')
  })
})
```

### Integration Tests (Playwright)
```javascript
test.describe('Mapping Canvas Integration', () => {
  test('drag and drop creates visual mapping', async ({ page }) => {
    // 1. Navigate to mapping designer
    // 2. Drag field from source schema
    // 3. Drop on target schema field
    // 4. Verify mapping line appears
    // 5. Verify line connects correct fields
  })
  
  test('full mapping workflow', async ({ page }) => {
    // 1. Create multiple mappings
    // 2. Select and delete mapping
    // 3. Use context menu
    // 4. Verify animations
  })
})
```

## Performance Benchmarks
- Render 100 mappings: < 100ms
- Path calculation for 100 mappings: < 50ms
- Selection response time: < 16ms
- Animation frame rate: 60fps

## Accessibility Requirements
- Keyboard navigation for selection
- Screen reader announcements
- High contrast mode support
- Focus indicators

## Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Current Status
- Component: **NOT IMPLEMENTED**
- Tests: **NOT IMPLEMENTED**
- Dependencies: Schema Panel (Task 12) ✓, Mapping Store (Task 11) ✓

## Next Steps
1. Implement MappingCanvas.vue component
2. Create unit tests with Vitest
3. Create integration tests with Playwright
4. Verify all test cases pass
5. Performance optimization if needed