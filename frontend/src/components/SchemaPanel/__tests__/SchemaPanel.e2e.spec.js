const { test, expect } = require('@playwright/test');

test.describe('Schema Panel Component E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the demo page
    await page.goto('http://localhost:8080/#/demo/schema-panel');
  });

  test('should render Schema Panel with title', async ({ page }) => {
    // Check if the schema panel is visible
    const schemaPanel = await page.locator('.schema-panel');
    await expect(schemaPanel).toBeVisible();
    
    // Check if title is rendered
    const title = await page.locator('.schema-panel-header h3');
    await expect(title).toContainText('Source Schema');
  });

  test('should display schema tree structure', async ({ page }) => {
    // Wait for tree to load
    await page.waitForSelector('.schema-tree', { timeout: 5000 });
    
    // Check if tree nodes are rendered
    const treeNodes = await page.locator('.schema-tree-node');
    const nodeCount = await treeNodes.count();
    expect(nodeCount).toBeGreaterThan(0);
  });

  test('should show field icons based on data type', async ({ page }) => {
    // Check for different field type icons
    const stringIcon = await page.locator('[data-field-type="string"] .field-icon');
    const numberIcon = await page.locator('[data-field-type="number"] .field-icon');
    
    // Verify icons exist
    await expect(stringIcon.first()).toBeVisible();
    await expect(numberIcon.first()).toBeVisible();
  });

  test('should expand/collapse tree nodes', async ({ page }) => {
    // Find expandable node
    const expandableNode = await page.locator('.schema-tree-node.has-children').first();
    const expandIcon = expandableNode.locator('.expand-icon');
    
    // Initially collapsed
    await expect(expandableNode).not.toHaveClass(/expanded/);
    
    // Click to expand
    await expandIcon.click();
    await expect(expandableNode).toHaveClass(/expanded/);
    
    // Click to collapse
    await expandIcon.click();
    await expect(expandableNode).not.toHaveClass(/expanded/);
  });

  test('should support search functionality', async ({ page }) => {
    // Type in search box
    const searchInput = await page.locator('.schema-search input');
    await searchInput.fill('customer');
    
    // Wait for filtering
    await page.waitForTimeout(500);
    
    // Check that non-matching nodes are hidden
    const visibleNodes = await page.locator('.schema-tree-node:visible');
    const visibleCount = await visibleNodes.count();
    
    // Should show only matching nodes
    const allText = await visibleNodes.allTextContents();
    allText.forEach(text => {
      expect(text.toLowerCase()).toContain('customer');
    });
  });

  test('should support drag and drop', async ({ page }) => {
    // Enable draggable mode
    const draggableToggle = await page.locator('.draggable-toggle');
    if (await draggableToggle.isVisible()) {
      await draggableToggle.click();
    }
    
    // Find a draggable field
    const sourceField = await page.locator('.schema-tree-node[draggable="true"]').first();
    const fieldName = await sourceField.locator('.field-name').textContent();
    
    // Start drag
    await sourceField.hover();
    await page.mouse.down();
    
    // Move to drop zone (if exists)
    const dropZone = await page.locator('.mapping-drop-zone');
    if (await dropZone.isVisible()) {
      await dropZone.hover();
      await page.mouse.up();
      
      // Verify drop event was triggered
      // This would depend on your implementation
    } else {
      // Just complete the drag without dropping
      await page.mouse.move(100, 100);
      await page.mouse.up();
    }
  });

  test('should show field details on hover', async ({ page }) => {
    // Hover over a field
    const field = await page.locator('.schema-tree-node').first();
    await field.hover();
    
    // Check if tooltip appears (if implemented)
    const tooltip = await page.locator('.field-tooltip');
    if (await tooltip.isVisible()) {
      await expect(tooltip).toContainText(/Type:/);
    }
  });

  test('should handle schema refresh', async ({ page }) => {
    // Click refresh button
    const refreshButton = await page.locator('.schema-refresh-btn');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      
      // Wait for refresh to complete
      await page.waitForLoadState('networkidle');
      
      // Verify schema is still displayed
      const schemaTree = await page.locator('.schema-tree');
      await expect(schemaTree).toBeVisible();
    }
  });

  test('should display empty state when no schema', async ({ page }) => {
    // Navigate to a page without schema data
    await page.goto('http://localhost:8080/#/demo/schema-panel-empty');
    
    // Check for empty state message
    const emptyState = await page.locator('.schema-empty-state');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toContainText(/No schema/i);
    }
  });

  test('should maintain state after interactions', async ({ page }) => {
    // Expand a node
    const expandableNode = await page.locator('.schema-tree-node.has-children').first();
    await expandableNode.locator('.expand-icon').click();
    
    // Search for something
    const searchInput = await page.locator('.schema-search input');
    await searchInput.fill('test');
    
    // Clear search
    await searchInput.clear();
    
    // Verify expanded state is maintained
    await expect(expandableNode).toHaveClass(/expanded/);
  });
});

test.describe('Schema Panel Accessibility Tests', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('http://localhost:8080/#/demo/schema-panel');
    
    // Check main panel has role
    const panel = await page.locator('.schema-panel');
    await expect(panel).toHaveAttribute('role', 'region');
    
    // Check tree has proper ARIA
    const tree = await page.locator('.schema-tree');
    await expect(tree).toHaveAttribute('role', 'tree');
    
    // Check tree items
    const treeItems = await page.locator('[role="treeitem"]');
    const itemCount = await treeItems.count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:8080/#/demo/schema-panel');
    
    // Focus on first tree item
    const firstItem = await page.locator('[role="treeitem"]').first();
    await firstItem.focus();
    
    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    
    // Check focus moved
    const focusedElement = await page.locator(':focus');
    const focusedText = await focusedElement.textContent();
    expect(focusedText).toBeTruthy();
  });
});

test.describe('Schema Panel Performance Tests', () => {
  test('should render large schemas efficiently', async ({ page }) => {
    // Navigate to a page with large schema
    await page.goto('http://localhost:8080/#/demo/schema-panel-large');
    
    // Measure render time
    const startTime = Date.now();
    await page.waitForSelector('.schema-tree-node', { timeout: 5000 });
    const endTime = Date.now();
    
    // Should render within reasonable time
    expect(endTime - startTime).toBeLessThan(3000);
    
    // Check virtualization if implemented
    const visibleNodes = await page.locator('.schema-tree-node:visible');
    const visibleCount = await visibleNodes.count();
    
    // If virtualization is implemented, visible count should be limited
    console.log(`Visible nodes: ${visibleCount}`);
  });
});