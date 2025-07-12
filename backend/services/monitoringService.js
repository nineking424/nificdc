const WebSocket = require('ws');
const os = require('os');
const { Job, JobExecution, System, Mapping } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * 실시간 모니터링 서비스
 * WebSocket을 통한 실시간 상태 추적 및 메트릭 제공
 */
class MonitoringService {
  constructor() {
    this.clients = new Map(); // Changed to Map for better client management
    this.wss = null;
    this.metricsInterval = null;
    this.healthCheckInterval = null;
    this.heartbeatInterval = null;
    this.currentMetrics = {};
    
    // 설정값
    this.config = {
      maxClients: 100,
      metricsUpdateInterval: 2000, // 2초
      healthCheckInterval: 10000, // 10초
      heartbeatInterval: 30000, // 30초
      compressionEnabled: true,
      maxMessageSize: 1024 * 1024 // 1MB
    };
    
    // 메트릭 캐시
    this.metricsCache = {
      lastUpdate: null,
      data: null,
      ttl: 5000 // 5초
    };
    
    // 시작 시간
    this.startTime = new Date();
  }

  /**
   * WebSocket 서버 초기화
   */
  initialize(server) {
    try {
      this.wss = new WebSocket.Server({
        server,
        path: '/monitoring',
        clientTracking: true,
        maxPayload: this.config.maxMessageSize,
        perMessageDeflate: this.config.compressionEnabled
      });

      this.setupEventHandlers();
      this.startMetricsCollection();
      this.startHeartbeat();
      
      logger.info('모니터링 WebSocket 서버가 시작되었습니다.');
    } catch (error) {
      logger.error('WebSocket 서버 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 이벤트 핸들러 설정
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket 서버 오류:', error);
    });

    // 서버 종료 시 정리
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * 클라이언트 연결 처리
   */
  handleConnection(ws, request) {
    // 연결 제한 확인
    if (this.clients.size >= this.config.maxClients) {
      ws.close(1013, '최대 연결 수 초과');
      return;
    }

    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: this.getClientIP(request),
      userAgent: request.headers['user-agent'],
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      subscriptions: new Set(['metrics', 'alerts']) // 기본 구독
    };

    this.clients.set(clientId, clientInfo);
    
    logger.info(`클라이언트 연결: ${clientId} (${clientInfo.ip})`);

    // 연결 즉시 현재 상태 전송
    this.sendInitialState(ws);

    // 메시지 핸들러 설정
    ws.on('message', (message) => {
      this.handleClientMessage(clientId, message);
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    ws.on('error', (error) => {
      logger.error(`클라이언트 ${clientId} 오류:`, error);
      this.clients.delete(clientId);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastHeartbeat = new Date();
      }
    });
  }

  /**
   * 클라이언트 메시지 처리 (개선됨)
   */
  handleClientMessage(clientId, message) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscription(clientId, data);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(clientId, data);
          break;
          
        case 'get_metrics':
          this.sendMetrics(client.ws, data.filter);
          break;
          
        case 'get_logs':
          this.sendLogs(client.ws, data.query);
          break;
          
        case 'get_job_details':
          this.sendJobDetails(client.ws, data.jobId);
          break;
          
        case 'get_execution_logs':
          this.sendExecutionLogs(client.ws, data.executionId);
          break;
          
        case 'heartbeat':
          client.lastHeartbeat = new Date();
          break;
          
        case 'ping':
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          }
          break;
          
