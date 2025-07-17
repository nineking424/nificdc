# NifiCDC Web Testing Strategy

## Overview

This document outlines the web testing strategy for the NifiCDC application, defining testing stages aligned with the development roadmap. The strategy ensures systematic validation of features as they become available through the web interface.

## Current Status

### Completed Components
- ✅ **Backend Core Services** (Tasks 1-7)
  - Universal Schema
  - Mapping Definition Model
  - System Adapters (PostgreSQL, MySQL)
  - Connection Manager
  - Validation Framework
  - Schema Discovery Service
  - Enhanced Mapping Engine
- ✅ **Frontend State Management** (Task 11)
  - Pinia Store for Mapping Management
  - 45 unit tests passing

### Missing Components for Web Access
- ❌ API Endpoints for frontend-backend communication
- ❌ UI Components for user interaction
- ❌ Transformation functions library
- ❌ Execution monitoring capabilities

## Development & Testing Stages

### Stage 1: Basic Schema Management
**Required Tasks:** Task 9 (Schema Discovery API) + Task 12 (Schema Panel)

#### Features to Test
- User authentication and authorization
- System connection management
- Schema discovery from connected systems
- Schema metadata viewing
- Tree view navigation of schema structure

#### Test Scenarios
1. **Authentication Flow**
   - Login with valid/invalid credentials
   - JWT token validation
   - Session management

2. **Schema Discovery**
   - Connect to PostgreSQL/MySQL systems
   - Discover schemas with various data types
   - Handle connection failures gracefully
   - Verify caching mechanism

3. **Schema Viewing**
   - Navigate schema tree structure
   - View column details and data types
   - Search within schemas
   - Refresh schema information

#### Validation Criteria
- All API endpoints return appropriate status codes
- Schema data matches source database structure
- UI renders schema information correctly
- Error messages are user-friendly

### Stage 2: Visual Mapping Creation
**Required Tasks:** Tasks 9, 12, 13 (Mapping Canvas)

#### Features to Test
- Drag and drop field mapping
- Visual connection lines between fields
- Mapping relationship management
- Basic mapping validation

#### Test Scenarios
1. **Drag & Drop Operations**
   - Drag source field to target field
   - Create multiple mappings
   - Invalid mapping attempts (type mismatches)
   - Remove existing mappings

2. **Visual Feedback**
   - Hover effects on draggable elements
   - Connection line rendering
   - Selection states
   - Mapping deletion confirmation

3. **State Management**
   - Mapping persistence in Pinia store
   - Undo/redo operations
   - Concurrent user scenarios

#### Validation Criteria
- Smooth drag & drop interactions
- Accurate visual representation of mappings
- State consistency between UI and store
- Performance with 100+ field mappings

### Stage 3: Complete Mapping Designer
**Required Tasks:** Tasks 9, 12, 13, 14 (Transformation Editor), 15 (Designer Integration)

#### Features to Test
- Transformation function selection
- Pipeline configuration
- Real-time preview
- Integrated designer workflow

#### Test Scenarios
1. **Transformation Configuration**
   - Add/remove transformation functions
   - Configure function parameters
   - Reorder transformation pipeline
   - Preview transformation results

2. **Designer Integration**
   - Component communication
   - Unified state management
   - Save/load mapping configurations
   - Export/import mappings

3. **Edge Cases**
   - Complex transformation chains
   - Circular dependencies
   - Large schema handling (1000+ fields)
   - Browser compatibility

#### Validation Criteria
- All components integrate seamlessly
- Transformation preview accuracy
- No memory leaks during extended use
- Responsive design on various screen sizes

### Stage 4: Full Executable System
**Required Tasks:** Tasks 8 (Transformation Functions), 9, 10 (Execution API), 12-15

#### Features to Test
- End-to-end mapping execution
- Real-time progress tracking
- Error handling and recovery
- Execution history

#### Test Scenarios
1. **Mapping Execution**
   - Execute simple mappings
   - Execute complex transformations
   - Batch vs. real-time execution
   - Concurrent executions

2. **Progress Monitoring**
   - Real-time progress updates
   - WebSocket/SSE communication
   - Execution cancellation
   - Resource usage monitoring

3. **Error Scenarios**
   - Source system unavailable
   - Target system write failures
   - Transformation errors
   - Network interruptions

4. **Performance Testing**
   - Load testing with large datasets
   - Concurrent user stress testing
   - Memory usage profiling
   - Response time benchmarking

#### Validation Criteria
- Successful data transformation and transfer
- Accurate progress reporting
- Graceful error handling
- Performance within acceptable limits

## Testing Infrastructure

