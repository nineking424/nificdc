const express = require('express');
const router = express.Router();
const { DataSchema, System } = require('../models');
const { authenticateToken, authorize } = require('./middleware/auth');
const SchemaDiscovery = require('./src/utils/schemaDiscovery');
const { Op } = require('sequelize');

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

/**
 * 스키마 목록 조회
 * GET /api/schemas
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      systemId = '',
      schemaType = '',
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
    if (systemId) {
      whereClause.systemId = systemId;
    }

    // 스키마 타입 필터
    if (schemaType) {
      whereClause.schemaType = schemaType;
    }

    // 활성 상태 필터
    if (isActive !== '') {
      whereClause.isActive = isActive === 'true';
    }

    const { count, rows } = await DataSchema.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: System,
          as: 'system',
          attributes: ['id', 'name', 'type']
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

    res.json({
      schemas: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('스키마 목록 조회 실패:', error);
    res.status(500).json({
      error: '스키마 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 상세 조회
 * GET /api/schemas/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeVersions = false } = req.query;

    const schema = await DataSchema.findByPk(id, {
      include: [
        {
          model: System,
          as: 'system',
          attributes: ['id', 'name', 'type']
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

    if (!schema) {
      return res.status(404).json({
        error: '스키마를 찾을 수 없습니다.'
      });
    }

    let result = schema.toJSON();

    // 버전 정보 포함
    if (includeVersions === 'true') {
      const versions = await DataSchema.findAllVersions(schema.systemId, schema.name);
      result.versions = versions;
    }

    res.json(result);
  } catch (error) {
    console.error('스키마 상세 조회 실패:', error);
    res.status(500).json({
      error: '스키마 상세 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 생성
 * POST /api/schemas
 */
