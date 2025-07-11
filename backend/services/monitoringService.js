const WebSocket = require('ws');
const { Job, JobExecution, System, Mapping } = require('../models');
const { Op } = require('sequelize');

/**
 * 실시간 모니터링 서비스
 * WebSocket을 통한 실시간 상태 추적 및 메트릭 제공
 */
class MonitoringService {
  constructor() {
    this.clients = new Set();
    this.wss = null;
    this.metricsInterval = null;
    this.healthCheckInterval = null;
    this.currentMetrics = {};
    
    // 메트릭 업데이트 주기 (밀리초)
    this.METRICS_UPDATE_INTERVAL = 2000; // 2초
    this.HEALTH_CHECK_INTERVAL = 10000; // 10초
  }

  /**
   * WebSocket 서버 초기화
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/monitoring'
    });

    this.wss.on('connection', (ws, req) => {
      console.log('Monitoring client connected:', req.socket.remoteAddress);
      
      this.clients.add(ws);
      
      // 클라이언트에 초기 상태 전송
      this.sendInitialState(ws);
      
      // 클라이언트 메시지 처리
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('클라이언트 메시지 파싱 오류:', error);
        }
      });
      
      // 연결 종료 처리
      ws.on('close', () => {
        console.log('Monitoring client disconnected');
        this.clients.delete(ws);
      });
      
      // 에러 처리
      ws.on('error', (error) => {
        console.error('WebSocket 에러:', error);
        this.clients.delete(ws);
      });
    });

    // 정기적 메트릭 업데이트 시작
    this.startMetricsCollection();
    
    console.log('Monitoring WebSocket server initialized');
  }

  /**
   * 메트릭 수집 시작
   */
  startMetricsCollection() {
    // 실시간 메트릭 수집
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectRealTimeMetrics();
        this.currentMetrics = metrics;
        this.broadcastToClients({
          type: 'metrics',
          data: metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('메트릭 수집 오류:', error);
      }
    }, this.METRICS_UPDATE_INTERVAL);

