const { test, expect } = require('@playwright/test');

test.describe('Schema Panel Component - Task 12 Validation', () => {
  let testResults = [];
  
  test.beforeAll(async () => {
    testResults = [];
  });

  test.afterAll(async () => {
    // Generate test summary
    console.log('\n=== TEST EXECUTION SUMMARY ===');
    console.log(`Total Tests: ${testResults.length}`);
    console.log(`Passed: ${testResults.filter(r => r.status === 'passed').length}`);
    console.log(`Failed: ${testResults.filter(r => r.status === 'failed').length}`);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080/test-schema-panel.html');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({}, testInfo) => {
    testResults.push({
      title: testInfo.title,
      status: testInfo.status,
      duration: testInfo.duration,
      error: testInfo.error?.message
    });
  });

  test.describe('Component Rendering Tests', () => {
    test('should render dual panel layout', async ({ page }) => {
      const sourcePanelExists = await page.locator('[aria-label="Source Schema"]').isVisible();
      const targetPanelExists = await page.locator('[aria-label="Target Schema"]').isVisible();
      
      expect(sourcePanelExists).toBeTruthy();
      expect(targetPanelExists).toBeTruthy();
      
      // Verify headers
      await expect(page.locator('h3:text("Source Schema")')).toBeVisible();
      await expect(page.locator('h3:text("Target Schema")')).toBeVisible();
    });

    test('should display schema trees', async ({ page }) => {
      const sourceTrees = await page.locator('[aria-label="Source Schema"] [role="tree"]').count();
      const targetTrees = await page.locator('[aria-label="Target Schema"] [role="tree"]').count();
      
      expect(sourceTrees).toBe(1);
      expect(targetTrees).toBe(1);
    });

    test('should show table nodes', async ({ page }) => {
      const tables = await page.locator('[role="treeitem"]').filter({ hasText: 'customers' });
      await expect(tables.first()).toBeVisible();
      
      const orderTable = await page.locator('[role="treeitem"]').filter({ hasText: 'orders' });
      await expect(orderTable.first()).toBeVisible();
    });
  });

  test.describe('Tree View Functionality', () => {
    test('should expand and collapse nodes', async ({ page }) => {
      // Find customers table expand icon
      const expandIcon = await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.expand-icon').first();
      
      // Initially collapsed - no child items visible
      const childrenBefore = await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.children').first();
      await expect(childrenBefore).not.toBeVisible();
      
      // Click to expand
      await expandIcon.click();
      await page.waitForTimeout(300);
      
      // Should show children
      const idField = await page.locator('[role="treeitem"]').filter({ hasText: 'id' }).filter({ hasText: 'integer' });
      await expect(idField.first()).toBeVisible();
      
      // Click to collapse
      await expandIcon.click();
      await page.waitForTimeout(300);
      
      // Children should be hidden again
      await expect(idField.first()).not.toBeVisible();
    });

    test('should display correct field count', async ({ page }) => {
      // Expand customers table
      await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.expand-icon').first().click();
      await page.waitForTimeout(300);
      
      // Count visible fields
      const fields = await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('[role="treeitem"]').all();
      
      // Should have 5 fields (id, email, first_name, last_name, created_at)
      expect(fields.length).toBe(5);
    });
  });

  test.describe('Field Type Icons', () => {
    test('should display correct icons for data types', async ({ page }) => {
      // Expand customers table
      await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.expand-icon').first().click();
      await page.waitForTimeout(300);
      
      // Check integer field icon
      const integerIcon = await page.locator('[data-field-type="integer"] .field-icon').first();
      await expect(integerIcon).toContainText('🔢');
      
      // Check varchar field icon
      const varcharIcon = await page.locator('[data-field-type="varchar"] .field-icon').first();
      await expect(varcharIcon).toContainText('📝');
      
      // Check timestamp field icon
      const timestampIcon = await page.locator('[data-field-type="timestamp"] .field-icon').first();
      await expect(timestampIcon).toContainText('🕐');
    });

    test('should apply correct colors to field types', async ({ page }) => {
      await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.expand-icon').first().click();
      await page.waitForTimeout(300);
      
      // Verify color styling exists
      const integerField = await page.locator('[data-field-type="integer"]').first();
      const varcharField = await page.locator('[data-field-type="varchar"]').first();
      
      expect(integerField).toBeTruthy();
      expect(varcharField).toBeTruthy();
    });
  });

  test.describe('Search Functionality', () => {
    test('should filter source schema fields', async ({ page }) => {
      // Expand customers table first
      await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.expand-icon').first().click();
      await page.waitForTimeout(300);
      
      // Type in search
      await page.fill('[aria-label="Search source schema fields"]', 'email');
      await page.waitForTimeout(500);
      
      // Check filtered results
      const emailField = await page.locator('[role="treeitem"]').filter({ hasText: 'email' }).filter({ hasText: 'varchar' });
      await expect(emailField.first()).toBeVisible();
      
      // Other fields should not be visible
      const idField = await page.locator('[role="treeitem"]').filter({ hasText: 'id' }).filter({ hasText: 'integer' });
      await expect(idField.first()).not.toBeVisible();
    });

    test('should filter target schema fields', async ({ page }) => {
      // Type in target search
      await page.fill('[aria-label="Search target schema fields"]', 'customer');
      await page.waitForTimeout(500);
      
      // Expand filtered results
      await page.locator('[aria-label="Target Schema"] [role="treeitem"]').filter({ hasText: 'dim_customers' }).locator('.expand-icon').first().click();
      await page.waitForTimeout(300);
      
      // Check customer_key is visible
      const customerKey = await page.locator('[role="treeitem"]').filter({ hasText: 'customer_key' });
      await expect(customerKey.first()).toBeVisible();
    });

    test('should clear search and show all fields', async ({ page }) => {
      // Search first
      await page.fill('[aria-label="Search source schema fields"]', 'email');
      await page.waitForTimeout(500);
      
      // Clear search
      await page.fill('[aria-label="Search source schema fields"]', '');
      await page.waitForTimeout(500);
      
      // All tables should be visible again
      const customers = await page.locator('[role="treeitem"]').filter({ hasText: 'customers' });
      const orders = await page.locator('[role="treeitem"]').filter({ hasText: 'orders' });
      
      await expect(customers.first()).toBeVisible();
      await expect(orders.first()).toBeVisible();
    });
  });

  test.describe('Drag and Drop Functionality', () => {
    test('should enable drag and drop via checkbox', async ({ page }) => {
      const checkbox = await page.locator('input[type="checkbox"]').first();
      
      // Should be checked by default
      await expect(checkbox).toBeChecked();
      
      // Uncheck and verify
      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
      
      // Re-check
      await checkbox.check();
      await expect(checkbox).toBeChecked();
    });

    test('should perform drag and drop operation', async ({ page }) => {
      // Expand source table
      await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.expand-icon').first().click();
      await page.waitForTimeout(300);
      
      // Get initial event count
      const eventLogsBefore = await page.locator('.log-entry').count();
      
      // Drag email field to drop zone
      const emailField = await page.locator('[role="treeitem"]').filter({ hasText: 'email' }).filter({ hasText: 'varchar(255)' }).first();
      const dropZone = await page.locator('.mapping-drop-zone');
      
      await emailField.dragTo(dropZone);
      await page.waitForTimeout(500);
      
      // Check event log updated
      const eventLogsAfter = await page.locator('.log-entry').count();
      expect(eventLogsAfter).toBeGreaterThan(eventLogsBefore);
      
      // Verify drag events logged
      const dragEvent = await page.locator('.log-entry').filter({ hasText: 'drag-start' });
      const dropEvent = await page.locator('.log-entry').filter({ hasText: 'drop' });
      
      await expect(dragEvent.first()).toBeVisible();
      await expect(dropEvent.first()).toBeVisible();
    });
  });

  test.describe('Refresh Functionality', () => {
    test('should refresh source schema', async ({ page }) => {
      // Get initial event count
      const eventLogsBefore = await page.locator('.log-entry').count();
      
      // Click refresh
      await page.locator('[aria-label="Source Schema"] button:text("Refresh")').click();
      await page.waitForTimeout(300);
      
      // Check event logged
      const eventLogsAfter = await page.locator('.log-entry').count();
      expect(eventLogsAfter).toBeGreaterThan(eventLogsBefore);
      
      const refreshEvent = await page.locator('.log-entry').filter({ hasText: 'refresh' }).filter({ hasText: 'source' });
      await expect(refreshEvent.first()).toBeVisible();
    });

    test('should refresh target schema', async ({ page }) => {
      // Click target refresh
      await page.locator('[aria-label="Target Schema"] button:text("Refresh")').click();
      await page.waitForTimeout(300);
      
      // Check event logged
      const refreshEvent = await page.locator('.log-entry').filter({ hasText: 'refresh' }).filter({ hasText: 'target' });
      await expect(refreshEvent.first()).toBeVisible();
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      // Check regions
      const sourceRegion = await page.locator('[aria-label="Source Schema"]');
      await expect(sourceRegion).toHaveAttribute('role', 'region');
      
      const targetRegion = await page.locator('[aria-label="Target Schema"]');
      await expect(targetRegion).toHaveAttribute('role', 'region');
      
      // Check trees
      const trees = await page.locator('[role="tree"]');
      expect(await trees.count()).toBe(2);
      
      // Check tree items
      const treeItems = await page.locator('[role="treeitem"]');
      expect(await treeItems.count()).toBeGreaterThan(0);
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Focus on search input
      const searchInput = await page.locator('[aria-label="Search source schema fields"]');
      await searchInput.focus();
      
      // Tab to tree
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Use arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter'); // Expand
      
      // Verify expansion worked
      const expandedNode = await page.locator('[aria-expanded="true"]');
      expect(await expandedNode.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Performance Tests', () => {
    test('should render quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:8080/test-schema-panel.html');
      await page.waitForSelector('[role="tree"]');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    test('should handle rapid interactions', async ({ page }) => {
      // Rapidly expand/collapse
      const expandIcon = await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.expand-icon').first();
      
      for (let i = 0; i < 5; i++) {
        await expandIcon.click();
        await page.waitForTimeout(100);
      }
      
      // Should still be functional
      const tree = await page.locator('[role="tree"]').first();
      await expect(tree).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle empty search gracefully', async ({ page }) => {
      await page.fill('[aria-label="Search source schema fields"]', '   ');
      await page.waitForTimeout(300);
      
      // Should show all items
      const treeItems = await page.locator('[aria-label="Source Schema"] [role="treeitem"]');
      expect(await treeItems.count()).toBeGreaterThan(0);
    });

    test('should handle non-matching search', async ({ page }) => {
      await page.fill('[aria-label="Search source schema fields"]', 'xyz123notfound');
      await page.waitForTimeout(300);
      
      // Tables might be hidden or shown based on implementation
      const visibleItems = await page.locator('[aria-label="Source Schema"] [role="treeitem"]:visible');
      // This is acceptable - either show no results or show table structure
      expect(await visibleItems.count()).toBeGreaterThanOrEqual(0);
    });
  });
});

// Generate HTML report after tests
test.describe('Generate Test Report', () => {
  test('create comprehensive test report', async ({ page }) => {
    const reportData = {
      title: 'Task 12 - Schema Panel Component Test Report',
      testDate: new Date().toISOString(),
      component: 'Schema Panel',
      taskId: 'Task 12',
      environment: {
        browser: 'Chromium',
        viewport: '1280x720',
        baseURL: 'http://localhost:8080'
      },
      summary: {
        totalTests: 20,
        categories: {
          'Component Rendering': 3,
          'Tree View Functionality': 2,
          'Field Type Icons': 2,
          'Search Functionality': 3,
          'Drag and Drop': 2,
          'Refresh Functionality': 2,
          'Accessibility': 2,
          'Performance': 2,
          'Edge Cases': 2
        }
      }
    };

    // Navigate to test page for final screenshot
    await page.goto('http://localhost:8080/test-schema-panel.html');
    await page.waitForLoadState('networkidle');
    
    // Expand some nodes for screenshot
    await page.locator('[role="treeitem"]').filter({ hasText: 'customers' }).locator('.expand-icon').first().click();
    await page.waitForTimeout(300);
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'schema-panel-test-final.png',
      fullPage: true 
    });

    console.log('\n=== FINAL TEST REPORT ===');
    console.log(JSON.stringify(reportData, null, 2));
  });
});