const express = require('express');
const router = express.Router();
const { Job, JobExecution, Mapping, System, DataSchema } = require('../models');
const { authenticateToken, authorize } = require('./middleware/auth');
const jobScheduler = require('./services/jobScheduler');
const nifiClient = require('./src/utils/nifiClient');
const { Op } = require('sequelize');

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

/**
 * 작업 목록 조회
 * GET /api/jobs
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      priority = '',
      isActive = '',
      mappingId = '',
      tags = '',
      sortBy = 'updatedAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // 검색 조건
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // 상태 필터
    if (status) {
      whereClause.status = status;
    }

    // 우선순위 필터
    if (priority) {
      whereClause.priority = priority;
    }

    // 활성 상태 필터
    if (isActive !== '') {
      whereClause.isActive = isActive === 'true';
    }

    // 매핑 필터
    if (mappingId) {
      whereClause.mappingId = mappingId;
    }

    // 태그 필터
    if (tags) {
      const tagArray = tags.split(',');
      whereClause.tags = {
        [Op.overlap]: tagArray
      };
    }

    const { count, rows } = await Job.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: Mapping,
          as: 'mapping',
          include: [
            {
              model: System,
              as: 'sourceSystem',
              attributes: ['id', 'name', 'type']
            },
            {
              model: System,
              as: 'targetSystem',
              attributes: ['id', 'name', 'type']
            }
          ]
        },
        {
          model: require('./src/models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: require('./src/models/User'),
          as: 'updater',
          attributes: ['id', 'name', 'email']
        }
      ],
      distinct: true
    });

    // 각 작업의 최근 실행 정보 추가
    const jobsWithExecutions = await Promise.all(rows.map(async (job) => {
      const jobJson = job.toJSON();
      
      // 최근 실행 정보
      const recentExecution = await JobExecution.findOne({
        where: { jobId: job.id },
        order: [['startedAt', 'DESC']],
        attributes: ['id', 'status', 'startedAt', 'completedAt', 'duration']
      });

      jobJson.recentExecution = recentExecution;
      return jobJson;
    }));

    res.json({
      jobs: jobsWithExecutions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('작업 목록 조회 실패:', error);
    res.status(500).json({
      error: '작업 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 상세 조회
 * GET /api/jobs/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeExecutions = false } = req.query;

    const job = await Job.findByPk(id, {
      include: [
        {
          model: Mapping,
          as: 'mapping',
          include: [
            {
              model: System,
              as: 'sourceSystem'
            },
            {
              model: System,
              as: 'targetSystem'
            },
            {
              model: DataSchema,
              as: 'sourceSchema'
            },
            {
              model: DataSchema,
              as: 'targetSchema'
            }
          ]
        },
        {
          model: require('./src/models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: require('./src/models/User'),
          as: 'updater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!job) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    let result = job.toJSON();

    // 실행 이력 포함
    if (includeExecutions === 'true') {
      const executions = await JobExecution.findAll({
        where: { jobId: id },
        order: [['startedAt', 'DESC']],
        limit: 20,
        include: [
          {
            model: require('./src/models/User'),
            as: 'triggeredByUser',
            attributes: ['id', 'name', 'email']
          }
        ]
      });
      result.executions = executions;
    }

    res.json(result);
  } catch (error) {
    console.error('작업 상세 조회 실패:', error);
    res.status(500).json({
      error: '작업 상세 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 생성
 * POST /api/jobs
 */
