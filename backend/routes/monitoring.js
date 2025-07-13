const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./middleware/auth');
const monitoringService = require('./services/monitoringService');

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

/**
 * 실시간 메트릭 조회
 * GET /api/monitoring/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await monitoringService.collectRealTimeMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('실시간 메트릭 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '실시간 메트릭 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템 상태 조회
 * GET /api/monitoring/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await monitoringService.checkSystemHealth();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('시스템 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '시스템 상태 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 최근 실행 내역 조회
 * GET /api/monitoring/recent-executions
 */
router.get('/recent-executions', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const executions = await monitoringService.getRecentExecutions(parseInt(limit));
    
    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    console.error('최근 실행 내역 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '최근 실행 내역 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템 통계 조회
 * GET /api/monitoring/system-stats
 */
router.get('/system-stats', async (req, res) => {
  try {
    const stats = await monitoringService.getSystemStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('시스템 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '시스템 통계 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 상위 성능 작업 조회
 * GET /api/monitoring/top-jobs
 */
router.get('/top-jobs', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const topJobs = await monitoringService.getTopPerformingJobs(parseInt(limit));
    
    res.json({
      success: true,
      data: topJobs
    });
  } catch (error) {
    console.error('상위 성능 작업 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '상위 성능 작업 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시간대별 실행 통계 조회
 * GET /api/monitoring/hourly-stats
 */
router.get('/hourly-stats', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const startDate = new Date(Date.now() - (parseInt(hours) * 60 * 60 * 1000));
    const stats = await monitoringService.getHourlyExecutionStats(startDate);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('시간대별 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '시간대별 통계 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 전체 대시보드 데이터 조회
 * GET /api/monitoring/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const [metrics, health, recentExecutions, systemStats] = await Promise.all([
      monitoringService.collectRealTimeMetrics(),
      monitoringService.checkSystemHealth(),
      monitoringService.getRecentExecutions(20),
      monitoringService.getSystemStatistics()
    ]);

    res.json({
      success: true,
      data: {
        metrics,
        health,
        recentExecutions,
        systemStats,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('대시보드 데이터 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '대시보드 데이터 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 실시간 이벤트 브로드캐스트
 * POST /api/monitoring/broadcast
 */
router.post('/broadcast', async (req, res) => {
  try {
    const { eventType, data } = req.body;
    
    if (!eventType || !data) {
      return res.status(400).json({
        success: false,
        error: '이벤트 타입과 데이터가 필요합니다.'
      });
    }
    
    monitoringService.broadcastEvent(eventType, data);
    
    res.json({
      success: true,
      message: '이벤트가 브로드캐스트되었습니다.'
    });
  } catch (error) {
    console.error('이벤트 브로드캐스트 실패:', error);
    res.status(500).json({
      success: false,
      error: '이벤트 브로드캐스트 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 모니터링 서비스 상태 조회
 * GET /api/monitoring/service-status
 */
router.get('/service-status', (req, res) => {
  try {
    const connectedClients = monitoringService.clients.size;
    const isRunning = monitoringService.metricsInterval !== null;
    
    res.json({
      success: true,
      data: {
        isRunning,
        connectedClients,
        metricsUpdateInterval: monitoringService.METRICS_UPDATE_INTERVAL,
        healthCheckInterval: monitoringService.HEALTH_CHECK_INTERVAL,
        currentMetrics: monitoringService.currentMetrics
      }
    });
  } catch (error) {
    console.error('모니터링 서비스 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '모니터링 서비스 상태 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 알림 설정 조회
 * GET /api/monitoring/alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    // 알림 설정 로직 (실제 구현에서는 데이터베이스에서 조회)
    const alerts = {
      thresholds: {
        errorRate: 10, // 10% 이상 에러율
        avgLatency: 5000, // 5초 이상 평균 지연시간
        systemHealth: 80, // 80% 미만 시스템 상태 점수
        memoryUsage: 85, // 85% 이상 메모리 사용률
        cpuUsage: 90 // 90% 이상 CPU 사용률
      },
      notifications: {
        email: true,
        slack: false,
        webhook: false
      }
    };
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('알림 설정 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '알림 설정 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 알림 설정 업데이트
 * PUT /api/monitoring/alerts
 */
router.put('/alerts', async (req, res) => {
  try {
    const { thresholds, notifications } = req.body;
    
    // 실제 구현에서는 데이터베이스에 저장
    console.log('알림 설정 업데이트:', { thresholds, notifications });
    
    res.json({
      success: true,
      message: '알림 설정이 업데이트되었습니다.',
      data: { thresholds, notifications }
    });
  } catch (error) {
    console.error('알림 설정 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      error: '알림 설정 업데이트 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 성능 리포트 생성
 * POST /api/monitoring/performance-report
 */
router.post('/performance-report', async (req, res) => {
  try {
    const { startDate, endDate, jobIds = [] } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '시작일과 종료일이 필요합니다.'
      });
    }
    
    // 성능 리포트 생성 로직 (실제 구현에서는 더 복잡한 분석)
    const report = {
      period: { startDate, endDate },
      summary: {
        totalExecutions: 0,
        successRate: 0,
        avgExecutionTime: 0,
        totalProcessedRecords: 0
      },
      jobPerformance: [],
      trends: [],
      recommendations: []
    };
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('성능 리포트 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: '성능 리포트 생성 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

module.exports = router;