const EventEmitter = require('events');
const logger = require('../../../src/utils/logger');

/**
 * Rollback Action Types
 */
const RollbackActionType = {
  RESTORE_STATE: 'RESTORE_STATE',
  UNDO_OPERATION: 'UNDO_OPERATION',
  COMPENSATE: 'COMPENSATE',
  DELETE_CREATED: 'DELETE_CREATED',
  REVERT_UPDATED: 'REVERT_UPDATED',
  CUSTOM: 'CUSTOM'
};

/**
 * Rollback Manager
 * Manages transaction-like rollback capabilities for mapping operations
 */
class RollbackManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxHistorySize: options.maxHistorySize || 1000,
      enableSnapshots: options.enableSnapshots !== false,
      snapshotInterval: options.snapshotInterval || 100, // Take snapshot every N operations
      compressionEnabled: options.compressionEnabled || false
    };
    
    // Transaction state
    this.transactions = new Map();
    this.activeTransaction = null;
    
    // Rollback history
    this.rollbackHistory = [];
    
    // Statistics
    this.stats = {
      totalTransactions: 0,
      successfulRollbacks: 0,
      failedRollbacks: 0,
      partialRollbacks: 0,
      activeTransactions: 0
    };
  }

  /**
   * Start a new transaction
   */
  startTransaction(transactionId = null) {
    const id = transactionId || this.generateTransactionId();
    
    if (this.transactions.has(id)) {
      throw new Error(`Transaction ${id} already exists`);
    }
    
    const transaction = {
      id,
      startTime: new Date(),
      actions: [],
      snapshots: [],
      state: 'active',
      metadata: {},
      rollbackStrategy: 'sequential' // sequential, parallel, compensating
    };
    
    this.transactions.set(id, transaction);
    this.activeTransaction = transaction;
    this.stats.totalTransactions++;
    this.stats.activeTransactions++;
    
    this.emit('transactionStarted', { transactionId: id });
    
    return id;
  }

  /**
   * Record an action in the current transaction
   */
  recordAction(action) {
    if (!this.activeTransaction) {
      throw new Error('No active transaction');
    }
    
    const actionRecord = {
      id: this.generateActionId(),
      type: action.type || RollbackActionType.CUSTOM,
      timestamp: new Date(),
      description: action.description,
      data: action.data || {},
      rollbackFunction: action.rollbackFunction,
      rollbackData: action.rollbackData || {},
      compensatingAction: action.compensatingAction,
      priority: action.priority || 0,
      dependencies: action.dependencies || []
    };
    
    // Validate rollback capability
    if (!actionRecord.rollbackFunction && !actionRecord.compensatingAction) {
      logger.warn('Action recorded without rollback capability:', actionRecord);
    }
    
    this.activeTransaction.actions.push(actionRecord);
    
    // Take snapshot if needed
    if (this.options.enableSnapshots && 
        this.activeTransaction.actions.length % this.options.snapshotInterval === 0) {
      this.takeSnapshot();
    }
    
    this.emit('actionRecorded', { 
      transactionId: this.activeTransaction.id, 
      action: actionRecord 
    });
    
    return actionRecord.id;
  }

  /**
   * Commit the current transaction
   */
  commitTransaction(transactionId = null) {
    const transaction = transactionId 
      ? this.transactions.get(transactionId) 
      : this.activeTransaction;
    
    if (!transaction) {
      throw new Error('No transaction to commit');
    }
    
    if (transaction.state !== 'active') {
      throw new Error(`Cannot commit transaction in state: ${transaction.state}`);
    }
    
    transaction.state = 'committed';
    transaction.endTime = new Date();
    
    // Clear active transaction if it's the current one
    if (this.activeTransaction && this.activeTransaction.id === transaction.id) {
      this.activeTransaction = null;
    }
    
    this.stats.activeTransactions--;
    
    // Add to history
    this.addToHistory({
      type: 'commit',
      transactionId: transaction.id,
      timestamp: transaction.endTime,
      actionCount: transaction.actions.length
    });
    
    this.emit('transactionCommitted', { transactionId: transaction.id });
    
    // Clean up old committed transactions
    this.cleanupOldTransactions();
    
    return transaction;
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transactionId = null, options = {}) {
    const transaction = transactionId 
      ? this.transactions.get(transactionId) 
      : this.activeTransaction;
    
    if (!transaction) {
      throw new Error('No transaction to rollback');
    }
    
    const rollbackOptions = {
      strategy: options.strategy || transaction.rollbackStrategy,
      partial: options.partial || false,
      fromAction: options.fromAction || null,
      toAction: options.toAction || null,
      skipErrors: options.skipErrors !== false
    };
    
    transaction.state = 'rolling_back';
    
    const rollbackResult = {
      transactionId: transaction.id,
      startTime: new Date(),
      actions: [],
      errors: [],
      status: 'success'
    };
    
    try {
      // Determine actions to rollback
      let actionsToRollback = [...transaction.actions];
      
      if (rollbackOptions.partial) {
        actionsToRollback = this.filterActionsForPartialRollback(
          actionsToRollback,
          rollbackOptions
        );
      }
      
      // Sort by priority and dependencies
      actionsToRollback = this.sortActionsForRollback(actionsToRollback);
      
      // Execute rollback based on strategy
      switch (rollbackOptions.strategy) {
        case 'parallel':
          await this.rollbackParallel(actionsToRollback, rollbackResult, rollbackOptions);
          break;
        case 'compensating':
          await this.rollbackCompensating(actionsToRollback, rollbackResult, rollbackOptions);
          break;
        case 'sequential':
        default:
          await this.rollbackSequential(actionsToRollback, rollbackResult, rollbackOptions);
      }
      
      // Update transaction state
      if (rollbackResult.errors.length > 0 && !rollbackOptions.skipErrors) {
        transaction.state = 'rollback_failed';
        rollbackResult.status = 'failed';
        this.stats.failedRollbacks++;
      } else if (rollbackOptions.partial || rollbackResult.errors.length > 0) {
        transaction.state = 'partially_rolled_back';
        rollbackResult.status = 'partial';
        this.stats.partialRollbacks++;
      } else {
        transaction.state = 'rolled_back';
        rollbackResult.status = 'success';
        this.stats.successfulRollbacks++;
      }
      
    } catch (error) {
      transaction.state = 'rollback_failed';
      rollbackResult.status = 'failed';
      rollbackResult.errors.push({
        message: error.message,
        stack: error.stack
      });
      this.stats.failedRollbacks++;
    }
    
    rollbackResult.endTime = new Date();
    rollbackResult.duration = rollbackResult.endTime - rollbackResult.startTime;
    
    // Add to history
    this.addToHistory({
      type: 'rollback',
      transactionId: transaction.id,
      result: rollbackResult
    });
    
    // Clear active transaction if rolled back
    if (this.activeTransaction && this.activeTransaction.id === transaction.id) {
      this.activeTransaction = null;
      this.stats.activeTransactions--;
    }
    
    this.emit('transactionRolledBack', rollbackResult);
    
    return rollbackResult;
  }

  /**
   * Sequential rollback execution
   */
  async rollbackSequential(actions, result, options) {
    // Reverse order for sequential rollback
    const reversedActions = actions.reverse();
    
    for (const action of reversedActions) {
      try {
        await this.executeRollbackAction(action, result);
      } catch (error) {
        result.errors.push({
          actionId: action.id,
          error: error.message,
          stack: error.stack
        });
        
        if (!options.skipErrors) {
          throw error;
        }
      }
    }
  }

  /**
   * Parallel rollback execution
   */
  async rollbackParallel(actions, result, options) {
    // Group actions by dependencies
    const actionGroups = this.groupActionsByDependencies(actions);
    
    // Execute each group in sequence, but actions within group in parallel
    for (const group of actionGroups) {
      const promises = group.map(action => 
        this.executeRollbackAction(action, result).catch(error => {
          result.errors.push({
            actionId: action.id,
            error: error.message,
            stack: error.stack
          });
          
          if (!options.skipErrors) {
            throw error;
          }
        })
      );
      
      await Promise.all(promises);
    }
  }

  /**
   * Compensating rollback execution
   */
  async rollbackCompensating(actions, result, options) {
    for (const action of actions) {
      if (!action.compensatingAction) {
        logger.warn('No compensating action for:', action.id);
        continue;
      }
      
      try {
        const compensatingResult = await action.compensatingAction(action.data);
        
        result.actions.push({
          actionId: action.id,
          type: 'compensating',
          status: 'success',
          result: compensatingResult
        });
      } catch (error) {
        result.errors.push({
          actionId: action.id,
          type: 'compensating',
          error: error.message,
          stack: error.stack
        });
        
        if (!options.skipErrors) {
          throw error;
        }
      }
    }
  }

  /**
   * Execute a single rollback action
   */
  async executeRollbackAction(action, result) {
    const startTime = Date.now();
    
    try {
      let rollbackResult;
      
      if (action.rollbackFunction) {
        rollbackResult = await action.rollbackFunction(action.rollbackData);
      } else if (action.compensatingAction) {
        rollbackResult = await action.compensatingAction(action.data);
      } else {
        throw new Error(`No rollback method available for action ${action.id}`);
      }
      
      const actionResult = {
        actionId: action.id,
        type: action.type,
        status: 'success',
        duration: Date.now() - startTime,
        result: rollbackResult
      };
      
      result.actions.push(actionResult);
      
      this.emit('actionRolledBack', actionResult);
      
      return rollbackResult;
      
    } catch (error) {
      const actionError = {
        actionId: action.id,
        type: action.type,
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message
      };
      
      result.actions.push(actionError);
      
      this.emit('actionRollbackFailed', actionError);
      
      throw error;
    }
  }

  /**
   * Take a snapshot of current state
   */
  takeSnapshot(data = null) {
    if (!this.activeTransaction) {
      return;
    }
    
    const snapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date(),
      actionCount: this.activeTransaction.actions.length,
      data: data || {},
      compressed: false
    };
    
    // Compress if enabled
    if (this.options.compressionEnabled && snapshot.data) {
      // In real implementation, would use compression library
      snapshot.compressed = true;
    }
    
    this.activeTransaction.snapshots.push(snapshot);
    
    this.emit('snapshotTaken', {
      transactionId: this.activeTransaction.id,
      snapshotId: snapshot.id
    });
    
    return snapshot.id;
  }

  /**
   * Restore from snapshot
   */
  async restoreSnapshot(snapshotId, transactionId = null) {
    const transaction = transactionId 
      ? this.transactions.get(transactionId) 
      : this.activeTransaction;
    
    if (!transaction) {
      throw new Error('No transaction found');
    }
    
    const snapshot = transaction.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    
    // Rollback actions after snapshot
    const actionsAfterSnapshot = transaction.actions.slice(snapshot.actionCount);
    
    if (actionsAfterSnapshot.length > 0) {
      await this.rollbackTransaction(transaction.id, {
        partial: true,
        fromAction: snapshot.actionCount
      });
    }
    
    this.emit('snapshotRestored', {
      transactionId: transaction.id,
      snapshotId: snapshot.id,
      rolledBackActions: actionsAfterSnapshot.length
    });
    
    return snapshot;
  }

  /**
   * Create savepoint (lightweight snapshot)
   */
  createSavepoint(name = null) {
    if (!this.activeTransaction) {
      throw new Error('No active transaction');
    }
    
    const savepoint = {
      name: name || `savepoint_${Date.now()}`,
      actionIndex: this.activeTransaction.actions.length,
      timestamp: new Date()
    };
    
    this.activeTransaction.metadata.savepoints = 
      this.activeTransaction.metadata.savepoints || [];
    this.activeTransaction.metadata.savepoints.push(savepoint);
    
    return savepoint.name;
  }

  /**
   * Rollback to savepoint
   */
  async rollbackToSavepoint(savepointName) {
    if (!this.activeTransaction) {
      throw new Error('No active transaction');
    }
    
    const savepoints = this.activeTransaction.metadata.savepoints || [];
    const savepoint = savepoints.find(s => s.name === savepointName);
    
    if (!savepoint) {
      throw new Error(`Savepoint ${savepointName} not found`);
    }
    
    return await this.rollbackTransaction(this.activeTransaction.id, {
      partial: true,
      fromAction: savepoint.actionIndex
    });
  }

  /**
   * Helper methods
   */
  
  filterActionsForPartialRollback(actions, options) {
    let filtered = [...actions];
    
    if (options.fromAction !== null) {
      filtered = filtered.slice(options.fromAction);
    }
    
    if (options.toAction !== null) {
      filtered = filtered.slice(0, options.toAction + 1);
    }
    
    return filtered;
  }

  sortActionsForRollback(actions) {
    // Sort by priority (higher priority first) and maintain dependencies
    return actions.sort((a, b) => {
      // Check dependencies
      if (a.dependencies.includes(b.id)) return 1;
      if (b.dependencies.includes(a.id)) return -1;
      
      // Sort by priority
      return b.priority - a.priority;
    });
  }

  groupActionsByDependencies(actions) {
    const groups = [];
    const processed = new Set();
    
    // Build dependency graph
    const dependencyMap = new Map();
    actions.forEach(action => {
      dependencyMap.set(action.id, action.dependencies || []);
    });
    
    // Group actions that can be executed in parallel
    while (processed.size < actions.length) {
      const currentGroup = [];
      
      for (const action of actions) {
        if (processed.has(action.id)) continue;
        
        // Check if all dependencies are processed
        const canProcess = action.dependencies.every(dep => processed.has(dep));
        
        if (canProcess) {
          currentGroup.push(action);
          processed.add(action.id);
        }
      }
      
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      } else {
        // Circular dependency or error
        logger.warn('Circular dependency detected in rollback actions');
        break;
      }
    }
    
    return groups;
  }

  generateTransactionId() {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  generateActionId() {
    return `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  generateSnapshotId() {
    return `snap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  addToHistory(entry) {
    this.rollbackHistory.push({
      ...entry,
      timestamp: entry.timestamp || new Date()
    });
    
    // Maintain history size
    if (this.rollbackHistory.length > this.options.maxHistorySize) {
      this.rollbackHistory.splice(0, 100); // Remove oldest 100 entries
    }
  }

  cleanupOldTransactions() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [id, transaction] of this.transactions) {
      if (transaction.state === 'committed' || transaction.state === 'rolled_back') {
        const age = now - transaction.endTime.getTime();
        if (age > maxAge) {
          this.transactions.delete(id);
        }
      }
    }
  }

  /**
   * Get transaction state
   */
  getTransaction(transactionId) {
    return this.transactions.get(transactionId);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      historySize: this.rollbackHistory.length,
      transactionCount: this.transactions.size
    };
  }

  /**
   * Get rollback history
   */
  getHistory(limit = 100) {
    return this.rollbackHistory.slice(-limit);
  }

  /**
   * Clear completed transactions
   */
  clearCompletedTransactions() {
    let cleared = 0;
    
    for (const [id, transaction] of this.transactions) {
      if (transaction.state === 'committed' || transaction.state === 'rolled_back') {
        this.transactions.delete(id);
        cleared++;
      }
    }
    
    logger.info(`Cleared ${cleared} completed transactions`);
    
    return cleared;
  }
}

module.exports = {
  RollbackManager,
  RollbackActionType
};