router.post('/', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const {
      systemId,
      name,
      description,
      schemaType = 'table',
      columns = [],
      indexes = [],
      constraints = [],
      relationships = []
    } = req.body;

    // 필수 필드 검증
    if (!systemId || !name) {
      return res.status(400).json({
        error: '시스템 ID와 스키마 이름은 필수입니다.'
      });
    }

    // 시스템 존재 확인
    const system = await System.findByPk(systemId);
    if (!system) {
      return res.status(404).json({
        error: '시스템을 찾을 수 없습니다.'
      });
    }

    // 스키마 생성
    const schema = await DataSchema.create({
      systemId,
      name,
      description,
      schemaType,
      columns,
      indexes,
      constraints,
      relationships,
      createdBy: req.user.id
    });

    // 스키마 유효성 검증
    const validationErrors = schema.validateSchema();
    if (validationErrors.length > 0) {
      await schema.destroy();
      return res.status(400).json({
        error: '스키마 유효성 검증 실패',
        details: validationErrors
      });
    }

    // 생성된 스키마 정보 반환
    const result = await DataSchema.findByPk(schema.id, {
      include: [
        {
          model: System,
          as: 'system',
          attributes: ['id', 'name', 'type']
        },
        {
          model: require('./src/models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({
      message: '스키마가 성공적으로 생성되었습니다.',
      schema: result
    });
  } catch (error) {
    console.error('스키마 생성 실패:', error);
    res.status(400).json({
      error: '스키마 생성 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 수정 (새 버전 생성)
 * PUT /api/schemas/:id
 */
router.put('/:id', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      description,
      columns,
      indexes,
      constraints,
      relationships,
      createNewVersion = true
    } = req.body;

    const schema = await DataSchema.findByPk(id);
    if (!schema) {
      return res.status(404).json({
        error: '스키마를 찾을 수 없습니다.'
      });
    }

    let updatedSchema;

    if (createNewVersion) {
      // 새 버전 생성
      updatedSchema = await DataSchema.createNewVersion(
        schema.systemId,
        schema.name,
        {
          description: description || schema.description,
          schemaType: schema.schemaType,
          columns: columns || schema.columns,
          indexes: indexes || schema.indexes,
          constraints: constraints || schema.constraints,
          relationships: relationships || schema.relationships
        },
        req.user.id
      );
    } else {
      // 현재 버전 업데이트
      const updateData = {
        updatedBy: req.user.id
      };

      if (description !== undefined) updateData.description = description;
      if (columns !== undefined) updateData.columns = columns;
      if (indexes !== undefined) updateData.indexes = indexes;
      if (constraints !== undefined) updateData.constraints = constraints;
      if (relationships !== undefined) updateData.relationships = relationships;

      await schema.update(updateData);
      updatedSchema = schema;
    }

    // 스키마 유효성 검증
    const validationErrors = updatedSchema.validateSchema();
    if (validationErrors.length > 0) {
      if (createNewVersion) {
        await updatedSchema.destroy();
      }
      return res.status(400).json({
        error: '스키마 유효성 검증 실패',
        details: validationErrors
      });
    }

    // 업데이트된 스키마 정보 반환
    const result = await DataSchema.findByPk(updatedSchema.id, {
      include: [
        {
          model: System,
          as: 'system',
          attributes: ['id', 'name', 'type']
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

    res.json({
      message: createNewVersion ? 
        '새 스키마 버전이 생성되었습니다.' : 
        '스키마가 수정되었습니다.',
      schema: result
    });
  } catch (error) {
    console.error('스키마 수정 실패:', error);
    res.status(400).json({
      error: '스키마 수정 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 삭제
 * DELETE /api/schemas/:id
 */
router.delete('/:id', authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const schema = await DataSchema.findByPk(id);
    if (!schema) {
      return res.status(404).json({
        error: '스키마를 찾을 수 없습니다.'
      });
    }

    // 연관된 매핑 확인
    const relatedMappings = await schema.getSourceMappings();
    const targetMappings = await schema.getTargetMappings();

    if (relatedMappings.length > 0 || targetMappings.length > 0) {
      return res.status(400).json({
        error: '연관된 매핑이 있어 스키마를 삭제할 수 없습니다.',
        details: {
          sourceMappings: relatedMappings.length,
          targetMappings: targetMappings.length
        }
      });
    }

    await schema.destroy();

    res.json({
      message: '스키마가 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('스키마 삭제 실패:', error);
    res.status(500).json({
      error: '스키마 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 버전 목록 조회
 * GET /api/schemas/:systemId/:name/versions
 */
router.get('/:systemId/:name/versions', async (req, res) => {
  try {
    const { systemId, name } = req.params;

    const versions = await DataSchema.findAllVersions(systemId, name);

    res.json({
      systemId,
      schemaName: name,
      versions
    });
  } catch (error) {
    console.error('스키마 버전 조회 실패:', error);
    res.status(500).json({
      error: '스키마 버전 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 버전 비교
 * GET /api/schemas/:id/compare/:targetId
 */
router.get('/:id/compare/:targetId', async (req, res) => {
  try {
    const { id, targetId } = req.params;

    const [sourceSchema, targetSchema] = await Promise.all([
      DataSchema.findByPk(id),
      DataSchema.findByPk(targetId)
    ]);

    if (!sourceSchema || !targetSchema) {
      return res.status(404).json({
        error: '비교할 스키마를 찾을 수 없습니다.'
      });
    }

    const comparison = sourceSchema.compareWith(targetSchema);

    res.json({
      sourceSchema: {
        id: sourceSchema.id,
        name: sourceSchema.name,
        version: sourceSchema.version
      },
      targetSchema: {
        id: targetSchema.id,
        name: targetSchema.name,
        version: targetSchema.version
      },
      comparison
    });
  } catch (error) {
    console.error('스키마 비교 실패:', error);
    res.status(500).json({
      error: '스키마 비교 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 유효성 검증
 * POST /api/schemas/validate
 */
router.post('/validate', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { columns, indexes, constraints } = req.body;

    // 임시 스키마 객체 생성
    const tempSchema = {
      columns: columns || [],
      indexes: indexes || [],
      constraints: constraints || [],
      validateSchema() {
        const errors = [];
        
        // 컬럼 이름 중복 검사
        const columnNames = this.columns.map(col => col.name);
        const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
          errors.push(`중복된 컬럼명: ${duplicates.join(', ')}`);
        }
        
        // 기본키 검사
        const primaryKeys = this.columns.filter(col => col.primaryKey);
        if (primaryKeys.length === 0 && this.columns.length > 0) {
          errors.push('기본키가 정의되지 않았습니다.');
        }
        
        // 컬럼 정의 검사
        this.columns.forEach((column, index) => {
          if (!column.name || typeof column.name !== 'string') {
            errors.push(`컬럼 ${index + 1}: 컬럼명이 유효하지 않습니다.`);
          }
          
          if (!column.dataType) {
            errors.push(`컬럼 ${index + 1}: 데이터 타입이 정의되지 않았습니다.`);
          }
          
          // 예약어 검사
          const reservedWords = ['select', 'insert', 'update', 'delete', 'from', 'where', 'order', 'by', 'group'];
          if (reservedWords.includes(column.name.toLowerCase())) {
            errors.push(`컬럼 ${index + 1}: '${column.name}'은 예약어입니다.`);
          }
        });
        
        return errors;
      }
    };

    const validationErrors = tempSchema.validateSchema();

    res.json({
      valid: validationErrors.length === 0,
      errors: validationErrors
    });
  } catch (error) {
    console.error('스키마 검증 실패:', error);
    res.status(500).json({
      error: '스키마 검증 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 데이터 타입 목록 조회
 * GET /api/schemas/meta/data-types
 */
router.get('/meta/data-types', (req, res) => {
  try {
    const dataTypes = DataSchema.getDataTypes();
    res.json({
      dataTypes
    });
  } catch (error) {
    console.error('데이터 타입 목록 조회 실패:', error);
    res.status(500).json({
      error: '데이터 타입 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 타입 목록 조회
 * GET /api/schemas/meta/schema-types
 */
router.get('/meta/schema-types', (req, res) => {
  try {
    const schemaTypes = [
      { value: 'table', label: '테이블', description: '관계형 데이터베이스 테이블' },
      { value: 'collection', label: '컬렉션', description: 'NoSQL 컬렉션' },
      { value: 'file', label: '파일', description: '파일 스키마 (CSV, JSON 등)' },
      { value: 'api', label: 'API', description: 'REST API 스키마' },
      { value: 'topic', label: '토픽', description: '메시지 큐 토픽' }
    ];

    res.json({
      schemaTypes
    });
  } catch (error) {
    console.error('스키마 타입 목록 조회 실패:', error);
    res.status(500).json({
      error: '스키마 타입 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 자동 탐색
 * POST /api/schemas/discover/:systemId
 */
router.post('/discover/:systemId', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { systemId } = req.params;
    const { autoSave = false } = req.body;

    // 시스템 정보 조회
    const system = await System.findByPk(systemId);
    if (!system) {
      return res.status(404).json({
        error: '시스템을 찾을 수 없습니다.'
      });
    }

    // 연결 정보 복호화
    const connectionInfo = system.getDecryptedConnectionInfo();
    
    // 스키마 탐색 수행
    const discoveryResult = await SchemaDiscovery.discoverSchema(system, connectionInfo);
    
    if (!discoveryResult.success) {
      return res.status(500).json({
        error: '스키마 탐색 실패',
        details: discoveryResult.error
      });
    }

    let savedSchemas = [];

    // 자동 저장 옵션이 활성화된 경우
    if (autoSave) {
      for (const schema of discoveryResult.schemas) {
        for (const table of schema.tables) {
          const schemaData = {
            systemId,
            name: table.name,
            description: `자동 탐색된 ${table.type}: ${table.name}`,
            schemaType: this.mapTableTypeToSchemaType(table.type),
            columns: table.columns.map(col => ({
              name: col.name,
              dataType: col.dataType,
              nullable: col.nullable,
              primaryKey: col.primaryKey,
              defaultValue: col.defaultValue,
              comment: col.comment,
              maxLength: col.maxLength,
              precision: col.precision,
              scale: col.scale,
              autoIncrement: col.autoIncrement
            })),
            indexes: table.indexes || [],
            constraints: table.foreignKeys || [],
            isDiscovered: true,
            metadata: {
              originalSchema: schema.name,
              discoveredAt: new Date().toISOString(),
              documentCount: table.documentCount,
              tableType: table.type
            },
            createdBy: req.user.id
          };

          // 기존 스키마 확인
          const existingSchema = await DataSchema.findOne({
            where: { systemId, name: table.name }
          });

          if (existingSchema) {
            // 새 버전 생성
            const newSchema = await DataSchema.createNewVersion(
              systemId,
              table.name,
              schemaData,
              req.user.id
            );
            savedSchemas.push(newSchema);
          } else {
            // 새 스키마 생성
            const newSchema = await DataSchema.create(schemaData);
            savedSchemas.push(newSchema);
          }
        }
      }
    }

    res.json({
      message: '스키마 탐색이 완료되었습니다.',
      result: discoveryResult,
      savedSchemas: autoSave ? savedSchemas.length : 0
    });
  } catch (error) {
    console.error('스키마 탐색 실패:', error);
    res.status(500).json({
      error: '스키마 탐색 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 스키마 동기화
 * POST /api/schemas/:id/sync
 */
router.post('/:id/sync', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;

    const schema = await DataSchema.findByPk(id, {
      include: [
        {
          model: System,
          as: 'system'
        }
      ]
    });

    if (!schema) {
      return res.status(404).json({
        error: '스키마를 찾을 수 없습니다.'
      });
    }

    if (!schema.isDiscovered) {
      return res.status(400).json({
        error: '자동 탐색된 스키마만 동기화할 수 있습니다.'
      });
    }

    // 시스템 연결 정보 복호화
    const connectionInfo = schema.system.getDecryptedConnectionInfo();
    
    // 스키마 재탐색
    const discoveryResult = await SchemaDiscovery.discoverSchema(schema.system, connectionInfo);
    
    if (!discoveryResult.success) {
      return res.status(500).json({
        error: '스키마 동기화 실패',
        details: discoveryResult.error
      });
    }

    // 해당 테이블/컬렉션 찾기
    let foundTable = null;
    for (const discoveredSchema of discoveryResult.schemas) {
      foundTable = discoveredSchema.tables.find(table => table.name === schema.name);
      if (foundTable) break;
    }

    if (!foundTable) {
      return res.status(404).json({
        error: '원본 테이블/컬렉션을 찾을 수 없습니다. 삭제되었을 수 있습니다.'
      });
    }

    // 스키마 비교
    const currentColumns = schema.columns || [];
    const newColumns = foundTable.columns || [];
    
    const changes = this.compareColumns(currentColumns, newColumns);

    // 변경사항이 있는 경우 새 버전 생성
    if (changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0) {
      const newSchema = await DataSchema.createNewVersion(
        schema.systemId,
        schema.name,
        {
          description: schema.description,
          schemaType: schema.schemaType,
          columns: newColumns,
          indexes: foundTable.indexes || [],
          constraints: foundTable.foreignKeys || [],
          isDiscovered: true,
          metadata: {
            ...schema.metadata,
            lastSyncAt: new Date().toISOString(),
            syncedFrom: schema.version
          }
        },
        req.user.id
      );

      // 동기화 시간 업데이트
      await schema.update({
        lastSyncAt: new Date()
      });

      res.json({
        message: '스키마가 동기화되었습니다.',
        changes,
        newVersion: newSchema.version,
        previousVersion: schema.version
      });
    } else {
      // 변경사항 없음
      await schema.update({
        lastSyncAt: new Date()
      });

      res.json({
        message: '스키마에 변경사항이 없습니다.',
        changes: { added: [], removed: [], modified: [] }
      });
    }
  } catch (error) {
    console.error('스키마 동기화 실패:', error);
    res.status(500).json({
      error: '스키마 동기화 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * 시스템별 스키마 통계
 * GET /api/schemas/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { systemId } = req.query;

    let whereClause = {};
    if (systemId) {
      whereClause.systemId = systemId;
    }

    const stats = await DataSchema.findAll({
      where: whereClause,
      attributes: [
        'systemId',
        'schemaType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      include: [
        {
          model: System,
          as: 'system',
          attributes: ['name', 'type']
        }
      ],
      group: ['systemId', 'schemaType', 'system.id', 'system.name', 'system.type']
    });

    res.json({
      stats
    });
  } catch (error) {
    console.error('스키마 통계 조회 실패:', error);
    res.status(500).json({
      error: '스키마 통계 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 유틸리티 메서드
router.mapTableTypeToSchemaType = function(tableType) {
  const typeMap = {
    'table': 'table',
    'view': 'table',
    'collection': 'collection',
    'BASE TABLE': 'table',
    'VIEW': 'table'
  };
  
  return typeMap[tableType] || 'table';
};

router.compareColumns = function(currentColumns, newColumns) {
  const changes = {
    added: [],
    removed: [],
    modified: []
  };
  
  // 추가된 컬럼
  newColumns.forEach(newCol => {
    if (!currentColumns.find(col => col.name === newCol.name)) {
      changes.added.push(newCol);
    }
  });
  
  // 삭제된 컬럼
  currentColumns.forEach(currentCol => {
    if (!newColumns.find(col => col.name === currentCol.name)) {
      changes.removed.push(currentCol);
    }
  });
  
  // 수정된 컬럼
  currentColumns.forEach(currentCol => {
    const newCol = newColumns.find(col => col.name === currentCol.name);
    if (newCol) {
      const differences = [];
      
      if (currentCol.dataType !== newCol.dataType) {
        differences.push({ field: 'dataType', from: currentCol.dataType, to: newCol.dataType });
      }
      
      if (currentCol.nullable !== newCol.nullable) {
        differences.push({ field: 'nullable', from: currentCol.nullable, to: newCol.nullable });
      }
      
      if (currentCol.primaryKey !== newCol.primaryKey) {
        differences.push({ field: 'primaryKey', from: currentCol.primaryKey, to: newCol.primaryKey });
      }
      
      if (differences.length > 0) {
        changes.modified.push({
          column: currentCol.name,
          differences
        });
      }
    }
  });
  
  return changes;
};

module.exports = router;