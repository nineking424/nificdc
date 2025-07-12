const express = require('express');
const router = express.Router();
const { authorize, requireAdmin } = require('../../middleware/rbac');
const alertManager = require('../../services/alertManager');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../utils/logger');

/**
 * 알림 관리 API 라우터
 * 알림 규칙 관리, 알림 히스토리 조회, 통계 등
 */

// 알림 규칙 목록 조회
router.get('/rules', authorize('alerts', 'read'), async (req, res) => {
  try {
    const rules = alertManager.getRules();
    
    await auditLogger.log({
      type: 'ALERT_RULES_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'alerts',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: { rulesCount: rules.length }
    });

    res.json({
      success: true,
      data: {
        rules,
        total: rules.length
      }
    });
  } catch (error) {
    logger.error('알림 규칙 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert rules'
    });
  }
});

// 특정 알림 규칙 조회
router.get('/rules/:ruleId', authorize('alerts', 'read'), async (req, res) => {
  try {
    const { ruleId } = req.params;
    const rules = alertManager.getRules();
    const rule = rules.find(r => r.id === ruleId);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }

    await auditLogger.log({
      type: 'ALERT_RULE_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'alerts',
      resourceId: ruleId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    logger.error('알림 규칙 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert rule'
    });
  }
});

// 알림 규칙 생성 (관리자만)
router.post('/rules', requireAdmin(), async (req, res) => {
  try {
    const ruleData = req.body;
    
    // 필수 필드 검증
    if (!ruleData.name || !ruleData.conditions) {
      return res.status(400).json({
        success: false,
        error: 'Rule name and conditions are required'
      });
    }

    // 고유 ID 생성
    const ruleId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // 기본값 설정
    const rule = {
      name: ruleData.name,
      description: ruleData.description || '',
      severity: ruleData.severity || 'MEDIUM',
      conditions: ruleData.conditions,
      actions: ruleData.actions || ['monitoring'],
      enabled: ruleData.enabled !== false
    };

    alertManager.addRule(ruleId, rule);

    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'alerts',
      resourceId: ruleId,
      newValues: rule,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.info('알림 규칙 생성:', { ruleId, ruleName: rule.name, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      data: {
        ruleId,
        ...rule
      }
    });
  } catch (error) {
    logger.error('알림 규칙 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert rule'
    });
  }
});

// 알림 규칙 수정 (관리자만)
router.put('/rules/:ruleId', requireAdmin(), async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updateData = req.body;
    
    // 기본 규칙 수정 방지
    if (ruleId.startsWith('multiple_login_failures') || 
        ruleId.startsWith('unauthorized_access') ||
        ruleId.startsWith('privilege_escalation')) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify default security rules'
      });
    }

    const rules = alertManager.getRules();
    const existingRule = rules.find(r => r.id === ruleId);
    
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }

    // 수정할 수 있는 필드만 허용
    const allowedFields = ['name', 'description', 'severity', 'conditions', 'actions', 'enabled'];
    const filteredUpdates = {};
    
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        filteredUpdates[field] = updateData[field];
      }
    });

    alertManager.updateRule(ruleId, filteredUpdates);

    await auditLogger.logDataChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'alerts',
      resourceId: ruleId,
      oldValues: existingRule,
      newValues: filteredUpdates,
      changes: filteredUpdates,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.session?.id
    });

    logger.info('알림 규칙 수정:', { ruleId, updatedBy: req.user.id });

    res.json({
      success: true,
      message: 'Alert rule updated successfully'
    });
  } catch (error) {
    logger.error('알림 규칙 수정 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert rule'
    });
  }
});

// 알림 규칙 삭제 (관리자만)
router.delete('/rules/:ruleId', requireAdmin(), async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    // 기본 규칙 삭제 방지
    if (ruleId.startsWith('multiple_login_failures') || 
        ruleId.startsWith('unauthorized_access') ||
        ruleId.startsWith('privilege_escalation')) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete default security rules'
      });
    }

    const rules = alertManager.getRules();
    const existingRule = rules.find(r => r.id === ruleId);
    
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }

    const deleted = alertManager.removeRule(ruleId);
    
    if (deleted) {
      await auditLogger.logDataChange({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'DELETE',
        resource: 'alerts',
        resourceId: ruleId,
        oldValues: existingRule,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id
      });

      logger.warn('알림 규칙 삭제:', { ruleId, deletedBy: req.user.id });

      res.json({
        success: true,
        message: 'Alert rule deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete alert rule'
      });
    }
  } catch (error) {
    logger.error('알림 규칙 삭제 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert rule'
    });
  }
});

