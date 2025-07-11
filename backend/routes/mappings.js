const express = require('express');
const router = express.Router();
const { Mapping, System, DataSchema } = require('../models');
const { authenticateToken, authorize } = require('../middleware/auth');
const MappingEngine = require('../utils/mappingEngine');
const { Op } = require('sequelize');

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

/**
 * 매핑 목록 조회
 * GET /api/mappings
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sourceSystemId = '',
      targetSystemId = '',
      mappingType = '',
      isActive = '',
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

    // 시스템 필터
    if (sourceSystemId) {
      whereClause.sourceSystemId = sourceSystemId;
    }
    
    if (targetSystemId) {
      whereClause.targetSystemId = targetSystemId;
    }

    // 매핑 타입 필터
    if (mappingType) {
      whereClause.mappingType = mappingType;
    }

    // 활성 상태 필터
    if (isActive !== '') {
      whereClause.isActive = isActive === 'true';
    }

    const { count, rows } = await Mapping.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
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
        },
        {
          model: DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'version']
        },
        {
          model: DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'version']
        },
        {
          model: require('../models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ],
      distinct: true
    });

    // 각 매핑의 통계 정보 추가
    const mappingsWithStats = rows.map(mapping => {
      const mappingJson = mapping.toJSON();
      mappingJson.statistics = mapping.getMappingStatistics();
      return mappingJson;
    });

    res.json({
      mappings: mappingsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('매핑 목록 조회 실패:', error);
    res.status(500).json({
      error: '매핑 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 매핑 상세 조회
 * GET /api/mappings/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeVersions = false } = req.query;

    const mapping = await Mapping.findByPk(id, {
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
        },
        {
          model: DataSchema,
          as: 'sourceSchema',
          include: ['system']
        },
        {
          model: DataSchema,
          as: 'targetSchema',
          include: ['system']
        },
        {
          model: require('../models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        },
        {
          model: require('../models/User'),
          as: 'updater',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!mapping) {
      return res.status(404).json({
        error: '매핑을 찾을 수 없습니다.'
      });
    }

    let result = mapping.toJSON();
    result.statistics = mapping.getMappingStatistics();

    // 버전 정보 포함
    if (includeVersions === 'true') {
      const versions = await Mapping.findAllVersions(mapping.parentMappingId || mapping.id);
      result.versions = versions;
    }

    res.json(result);
  } catch (error) {
    console.error('매핑 상세 조회 실패:', error);
    res.status(500).json({
      error: '매핑 상세 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 매핑 생성
 * POST /api/mappings
 */
