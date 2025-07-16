const { PerformanceOptimizer, MemoryManager, CompressionManager, BatchOptimizer, CacheManager } = require('./PerformanceOptimizer');
const { DataStreamOptimizer, OptimizedTransform, ParallelProcessingStream, BatchProcessingStream, OptimizedPipeline } = require('./DataStreamOptimizer');
const { ConnectionPoolManager, ConnectionPool } = require('./ConnectionPoolManager');

module.exports = {
  // Main performance optimizer
  PerformanceOptimizer,
  
  // Individual optimization components
  MemoryManager,
  CompressionManager,
  BatchOptimizer,
  CacheManager,
  
  // Stream optimization
  DataStreamOptimizer,
  OptimizedTransform,
  ParallelProcessingStream,
  BatchProcessingStream,
  OptimizedPipeline,
  
  // Connection management
  ConnectionPoolManager,
  ConnectionPool
};