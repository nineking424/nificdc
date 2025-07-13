const cron = require('node-cron');
const { Job, JobExecution, Mapping } = require('../src/models');
const MappingEngine = require('../src/utils/mappingEngine');
const nifiClient = require('../src/utils/nifiClient');

/**
 * 작업 스케줄러 서비스
 * 작업 예약, 실행, 모니터링을 담당
 */
class JobScheduler {
  constructor() {
    this.scheduledJobs = new Map(); // 스케줄된 작업 저장
    this.executionQueue = []; // 실행 대기열
    this.runningExecutions = new Map(); // 실행 중인 작업
    this.isProcessing = false;
    this.maxConcurrentJobs = 5; // 동시 실행 최대 개수
    this.pollingInterval = 30000; // 30초마다 체크
    this.retryDelay = 60000; // 재시도 지연 시간
    
    this.init();
  }

  /**
   * 스케줄러 초기화
   */
  async init() {
    console.log('Job Scheduler 초기화 시작...');
    
    // 기존 스케줄 재등록
    await this.restoreSchedules();
    
    // 정기적 스케줄 체크
    this.startPolling();
    
    // 실행 대기열 처리
    this.processExecutionQueue();
    
    console.log('Job Scheduler 초기화 완료');
  }

  /**
   * 기존 스케줄 복원
   */
  async restoreSchedules() {
    try {
      const activeJobs = await Job.findAll({
        where: {
          isActive: true,
          status: ['scheduled', 'running']
        },
        include: [
          {
            model: Mapping,
            as: 'mapping'
          }
        ]
      });

      console.log(`${activeJobs.length}개의 활성 작업 복원 중...`);

      for (const job of activeJobs) {
        await this.scheduleJob(job);
      }
    } catch (error) {
      console.error('스케줄 복원 실패:', error);
    }
  }

  /**
   * 작업 스케줄 등록
   */
  async scheduleJob(job) {
    try {
      // 기존 스케줄 제거
      this.unscheduleJob(job.id);

      const { scheduleConfig } = job;
      
      switch (scheduleConfig.type) {
        case 'immediate':
          await this.executeJobImmediate(job);
          break;
          
        case 'once':
          this.scheduleOnceJob(job);
          break;
          
        case 'recurring':
          this.scheduleRecurringJob(job);
          break;
          
        case 'cron':
          this.scheduleCronJob(job);
          break;
          
        default:
          console.warn(`지원되지 않는 스케줄 타입: ${scheduleConfig.type}`);
      }
    } catch (error) {
      console.error(`작업 스케줄 등록 실패 [${job.id}]:`, error);
    }
  }

  /**
   * 즉시 실행 작업 처리
   */
  async executeJobImmediate(job) {
    await this.addToExecutionQueue(job, 'scheduled');
  }

  /**
   * 일회성 작업 스케줄
   */
  scheduleOnceJob(job) {
    const { scheduleConfig } = job;
    const executeAt = new Date(scheduleConfig.executeAt);
    const now = new Date();
    
    if (executeAt <= now) {
      // 이미 지난 시간이면 즉시 실행
      this.executeJobImmediate(job);
      return;
    }
    
    const delay = executeAt.getTime() - now.getTime();
    
    const timeout = setTimeout(async () => {
      await this.addToExecutionQueue(job, 'scheduled');
      this.scheduledJobs.delete(job.id);
    }, delay);
    
    this.scheduledJobs.set(job.id, {
      type: 'timeout',
      task: timeout,
      job
    });
  }

  /**
   * 반복 작업 스케줄
   */
  scheduleRecurringJob(job) {
    const { scheduleConfig } = job;
    const { intervalType, interval } = scheduleConfig;
    
    let cronExpression;
    
    switch (intervalType) {
      case 'minutes':
        cronExpression = `*/${interval} * * * *`;
        break;
      case 'hours':
        cronExpression = `0 */${interval} * * *`;
        break;
      case 'days':
        cronExpression = `0 0 */${interval} * *`;
        break;
      case 'weeks':
        cronExpression = `0 0 * * ${interval}`;
        break;
      case 'months':
        cronExpression = `0 0 1 */${interval} *`;
        break;
      default:
        console.error(`지원되지 않는 반복 유형: ${intervalType}`);
        return;
    }
    
    this.scheduleCronJobWithExpression(job, cronExpression);
  }

