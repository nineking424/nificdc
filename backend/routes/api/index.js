const express = require('express');
const router = express.Router();

/**
 * API 라우터 메인 인덱스
 * 모든 API 엔드포인트를 여기서 등록
 */

// 인증 관련 라우터
const authRoutes = require('./auth');
router.use('/auth', authRoutes);

// 사용자 관리 라우터
const userRoutes = require('./users');
router.use('/users', userRoutes);

// 시스템 관리 라우터
const systemRoutes = require('./systems');
router.use('/systems', systemRoutes);

// 작업 관리 라우터 (추후 구현)
// const jobRoutes = require('./jobs');
// router.use('/jobs', jobRoutes);

// 모니터링 라우터 (추후 구현)
// const monitoringRoutes = require('./monitoring');
// router.use('/monitoring', monitoringRoutes);

// 감사 로그 라우터
const auditRoutes = require('./audit');
router.use('/audit', auditRoutes);

// 알림 관리 라우터
const alertRoutes = require('./alerts');
router.use('/alerts', alertRoutes);

// 보안 설정 라우터
const securityRoutes = require('./security');
router.use('/security', securityRoutes);

// API 루트 정보
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NifiCDC API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      systems: '/api/systems',
      audit: '/api/audit',
      alerts: '/api/alerts',
      security: '/api/security'
      // jobs: '/api/jobs',
      // monitoring: '/api/monitoring'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;