const { chromium } = require('@playwright/test');

async function runSchemaTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const testResults = [];
  const startTime = Date.now();
  
  console.log('Starting Schema Panel Component Tests...\n');
  
  // Test Suite 1: Component Rendering
  console.log('Running Component Rendering Tests...');
  try {
    await page.goto('http://localhost:8080/test-schema-panel.html');
    await page.waitForLoadState('networkidle');
    
    const sourcePanel = await page.locator('[aria-label="Source Schema"]').isVisible();
    const targetPanel = await page.locator('[aria-label="Target Schema"]').isVisible();
    
    testResults.push({
      category: 'Component Rendering',
      test: 'Dual panel layout renders',
      status: sourcePanel && targetPanel ? 'PASS' : 'FAIL',
      details: 'Both source and target panels visible'
    });
    
    const headers = await page.locator('h3').count();
    testResults.push({
      category: 'Component Rendering',
      test: 'Headers display correctly',
      status: headers >= 2 ? 'PASS' : 'FAIL',
      details: `Found ${headers} headers`
    });
  } catch (error) {
    testResults.push({
      category: 'Component Rendering',
      test: 'Component loads',
      status: 'FAIL',
      details: error.message
    });
  }
  
  // Test Suite 2: Tree View Functionality
  console.log('Running Tree View Tests...');
  try {
    const expandIcon = page.locator('.expand-icon').first();
    await expandIcon.click();
    await page.waitForTimeout(300);
    
    const expandedItems = await page.locator('[aria-expanded="true"]').count();
    testResults.push({
      category: 'Tree View',
      test: 'Expand/collapse functionality',
      status: expandedItems > 0 ? 'PASS' : 'FAIL',
      details: `Expanded ${expandedItems} nodes`
    });
    
    const fields = await page.locator('.field-name').count();
    testResults.push({
      category: 'Tree View',
      test: 'Field display',
      status: fields > 0 ? 'PASS' : 'FAIL',
      details: `Displaying ${fields} fields`
    });
  } catch (error) {
    testResults.push({
      category: 'Tree View',
      test: 'Tree interactions',
      status: 'FAIL',
      details: error.message
    });
  }
  
  // Test Suite 3: Field Type Icons
  console.log('Running Field Type Icon Tests...');
  try {
    const integerIcon = await page.locator('[data-field-type="integer"]').first().isVisible();
    const varcharIcon = await page.locator('[data-field-type="varchar"]').first().isVisible();
    
    testResults.push({
      category: 'Field Icons',
      test: 'Data type icons display',
      status: integerIcon && varcharIcon ? 'PASS' : 'FAIL',
      details: 'Integer and varchar icons visible'
    });
  } catch (error) {
    testResults.push({
      category: 'Field Icons',
      test: 'Icon system',
      status: 'FAIL',
      details: error.message
    });
  }
  
  // Test Suite 4: Search Functionality
  console.log('Running Search Tests...');
  try {
    await page.fill('[aria-label="Search source schema fields"]', 'email');
    await page.waitForTimeout(500);
    
    const visibleFields = await page.locator('.field-name:visible').count();
    testResults.push({
      category: 'Search',
      test: 'Search filtering',
      status: visibleFields > 0 && visibleFields < 10 ? 'PASS' : 'FAIL',
      details: `Filtered to ${visibleFields} fields`
    });
    
    await page.fill('[aria-label="Search source schema fields"]', '');
    await page.waitForTimeout(300);
  } catch (error) {
    testResults.push({
      category: 'Search',
      test: 'Search functionality',
      status: 'FAIL',
      details: error.message
    });
  }
  
  // Test Suite 5: Drag and Drop
  console.log('Running Drag and Drop Tests...');
  try {
    const dragSource = page.locator('.field-name').first();
    const dropTarget = page.locator('.mapping-drop-zone');
    
    await dragSource.hover();
    await page.mouse.down();
    await dropTarget.hover();
    await page.mouse.up();
    
    const eventLogs = await page.locator('.log-entry').count();
    testResults.push({
      category: 'Drag & Drop',
      test: 'Drag and drop operation',
      status: eventLogs > 0 ? 'PASS' : 'FAIL',
      details: `Generated ${eventLogs} event logs`
    });
  } catch (error) {
    testResults.push({
      category: 'Drag & Drop',
      test: 'Drag functionality',
      status: 'FAIL',
      details: error.message
    });
  }
  
  // Test Suite 6: Refresh Functionality
  console.log('Running Refresh Tests...');
  try {
    const refreshBtn = page.locator('button:text("Refresh")').first();
    await refreshBtn.click();
    await page.waitForTimeout(300);
    
    const refreshEvent = await page.locator('.log-entry:has-text("refresh")').count();
    testResults.push({
      category: 'Refresh',
      test: 'Refresh button functionality',
      status: refreshEvent > 0 ? 'PASS' : 'FAIL',
      details: 'Refresh event logged'
    });
  } catch (error) {
    testResults.push({
      category: 'Refresh',
      test: 'Refresh functionality',
      status: 'FAIL',
      details: error.message
    });
  }
  
  // Test Suite 7: Accessibility
  console.log('Running Accessibility Tests...');
  try {
    const regions = await page.locator('[role="region"]').count();
    const trees = await page.locator('[role="tree"]').count();
    const treeItems = await page.locator('[role="treeitem"]').count();
    
    testResults.push({
      category: 'Accessibility',
      test: 'ARIA roles implemented',
      status: regions >= 2 && trees >= 2 && treeItems > 0 ? 'PASS' : 'FAIL',
      details: `${regions} regions, ${trees} trees, ${treeItems} tree items`
    });
  } catch (error) {
    testResults.push({
      category: 'Accessibility',
      test: 'Accessibility compliance',
      status: 'FAIL',
      details: error.message
    });
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results-screenshot.png', fullPage: true });
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  await browser.close();
  
  // Generate Report
  generateHTMLReport(testResults, totalDuration);
  
  return testResults;
}