  /**
   * Cron 작업 스케줄
   */
  scheduleCronJob(job) {
    const { scheduleConfig } = job;
    this.scheduleCronJobWithExpression(job, scheduleConfig.expression);
  }

  /**
   * Cron 표현식으로 작업 스케줄
   */
  scheduleCronJobWithExpression(job, expression) {
    try {
      if (!cron.validate(expression)) {
        throw new Error(`유효하지 않은 cron 표현식: ${expression}`);
      }
      
      const task = cron.schedule(expression, async () => {
        await this.addToExecutionQueue(job, 'scheduled');
      }, {
        scheduled: true,
        timezone: 'Asia/Seoul'
      });
      
      this.scheduledJobs.set(job.id, {
        type: 'cron',
        task,
        job,
        expression
      });
      
      console.log(`Cron 작업 스케줄 등록: ${job.name} [${expression}]`);
    } catch (error) {
      console.error(`Cron 작업 스케줄 등록 실패 [${job.id}]:`, error);
    }
  }

  /**
   * 작업 스케줄 해제
   */
  unscheduleJob(jobId) {
    const scheduledJob = this.scheduledJobs.get(jobId);
    if (scheduledJob) {
      if (scheduledJob.type === 'cron') {
        scheduledJob.task.destroy();
      } else if (scheduledJob.type === 'timeout') {
        clearTimeout(scheduledJob.task);
      }
      
      this.scheduledJobs.delete(jobId);
      console.log(`작업 스케줄 해제: ${jobId}`);
    }
  }

  /**
   * 실행 대기열에 추가
   */
  async addToExecutionQueue(job, triggerType, triggeredBy = null, parameters = null) {
    try {
      // 의존성 확인
      const dependenciesMet = await job.isDependenciesMet();
      if (!dependenciesMet) {
        console.log(`작업 의존성 미충족: ${job.name}`);
        return;
      }
      
      // 실행 레코드 생성
      const execution = await JobExecution.create({
        jobId: job.id,
        status: 'queued',
        triggerType,
        triggeredBy,
        parameters,
        priority: job.priority,
        scheduledAt: new Date()
      });
      
      this.executionQueue.push({
        execution,
        job,
        queuedAt: new Date()
      });
      
      // 우선순위 순으로 정렬
      this.executionQueue.sort((a, b) => {
        if (a.job.priority !== b.job.priority) {
          return b.job.priority - a.job.priority; // 높은 우선순위 먼저
        }
        return a.queuedAt - b.queuedAt; // 같은 우선순위면 먼저 대기한 것부터
      });
      
      console.log(`실행 대기열에 추가: ${job.name} [우선순위: ${job.priority}]`);
      
      // 즉시 처리 시도
      setImmediate(() => this.processExecutionQueue());
      
    } catch (error) {
      console.error(`실행 대기열 추가 실패 [${job.id}]:`, error);
    }
  }

