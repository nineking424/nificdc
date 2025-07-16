const { performance } = require('perf_hooks');
const { EnhancedMappingEngine } = require('../../services/mappingEngine/EnhancedMappingEngine');
const { EnhancedMappingService } = require('../../services/enhanced-mapping');

/**
 * Enhanced Mapping Engine Performance Benchmarks
 * 
 * This benchmark suite tests the performance characteristics of the Enhanced Mapping Engine
 * under various scenarios including data size, complexity, and concurrency.
 */

class PerformanceBenchmark {
  constructor() {
    this.engine = null;
    this.service = null;
    this.results = {};
  }

  async setup() {
    console.log('🚀 Setting up Enhanced Mapping Engine Performance Benchmarks...\n');
    
    this.engine = new EnhancedMappingEngine({
      enableCache: true,
      enableMetrics: true,
      enablePerformanceOptimization: true,
      performanceOptions: {
        memoryThreshold: 0.8,
        optimizationStrategies: ['compression', 'batching', 'caching'],
        batchSizeMin: 100,
        batchSizeMax: 5000
      }
    });

    await this.engine.initialize();

    this.service = new EnhancedMappingService({
      autoInitialize: false,
      engineOptions: {
        enableCache: true,
        enableMetrics: true,
        enablePerformanceOptimization: true
      }
    });

    await this.service.initialize();
    
    console.log('✅ Setup complete\n');
  }

  async teardown() {
    if (this.engine) {
      await this.engine.shutdown();
    }
    if (this.service) {
      await this.service.shutdown();
    }
  }