### Development Environment
```yaml
Frontend:
  - URL: http://localhost:8080
  - Framework: Vue 3 + Vite
  - Testing: Vitest + Vue Test Utils

Backend:
  - URL: http://localhost:3000
  - Framework: Node.js + Express
  - Testing: Jest + Supertest

Databases:
  - PostgreSQL: localhost:5432
  - MySQL: localhost:3306
  - Test containers for isolated testing
```

### Testing Tools
1. **Unit Testing**
   - Frontend: Vitest
   - Backend: Jest

2. **Integration Testing**
   - API: Supertest
   - Database: Test containers

3. **E2E Testing**
   - Cypress or Playwright
   - Visual regression: Percy

4. **Performance Testing**
   - Load testing: k6 or JMeter
   - Monitoring: Grafana + Prometheus

## Test Data Strategy

### Schema Test Cases
1. **Simple Schemas**
   - Basic data types (string, number, date)
   - 10-20 fields

2. **Complex Schemas**
   - Nested structures
   - 100+ fields
   - Various data types

3. **Edge Cases**
   - Unicode field names
   - Reserved keywords
   - Maximum field limits

### Mapping Test Cases
1. **Basic Mappings**
   - 1:1 field mappings
   - Type-compatible transfers

2. **Complex Mappings**
   - Many-to-one mappings
   - Transformation chains
   - Conditional logic

3. **Performance Test Data**
   - 1K, 10K, 100K, 1M records
   - Various data distributions

## Continuous Testing Strategy

### CI/CD Pipeline
```yaml
stages:
  - lint
  - unit-test
  - build
  - integration-test
  - e2e-test
  - performance-test
  - deploy

test-conditions:
  - All tests must pass for merge
  - Code coverage > 80%
  - No critical security vulnerabilities
  - Performance benchmarks met
```

### Automated Testing Schedule
- **On Every Commit**: Lint + Unit tests
- **On PR**: Full test suite
- **Nightly**: E2E + Performance tests
- **Weekly**: Full regression suite

## Browser Compatibility Matrix

| Browser | Minimum Version | Testing Priority |
|---------|----------------|------------------|
| Chrome | 90+ | High |
| Firefox | 88+ | High |
| Safari | 14+ | Medium |
| Edge | 90+ | Medium |

## Mobile Responsiveness

While primarily a desktop application, basic mobile responsiveness testing should cover:
- Tablet landscape mode (1024px+)
- Responsive table layouts
- Touch-friendly controls

## Security Testing Checklist

- [ ] Authentication bypass attempts
- [ ] SQL injection in schema queries
- [ ] XSS in mapping names/descriptions
- [ ] CSRF token validation
- [ ] API rate limiting
- [ ] File upload restrictions
- [ ] Connection credential encryption

## Performance Benchmarks

| Operation | Target | Maximum |
|-----------|--------|---------|
| Page Load | < 2s | 5s |
| Schema Discovery | < 5s | 30s |
| Mapping Save | < 1s | 3s |
| Transformation Preview | < 2s | 5s |
| 10K Record Execution | < 30s | 2min |

## Rollout Strategy

### Phase 1: Internal Testing
- Development team testing
- Automated test suite completion
- Bug fixes and stabilization

### Phase 2: Beta Testing
- Limited user group
- Feedback collection
- Performance monitoring

### Phase 3: Production Release
- Gradual rollout
- A/B testing for new features
- Continuous monitoring

## Success Metrics

1. **Functional Coverage**
   - 100% of critical paths tested
   - 90%+ code coverage

2. **Performance**
   - All operations within target benchmarks
   - <1% error rate in production

3. **User Experience**
   - <5% bounce rate
   - >80% task completion rate
   - <3 clicks to create basic mapping

## Appendix: Test Case Templates

### API Test Template
```javascript
describe('POST /api/mappings/:id/execute', () => {
  it('should execute mapping successfully', async () => {
    const response = await request(app)
      .post('/api/mappings/123/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'batch' })
      .expect(200);
    
    expect(response.body).toHaveProperty('jobId');
    expect(response.body.status).toBe('running');
  });
});
```

### UI Test Template
```javascript
describe('Mapping Canvas', () => {
  it('should create field mapping via drag and drop', () => {
    cy.visit('/mappings/new');
    cy.get('[data-field="source.id"]').drag('[data-field="target.user_id"]');
    cy.get('.mapping-line').should('have.length', 1);
    cy.get('.save-mapping').click();
    cy.contains('Mapping saved successfully');
  });
});
```

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-16 | System | Initial strategy document |

---

*This document should be reviewed and updated as development progresses and new testing requirements emerge.*