  /**
   * 실행 대기열 처리
   */
  async processExecutionQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (this.executionQueue.length > 0 && this.runningExecutions.size < this.maxConcurrentJobs) {
        const queueItem = this.executionQueue.shift();
        await this.executeJob(queueItem.execution, queueItem.job);
      }
    } catch (error) {
      console.error('실행 대기열 처리 중 오류:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 작업 실행
   */
  async executeJob(execution, job) {
    try {
      console.log(`작업 실행 시작: ${job.name} [${execution.id}]`);
      
      // 실행 상태 업데이트
      await execution.update({
        status: 'running',
        startedAt: new Date()
      });
      
      // 실행 중인 작업 목록에 추가
      this.runningExecutions.set(execution.id, {
        execution,
        job,
        startedAt: new Date()
      });
      
      // 작업 상태 업데이트
      await job.update({
        status: 'running',
        lastExecutedAt: new Date()
      });
      
      // 실행 컨텍스트 설정
      const context = {
        jobId: job.id,
        mappingId: job.mappingId,
        executionId: execution.id,
        parameters: execution.parameters || {},
        timeout: job.timeout || 300000 // 5분 기본 타임아웃
      };
      
      let result;
      
      // 타임아웃 설정
      if (job.timeout) {
        result = await Promise.race([
          this.executeJobWithMapping(job, execution, context),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('실행 시간 초과')), job.timeout * 1000);
          })
        ]);
      } else {
        result = await this.executeJobWithMapping(job, execution, context);
      }
      
      // 성공 처리
      await this.handleJobSuccess(execution, job, result);
      
    } catch (error) {
      // 실패 처리
      await this.handleJobFailure(execution, job, error);
    } finally {
      // 실행 중인 작업 목록에서 제거
      this.runningExecutions.delete(execution.id);
      
      // 대기열 계속 처리
      setImmediate(() => this.processExecutionQueue());
    }
  }

  /**
   * 매핑을 사용한 작업 실행
   */
  async executeJobWithMapping(job, execution, context) {
    const mapping = await Mapping.findByPk(job.mappingId, {
      include: [
        { model: require('../models/System'), as: 'sourceSystem' },
        { model: require('../models/System'), as: 'targetSystem' },
        { model: require('../models/DataSchema'), as: 'sourceSchema' },
        { model: require('../models/DataSchema'), as: 'targetSchema' }
      ]
    });
    
    if (!mapping) {
      throw new Error('매핑을 찾을 수 없습니다.');
    }
    
    execution.addCheckpoint('mapping_loaded', '매핑 정보 로드 완료');
    
    // NiFi 프로세스 실행
    let nifiResult;
    if (job.nifiProcessGroupId) {
      execution.addCheckpoint('nifi_start', 'NiFi 프로세스 시작');
      nifiResult = await this.executeNiFiProcess(job, execution);
      execution.addCheckpoint('nifi_complete', 'NiFi 프로세스 완료');
    }
    
    // 매핑 엔진 실행 (NiFi 결과 데이터 처리)
    let mappingResult;
    if (nifiResult && nifiResult.data) {
      execution.addCheckpoint('mapping_start', '매핑 변환 시작');
      mappingResult = await MappingEngine.transform(mapping, nifiResult.data);
      execution.addCheckpoint('mapping_complete', '매핑 변환 완료');
    }
    
    // 실행 메트릭 업데이트
    const metrics = {
      nifiMetrics: nifiResult?.metrics || {},
      mappingMetrics: mappingResult?.metrics || {},
      executionTime: Date.now() - execution.startedAt?.getTime(),
      timestamp: new Date()
    };
    
    execution.updateMetrics(metrics);
    
    // 레코드 카운트 업데이트
    if (nifiResult?.recordCounts) {
      execution.updateRecordCounts(
        nifiResult.recordCounts.input,
        nifiResult.recordCounts.output,
        nifiResult.recordCounts.error
      );
    }
    
    return {
      nifiResult,
      mappingResult,
      metrics
    };
  }

  /**
   * NiFi 프로세스 실행
   */
  async executeNiFiProcess(job, execution) {
    try {
      if (!job.nifiProcessGroupId) {
        throw new Error('NiFi 프로세스 그룹 ID가 설정되지 않았습니다.');
      }
      
      // 프로세스 그룹 시작
      const startResult = await nifiClient.startProcessGroup(job.nifiProcessGroupId);
      
      // 실행 모니터링
      const monitoringResult = await this.monitorNiFiExecution(job.nifiProcessGroupId, execution);
      
      // 프로세스 그룹 중지
      await nifiClient.stopProcessGroup(job.nifiProcessGroupId);
      
      return monitoringResult;
    } catch (error) {
      console.error('NiFi 프로세스 실행 실패:', error);
      throw error;
    }
  }

  /**
   * NiFi 실행 모니터링
   */
  async monitorNiFiExecution(processGroupId, execution) {
    const monitoringInterval = 5000; // 5초마다 체크
    const maxMonitoringTime = 30 * 60 * 1000; // 30분 최대 모니터링
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxMonitoringTime) {
      try {
        const status = await nifiClient.getProcessGroupStatus(processGroupId);
        
        // 상태 업데이트
        execution.updateMetrics({
          nifiStatus: status,
          monitoringTime: Date.now() - startTime
        });
        
        // 완료 조건 확인
        if (status.aggregate.activeThreadCount === 0 && 
            status.aggregate.queuedCount === 0) {
          
          // 결과 데이터 수집
          const resultData = await nifiClient.getProcessGroupData(processGroupId);
          
          return {
            status: 'completed',
            data: resultData.data,
            metrics: resultData.metrics,
            recordCounts: {
              input: status.aggregate.bytesRead,
              output: status.aggregate.bytesWritten,
              error: status.aggregate.bytesTransferred - status.aggregate.bytesWritten
            }
          };
        }
        
        // 에러 조건 확인
        if (status.aggregate.bytesTransferred === 0 && 
            Date.now() - startTime > 60000) { // 1분 후에도 데이터 이동이 없으면
          throw new Error('NiFi 프로세스에서 데이터 처리가 시작되지 않았습니다.');
        }
        
        await new Promise(resolve => setTimeout(resolve, monitoringInterval));
      } catch (error) {
        console.error('NiFi 모니터링 중 오류:', error);
        throw error;
      }
    }
    
    throw new Error('NiFi 프로세스 모니터링 시간이 초과되었습니다.');
  }

  /**
   * 작업 성공 처리
   */
  async handleJobSuccess(execution, job, result) {
    try {
      await execution.update({
        status: 'completed',
        completedAt: new Date(),
        metrics: result.metrics
      });
      
      // 작업 통계 업데이트
      const executionTime = execution.completedAt.getTime() - execution.startedAt.getTime();
      job.updateExecutionStats(executionTime, true);
      
      // 다음 실행 시간 계산
      const nextExecutionAt = job.calculateNextExecution();
      
      await job.update({
        status: nextExecutionAt ? 'scheduled' : 'completed',
        lastExecutedAt: new Date(),
        lastExecutionStatus: 'success',
        lastExecutionError: null,
        nextExecutionAt,
        executionStats: job.executionStats
      });
      
      console.log(`작업 실행 성공: ${job.name} [${execution.id}]`);
      
    } catch (error) {
      console.error('작업 성공 처리 중 오류:', error);
    }
  }

  /**
   * 작업 실패 처리
   */
  async handleJobFailure(execution, job, error) {
    try {
      await execution.update({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message,
        errorStack: error.stack
      });
      
      // 작업 통계 업데이트
      const executionTime = execution.completedAt.getTime() - execution.startedAt.getTime();
      job.updateExecutionStats(executionTime, false);
      
      await job.update({
        status: 'failed',
        lastExecutedAt: new Date(),
        lastExecutionStatus: 'failed',
        lastExecutionError: error.message,
        executionStats: job.executionStats
      });
      
      console.error(`작업 실행 실패: ${job.name} [${execution.id}]: ${error.message}`);
      
      // 재시도 처리
      if (execution.retryCount < job.maxRetries) {
        setTimeout(async () => {
          await this.retryJob(execution, job);
        }, job.retryDelay * 1000);
      }
      
    } catch (updateError) {
      console.error('작업 실패 처리 중 오류:', updateError);
    }
  }

  /**
   * 작업 재시도
   */
  async retryJob(originalExecution, job) {
    try {
      console.log(`작업 재시도: ${job.name} [${originalExecution.retryCount + 1}/${job.maxRetries}]`);
      
      const retryExecution = await JobExecution.create({
        jobId: job.id,
        status: 'queued',
        triggerType: 'retry',
        parentExecutionId: originalExecution.id,
        retryCount: originalExecution.retryCount + 1,
        priority: job.priority,
        scheduledAt: new Date()
      });
      
      await this.addToExecutionQueue(job, 'retry');
      
    } catch (error) {
      console.error('작업 재시도 실패:', error);
    }
  }

  /**
   * 수동 작업 실행
   */
  async executeJobManually(jobId, userId, parameters = null) {
    try {
      const job = await Job.findByPk(jobId);
      if (!job) {
        throw new Error('작업을 찾을 수 없습니다.');
      }
      
      if (!job.canExecute()) {
        throw new Error('현재 실행할 수 없는 작업입니다.');
      }
      
      await this.addToExecutionQueue(job, 'manual', userId, parameters);
      
      return true;
    } catch (error) {
      console.error('수동 작업 실행 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 취소
   */
  async cancelJob(executionId, userId) {
    try {
      const runningExecution = this.runningExecutions.get(executionId);
      if (runningExecution) {
        // 실행 중인 작업 취소
        const { execution, job } = runningExecution;
        
        // NiFi 프로세스 중지
        if (job.nifiProcessGroupId) {
          await nifiClient.stopProcessGroup(job.nifiProcessGroupId);
        }
        
        await execution.update({
          status: 'cancelled',
          completedAt: new Date(),
          errorMessage: `사용자 ${userId}에 의해 취소됨`
        });
        
        await job.update({
          status: 'scheduled',
          lastExecutionStatus: 'cancelled'
        });
        
        this.runningExecutions.delete(executionId);
        
        console.log(`작업 취소: ${job.name} [${executionId}]`);
        return true;
      }
      
      // 대기 중인 작업 취소
      const queueIndex = this.executionQueue.findIndex(item => item.execution.id === executionId);
      if (queueIndex !== -1) {
        const queueItem = this.executionQueue.splice(queueIndex, 1)[0];
        
        await queueItem.execution.update({
          status: 'cancelled',
          completedAt: new Date(),
          errorMessage: `사용자 ${userId}에 의해 취소됨`
        });
        
        console.log(`대기 중인 작업 취소: ${queueItem.job.name} [${executionId}]`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('작업 취소 실패:', error);
      throw error;
    }
  }

  /**
   * 정기적 스케줄 체크
   */
  startPolling() {
    setInterval(async () => {
      try {
        // 스케줄된 작업 확인
        const executableJobs = await Job.findExecutableJobs();
        
        for (const job of executableJobs) {
          if (!this.runningExecutions.has(job.id)) {
            await this.addToExecutionQueue(job, 'scheduled');
          }
        }
        
        // 실행 중인 작업 상태 확인
        this.checkRunningExecutions();
        
      } catch (error) {
        console.error('스케줄 체크 중 오류:', error);
      }
    }, this.pollingInterval);
  }

  /**
   * 실행 중인 작업 상태 확인
   */
  checkRunningExecutions() {
    const now = Date.now();
    
    for (const [executionId, runningExecution] of this.runningExecutions) {
      const { execution, job, startedAt } = runningExecution;
      
      // 타임아웃 확인
      if (job.timeout && now - startedAt.getTime() > job.timeout * 1000) {
        this.handleJobTimeout(execution, job);
      }
    }
  }

  /**
   * 작업 타임아웃 처리
   */
  async handleJobTimeout(execution, job) {
    try {
      console.log(`작업 타임아웃: ${job.name} [${execution.id}]`);
      
      // NiFi 프로세스 중지
      if (job.nifiProcessGroupId) {
        await nifiClient.stopProcessGroup(job.nifiProcessGroupId);
      }
      
      await execution.update({
        status: 'timeout',
        completedAt: new Date(),
        errorMessage: '실행 시간 초과'
      });
      
      await job.update({
        status: 'failed',
        lastExecutionStatus: 'failed',
        lastExecutionError: '실행 시간 초과'
      });
      
      this.runningExecutions.delete(execution.id);
      
    } catch (error) {
      console.error('타임아웃 처리 중 오류:', error);
    }
  }

  /**
   * 스케줄러 종료
   */
  async shutdown() {
    console.log('Job Scheduler 종료 중...');
    
    // 모든 스케줄된 작업 해제
    for (const [jobId] of this.scheduledJobs) {
      this.unscheduleJob(jobId);
    }
    
    // 실행 중인 작업 대기
    const runningJobs = Array.from(this.runningExecutions.values());
    if (runningJobs.length > 0) {
      console.log(`${runningJobs.length}개의 실행 중인 작업 완료 대기...`);
      
      // 최대 30초 대기
      const maxWaitTime = 30000;
      const startTime = Date.now();
      
      while (this.runningExecutions.size > 0 && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 강제 종료
      for (const [executionId, runningExecution] of this.runningExecutions) {
        await this.cancelJob(executionId, 'system');
      }
    }
    
    console.log('Job Scheduler 종료 완료');
  }

  /**
   * 스케줄러 상태 정보
   */
  getStatus() {
    return {
      scheduledJobs: this.scheduledJobs.size,
      queuedJobs: this.executionQueue.length,
      runningJobs: this.runningExecutions.size,
      maxConcurrentJobs: this.maxConcurrentJobs,
      isProcessing: this.isProcessing,
      uptime: process.uptime()
    };
  }
}

// 싱글톤 인스턴스
const jobScheduler = new JobScheduler();

module.exports = jobScheduler;