router.post('/', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const {
      name,
      description,
      mappingId,
      scheduleConfig,
      priority = 5,
      configuration = {},
      tags = [],
      dependencies = [],
      timeout,
      maxRetries = 3,
      retryDelay = 60
    } = req.body;

    // 필수 필드 검증
    if (!name || !mappingId || !scheduleConfig) {
      return res.status(400).json({
        error: '필수 필드가 누락되었습니다.',
        required: ['name', 'mappingId', 'scheduleConfig']
      });
    }

    // 매핑 존재 확인
    const mapping = await Mapping.findByPk(mappingId, {
      include: [
        { model: System, as: 'sourceSystem' },
        { model: System, as: 'targetSystem' },
        { model: DataSchema, as: 'sourceSchema' },
        { model: DataSchema, as: 'targetSchema' }
      ]
    });

    if (!mapping) {
      return res.status(404).json({
        error: '매핑을 찾을 수 없습니다.'
      });
    }

    // 작업 생성
    const job = await Job.create({
      name,
      description,
      mappingId,
      scheduleConfig,
      priority,
      configuration,
      tags,
      dependencies,
      timeout,
      maxRetries,
      retryDelay,
      createdBy: req.user.id
    });

    // NiFi 플로우 생성
    try {
      const nifiFlow = await nifiClient.createMappingFlow(mapping, job.name);
      await job.update({
        nifiProcessGroupId: nifiFlow.processGroupId,
        nifiProcessorId: nifiFlow.transformProcessorId
      });
    } catch (nifiError) {
      console.warn('NiFi 플로우 생성 실패:', nifiError.message);
      // NiFi 오류는 작업 생성을 막지 않음
    }

    // 스케줄 등록
    if (job.isActive && scheduleConfig.type !== 'manual') {
      await jobScheduler.scheduleJob(job);
    }

    // 생성된 작업 정보 반환
    const result = await Job.findByPk(job.id, {
      include: [
        {
          model: Mapping,
          as: 'mapping',
          include: [
            { model: System, as: 'sourceSystem', attributes: ['id', 'name', 'type'] },
            { model: System, as: 'targetSystem', attributes: ['id', 'name', 'type'] }
          ]
        },
        {
          model: require('./src/models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({
      message: '작업이 성공적으로 생성되었습니다.',
      job: result
    });
  } catch (error) {
    console.error('작업 생성 실패:', error);
    res.status(400).json({
      error: '작업 생성 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 수정
 * PUT /api/jobs/:id
 */
router.put('/:id', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      scheduleConfig,
      priority,
      configuration,
      tags,
      dependencies,
      timeout,
      maxRetries,
      retryDelay,
      isActive
    } = req.body;

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    // 실행 중인 작업은 수정 제한
    if (job.status === 'running') {
      return res.status(400).json({
        error: '실행 중인 작업은 수정할 수 없습니다.'
      });
    }

    const updateData = {
      updatedBy: req.user.id
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (scheduleConfig !== undefined) updateData.scheduleConfig = scheduleConfig;
    if (priority !== undefined) updateData.priority = priority;
    if (configuration !== undefined) updateData.configuration = configuration;
    if (tags !== undefined) updateData.tags = tags;
    if (dependencies !== undefined) updateData.dependencies = dependencies;
    if (timeout !== undefined) updateData.timeout = timeout;
    if (maxRetries !== undefined) updateData.maxRetries = maxRetries;
    if (retryDelay !== undefined) updateData.retryDelay = retryDelay;
    if (isActive !== undefined) updateData.isActive = isActive;

    await job.update(updateData);

    // 스케줄 재등록
    if (scheduleConfig || isActive !== undefined) {
      jobScheduler.unscheduleJob(job.id);
      if (job.isActive && job.scheduleConfig.type !== 'manual') {
        await jobScheduler.scheduleJob(job);
      }
    }

    // 업데이트된 작업 정보 반환
    const result = await Job.findByPk(job.id, {
      include: [
        {
          model: Mapping,
          as: 'mapping',
          include: [
            { model: System, as: 'sourceSystem', attributes: ['id', 'name', 'type'] },
            { model: System, as: 'targetSystem', attributes: ['id', 'name', 'type'] }
          ]
        }
      ]
    });

    res.json({
      message: '작업이 성공적으로 수정되었습니다.',
      job: result
    });
  } catch (error) {
    console.error('작업 수정 실패:', error);
    res.status(400).json({
      error: '작업 수정 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 삭제
 * DELETE /api/jobs/:id
 */
router.delete('/:id', authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    // 실행 중인 작업은 삭제 불가
    if (job.status === 'running') {
      return res.status(400).json({
        error: '실행 중인 작업은 삭제할 수 없습니다.'
      });
    }

    // 스케줄 해제
    jobScheduler.unscheduleJob(job.id);

    // NiFi 프로세스 그룹 삭제
    if (job.nifiProcessGroupId) {
      try {
        await nifiClient.deleteProcessGroup(job.nifiProcessGroupId);
      } catch (nifiError) {
        console.warn('NiFi 프로세스 그룹 삭제 실패:', nifiError.message);
      }
    }

    // 작업 삭제
    await job.destroy();

    res.json({
      message: '작업이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('작업 삭제 실패:', error);
    res.status(500).json({
      error: '작업 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 수동 실행
 * POST /api/jobs/:id/execute
 */
router.post('/:id/execute', authorize(['admin', 'manager', 'user']), async (req, res) => {
  try {
    const { id } = req.params;
    const { parameters = null } = req.body;

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    if (!job.canExecute()) {
      return res.status(400).json({
        error: '현재 실행할 수 없는 작업입니다.',
        reason: job.status === 'running' ? '이미 실행 중입니다.' : '작업이 비활성화되었습니다.'
      });
    }

    // 수동 실행
    await jobScheduler.executeJobManually(id, req.user.id, parameters);

    res.json({
      message: '작업이 실행 대기열에 추가되었습니다.',
      jobId: id
    });
  } catch (error) {
    console.error('작업 수동 실행 실패:', error);
    res.status(400).json({
      error: '작업 실행 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 실행 취소
 * POST /api/jobs/:id/cancel
 */
router.post('/:id/cancel', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { executionId } = req.body;

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    let cancelled = false;

    if (executionId) {
      // 특정 실행 취소
      cancelled = await jobScheduler.cancelJob(executionId, req.user.id);
    } else {
      // 모든 실행 취소
      const runningExecutions = await JobExecution.findAll({
        where: {
          jobId: id,
          status: ['queued', 'running']
        }
      });

      for (const execution of runningExecutions) {
        await jobScheduler.cancelJob(execution.id, req.user.id);
      }

      cancelled = runningExecutions.length > 0;
    }

    res.json({
      message: cancelled ? '작업이 취소되었습니다.' : '취소할 실행이 없습니다.',
      cancelled
    });
  } catch (error) {
    console.error('작업 취소 실패:', error);
    res.status(400).json({
      error: '작업 취소 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 활성화/비활성화
 * PATCH /api/jobs/:id/status
 */
router.patch('/:id/status', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    if (isActive) {
      job.activate();
      await jobScheduler.scheduleJob(job);
    } else {
      job.deactivate();
      jobScheduler.unscheduleJob(job.id);
    }

    await job.save();

    res.json({
      message: `작업이 ${isActive ? '활성화' : '비활성화'}되었습니다.`,
      job: {
        id: job.id,
        isActive: job.isActive,
        status: job.status,
        nextExecutionAt: job.nextExecutionAt
      }
    });
  } catch (error) {
    console.error('작업 상태 변경 실패:', error);
    res.status(400).json({
      error: '작업 상태 변경 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 일시정지/재개
 * PATCH /api/jobs/:id/pause
 */
router.patch('/:id/pause', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { paused } = req.body;

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    if (paused) {
      job.pause();
      jobScheduler.unscheduleJob(job.id);
    } else {
      job.resume();
      if (job.isActive && job.scheduleConfig.type !== 'manual') {
        await jobScheduler.scheduleJob(job);
      }
    }

    await job.save();

    res.json({
      message: `작업이 ${paused ? '일시정지' : '재개'}되었습니다.`,
      job: {
        id: job.id,
        status: job.status,
        nextExecutionAt: job.nextExecutionAt
      }
    });
  } catch (error) {
    console.error('작업 일시정지/재개 실패:', error);
    res.status(400).json({
      error: '작업 일시정지/재개 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 실행 이력 조회
 * GET /api/jobs/:id/executions
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 20,
      status = '',
      triggerType = '',
      sortBy = 'startedAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = { jobId: id };

    if (status) {
      whereClause.status = status;
    }

    if (triggerType) {
      whereClause.triggerType = triggerType;
    }

    const { count, rows } = await JobExecution.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: require('./src/models/User'),
          as: 'triggeredByUser',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.json({
      executions: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('작업 실행 이력 조회 실패:', error);
    res.status(500).json({
      error: '작업 실행 이력 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 작업 실행 통계
 * GET /api/jobs/:id/stats
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    const job = await Job.findByPk(id);
    if (!job) {
      return res.status(404).json({
        error: '작업을 찾을 수 없습니다.'
      });
    }

    const stats = await JobExecution.getExecutionStats(id, period);

    res.json({
      jobId: id,
      period,
      stats
    });
  } catch (error) {
    console.error('작업 통계 조회 실패:', error);
    res.status(500).json({
      error: '작업 통계 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스케줄 타입 목록 조회
 * GET /api/jobs/meta/schedule-types
 */
router.get('/meta/schedule-types', (req, res) => {
  try {
    const scheduleTypes = Job.getScheduleTypes();
    res.json({ scheduleTypes });
  } catch (error) {
    console.error('스케줄 타입 목록 조회 실패:', error);
    res.status(500).json({
      error: '스케줄 타입 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 상태 타입 목록 조회
 * GET /api/jobs/meta/status-types
 */
router.get('/meta/status-types', (req, res) => {
  try {
    const statusTypes = Job.getStatusTypes();
    res.json({ statusTypes });
  } catch (error) {
    console.error('상태 타입 목록 조회 실패:', error);
    res.status(500).json({
      error: '상태 타입 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 대시보드 통계
 * GET /api/jobs/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { period = '7d' } = req.query;

    // 기본 통계
    const totalJobs = await Job.count();
    const activeJobs = await Job.count({ where: { isActive: true } });
    const runningJobs = await Job.count({ where: { status: 'running' } });
    const scheduledJobs = await Job.count({ where: { status: 'scheduled' } });

    // 기간별 실행 통계
    const startDate = new Date();
    const days = parseInt(period.replace('d', ''));
    startDate.setDate(startDate.getDate() - days);

    const recentExecutions = await JobExecution.findAll({
      where: {
        startedAt: {
          [Op.gte]: startDate
        }
      },
      attributes: ['status', 'startedAt', 'duration'],
      order: [['startedAt', 'DESC']]
    });

    // 상태별 실행 통계
    const executionsByStatus = recentExecutions.reduce((acc, execution) => {
      acc[execution.status] = (acc[execution.status] || 0) + 1;
      return acc;
    }, {});

    // 일별 실행 통계
    const dailyStats = {};
    recentExecutions.forEach(execution => {
      const dateKey = execution.startedAt.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { total: 0, completed: 0, failed: 0 };
      }
      dailyStats[dateKey].total++;
      dailyStats[dateKey][execution.status]++;
    });

    // 평균 실행 시간
    const completedExecutions = recentExecutions.filter(e => e.status === 'completed' && e.duration);
    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + e.duration, 0) / completedExecutions.length
      : 0;

    // 스케줄러 상태
    const schedulerStatus = jobScheduler.getStatus();

    res.json({
      summary: {
        totalJobs,
        activeJobs,
        runningJobs,
        scheduledJobs
      },
      executions: {
        total: recentExecutions.length,
        byStatus: executionsByStatus,
        averageExecutionTime,
        successRate: recentExecutions.length > 0
          ? ((executionsByStatus.completed || 0) / recentExecutions.length * 100)
          : 0
      },
      dailyStats,
      scheduler: schedulerStatus,
      period
    });
  } catch (error) {
    console.error('대시보드 통계 조회 실패:', error);
    res.status(500).json({
      error: '대시보드 통계 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

module.exports = router;