    // 시스템 상태 체크
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthStatus = await this.checkSystemHealth();
        this.broadcastToClients({
          type: 'health',
          data: healthStatus,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('시스템 상태 체크 오류:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * 메트릭 수집 중지
   */
  stopMetricsCollection() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * 클라이언트에 초기 상태 전송
   */
  async sendInitialState(ws) {
    try {
      const [metrics, health, recentExecutions, systemStats] = await Promise.all([
        this.collectRealTimeMetrics(),
        this.checkSystemHealth(),
        this.getRecentExecutions(50),
        this.getSystemStatistics()
      ]);

      const initialState = {
        type: 'initial_state',
        data: {
          metrics,
          health,
          recentExecutions,
          systemStats
        },
        timestamp: new Date().toISOString()
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(initialState));
      }
    } catch (error) {
      console.error('초기 상태 전송 실패:', error);
    }
  }

  /**
   * 클라이언트 메시지 처리
   */
  async handleClientMessage(ws, message) {
    const { type, data } = message;

    switch (type) {
      case 'subscribe':
        await this.handleSubscription(ws, data);
        break;
        
      case 'get_job_details':
        await this.sendJobDetails(ws, data.jobId);
        break;
        
      case 'get_execution_logs':
        await this.sendExecutionLogs(ws, data.executionId);
        break;
        
      case 'ping':
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
        break;
        
      default:
        console.warn('알 수 없는 메시지 타입:', type);
    }
  }

  /**
   * 구독 처리
   */
  async handleSubscription(ws, subscriptionData) {
    // 클라이언트별 구독 정보 저장 (필요시 확장)
    ws.subscriptions = subscriptionData;
    
    console.log('클라이언트 구독 설정:', subscriptionData);
  }

  /**
   * 실시간 메트릭 수집
   */
  async collectRealTimeMetrics() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 기본 작업 통계
    const [
      totalJobs,
      activeJobs,
      runningJobs,
      scheduledJobs,
      pausedJobs,
      failedJobs
    ] = await Promise.all([
      Job.count(),
      Job.count({ where: { isActive: true } }),
      Job.count({ where: { status: 'running' } }),
      Job.count({ where: { status: 'scheduled' } }),
      Job.count({ where: { status: 'paused' } }),
      Job.count({ where: { status: 'failed' } })
    ]);

    // 실행 통계 (최근 1시간)
    const recentExecutions = await JobExecution.findAll({
      where: {
        startedAt: {
          [Op.gte]: oneHourAgo
        }
      },
      attributes: ['status', 'duration', 'startedAt', 'sourceRecordsCount', 'targetRecordsCount', 'errorRecordsCount']
    });

    // 처리량 계산
    const completedExecutions = recentExecutions.filter(exec => exec.status === 'completed');
    const totalRecordsProcessed = completedExecutions.reduce((sum, exec) => 
      sum + (exec.sourceRecordsCount || 0), 0);
    const throughput = Math.round(totalRecordsProcessed / 3600); // 시간당 처리량

    // 평균 지연시간 계산
    const avgLatency = completedExecutions.length > 0
      ? Math.round(completedExecutions.reduce((sum, exec) => sum + (exec.duration || 0), 0) / completedExecutions.length)
      : 0;

    // 에러율 계산
    const totalExecutions = recentExecutions.length;
    const failedExecutions = recentExecutions.filter(exec => exec.status === 'failed').length;
    const errorRate = totalExecutions > 0 ? Math.round((failedExecutions / totalExecutions) * 100) : 0;

    // 데이터 전송률 계산
    const totalDataTransferred = completedExecutions.reduce((sum, exec) => 
      sum + (exec.sourceRecordsCount || 0) + (exec.targetRecordsCount || 0), 0);
    const dataTransferRate = Math.round(totalDataTransferred / 3600); // 시간당 데이터 전송률

    // 시간대별 실행 분포 (최근 24시간)
    const hourlyStats = await this.getHourlyExecutionStats(oneDayAgo);

    // 상위 작업 통계
    const topJobs = await this.getTopPerformingJobs(10);

    return {
      summary: {
        totalJobs,
        activeJobs,
        runningJobs,
        scheduledJobs,
        pausedJobs,
        failedJobs
      },
      performance: {
        throughput,
        avgLatency,
        errorRate,
        dataTransferRate,
        totalRecordsProcessed,
        totalExecutions: recentExecutions.length
      },
      trends: {
        hourlyStats,
        recentExecutions: recentExecutions.slice(0, 20)
      },
      topJobs,
      lastUpdated: now.toISOString()
    };
  }

  /**
   * 시스템 상태 체크
   */
  async checkSystemHealth() {
    try {
      // 데이터베이스 연결 상태
      const dbHealth = await this.checkDatabaseHealth();
      
      // 시스템 연결 상태
      const systemsHealth = await this.checkSystemsHealth();
      
      // NiFi 상태 (있는 경우)
      const nifiHealth = await this.checkNiFiHealth();
      
      // 메모리 사용량
      const memoryUsage = process.memoryUsage();
      const memoryUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
      
      // CPU 사용량 (간단한 추정)
      const cpuUsage = await this.getCPUUsage();

      return {
        overall: this.calculateOverallHealth([dbHealth, systemsHealth, nifiHealth]),
        components: {
          database: dbHealth,
          systems: systemsHealth,
          nifi: nifiHealth,
          server: {
            status: 'healthy',
            memoryUsage: memoryUsagePercent,
            cpuUsage,
            uptime: Math.round(process.uptime())
          }
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      console.error('시스템 상태 체크 실패:', error);
      return {
        overall: { status: 'error', message: error.message },
        components: {},
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * 데이터베이스 상태 체크
   */
  async checkDatabaseHealth() {
    try {
      const { sequelize } = require('../config/database');
      await sequelize.authenticate();
      
      return {
        status: 'healthy',
        responseTime: 0, // 실제 구현에서는 응답 시간 측정
        connections: await this.getDatabaseConnections()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 시스템 연결 상태 체크
   */
  async checkSystemsHealth() {
    try {
      const systems = await System.findAll({
        where: { isActive: true },
        attributes: ['id', 'name', 'type']
      });

      const healthChecks = await Promise.all(
        systems.map(async (system) => {
          try {
            // 간단한 연결 테스트 (실제로는 각 시스템 타입별 구현 필요)
            const isHealthy = await this.testSystemConnection(system);
            return {
              id: system.id,
              name: system.name,
              type: system.type,
              status: isHealthy ? 'healthy' : 'error'
            };
          } catch (error) {
            return {
              id: system.id,
              name: system.name,
              type: system.type,
              status: 'error',
              error: error.message
            };
          }
        })
      );

      const healthyCount = healthChecks.filter(check => check.status === 'healthy').length;
      const overallStatus = healthyCount === systems.length ? 'healthy' : 
                           healthyCount > 0 ? 'degraded' : 'error';

      return {
        status: overallStatus,
        systems: healthChecks,
        healthy: healthyCount,
        total: systems.length
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * NiFi 상태 체크
   */
  async checkNiFiHealth() {
    try {
      const nifiClient = require('../utils/nifiClient');
      const result = await nifiClient.testConnection();
      
      return {
        status: result.success ? 'healthy' : 'error',
        version: result.version,
        uptime: result.uptime,
        error: result.error
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * CPU 사용량 계산
   */
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const cpuPercent = Math.round((totalUsage / 1000000) * 100); // 마이크로초를 밀리초로 변환
        resolve(Math.min(cpuPercent, 100));
      }, 100);
    });
  }

  /**
   * 시간대별 실행 통계
   */
  async getHourlyExecutionStats(startDate) {
    const stats = {};
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      const hourKey = hourStart.getHours().toString().padStart(2, '0') + ':00';
      
      const executions = await JobExecution.count({
        where: {
          startedAt: {
            [Op.between]: [hourStart, hourEnd]
          }
        }
      });
      
      stats[hourKey] = executions;
    }
    
    return stats;
  }

  /**
   * 상위 성능 작업 조회
   */
  async getTopPerformingJobs(limit = 10) {
    try {
      const jobs = await Job.findAll({
        include: [
          {
            model: JobExecution,
            as: 'executions',
            where: {
              status: 'completed',
              startedAt: {
                [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 최근 24시간
              }
            },
            required: false
          }
        ],
        limit
      });

      return jobs.map(job => {
        const executions = job.executions || [];
        const avgDuration = executions.length > 0
          ? executions.reduce((sum, exec) => sum + (exec.duration || 0), 0) / executions.length
          : 0;
        
        return {
          id: job.id,
          name: job.name,
          executionCount: executions.length,
          avgDuration: Math.round(avgDuration),
          successRate: executions.length > 0 
            ? Math.round((executions.filter(e => e.status === 'completed').length / executions.length) * 100)
            : 0
        };
      }).sort((a, b) => b.executionCount - a.executionCount);
    } catch (error) {
      console.error('상위 성능 작업 조회 실패:', error);
      return [];
    }
  }

  /**
   * 최근 실행 내역 조회
   */
  async getRecentExecutions(limit = 50) {
    try {
      return await JobExecution.findAll({
        limit,
        order: [['startedAt', 'DESC']],
        include: [
          {
            model: Job,
            as: 'job',
            attributes: ['id', 'name']
          }
        ],
        attributes: ['id', 'status', 'startedAt', 'completedAt', 'duration', 'triggerType']
      });
    } catch (error) {
      console.error('최근 실행 내역 조회 실패:', error);
      return [];
    }
  }

  /**
   * 시스템 통계 조회
   */
  async getSystemStatistics() {
    try {
      const [totalSystems, activeSystems, totalMappings, activeMappings] = await Promise.all([
        System.count(),
        System.count({ where: { isActive: true } }),
        Mapping.count(),
        Mapping.count({ where: { isActive: true } })
      ]);

      return {
        systems: {
          total: totalSystems,
          active: activeSystems
        },
        mappings: {
          total: totalMappings,
          active: activeMappings
        }
      };
    } catch (error) {
      console.error('시스템 통계 조회 실패:', error);
      return {};
    }
  }

  /**
   * 작업 상세 정보 전송
   */
  async sendJobDetails(ws, jobId) {
    try {
      const job = await Job.findByPk(jobId, {
        include: [
          {
            model: Mapping,
            as: 'mapping',
            include: ['sourceSystem', 'targetSystem']
          },
          {
            model: JobExecution,
            as: 'executions',
            limit: 10,
            order: [['startedAt', 'DESC']]
          }
        ]
      });

      if (job && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'job_details',
          data: job,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('작업 상세 정보 전송 실패:', error);
    }
  }

  /**
   * 실행 로그 전송
   */
  async sendExecutionLogs(ws, executionId) {
    try {
      const execution = await JobExecution.findByPk(executionId, {
        attributes: ['id', 'logs', 'checkpoints', 'warnings', 'errorMessage', 'errorStack']
      });

      if (execution && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'execution_logs',
          data: execution,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('실행 로그 전송 실패:', error);
    }
  }

  /**
   * 모든 클라이언트에 브로드캐스트
   */
  broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      } else {
        this.clients.delete(client);
      }
    });
  }

  /**
   * 특정 이벤트 브로드캐스트
   */
  broadcastEvent(eventType, data) {
    this.broadcastToClients({
      type: 'event',
      eventType,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 전체 상태 계산
   */
  calculateOverallHealth(components) {
    const healthyCount = components.filter(comp => comp.status === 'healthy').length;
    const totalCount = components.length;
    
    if (healthyCount === totalCount) {
      return { status: 'healthy', score: 100 };
    } else if (healthyCount > totalCount / 2) {
      return { status: 'degraded', score: Math.round((healthyCount / totalCount) * 100) };
    } else {
      return { status: 'error', score: Math.round((healthyCount / totalCount) * 100) };
    }
  }

  /**
   * 시스템 연결 테스트 (간단한 구현)
   */
  async testSystemConnection(system) {
    // 실제 구현에서는 각 시스템 타입별로 연결 테스트 구현
    return true; // 임시로 항상 true 반환
  }

  /**
   * 데이터베이스 연결 수 조회
   */
  async getDatabaseConnections() {
    // 실제 구현에서는 데이터베이스별 연결 수 조회
    return Math.floor(Math.random() * 10) + 1;
  }

  /**
   * 서비스 종료
   */
  shutdown() {
    console.log('Monitoring service shutting down...');
    
    this.stopMetricsCollection();
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.clients.clear();
    console.log('Monitoring service shutdown complete');
  }
}

// 싱글톤 인스턴스
const monitoringService = new MonitoringService();

module.exports = monitoringService;