router.post('/', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const {
      name,
      description,
      sourceSystemId,
      targetSystemId,
      sourceSchemaId,
      targetSchemaId,
      mappingType = 'one_to_one',
      mappingRules,
      transformationScript,
      transformationConfig,
      validationRules
    } = req.body;

    // 필수 필드 검증
    if (!name || !sourceSystemId || !targetSystemId || !sourceSchemaId || !targetSchemaId) {
      return res.status(400).json({
        error: '필수 필드가 누락되었습니다.',
        required: ['name', 'sourceSystemId', 'targetSystemId', 'sourceSchemaId', 'targetSchemaId']
      });
    }

    // 스키마 존재 확인
    const [sourceSchema, targetSchema] = await Promise.all([
      DataSchema.findByPk(sourceSchemaId),
      DataSchema.findByPk(targetSchemaId)
    ]);

    if (!sourceSchema || !targetSchema) {
      return res.status(404).json({
        error: '소스 또는 타겟 스키마를 찾을 수 없습니다.'
      });
    }

    // 매핑 생성
    const mapping = await Mapping.create({
      name,
      description,
      sourceSystemId,
      targetSystemId,
      sourceSchemaId,
      targetSchemaId,
      mappingType,
      mappingRules: mappingRules || [],
      transformationScript,
      transformationConfig: transformationConfig || {},
      validationRules: validationRules || [],
      createdBy: req.user.id
    });

    // 매핑 규칙 검증
    const validationResult = mapping.validateMappingRules();
    if (!validationResult.valid) {
      await mapping.destroy();
      return res.status(400).json({
        error: '매핑 규칙 검증 실패',
        details: validationResult.errors
      });
    }

    // 생성된 매핑 정보 반환
    const result = await Mapping.findByPk(mapping.id, {
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
        },
        {
          model: DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'version']
        },
        {
          model: DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'version']
        }
      ]
    });

    res.status(201).json({
      message: '매핑이 성공적으로 생성되었습니다.',
      mapping: result
    });
  } catch (error) {
    console.error('매핑 생성 실패:', error);
    res.status(400).json({
      error: '매핑 생성 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 매핑 수정
 * PUT /api/mappings/:id
 */
router.put('/:id', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      mappingRules,
      transformationScript,
      transformationConfig,
      validationRules,
      createNewVersion = false
    } = req.body;

    const mapping = await Mapping.findByPk(id);
    if (!mapping) {
      return res.status(404).json({
        error: '매핑을 찾을 수 없습니다.'
      });
    }

    let updatedMapping;

    if (createNewVersion) {
      // 새 버전 생성
      updatedMapping = await Mapping.createNewVersion(
        mapping.parentMappingId || mapping.id,
        {
          name: name || mapping.name,
          description: description || mapping.description,
          sourceSystemId: mapping.sourceSystemId,
          targetSystemId: mapping.targetSystemId,
          sourceSchemaId: mapping.sourceSchemaId,
          targetSchemaId: mapping.targetSchemaId,
          mappingType: mapping.mappingType,
          mappingRules: mappingRules || mapping.mappingRules,
          transformationScript: transformationScript || mapping.transformationScript,
          transformationConfig: transformationConfig || mapping.transformationConfig,
          validationRules: validationRules || mapping.validationRules
        },
        req.user.id
      );
    } else {
      // 현재 버전 업데이트
      const updateData = {
        updatedBy: req.user.id
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (mappingRules !== undefined) updateData.mappingRules = mappingRules;
      if (transformationScript !== undefined) updateData.transformationScript = transformationScript;
      if (transformationConfig !== undefined) updateData.transformationConfig = transformationConfig;
      if (validationRules !== undefined) updateData.validationRules = validationRules;

      await mapping.update(updateData);
      updatedMapping = mapping;
    }

    // 매핑 규칙 검증
    const validationResult = updatedMapping.validateMappingRules();
    if (!validationResult.valid) {
      if (createNewVersion) {
        await updatedMapping.destroy();
      }
      return res.status(400).json({
        error: '매핑 규칙 검증 실패',
        details: validationResult.errors
      });
    }

    // 업데이트된 매핑 정보 반환
    const result = await Mapping.findByPk(updatedMapping.id, {
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
        },
        {
          model: DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'version']
        },
        {
          model: DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'version']
        }
      ]
    });

    res.json({
      message: createNewVersion ? 
        '새 매핑 버전이 생성되었습니다.' : 
        '매핑이 수정되었습니다.',
      mapping: result
    });
  } catch (error) {
    console.error('매핑 수정 실패:', error);
    res.status(400).json({
      error: '매핑 수정 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 매핑 삭제
 * DELETE /api/mappings/:id
 */
router.delete('/:id', authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const mapping = await Mapping.findByPk(id);
    if (!mapping) {
      return res.status(404).json({
        error: '매핑을 찾을 수 없습니다.'
      });
    }

    // 연관된 작업 확인
    const relatedJobs = await mapping.getJobs();
    if (relatedJobs.length > 0) {
      return res.status(400).json({
        error: '연관된 작업이 있어 매핑을 삭제할 수 없습니다.',
        details: {
          jobCount: relatedJobs.length
        }
      });
    }

    await mapping.destroy();

    res.json({
      message: '매핑이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('매핑 삭제 실패:', error);
    res.status(500).json({
      error: '매핑 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 매핑 미리보기
 * POST /api/mappings/:id/preview
 */
router.post('/:id/preview', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { sampleData, previewCount = 10 } = req.body;

    const mapping = await Mapping.findByPk(id, {
      include: [
        {
          model: DataSchema,
          as: 'sourceSchema'
        },
        {
          model: DataSchema,
          as: 'targetSchema'
        }
      ]
    });

    if (!mapping) {
      return res.status(404).json({
        error: '매핑을 찾을 수 없습니다.'
      });
    }

    if (!sampleData || !Array.isArray(sampleData)) {
      return res.status(400).json({
        error: '샘플 데이터는 배열 형태여야 합니다.'
      });
    }

    // 매핑 엔진을 통한 데이터 변환
    const previewData = sampleData.slice(0, previewCount);
    const transformationResults = [];

    for (const data of previewData) {
      try {
        const transformedData = await MappingEngine.transform(mapping, data);
        transformationResults.push({
          original: data,
          transformed: transformedData,
          success: true
        });
      } catch (error) {
        transformationResults.push({
          original: data,
          transformed: null,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      message: '매핑 미리보기가 완료되었습니다.',
      preview: {
        mapping: {
          id: mapping.id,
          name: mapping.name,
          mappingType: mapping.mappingType
        },
        results: transformationResults,
        statistics: {
          total: transformationResults.length,
          success: transformationResults.filter(r => r.success).length,
          failed: transformationResults.filter(r => !r.success).length
        }
      }
    });
  } catch (error) {
    console.error('매핑 미리보기 실패:', error);
    res.status(500).json({
      error: '매핑 미리보기 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 매핑 검증
 * POST /api/mappings/:id/validate
 */
router.post('/:id/validate', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;

    const mapping = await Mapping.findByPk(id, {
      include: [
        {
          model: DataSchema,
          as: 'sourceSchema'
        },
        {
          model: DataSchema,
          as: 'targetSchema'
        }
      ]
    });

    if (!mapping) {
      return res.status(404).json({
        error: '매핑을 찾을 수 없습니다.'
      });
    }

    // 매핑 규칙 검증
    const ruleValidation = mapping.validateMappingRules();
    
    // 변환 스크립트 검증
    const scriptValidation = mapping.validateTransformationScript();
    
    // 스키마 호환성 검증
    const schemaValidation = await MappingEngine.validateSchemaCompatibility(
      mapping.sourceSchema,
      mapping.targetSchema,
      mapping.mappingRules
    );

    const allValid = ruleValidation.valid && scriptValidation.valid && schemaValidation.valid;

    res.json({
      valid: allValid,
      validations: {
        rules: ruleValidation,
        script: scriptValidation,
        schema: schemaValidation
      },
      mapping: {
        id: mapping.id,
        name: mapping.name,
        complexity: mapping.calculateComplexity()
      }
    });
  } catch (error) {
    console.error('매핑 검증 실패:', error);
    res.status(500).json({
      error: '매핑 검증 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 매핑 타입 목록 조회
 * GET /api/mappings/meta/types
 */
router.get('/meta/types', (req, res) => {
  try {
    const mappingTypes = Mapping.getMappingTypes();
    const ruleMappingTypes = Mapping.getRuleMappingTypes();

    res.json({
      mappingTypes,
      ruleMappingTypes
    });
  } catch (error) {
    console.error('매핑 타입 목록 조회 실패:', error);
    res.status(500).json({
      error: '매핑 타입 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 매핑 통계 조회
 * GET /api/mappings/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { systemId, period = '30d' } = req.query;

    let whereClause = { isActive: true };
    if (systemId) {
      whereClause[Op.or] = [
        { sourceSystemId: systemId },
        { targetSystemId: systemId }
      ];
    }

    const mappings = await Mapping.findAll({
      where: whereClause,
      attributes: ['id', 'mappingType', 'mappingRules', 'executionStats', 'createdAt'],
      include: [
        {
          model: System,
          as: 'sourceSystem',
          attributes: ['name', 'type']
        },
        {
          model: System,
          as: 'targetSystem',
          attributes: ['name', 'type']
        }
      ]
    });

    const stats = {
      total: mappings.length,
      byType: {},
      bySystemType: {},
      complexity: {
        low: 0,
        medium: 0,
        high: 0
      },
      execution: {
        totalExecutions: 0,
        averageExecutionTime: 0,
        errorRate: 0
      }
    };

    mappings.forEach(mapping => {
      // 타입별 통계
      stats.byType[mapping.mappingType] = (stats.byType[mapping.mappingType] || 0) + 1;

      // 시스템 타입별 통계
      const sourceType = mapping.sourceSystem.type;
      const targetType = mapping.targetSystem.type;
      const typeKey = `${sourceType}->${targetType}`;
      stats.bySystemType[typeKey] = (stats.bySystemType[typeKey] || 0) + 1;

      // 복잡도 통계
      const complexity = (mapping.mappingRules || []).length;
      if (complexity <= 5) {
        stats.complexity.low++;
      } else if (complexity <= 15) {
        stats.complexity.medium++;
      } else {
        stats.complexity.high++;
      }

      // 실행 통계
      if (mapping.executionStats) {
        stats.execution.totalExecutions += mapping.executionStats.totalExecutions || 0;
        stats.execution.averageExecutionTime += mapping.executionStats.averageExecutionTime || 0;
      }
    });

    if (mappings.length > 0) {
      stats.execution.averageExecutionTime /= mappings.length;
    }

    res.json({ stats });
  } catch (error) {
    console.error('매핑 통계 조회 실패:', error);
    res.status(500).json({
      error: '매핑 통계 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

module.exports = router;