function generateHTMLReport(testResults, duration) {
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const total = testResults.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Schema Panel Component - Playwright Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #1976D2;
            padding-bottom: 10px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e9ecef;
        }
        .metric h3 {
            margin: 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .metric .value {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric.passed .value { color: #4CAF50; }
        .metric.failed .value { color: #f44336; }
        .metric.total .value { color: #2196F3; }
        .metric.duration .value { color: #FF9800; }
        .metric.rate .value { color: #9C27B0; }
        
        .test-results {
            margin-top: 40px;
        }
        .category {
            margin-bottom: 30px;
        }
        .category h2 {
            color: #1976D2;
            font-size: 20px;
            margin-bottom: 15px;
            padding: 10px;
            background: #E3F2FD;
            border-radius: 4px;
        }
        .test {
            display: grid;
            grid-template-columns: 40px 1fr 100px;
            gap: 15px;
            padding: 12px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            align-items: center;
        }
        .test.pass { background: #E8F5E9; }
        .test.fail { background: #FFEBEE; }
        .status {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
        }
        .status.pass { background: #4CAF50; }
        .status.fail { background: #f44336; }
        .test-name {
            font-weight: 500;
            color: #333;
        }
        .test-details {
            color: #666;
            font-size: 14px;
        }
        .timestamp {
            text-align: center;
            color: #999;
            margin-top: 40px;
            font-size: 14px;
        }
        .screenshot {
            margin-top: 30px;
            text-align: center;
        }
        .screenshot img {
            max-width: 100%;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Schema Panel Component - Test Report</h1>
        <p style="color: #666;">Task 12 Implementation Validation • Playwright E2E Testing</p>
        
        <div class="summary">
            <div class="metric total">
                <h3>Total Tests</h3>
                <div class="value">${total}</div>
            </div>
            <div class="metric passed">
                <h3>Passed</h3>
                <div class="value">${passed}</div>
            </div>
            <div class="metric failed">
                <h3>Failed</h3>
                <div class="value">${failed}</div>
            </div>
            <div class="metric rate">
                <h3>Pass Rate</h3>
                <div class="value">${passRate}%</div>
            </div>
            <div class="metric duration">
                <h3>Duration</h3>
                <div class="value">${(duration / 1000).toFixed(1)}s</div>
            </div>
        </div>
        
        <div class="test-results">
            ${generateTestResultsHTML(testResults)}
        </div>
        
        <div class="timestamp">
            Generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
  
  const fs = require('fs');
  fs.writeFileSync('schema-panel-test-report.html', html);
  console.log('\n✅ Test report generated: schema-panel-test-report.html');
  
  // Console summary
  console.log('\n=== TEST EXECUTION SUMMARY ===');
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} (${passRate}%)`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
}

function generateTestResultsHTML(results) {
  const categories = {};
  results.forEach(result => {
    if (!categories[result.category]) {
      categories[result.category] = [];
    }
    categories[result.category].push(result);
  });
  
  let html = '';
  for (const [category, tests] of Object.entries(categories)) {
    html += `<div class="category">
        <h2>${category}</h2>`;
    
    tests.forEach(test => {
      const statusClass = test.status === 'PASS' ? 'pass' : 'fail';
      const statusIcon = test.status === 'PASS' ? '✓' : '✗';
      
      html += `
        <div class="test ${statusClass}">
            <div class="status ${statusClass}">${statusIcon}</div>
            <div>
                <div class="test-name">${test.test}</div>
                <div class="test-details">${test.details}</div>
            </div>
            <div style="text-align: right; font-weight: bold; color: ${test.status === 'PASS' ? '#4CAF50' : '#f44336'}">
                ${test.status}
            </div>
        </div>`;
    });
    
    html += '</div>';
  }
  
  return html;
}

// Run the tests
runSchemaTests().catch(console.error);