  // Generate test data of various sizes and complexities
  generateTestData(size, complexity = 'simple') {
    const data = [];
    
    for (let i = 0; i < size; i++) {
      const baseRecord = {
        id: i + 1,
        name: `Record ${i + 1}`,
        email: `record${i + 1}@example.com`,
        timestamp: new Date().toISOString(),
        value: Math.random() * 1000
      };

      if (complexity === 'medium') {
        baseRecord.address = {
          street: `${i + 1} Test Street`,
          city: 'Test City',
          state: 'TS',
          zipCode: `${String(i + 1).padStart(5, '0')}`,
          country: 'Test Country'
        };
        baseRecord.metadata = {
          source: 'benchmark',
          category: ['test', 'performance', 'data'],
          priority: Math.floor(Math.random() * 5) + 1
        };
      }

      if (complexity === 'complex') {
        baseRecord.address = {
          street: `${i + 1} Test Street`,
          city: 'Test City',
          state: 'TS',
          zipCode: `${String(i + 1).padStart(5, '0')}`,
          country: 'Test Country',
          coordinates: {
            latitude: Math.random() * 180 - 90,
            longitude: Math.random() * 360 - 180
          }
        };
        baseRecord.orders = Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, orderIndex) => ({
          orderId: `ORD-${i + 1}-${orderIndex + 1}`,
          amount: Math.round((Math.random() * 500 + 10) * 100) / 100,
          date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          items: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, itemIndex) => ({
            itemId: `ITEM-${i + 1}-${orderIndex + 1}-${itemIndex + 1}`,
            name: `Item ${itemIndex + 1}`,
            quantity: Math.floor(Math.random() * 10) + 1,
            price: Math.round((Math.random() * 100 + 1) * 100) / 100
          }))
        }));
        baseRecord.preferences = {
          notifications: {
            email: Math.random() > 0.5,
            sms: Math.random() > 0.5,
            push: Math.random() > 0.5
          },
          privacy: {
            shareData: Math.random() > 0.5,
            tracking: Math.random() > 0.5
          },
          settings: {
            theme: ['light', 'dark'][Math.floor(Math.random() * 2)],
            language: ['en', 'es', 'fr', 'de'][Math.floor(Math.random() * 4)],
            timezone: 'UTC'
          }
        };
      }

      data.push(baseRecord);
    }
    
    return data;
  }

  // Generate mappings of various complexities
  generateMapping(complexity = 'simple') {
    const baseMapping = {
      id: `benchmark-mapping-${complexity}`,
      version: '1.0.0',
      source: { type: 'object' },
      target: { type: 'object' },
      rules: []
    };

    if (complexity === 'simple') {
      baseMapping.rules = [
        { type: 'direct', source: 'id', target: 'recordId' },
        { type: 'direct', source: 'name', target: 'recordName' },
        { type: 'direct', source: 'email', target: 'contactEmail' },
        { type: 'direct', source: 'value', target: 'recordValue' }
      ];
    }

    if (complexity === 'medium') {
      baseMapping.rules = [
        { type: 'direct', source: 'id', target: 'recordId' },
        { type: 'direct', source: 'name', target: 'recordName' },
        { type: 'direct', source: 'email', target: 'contactEmail' },
        { type: 'concatenation', sources: ['address.street', 'address.city', 'address.state'], target: 'fullAddress', separator: ', ' },
        { type: 'direct', source: 'address.zipCode', target: 'postalCode' },
        { type: 'conditional', condition: 'value > 500', source: 'value', target: 'highValue', trueValue: true, falseValue: false },
        { type: 'transformation', source: 'metadata.priority', target: 'priorityLevel', expression: 'value * 10' }
      ];
    }

    if (complexity === 'complex') {
      baseMapping.rules = [
        { type: 'direct', source: 'id', target: 'recordId' },
        { type: 'direct', source: 'name', target: 'recordName' },
        { type: 'direct', source: 'email', target: 'contactEmail' },
        { type: 'concatenation', sources: ['address.street', 'address.city', 'address.state', 'address.country'], target: 'fullAddress', separator: ', ' },
        { type: 'direct', source: 'address.coordinates.latitude', target: 'latitude' },
        { type: 'direct', source: 'address.coordinates.longitude', target: 'longitude' },
        { type: 'aggregation', source: 'orders', target: 'totalOrderValue', operation: 'sum', field: 'amount' },
        { type: 'aggregation', source: 'orders', target: 'orderCount', operation: 'count' },
        { type: 'aggregation', source: 'orders', target: 'averageOrderValue', operation: 'avg', field: 'amount' },
        { type: 'aggregation', source: 'orders', target: 'lastOrderDate', operation: 'max', field: 'date' },
        { type: 'conditional', condition: 'preferences.notifications.email === true', source: 'email', target: 'emailNotificationContact', trueValue: 'email', falseValue: null },
        { type: 'transformation', source: 'preferences.settings.theme', target: 'isDarkMode', expression: 'value === "dark"' }
      ];
    }

    return baseMapping;
  }

  async measureExecution(name, fn) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    const result = await fn();
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const executionTime = endTime - startTime;
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal
    };

    return {
      name,
      executionTime,
      memoryDelta,
      result
    };
  }

  async runDataSizeBenchmarks() {
    console.log('📊 Running Data Size Benchmarks...\n');
    
    const sizes = [100, 500, 1000, 5000, 10000];
    const mapping = this.generateMapping('medium');
    
    for (const size of sizes) {
      const testData = this.generateTestData(size, 'medium');
      
      const measurement = await this.measureExecution(`Data Size: ${size} records`, async () => {
        const results = [];
        for (const data of testData) {
          const result = await this.engine.executeMapping(mapping, data);
          results.push(result);
        }
        return results;
      });
      
      this.results[`dataSize_${size}`] = {
        ...measurement,
        recordsPerSecond: size / (measurement.executionTime / 1000),
        memoryPerRecord: measurement.memoryDelta.heapUsed / size
      };
      
      console.log(`✅ ${measurement.name}: ${measurement.executionTime.toFixed(2)}ms (${this.results[`dataSize_${size}`].recordsPerSecond.toFixed(2)} records/sec)`);
    }
    
    console.log();
  }

  async runComplexityBenchmarks() {
    console.log('🧩 Running Complexity Benchmarks...\n');
    
    const complexities = ['simple', 'medium', 'complex'];
    const dataSize = 1000;
    
    for (const complexity of complexities) {
      const mapping = this.generateMapping(complexity);
      const testData = this.generateTestData(dataSize, complexity);
      
      const measurement = await this.measureExecution(`Complexity: ${complexity}`, async () => {
        const results = [];
        for (const data of testData) {
          const result = await this.engine.executeMapping(mapping, data);
          results.push(result);
        }
        return results;
      });
      
      this.results[`complexity_${complexity}`] = {
        ...measurement,
        recordsPerSecond: dataSize / (measurement.executionTime / 1000),
        memoryPerRecord: measurement.memoryDelta.heapUsed / dataSize
      };
      
      console.log(`✅ ${measurement.name}: ${measurement.executionTime.toFixed(2)}ms (${this.results[`complexity_${complexity}`].recordsPerSecond.toFixed(2)} records/sec)`);
    }
    
    console.log();
  }

  async runBatchProcessingBenchmarks() {
    console.log('📦 Running Batch Processing Benchmarks...\n');
    
    const batchSizes = [10, 50, 100, 500, 1000];
    const totalRecords = 5000;
    const mapping = this.generateMapping('medium');
    const testData = this.generateTestData(totalRecords, 'medium');
    
    for (const batchSize of batchSizes) {
      const measurement = await this.measureExecution(`Batch Size: ${batchSize}`, async () => {
        const results = [];
        for (let i = 0; i < testData.length; i += batchSize) {
          const batch = testData.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(data => this.engine.executeMapping(mapping, data))
          );
          results.push(...batchResults);
        }
        return results;
      });
      
      this.results[`batch_${batchSize}`] = {
        ...measurement,
        recordsPerSecond: totalRecords / (measurement.executionTime / 1000),
        batches: Math.ceil(totalRecords / batchSize)
      };
      
      console.log(`✅ ${measurement.name}: ${measurement.executionTime.toFixed(2)}ms (${this.results[`batch_${batchSize}`].recordsPerSecond.toFixed(2)} records/sec, ${this.results[`batch_${batchSize}`].batches} batches)`);
    }
    
    console.log();
  }

  async runConcurrencyBenchmarks() {
    console.log('⚡ Running Concurrency Benchmarks...\n');
    
    const concurrencyLevels = [1, 2, 4, 8, 16];
    const recordsPerWorker = 500;
    const mapping = this.generateMapping('medium');
    
    for (const concurrency of concurrencyLevels) {
      const totalRecords = recordsPerWorker * concurrency;
      const testData = this.generateTestData(totalRecords, 'medium');
      
      const measurement = await this.measureExecution(`Concurrency: ${concurrency}`, async () => {
        const workers = [];
        const chunkSize = Math.ceil(testData.length / concurrency);
        
        for (let i = 0; i < concurrency; i++) {
          const chunk = testData.slice(i * chunkSize, (i + 1) * chunkSize);
          const worker = Promise.all(
            chunk.map(data => this.engine.executeMapping(mapping, data))
          );
          workers.push(worker);
        }
        
        const results = await Promise.all(workers);
        return results.flat();
      });
      
      this.results[`concurrency_${concurrency}`] = {
        ...measurement,
        recordsPerSecond: totalRecords / (measurement.executionTime / 1000),
        workers: concurrency
      };
      
      console.log(`✅ ${measurement.name}: ${measurement.executionTime.toFixed(2)}ms (${this.results[`concurrency_${concurrency}`].recordsPerSecond.toFixed(2)} records/sec, ${concurrency} workers)`);
    }
    
    console.log();
  }

  async runCachingBenchmarks() {
    console.log('🗄️ Running Caching Benchmarks...\n');
    
    const mapping = this.generateMapping('medium');
    const testData = this.generateTestData(100, 'medium');
    
    // Cold run (no cache)
    await this.engine.clearCache();
    const coldRun = await this.measureExecution('Cold Run (No Cache)', async () => {
      const results = [];
      for (const data of testData) {
        const result = await this.engine.executeMapping(mapping, data);
        results.push(result);
      }
      return results;
    });
    
    // Warm run (with cache)
    const warmRun = await this.measureExecution('Warm Run (With Cache)', async () => {
      const results = [];
      for (const data of testData) {
        const result = await this.engine.executeMapping(mapping, data);
        results.push(result);
      }
      return results;
    });
    
    this.results.caching = {
      coldRun,
      warmRun,
      cacheSpeedup: coldRun.executionTime / warmRun.executionTime,
      memorySavings: coldRun.memoryDelta.heapUsed - warmRun.memoryDelta.heapUsed
    };
    
    console.log(`✅ Cold Run: ${coldRun.executionTime.toFixed(2)}ms`);
    console.log(`✅ Warm Run: ${warmRun.executionTime.toFixed(2)}ms`);
    console.log(`✅ Cache Speedup: ${this.results.caching.cacheSpeedup.toFixed(2)}x`);
    console.log();
  }

  async runServiceLayerBenchmarks() {
    console.log('🔧 Running Service Layer Benchmarks...\n');
    
    const mappingId = 'service-benchmark-mapping';
    const testData = this.generateTestData(1000, 'medium');
    
    // Mock mapping configuration
    this.service.getMappingConfiguration = jest.fn().mockResolvedValue(this.generateMapping('medium'));
    
    // Single execution benchmark
    const singleExecution = await this.measureExecution('Service Single Execution', async () => {
      return await this.service.executeMapping(mappingId, testData[0]);
    });
    
    // Batch execution benchmark
    const batchExecution = await this.measureExecution('Service Batch Execution', async () => {
      return await this.service.executeBatchMapping(mappingId, testData.slice(0, 100), {
        batchSize: 20,
        parallelism: 4
      });
    });
    
    // Streaming benchmark
    const streamingExecution = await this.measureExecution('Service Streaming', async () => {
      return await this.service.processWithStreaming(mappingId, testData.slice(0, 500), {
        maxConcurrency: 10,
        enableBackpressureControl: true
      });
    });
    
    this.results.serviceLayer = {
      singleExecution,
      batchExecution,
      streamingExecution
    };
    
    console.log(`✅ Single Execution: ${singleExecution.executionTime.toFixed(2)}ms`);
    console.log(`✅ Batch Execution: ${batchExecution.executionTime.toFixed(2)}ms`);
    console.log(`✅ Streaming: ${streamingExecution.executionTime.toFixed(2)}ms`);
    console.log();
  }

  generateReport() {
    console.log('📋 Performance Benchmark Report\n');
    console.log('=' .repeat(80));
    
    // Data Size Performance
    console.log('\n📊 Data Size Performance:');
    Object.keys(this.results)
      .filter(key => key.startsWith('dataSize_'))
      .forEach(key => {
        const result = this.results[key];
        console.log(`  ${result.name}: ${result.recordsPerSecond.toFixed(2)} records/sec, ${(result.memoryPerRecord / 1024).toFixed(2)} KB/record`);
      });
    
    // Complexity Performance
    console.log('\n🧩 Complexity Performance:');
    Object.keys(this.results)
      .filter(key => key.startsWith('complexity_'))
      .forEach(key => {
        const result = this.results[key];
        console.log(`  ${result.name}: ${result.recordsPerSecond.toFixed(2)} records/sec`);
      });
    
    // Batch Processing Performance
    console.log('\n📦 Batch Processing Performance:');
    Object.keys(this.results)
      .filter(key => key.startsWith('batch_'))
      .forEach(key => {
        const result = this.results[key];
        console.log(`  ${result.name}: ${result.recordsPerSecond.toFixed(2)} records/sec`);
      });
    
    // Concurrency Performance
    console.log('\n⚡ Concurrency Performance:');
    Object.keys(this.results)
      .filter(key => key.startsWith('concurrency_'))
      .forEach(key => {
        const result = this.results[key];
        console.log(`  ${result.name}: ${result.recordsPerSecond.toFixed(2)} records/sec`);
      });
    
    // Caching Performance
    if (this.results.caching) {
      console.log('\n🗄️ Caching Performance:');
      console.log(`  Cache Speedup: ${this.results.caching.cacheSpeedup.toFixed(2)}x`);
      console.log(`  Memory Savings: ${(this.results.caching.memorySavings / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // Service Layer Performance
    if (this.results.serviceLayer) {
      console.log('\n🔧 Service Layer Performance:');
      console.log(`  Single Execution: ${this.results.serviceLayer.singleExecution.executionTime.toFixed(2)}ms`);
      console.log(`  Batch Execution: ${this.results.serviceLayer.batchExecution.executionTime.toFixed(2)}ms`);
      console.log(`  Streaming: ${this.results.serviceLayer.streamingExecution.executionTime.toFixed(2)}ms`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Performance summary
    const allDataSizeResults = Object.keys(this.results)
      .filter(key => key.startsWith('dataSize_'))
      .map(key => this.results[key].recordsPerSecond);
    
    if (allDataSizeResults.length > 0) {
      const maxThroughput = Math.max(...allDataSizeResults);
      const avgThroughput = allDataSizeResults.reduce((a, b) => a + b, 0) / allDataSizeResults.length;
      
      console.log('\n🎯 Performance Summary:');
      console.log(`  Maximum Throughput: ${maxThroughput.toFixed(2)} records/sec`);
      console.log(`  Average Throughput: ${avgThroughput.toFixed(2)} records/sec`);
    }
  }

  async runAllBenchmarks() {
    try {
      await this.setup();
      
      await this.runDataSizeBenchmarks();
      await this.runComplexityBenchmarks();
      await this.runBatchProcessingBenchmarks();
      await this.runConcurrencyBenchmarks();
      await this.runCachingBenchmarks();
      await this.runServiceLayerBenchmarks();
      
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
    } finally {
      await this.teardown();
    }
  }
}

// Export for use in test files or standalone execution
module.exports = PerformanceBenchmark;

// Allow running standalone
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runAllBenchmarks().catch(console.error);
}