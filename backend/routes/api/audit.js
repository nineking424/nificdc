const express = require('express');
const router = express.Router();
const { authorize, requireAdmin } = require('../../middleware/rbac');
const auditLogger = require('../../services/auditLogger');
const AuditLog = require('../../models/AuditLog');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

/**
 * 감사 로그 관리 API 라우터
 * 감사 로그 조회, 검색, 내보내기 기능
 */

// 감사 로그 목록 조회 - 읽기 권한 필요
router.get('/', authorize('audit', 'read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      eventType,
      userId,
      resource,
      severity,
      result,
      startDate,
      endDate,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // 필터 조건 적용
    if (eventType) {
      where.eventType = eventType;
    }

    if (userId) {
      where.userId = userId;
    }

    if (resource) {
      where.resource = resource;
    }

    if (severity) {
      where.severity = severity;
    }

    if (result) {
      where.result = result;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.timestamp[Op.lte] = new Date(endDate);
      }
    }

    // 검색어 조건
    if (search) {
      where[Op.or] = [
        { userName: { [Op.iLike]: `%${search}%` } },
        { eventType: { [Op.iLike]: `%${search}%` } },
        { resource: { [Op.iLike]: `%${search}%` } },
        { ipAddress: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    await auditLogger.log({
      type: 'AUDIT_LOG_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'audit',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        recordsAccessed: rows.length,
        filters: { eventType, userId, resource, severity, result }
      }
    });

    res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    logger.error('감사 로그 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

// 특정 감사 로그 상세 조회
router.get('/:id', authorize('audit', 'read'), async (req, res) => {
  try {
    const logId = req.params.id;
    
    const auditLog = await AuditLog.findByPk(logId);
    
    if (!auditLog) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    await auditLogger.log({
      type: 'AUDIT_LOG_DETAIL_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'audit',
      resourceId: logId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: auditLog
    });
  } catch (error) {
    logger.error('감사 로그 상세 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log details'
    });
  }
});

// 보안 통계 조회
router.get('/stats/security', authorize('audit', 'read'), async (req, res) => {
  try {
    const { timeWindow = '24h' } = req.query;
    
    const stats = await auditLogger.getSecurityStats(timeWindow);
    
    // 추가 통계 계산
    const criticalEvents = await AuditLog.findCriticalEvents(timeWindow);
    const securitySummary = await AuditLog.getSecuritySummary(timeWindow);

    await auditLogger.log({
      type: 'SECURITY_STATS_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'audit',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: { timeWindow }
    });

    res.json({
      success: true,
      data: {
        timeWindow,
        stats,
        criticalEvents: criticalEvents.length,
        summary: securitySummary,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('보안 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security statistics'
    });
  }
});

// 중요 이벤트 목록 조회
router.get('/events/critical', authorize('audit', 'read'), async (req, res) => {
  try {
    const { timeWindow = '24h', limit = 100 } = req.query;
    
    const criticalEvents = await AuditLog.findCriticalEvents(timeWindow);
    
    // 제한된 수만 반환
    const limitedEvents = criticalEvents.slice(0, parseInt(limit));

    await auditLogger.log({
      type: 'CRITICAL_EVENTS_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'audit',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: { 
        timeWindow, 
        eventsCount: limitedEvents.length 
      }
    });

    res.json({
      success: true,
      data: {
        timeWindow,
        events: limitedEvents,
        total: criticalEvents.length,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('중요 이벤트 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch critical events'
    });
  }
});

// 사용자별 감사 로그 조회
router.get('/users/:userId/logs', authorize('audit', 'read'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // 자신의 로그만 조회 가능 (관리자 제외)
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Can only access your own audit logs'
      });
    }

    const logs = await AuditLog.findByUser(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    await auditLogger.log({
      type: 'USER_AUDIT_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'audit',
      resourceId: userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: { targetUserId: userId, recordsAccessed: logs.length }
    });

    res.json({
      success: true,
      data: {
        userId,
        logs,
        total: logs.length
      }
    });
  } catch (error) {
    logger.error('사용자별 감사 로그 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user audit logs'
    });
  }
});

// 감사 로그 내보내기
router.post('/export', authorize('audit', 'export'), async (req, res) => {
  try {
    const {
      format = 'csv',
      startDate,
      endDate,
      eventTypes,
      severities,
      includeDetails = false
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const where = {
      timestamp: {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      }
    };

    if (eventTypes && eventTypes.length > 0) {
      where.eventType = { [Op.in]: eventTypes };
    }

    if (severities && severities.length > 0) {
      where.severity = { [Op.in]: severities };
    }

    const logs = await AuditLog.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: 10000 // 최대 1만 건
    });

    // 형식에 따른 데이터 변환
    let exportData;
    let contentType;
    let filename;

    if (format === 'csv') {
      exportData = generateCSV(logs, includeDetails);
      contentType = 'text/csv';
      filename = `audit-logs-${startDate}-${endDate}.csv`;
    } else if (format === 'json') {
      exportData = JSON.stringify(logs, null, 2);
      contentType = 'application/json';
      filename = `audit-logs-${startDate}-${endDate}.json`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format'
      });
    }

    await auditLogger.log({
      type: 'AUDIT_LOG_EXPORT',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'EXPORT',
      resource: 'audit',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        format,
        recordsExported: logs.length,
        dateRange: { startDate, endDate },
        filters: { eventTypes, severities }
      }
    });

    logger.warn('감사 로그 내보내기:', {
      userId: req.user.id,
      recordsExported: logs.length,
      format,
      dateRange: { startDate, endDate }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.send(exportData);
  } catch (error) {
    logger.error('감사 로그 내보내기 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs'
    });
  }
});