        default:
          logger.warn(`알 수 없는 메시지 타입: ${data.type}`);
      }
    } catch (error) {
      logger.error(`메시지 처리 오류 (클라이언트 ${clientId}):`, error);
    }
  }

  /**
   * 구독 처리 (개선됨)
   */
  handleSubscription(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = data;
    if (Array.isArray(channels)) {
      channels.forEach(channel => {
        if (this.isValidChannel(channel)) {
          client.subscriptions.add(channel);
        }
      });
    }

    logger.debug(`클라이언트 ${clientId} 구독 업데이트:`, Array.from(client.subscriptions));
  }

  /**
   * 구독 해제 처리
   */
  handleUnsubscription(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = data;
    if (Array.isArray(channels)) {
      channels.forEach(channel => {
        client.subscriptions.delete(channel);
      });
    }
  }

  /**
   * 클라이언트 연결 해제 처리
   */
  handleDisconnection(clientId, code, reason) {
    this.clients.delete(clientId);
    logger.info(`클라이언트 연결 해제: ${clientId} (코드: ${code}, 이유: ${reason})`);
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
        this.broadcastToSubscribers('metrics', {
          type: 'metrics',
          data: metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('메트릭 수집 오류:', error);
      }
    }, this.config.metricsUpdateInterval);

    // 시스템 상태 체크
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthStatus = await this.checkSystemHealth();
        this.broadcastToSubscribers('alerts', {
          type: 'health',
          data: healthStatus,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('시스템 상태 체크 오류:', error);
      }
    }, this.config.healthCheckInterval);
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
      logger.error('초기 상태 전송 실패:', error);
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
        logger.warn('알 수 없는 메시지 타입:', type);
    }
  }

  /**
   * 구독 처리
   */
  async handleSubscription(ws, subscriptionData) {
    // 클라이언트별 구독 정보 저장 (필요시 확장)
    ws.subscriptions = subscriptionData;
    
    logger.debug('클라이언트 구독 설정:', subscriptionData);
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

    // 시스템 리소스 정보 추가
    const systemResources = await this.getSystemResources();

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
      system: systemResources,
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
      logger.error('시스템 상태 체크 실패:', error);
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
      logger.error('상위 성능 작업 조회 실패:', error);
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
      logger.error('최근 실행 내역 조회 실패:', error);
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
      logger.error('시스템 통계 조회 실패:', error);
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
      logger.error('작업 상세 정보 전송 실패:', error);
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
      logger.error('실행 로그 전송 실패:', error);
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
   * 시스템 리소스 정보 수집
   */
  async getSystemResources() {
    try {
      const cpuUsage = await this.getEnhancedCPUUsage();
      const memoryUsage = this.getMemoryUsage();
      const networkUsage = this.getNetworkUsage();

      return {
        cpu: {
          usage: cpuUsage,
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'Unknown',
          loadAverage: os.loadavg()
        },
        memory: {
          total: memoryUsage.total,
          used: memoryUsage.used,
          free: memoryUsage.free,
          usage: memoryUsage.usage
        },
        network: networkUsage,
        os: {
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          hostname: os.hostname(),
          uptime: Math.round(os.uptime())
        },
        process: {
          uptime: Math.round(process.uptime()),
          pid: process.pid,
          memory: process.memoryUsage()
        }
      };
    } catch (error) {
      logger.error('시스템 리소스 수집 실패:', error);
      return {};
    }
  }

  /**
   * 향상된 CPU 사용률 계산
   */
  getEnhancedCPUUsage() {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const usage = 100 - ~~(100 * idleDifference / totalDifference);
        
        resolve(Math.max(0, Math.min(100, usage)));
      }, 100);
    });
  }

  /**
   * CPU 평균 계산 헬퍼
   */
  cpuAverage() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    
    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }
    
    const total = user + nice + sys + idle + irq;
    
    return { idle, total };
  }

  /**
   * 메모리 사용 정보
   */
  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = Math.round((used / total) * 100 * 100) / 100;

    return {
      total: Math.round(total / 1024 / 1024), // MB
      used: Math.round(used / 1024 / 1024),   // MB
      free: Math.round(free / 1024 / 1024),   // MB
      usage
    };
  }

  /**
   * 네트워크 사용 정보
   */
  getNetworkUsage() {
    try {
      const interfaces = os.networkInterfaces();
      const stats = {
        interfaces: Object.keys(interfaces).length,
        active: 0,
        details: {}
      };

      // 활성 인터페이스 계산
      for (const [name, addrs] of Object.entries(interfaces)) {
        const activeAddrs = addrs.filter(addr => !addr.internal);
        if (activeAddrs.length > 0) {
          stats.active++;
          stats.details[name] = activeAddrs.map(addr => ({
            address: addr.address,
            family: addr.family,
            mac: addr.mac
          }));
        }
      }

      return stats;
    } catch (error) {
      return {
        interfaces: 0,
        active: 0,
        details: {}
      };
    }
  }

  /**
   * 구독자들에게 브로드캐스트
   */
  broadcastToSubscribers(channel, message) {
    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.has(channel)) {
        this.sendMessage(client.ws, message);
      }
    });
  }

  /**
   * 메시지 전송
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const data = JSON.stringify(message);
        ws.send(data);
      } catch (error) {
        logger.error('메시지 전송 실패:', error);
      }
    }
  }

  /**
   * 메트릭 데이터 전송
   */
  async sendMetrics(ws, filter = {}) {
    try {
      const metrics = await this.getMetrics(filter);
      this.sendMessage(ws, {
        type: 'metrics_response',
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('메트릭 데이터 전송 실패:', error);
    }
  }

  /**
   * 로그 데이터 전송
   */
  async sendLogs(ws, query = {}) {
    try {
      const logs = await this.getLogs(query);
      this.sendMessage(ws, {
        type: 'logs_response',
        data: logs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('로그 데이터 전송 실패:', error);
    }
  }

  /**
   * 메트릭 데이터 반환 (필터 적용)
   */
  async getMetrics(filter = {}) {
    try {
      const { timeRange, type, limit } = filter;
      
      if (type === 'current') {
        return this.currentMetrics;
      } else {
        return await this.collectRealTimeMetrics();
      }
    } catch (error) {
      logger.error('메트릭 데이터 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 로그 데이터 반환
   */
  async getLogs(query = {}) {
    try {
      const { level, limit = 100, search } = query;
      
      // 실제 구현에서는 로그 파일이나 데이터베이스에서 조회
      // 여기서는 예시 데이터 반환
      const logs = [
        {
          id: 1,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: '시스템이 정상적으로 시작되었습니다.',
          source: 'system'
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 60000).toISOString(),
          level: 'warn',
          message: 'CPU 사용률이 높습니다.',
          source: 'monitoring'
        }
      ];

      // 필터 적용
      let filteredLogs = logs;
      
      if (level) {
        filteredLogs = filteredLogs.filter(log => log.level === level);
      }
      
      if (search) {
        filteredLogs = filteredLogs.filter(log => 
          log.message.toLowerCase().includes(search.toLowerCase())
        );
      }

      return filteredLogs.slice(0, limit);
    } catch (error) {
      logger.error('로그 데이터 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 하트비트 시작
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      
      this.clients.forEach((client, clientId) => {
        // 하트비트 확인
        const timeSinceLastHeartbeat = now - client.lastHeartbeat;
        
        if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
          // 응답하지 않는 클라이언트 제거
          logger.warn(`클라이언트 ${clientId} 하트비트 타임아웃`);
          client.ws.terminate();
          this.clients.delete(clientId);
        } else if (client.ws.readyState === WebSocket.OPEN) {
          // 핑 전송
          client.ws.ping();
        }
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * 클라이언트 ID 생성
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 클라이언트 IP 주소 획득
   */
  getClientIP(request) {
    return request.headers['x-forwarded-for'] || 
           request.headers['x-real-ip'] || 
           request.connection.remoteAddress ||
           request.socket.remoteAddress ||
           (request.connection.socket ? request.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
  }

  /**
   * 유효한 채널인지 확인
   */
  isValidChannel(channel) {
    const validChannels = ['metrics', 'alerts', 'logs', 'jobs', 'system'];
    return validChannels.includes(channel);
  }

  /**
   * 현재 연결된 클라이언트 정보 반환
   */
  getClientInfo() {
    return {
      totalClients: this.clients.size,
      maxClients: this.config.maxClients,
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        ip: client.ip,
        connectedAt: client.connectedAt,
        subscriptions: Array.from(client.subscriptions)
      }))
    };
  }

  /**
   * 서비스 종료
   */
  shutdown() {
    logger.info('모니터링 서비스를 종료합니다...');

    // 타이머 정리
    this.stopMetricsCollection();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // 모든 클라이언트 연결 종료
    this.clients.forEach((client, clientId) => {
      client.ws.close(1001, '서버 종료');
    });

    // WebSocket 서버 종료
    if (this.wss) {
      this.wss.close(() => {
        logger.info('모니터링 WebSocket 서버가 종료되었습니다.');
      });
    }
    
    this.clients.clear();
    logger.info('모니터링 서비스 종료 완료');
  }
}

// 싱글톤 인스턴스
const monitoringService = new MonitoringService();

module.exports = monitoringService;