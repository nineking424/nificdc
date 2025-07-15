/**
 * Execution Strategy Module
 * 
 * Provides various execution strategies for the Enhanced Mapping Engine:
 * - Sequential: Process records one by one in order
 * - Batch: Process records in configurable batches
 * - Stream: Process records as a continuous stream
 * - Parallel: Process records concurrently
 * 
 * Also includes execution context management for tracking
 * execution state, metrics, and profiling.
 */

const {
  ExecutionStrategy,
  SequentialExecutor,
  BatchExecutor,
  StreamExecutor,
  ParallelExecutor,
  createExecutor
} = require('./ExecutionStrategy');

const ExecutionContext = require('./ExecutionContext');

module.exports = {
  // Execution strategies
  ExecutionStrategy,
  SequentialExecutor,
  BatchExecutor,
  StreamExecutor,
  ParallelExecutor,
  createExecutor,
  
  // Context management
  ExecutionContext
};