// 감사 로그 보존 기간 설정 (관리자만)
router.patch('/retention', requireAdmin(), async (req, res) => {
  try {
    const { retentionDays } = req.body;
    
    if (!retentionDays || retentionDays < 30 || retentionDays > 2555) {
      return res.status(400).json({
        success: false,
        error: 'Retention period must be between 30 and 2555 days'
      });
    }

    // 보존 기간 설정 업데이트 (실제로는 설정 테이블에 저장)
    const oldRetention = 365; // 현재 설정값 (실제로는 DB에서 조회)

    await auditLogger.logConfigChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      configKey: 'audit_log_retention_days',
      section: 'security',
      oldValues: { retentionDays: oldRetention },
      newValues: { retentionDays },
      changes: { retentionDays },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      affectedServices: ['audit', 'cleanup']
    });

    logger.warn('감사 로그 보존 기간 변경:', {
      userId: req.user.id,
      oldRetention,
      newRetention: retentionDays
    });

    res.json({
      success: true,
      message: 'Audit log retention period updated',
      data: {
        retentionDays,
        updatedBy: req.user.name,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('감사 로그 보존 기간 설정 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update retention period'
    });
  }
});

// 오래된 감사 로그 정리 (관리자만)
router.delete('/cleanup', requireAdmin(), async (req, res) => {
  try {
    const { retentionDays = 365, dryRun = true } = req.body;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    if (dryRun) {
      // 삭제될 로그 수만 계산
      const count = await AuditLog.count({
        where: {
          timestamp: {
            [Op.lt]: cutoffDate
          }
        }
      });

      res.json({
        success: true,
        message: 'Dry run completed',
        data: {
          logsToDelete: count,
          cutoffDate,
          retentionDays
        }
      });
    } else {
      // 실제 삭제 실행
      const deletedCount = await AuditLog.destroy({
        where: {
          timestamp: {
            [Op.lt]: cutoffDate
          }
        }
      });

      await auditLogger.log({
        type: 'AUDIT_LOG_CLEANUP',
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'DELETE',
        resource: 'audit',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        result: 'SUCCESS',
        metadata: {
          deletedCount,
          cutoffDate,
          retentionDays
        }
      });

      logger.warn('감사 로그 정리 완료:', {
        userId: req.user.id,
        deletedCount,
        retentionDays
      });

      res.json({
        success: true,
        message: 'Audit logs cleanup completed',
        data: {
          deletedCount,
          cutoffDate,
          retentionDays
        }
      });
    }
  } catch (error) {
    logger.error('감사 로그 정리 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup audit logs'
    });
  }
});

// CSV 생성 헬퍼 함수
function generateCSV(logs, includeDetails) {
  const headers = [
    'timestamp',
    'eventType',
    'userId',
    'userName',
    'userRole',
    'action',
    'resource',
    'resourceId',
    'result',
    'severity',
    'ipAddress',
    'userAgent'
  ];

  if (includeDetails) {
    headers.push('changes', 'oldValues', 'newValues', 'metadata');
  }

  const csvRows = [headers.join(',')];

  logs.forEach(log => {
    const row = [
      log.timestamp,
      log.eventType,
      log.userId || '',
      log.userName || '',
      log.userRole || '',
      log.action,
      log.resource,
      log.resourceId || '',
      log.result,
      log.severity,
      log.ipAddress || '',
      `"${(log.userAgent || '').replace(/"/g, '""')}"`
    ];

    if (includeDetails) {
      row.push(
        `"${(log.changes || '').replace(/"/g, '""')}"`,
        `"${(log.oldValues || '').replace(/"/g, '""')}"`,
        `"${(log.newValues || '').replace(/"/g, '""')}"`,
        `"${(log.metadata || '').replace(/"/g, '""')}"`
      );
    }

    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

module.exports = router;