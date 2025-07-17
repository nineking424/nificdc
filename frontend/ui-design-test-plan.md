# UI Design Improvement Test Plan

## Overview

This document outlines the comprehensive test plan for validating the UI design improvements made to the NiFiCDC application using Playwright E2E testing.

## Test Environment Setup

### Prerequisites
- NiFiCDC application running locally (http://localhost:5173)
- Playwright MCP configured
- Test data available for all pages

### Test Configuration
- **Browser**: Chrome (headed mode for visual validation)
- **Viewport**: Multiple viewports (1920x1080, 1024x768, 768x1024, 375x667)
- **Network**: Fast 3G simulation for performance testing

## Test Scenarios

### 1. Login Page (`/login`)

#### Visual Tests
```javascript
test('Login page design validation', async ({ page }) => {
  await page.goto('/login');
  
  // Verify split layout
  await expect(page.locator('.login-content')).toHaveCSS('display', 'grid');
  await expect(page.locator('.login-content')).toHaveCSS('grid-template-columns', '1fr 1fr');
  
  // Check brand logo
  await expect(page.locator('.brand-logo')).toBeVisible();
  await expect(page.locator('.brand-logo h1')).toHaveText('NiFiCDC');
  
  // Verify form elements
  await expect(page.locator('.login-card')).toBeVisible();
  await expect(page.locator('.clean-form-input')).toHaveCount(2);
  await expect(page.locator('.clean-button-primary')).toBeVisible();
  
  // Check visual section
  await expect(page.locator('.visual-section')).toBeVisible();
  await expect(page.locator('.feature-grid')).toBeVisible();
  
  // Take screenshot
  await page.screenshot({ path: 'login-page.png', fullPage: true });
});
```

#### Interaction Tests
```javascript
test('Login form interactions', async ({ page }) => {
  await page.goto('/login');
  
  // Test form input focus states
  await page.locator('input[type="email"]').click();
  await expect(page.locator('input[type="email"]')).toBeFocused();
  
  // Test password visibility toggle
  await page.locator('.input-action').click();
  await expect(page.locator('input[type="password"]')).toHaveAttribute('type', 'text');
  
  // Test form validation
  await page.locator('.clean-button-primary').click();
  await expect(page.locator('.error-message')).toBeVisible();
});
```

### 2. Dashboard Page (`/dashboard`)

#### Layout Tests
```javascript
test('Dashboard layout validation', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Verify header
  await expect(page.locator('.dashboard-header')).toBeVisible();
  await expect(page.locator('.page-title')).toHaveText('대시보드');
  
  // Check status cards
  await expect(page.locator('.status-card')).toHaveCount(4);
  await expect(page.locator('.status-card').first()).toHaveClass(/status-success/);
  
  // Verify content sections
  await expect(page.locator('.chart-section')).toBeVisible();
  await expect(page.locator('.activity-section')).toBeVisible();
  await expect(page.locator('.actions-section')).toBeVisible();
  
  // Check getting started guide
  await expect(page.locator('.guide-grid')).toBeVisible();
  await expect(page.locator('.guide-card')).toHaveCount(3);
  
  await page.screenshot({ path: 'dashboard-page.png', fullPage: true });
});
```

#### Interactive Elements
```javascript
test('Dashboard interactions', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Test refresh button
  await page.locator('.clean-button-secondary').click();
  
  // Test quick action buttons
  await page.locator('.action-button').first().click();
  await expect(page).toHaveURL(/.*systems/);
  
  // Test time filter buttons
  await page.locator('.filter-button').nth(1).click();
  await expect(page.locator('.filter-button').nth(1)).toHaveClass(/active/);
});
```

### 3. System Management Page (`/systems`)

#### Grid Layout Tests
```javascript
test('System management layout', async ({ page }) => {
  await page.goto('/systems');
  
  // Verify header and actions
  await expect(page.locator('.system-header')).toBeVisible();
  await expect(page.locator('.clean-button-primary')).toHaveText('새 시스템 추가');
  
  // Check statistics cards
  await expect(page.locator('.stats-grid')).toBeVisible();
  await expect(page.locator('.stat-card')).toHaveCount(4);
  
  // Verify filter section
  await expect(page.locator('.filter-section')).toBeVisible();
  await expect(page.locator('.search-input')).toBeVisible();
  
  // Check system grid
  await expect(page.locator('.systems-grid')).toBeVisible();
  
  await page.screenshot({ path: 'systems-page.png', fullPage: true });
});
```

#### Search and Filter Tests
```javascript
test('System search and filter', async ({ page }) => {
  await page.goto('/systems');
  
  // Test search functionality
  await page.locator('.search-input').fill('postgres');
  await page.locator('.search-input').press('Enter');
  
  // Test filter controls
  await page.locator('.clean-form-select').first().selectOption('active');
  await page.locator('.clean-form-select').nth(1).selectOption('database');
  
  // Test view toggle
  await page.locator('.view-toggle button').nth(1).click();
  await expect(page.locator('.systems-list')).toBeVisible();
});
```

### 4. Mapping Management Page (`/mappings`)

#### Card Layout Tests
```javascript
test('Mapping management layout', async ({ page }) => {
  await page.goto('/mappings');
  
  // Verify header
  await expect(page.locator('.mapping-header')).toBeVisible();
  await expect(page.locator('.page-title')).toHaveText('매핑 관리');
  
  // Check stats cards
  await expect(page.locator('.stats-grid')).toBeVisible();
  await expect(page.locator('.stat-card')).toHaveCount(4);
  
  // Verify filter section
  await expect(page.locator('.filter-section')).toBeVisible();
  
  // Check mapping cards
  await expect(page.locator('.mappings-grid')).toBeVisible();
  
  await page.screenshot({ path: 'mappings-page.png', fullPage: true });
});
```

#### Data Flow Visualization
```javascript
test('Mapping data flow visualization', async ({ page }) => {
  await page.goto('/mappings');
  
  // Check mapping cards structure
  const mappingCard = page.locator('.mapping-card').first();
  await expect(mappingCard).toBeVisible();
  
  // Verify system flow
  await expect(mappingCard.locator('.system-flow')).toBeVisible();
  await expect(mappingCard.locator('.system-box')).toHaveCount(2);
  await expect(mappingCard.locator('.flow-arrow')).toBeVisible();
  
  // Check action buttons
  await expect(mappingCard.locator('.action-button')).toHaveCount(4);
});
```

### 5. Job Management Page (`/jobs`)

#### Status Cards Tests
```javascript
test('Job management status cards', async ({ page }) => {
  await page.goto('/jobs');
  
  // Verify header
  await expect(page.locator('.job-header')).toBeVisible();
  await expect(page.locator('.page-title')).toHaveText('작업 관리');
  
  // Check status cards
  await expect(page.locator('.status-grid')).toBeVisible();
  await expect(page.locator('.status-card')).toHaveCount(4);
  
  // Verify status card colors
  await expect(page.locator('.status-card.success')).toBeVisible();
  await expect(page.locator('.status-card.warning')).toBeVisible();
  await expect(page.locator('.status-card.error')).toBeVisible();
  await expect(page.locator('.status-card.info')).toBeVisible();
  
  await page.screenshot({ path: 'jobs-page.png', fullPage: true });
});
```

#### Performance Metrics
```javascript
test('Job performance metrics', async ({ page }) => {
  await page.goto('/jobs');
  
  // Check performance indicators
  await expect(page.locator('.performance-indicators')).toBeVisible();
  await expect(page.locator('.metric-item')).toHaveCount(3);
  
  // Verify progress bars
  await expect(page.locator('.progress-bar')).toHaveCount(3);
  await expect(page.locator('.progress-bar.success')).toBeVisible();
});
```

### 6. Monitoring Dashboard (`/monitoring`)

#### Real-time Elements
```javascript
test('Monitoring dashboard real-time elements', async ({ page }) => {
  await page.goto('/monitoring');
  
  // Verify header with connection status
  await expect(page.locator('.monitoring-header')).toBeVisible();
  await expect(page.locator('.connection-status')).toBeVisible();
  
  // Check metric cards
  await expect(page.locator('.metric-grid')).toBeVisible();
  await expect(page.locator('.metric-card')).toHaveCount(4);
  
  // Verify chart section
  await expect(page.locator('.chart-section')).toBeVisible();
  await expect(page.locator('.period-button')).toHaveCount(3);
  
  // Check health section
  await expect(page.locator('.health-section')).toBeVisible();
  await expect(page.locator('.health-progress')).toBeVisible();
  
  await page.screenshot({ path: 'monitoring-page.png', fullPage: true });
});
```

#### Interactive Controls
```javascript
test('Monitoring interactive controls', async ({ page }) => {
  await page.goto('/monitoring');
  
  // Test refresh button
  await page.locator('.clean-button-secondary').click();
  
  // Test chart period buttons
  await page.locator('.period-button').nth(1).click();
  await expect(page.locator('.period-button').nth(1)).toHaveClass(/active/);
  
  // Test settings dialog
  await page.locator('button:has-text("설정")').click();
  await expect(page.locator('.v-dialog')).toBeVisible();
});
```

### 7. Navigation & Layout Tests

#### Sidebar Navigation
```javascript
test('Sidebar navigation functionality', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Verify sidebar structure
  await expect(page.locator('.modern-sidebar')).toBeVisible();
  await expect(page.locator('.brand-section')).toBeVisible();
  await expect(page.locator('.nav-list')).toBeVisible();
  
  // Check navigation items
  await expect(page.locator('.nav-item')).toHaveCount(5);
  
  // Test navigation links
  await page.locator('a[href="/systems"]').click();
  await expect(page).toHaveURL(/.*systems/);
  await expect(page.locator('.nav-link.active')).toHaveText('시스템 관리');
  
  // Test sidebar collapse
  await page.locator('.toggle-btn').click();
  await expect(page.locator('.modern-sidebar')).toHaveClass(/collapsed/);
});
```

#### Header Elements
```javascript
test('Header functionality', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Verify header structure
  await expect(page.locator('.modern-header')).toBeVisible();
  await expect(page.locator('.page-title')).toBeVisible();
  await expect(page.locator('.breadcrumb')).toBeVisible();
  
  // Check action buttons
  await expect(page.locator('.action-btn')).toHaveCount(2);
  
  // Test user dropdown
  await page.locator('.user-info').click();
  await expect(page.locator('.sidebar-user-dropdown')).toBeVisible();
});
```

### 8. Responsive Design Tests

#### Mobile Layout
```javascript
test('Mobile responsive design', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  
  // Test login page mobile
  await page.goto('/login');
  await expect(page.locator('.visual-section')).toBeHidden();
  
  // Test dashboard mobile
  await page.goto('/dashboard');
  await expect(page.locator('.mobile-menu-btn')).toBeVisible();
  await expect(page.locator('.modern-sidebar')).toHaveClass(/mobile-sidebar/);
  
  // Test mobile navigation
  await page.locator('.mobile-menu-btn').click();
  await expect(page.locator('.modern-sidebar')).toHaveClass(/mobile-open/);
});
```

#### Tablet Layout
```javascript
test('Tablet responsive design', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  
  // Test dashboard tablet layout
  await page.goto('/dashboard');
  await expect(page.locator('.status-grid')).toHaveCSS('grid-template-columns', '1fr');
  
  // Test systems page tablet
  await page.goto('/systems');
  await expect(page.locator('.stats-grid')).toHaveCSS('grid-template-columns', 'repeat(2, 1fr)');
});
```

### 9. Design System Validation

#### CSS Variables Test
```javascript
test('Design system CSS variables', async ({ page }) => {
  await page.goto('/dashboard');
  
  // Test primary color usage
  const primaryButton = page.locator('.clean-button-primary');
  await expect(primaryButton).toHaveCSS('background-color', 'rgb(25, 118, 210)');
  
  // Test spacing consistency
  const card = page.locator('.clean-card').first();
  await expect(card).toHaveCSS('padding', '32px');
  
  // Test border radius
  await expect(card).toHaveCSS('border-radius', '12px');
});
```

#### Component Consistency
```javascript
test('Component consistency across pages', async ({ page }) => {
  const pages = ['/dashboard', '/systems', '/mappings', '/jobs', '/monitoring'];
  
  for (const pagePath of pages) {
    await page.goto(pagePath);
    
    // Check page header consistency
    await expect(page.locator('.page-title')).toHaveCSS('font-size', '30px');
    await expect(page.locator('.page-title')).toHaveCSS('font-weight', '700');
    
    // Check card consistency
    if (await page.locator('.clean-card').count() > 0) {
      await expect(page.locator('.clean-card').first()).toHaveCSS('border-radius', '12px');
    }
    
    // Check button consistency
    if (await page.locator('.clean-button-primary').count() > 0) {
      await expect(page.locator('.clean-button-primary').first()).toHaveCSS('background-color', 'rgb(25, 118, 210)');
    }
  }
});
```

## Test Execution Instructions

### Running the Tests

1. **Start the application**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Execute Playwright tests**:
   ```bash
   # Run all UI tests
   npx playwright test --headed

   # Run specific test file
   npx playwright test ui-design-tests.spec.js --headed

   # Run tests with screenshot capture
   npx playwright test --headed --screenshot=only-on-failure
   ```

3. **Generate test report**:
   ```bash
   npx playwright show-report
   ```

### Test Data Requirements

- **Login credentials**: Valid test user account
- **System data**: At least 3 test systems with different statuses
- **Mapping data**: Sample mappings with various configurations
- **Job data**: Test jobs with different execution states
- **Monitoring data**: Real-time metrics for validation

### Expected Results

#### Visual Validation
- All pages should render consistently across browsers
- Color scheme should match design system variables
- Layout should be responsive across all viewports
- Interactive elements should provide appropriate feedback

#### Functional Validation
- Navigation should work smoothly between pages
- Form inputs should validate correctly
- Search and filter functionality should work as expected
- Real-time updates should function properly

#### Performance Validation
- Page load times should be under 2 seconds
- CSS animations should be smooth (60fps)
- No layout shifts during loading
- Proper loading states for all async operations

## Test Report Template

### Summary
- **Total Tests**: X
- **Passed**: X
- **Failed**: X
- **Skipped**: X
- **Duration**: X minutes

### Screenshots
- Include screenshots of all major pages
- Before/after comparisons if available
- Error screenshots for failed tests

### Issues Found
- List any visual inconsistencies
- Performance issues
- Responsive design problems
- Accessibility concerns

### Recommendations
- Suggestions for further improvements
- Performance optimizations
- Additional test coverage needed

---

This test plan provides comprehensive coverage for validating the UI design improvements. Execute these tests when the application is running to ensure all improvements are working correctly.