// 알림 히스토리 조회
router.get('/history', authorize('alerts', 'read'), async (req, res) => {
  try {
    const {
      severity,
      ruleId,
      startDate,
      endDate,
      limit = 100
    } = req.query;

    const filters = {
      severity,
      ruleId,
      startDate,
      endDate,
      limit: parseInt(limit)
    };

    const alerts = alertManager.getAlertHistory(filters);

    await auditLogger.log({
      type: 'ALERT_HISTORY_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'alerts',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: { 
        alertsAccessed: alerts.length,
        filters 
      }
    });

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        filters
      }
    });
  } catch (error) {
    logger.error('알림 히스토리 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert history'
    });
  }
});

// 알림 통계 조회
router.get('/statistics', authorize('alerts', 'read'), async (req, res) => {
  try {
    const statistics = alertManager.getStatistics();

    await auditLogger.log({
      type: 'ALERT_STATISTICS_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'alerts',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('알림 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert statistics'
    });
  }
});

// 알림 규칙 테스트
router.post('/rules/:ruleId/test', authorize('alerts', 'configure'), async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { testEvent } = req.body;
    
    if (!testEvent) {
      return res.status(400).json({
        success: false,
        error: 'Test event data is required'
      });
    }

    const rules = alertManager.getRules();
    const rule = rules.find(r => r.id === ruleId);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Alert rule not found'
      });
    }

    // 테스트 이벤트로 규칙 매치 확인
    const matches = alertManager.matchesRule(testEvent, rule);
    
    await auditLogger.log({
      type: 'ALERT_RULE_TEST',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'TEST',
      resource: 'alerts',
      resourceId: ruleId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        testEvent,
        matches
      }
    });

    res.json({
      success: true,
      data: {
        ruleId,
        ruleName: rule.name,
        matches,
        testEvent,
        explanation: matches 
          ? '테스트 이벤트가 규칙 조건과 일치합니다.'
          : '테스트 이벤트가 규칙 조건과 일치하지 않습니다.'
      }
    });
  } catch (error) {
    logger.error('알림 규칙 테스트 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test alert rule'
    });
  }
});

// 모든 알림 규칙 활성화/비활성화 (관리자만)
router.patch('/rules/bulk/toggle', requireAdmin(), async (req, res) => {
  try {
    const { enabled, ruleIds } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Enabled field must be boolean'
      });
    }

    let updatedCount = 0;
    const rules = alertManager.getRules();
    
    const targetRules = ruleIds 
      ? rules.filter(rule => ruleIds.includes(rule.id))
      : rules;

    for (const rule of targetRules) {
      // 기본 보안 규칙은 비활성화 방지
      if (!enabled && (
        rule.id.startsWith('multiple_login_failures') || 
        rule.id.startsWith('unauthorized_access') ||
        rule.id.startsWith('privilege_escalation')
      )) {
        continue;
      }

      alertManager.updateRule(rule.id, { enabled });
      updatedCount++;
    }

    await auditLogger.logConfigChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      configKey: 'alert_rules_enabled',
      section: 'security',
      oldValues: { description: 'Bulk toggle before' },
      newValues: { enabled, ruleIds, updatedCount },
      changes: { enabled, updatedCount },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      affectedServices: ['alerts', 'monitoring']
    });

    logger.info('알림 규칙 일괄 토글:', {
      userId: req.user.id,
      enabled,
      updatedCount,
      targetRuleIds: ruleIds
    });

    res.json({
      success: true,
      message: `${updatedCount} alert rules ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        updatedCount,
        enabled
      }
    });
  } catch (error) {
    logger.error('알림 규칙 일괄 토글 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle alert rules'
    });
  }
});

// 알림 확인 처리
router.patch('/history/:alertId/acknowledge', authorize('alerts', 'acknowledge'), async (req, res) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;
    
    // 실제로는 데이터베이스에서 알림 상태 업데이트
    // 여기서는 시뮬레이션
    
    await auditLogger.log({
      type: 'ALERT_ACKNOWLEDGED',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'ACKNOWLEDGE',
      resource: 'alerts',
      resourceId: alertId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: { notes }
    });

    logger.info('알림 확인 처리:', {
      alertId,
      acknowledgedBy: req.user.id,
      notes
    });

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: {
        alertId,
        acknowledgedBy: req.user.name,
        acknowledgedAt: new Date(),
        notes
      }
    });
  } catch (error) {
    logger.error('알림 확인 처리 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

module.exports = router;