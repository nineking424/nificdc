const express = require('express');
const router = express.Router();
const { authorize } = require('../../middleware/rbac');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../src/utils/logger');

/**
 * @swagger
 * components:
 *   schemas:
 *     Mapping:
 *       type: object
 *       required:
 *         - name
 *         - sourceSchemaId
 *         - targetSchemaId
 *         - mappingRules
 *       properties:
 *         id:
 *           type: string
 *           description: Mapping ID
 *         name:
 *           type: string
 *           description: Mapping name
 *         sourceSchemaId:
 *           type: string
 *           description: Source schema ID
 *         targetSchemaId:
 *           type: string
 *           description: Target schema ID
 *         mappingRules:
 *           type: object
 *           description: Mapping rules (JSON)
 *         transformationScript:
 *           type: string
 *           description: Transformation script
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/mappings:
 *   get:
 *     summary: Get all mappings
 *     tags: [Mappings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of mappings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Mapping'
 */
// 매핑 목록 조회 - 읽기 권한 필요
router.get('/', authorize('mappings', 'read'), async (req, res) => {
  try {
    const { sourceSchemaId, targetSchemaId } = req.query;
    
    const { Mapping } = require('../models');
    let whereClause = {};
    
    if (sourceSchemaId) {
      whereClause.sourceSchemaId = sourceSchemaId;
    }
    if (targetSchemaId) {
      whereClause.targetSchemaId = targetSchemaId;
    }
    
    const mappings = await Mapping.findAll({
      where: whereClause,
      include: [
        {
          model: require('../models').DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'systemId']
        },
        {
          model: require('../models').DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'systemId']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formattedMappings = mappings.map(mapping => ({
      id: mapping.id,
      name: mapping.name,
      description: mapping.description,
      sourceSchemaId: mapping.sourceSchemaId,
      targetSchemaId: mapping.targetSchemaId,
      sourceSchema: mapping.sourceSchema,
      targetSchema: mapping.targetSchema,
      mappingRules: mapping.mappingRules,
      transformationScript: mapping.transformationScript,
      status: mapping.status,
      priority: mapping.priority,
      tags: mapping.tags,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt
    }));

    await auditLogger.log({
      type: 'DATA_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'mappings',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: formattedMappings,
      total: formattedMappings.length
    });
  } catch (error) {
    logger.error('매핑 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mappings'
    });
  }
});

/**
 * @swagger
 * /api/v1/mappings/{id}:
 *   get:
 *     summary: Get mapping by ID
 *     tags: [Mappings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Mapping ID
 *     responses:
 *       200:
 *         description: Mapping details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mapping'
 *       404:
 *         description: Mapping not found
 */
// 특정 매핑 조회 - 읽기 권한 필요
router.get('/:id', authorize('mappings', 'read'), async (req, res) => {
  try {
    const mappingId = req.params.id;
    
    const { Mapping } = require('../models');
    const mapping = await Mapping.findByPk(mappingId, {
      include: [
        {
          model: require('../models').DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'systemId', 'schemaDefinition'],
          include: [{
            model: require('../models').System,
            as: 'system',
            attributes: ['id', 'name', 'type']
          }]
        },
        {
          model: require('../models').DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'systemId', 'schemaDefinition'],
          include: [{
            model: require('../models').System,
            as: 'system',
            attributes: ['id', 'name', 'type']
          }]
        }
      ]
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    const formattedMapping = {
      id: mapping.id,
      name: mapping.name,
      description: mapping.description,
      sourceSchemaId: mapping.sourceSchemaId,
      targetSchemaId: mapping.targetSchemaId,
      sourceSchema: mapping.sourceSchema,
      targetSchema: mapping.targetSchema,
      mappingRules: mapping.mappingRules,
      transformationScript: mapping.transformationScript,
      isActive: mapping.isActive,
      createdAt: mapping.createdAt,
      updatedAt: mapping.updatedAt
    };

    await auditLogger.log({
      type: 'DATA_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'mappings',
      resourceId: mappingId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: formattedMapping
    });
  } catch (error) {
    logger.error('매핑 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mapping'
    });
  }
});

/**
 * @swagger
 * /api/v1/mappings:
 *   post:
 *     summary: Create new mapping
 *     tags: [Mappings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Mapping'
 *     responses:
 *       201:
 *         description: Mapping created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mapping'
 */
// 매핑 생성 - 생성 권한 필요
router.post('/', authorize('mappings', 'create'), async (req, res) => {
  try {
    const { 
      name, 
      description,
      sourceSchemaId, 
      targetSchemaId, 
      mappingRules = {}, 
      transformationScript,
      status = 'draft',
      priority = 'medium',
      tags = [],
      isActive = true 
    } = req.body;
    
    // 입력 검증 - only name is required
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Mapping name is required'
      });
    }

    // 소스 및 타겟 스키마 존재 확인 (if provided)
    const { DataSchema } = require('../models');
    let sourceSchema = null;
    let targetSchema = null;
    
    if (sourceSchemaId) {
      sourceSchema = await DataSchema.findByPk(sourceSchemaId);
      if (!sourceSchema) {
        return res.status(404).json({
          success: false,
          error: 'Source schema not found'
        });
      }
    }
    
    if (targetSchemaId) {
      targetSchema = await DataSchema.findByPk(targetSchemaId);
      if (!targetSchema) {
        return res.status(404).json({
          success: false,
          error: 'Target schema not found'
        });
      }
    }

    // 매핑 생성
    const { Mapping } = require('../models');
    const newMapping = await Mapping.create({
      name,
      description,
      sourceSchemaId: sourceSchemaId || null,
      targetSchemaId: targetSchemaId || null,
      mappingRules,
      transformationScript,
      status,
      priority,
      tags,
      isActive
    });

    // 생성된 매핑을 연관 데이터와 함께 조회
    const createdMapping = await Mapping.findByPk(newMapping.id, {
      include: [
        {
          model: DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'systemId']
        },
        {
          model: DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'systemId']
        }
      ]
    });

    const formattedMapping = {
      id: createdMapping.id,
      name: createdMapping.name,
      description: createdMapping.description,
      sourceSchemaId: createdMapping.sourceSchemaId,
      targetSchemaId: createdMapping.targetSchemaId,
      sourceSchema: createdMapping.sourceSchema,
      targetSchema: createdMapping.targetSchema,
      mappingRules: createdMapping.mappingRules,
      transformationScript: createdMapping.transformationScript,
      status: createdMapping.status,
      priority: createdMapping.priority,
      tags: createdMapping.tags,
      isActive: createdMapping.isActive,
      createdAt: createdMapping.createdAt,
      updatedAt: createdMapping.updatedAt
    };

    await auditLogger.log({
      type: 'DATA_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'CREATE',
      resource: 'mappings',
      resourceId: newMapping.id.toString(),
      newValues: formattedMapping,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    logger.info('새 매핑 생성:', { mappingId: newMapping.id, userId: req.user.id });

    res.status(201).json({
      success: true,
      data: formattedMapping
    });
  } catch (error) {
    logger.error('매핑 생성 실패:', error);
    
    // 중복 이름 에러 처리
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'Mapping with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create mapping'
    });
  }
});

/**
 * @swagger
 * /api/v1/mappings/{id}:
 *   put:
 *     summary: Update mapping
 *     tags: [Mappings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Mapping ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Mapping'
 *     responses:
 *       200:
 *         description: Mapping updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mapping'
 *       404:
 *         description: Mapping not found
 */
// 매핑 수정 - 수정 권한 필요
router.put('/:id', authorize('mappings', 'update'), async (req, res) => {
  try {
    const mappingId = req.params.id;
    const { 
      name, 
      description, 
      sourceSchemaId, 
      targetSchemaId, 
      mappingRules, 
      transformationScript, 
      isActive 
    } = req.body;
    
    // 기존 매핑 조회
    const { Mapping } = require('../models');
    const existingMapping = await Mapping.findByPk(mappingId);

    if (!existingMapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    // 소스 및 타겟 스키마 존재 확인 (변경된 경우)
    if (sourceSchemaId || targetSchemaId) {
      const { DataSchema } = require('../models');
      const schemaChecks = [];
      
      if (sourceSchemaId && sourceSchemaId !== existingMapping.sourceSchemaId) {
        schemaChecks.push(DataSchema.findByPk(sourceSchemaId));
      } else {
        schemaChecks.push(Promise.resolve(true));
      }
      
      if (targetSchemaId && targetSchemaId !== existingMapping.targetSchemaId) {
        schemaChecks.push(DataSchema.findByPk(targetSchemaId));
      } else {
        schemaChecks.push(Promise.resolve(true));
      }
      
      const [sourceSchema, targetSchema] = await Promise.all(schemaChecks);
      
      if (sourceSchemaId && sourceSchemaId !== existingMapping.sourceSchemaId && !sourceSchema) {
        return res.status(404).json({
          success: false,
          error: 'Source schema not found'
        });
      }
      
      if (targetSchemaId && targetSchemaId !== existingMapping.targetSchemaId && !targetSchema) {
        return res.status(404).json({
          success: false,
          error: 'Target schema not found'
        });
      }
    }

    // 업데이트할 필드만 추출
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (sourceSchemaId !== undefined) updateFields.sourceSchemaId = sourceSchemaId;
    if (targetSchemaId !== undefined) updateFields.targetSchemaId = targetSchemaId;
    if (mappingRules !== undefined) updateFields.mappingRules = mappingRules;
    if (transformationScript !== undefined) updateFields.transformationScript = transformationScript;
    if (isActive !== undefined) updateFields.isActive = isActive;

    // 기존 매핑 데이터 (감사 로그용)
    const oldMappingData = {
      id: existingMapping.id,
      name: existingMapping.name,
      description: existingMapping.description,
      sourceSchemaId: existingMapping.sourceSchemaId,
      targetSchemaId: existingMapping.targetSchemaId,
      mappingRules: existingMapping.mappingRules,
      transformationScript: existingMapping.transformationScript,
      isActive: existingMapping.isActive
    };

    // 매핑 업데이트
    await existingMapping.update(updateFields);
    await existingMapping.reload();

    // 업데이트된 매핑을 연관 데이터와 함께 조회
    const updatedMapping = await Mapping.findByPk(mappingId, {
      include: [
        {
          model: require('../models').DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'systemId']
        },
        {
          model: require('../models').DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'systemId']
        }
      ]
    });

    const formattedMapping = {
      id: updatedMapping.id,
      name: updatedMapping.name,
      description: updatedMapping.description,
      sourceSchemaId: updatedMapping.sourceSchemaId,
      targetSchemaId: updatedMapping.targetSchemaId,
      sourceSchema: updatedMapping.sourceSchema,
      targetSchema: updatedMapping.targetSchema,
      mappingRules: updatedMapping.mappingRules,
      transformationScript: updatedMapping.transformationScript,
      isActive: updatedMapping.isActive,
      createdAt: updatedMapping.createdAt,
      updatedAt: updatedMapping.updatedAt
    };

    await auditLogger.log({
      type: 'DATA_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'UPDATE',
      resource: 'mappings',
      resourceId: mappingId,
      oldValues: oldMappingData,
      newValues: formattedMapping,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    logger.info('매핑 업데이트:', { mappingId, userId: req.user.id });

    res.json({
      success: true,
      data: formattedMapping
    });
  } catch (error) {
    logger.error('매핑 업데이트 실패:', error);
    
    // 중복 이름 에러 처리
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        error: 'Mapping with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update mapping'
    });
  }
});

/**
 * @swagger
 * /api/v1/mappings/{id}:
 *   delete:
 *     summary: Delete mapping
 *     tags: [Mappings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Mapping ID
 *     responses:
 *       204:
 *         description: Mapping deleted
 *       404:
 *         description: Mapping not found
 */
// 매핑 삭제 - 삭제 권한 필요
router.delete('/:id', authorize('mappings', 'delete'), async (req, res) => {
  try {
    const mappingId = req.params.id;
    
    // 기존 매핑 조회
    const { Mapping } = require('../models');
    const mappingToDelete = await Mapping.findByPk(mappingId);

    if (!mappingToDelete) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    // 매핑이 작업에서 사용 중인지 확인 (실제로는 Job 모델과 연관 확인 필요)
    // TODO: Job 모델이 구현되면 아래 주석 해제
    // const { Job } = require('../models');
    // const relatedJobs = await Job.findAll({
    //   where: { mappingId: mappingId, isActive: true }
    // });
    // 
    // if (relatedJobs.length > 0) {
    //   return res.status(409).json({
    //     success: false,
    //     error: 'Cannot delete mapping that is being used by active jobs',
    //     relatedJobs: relatedJobs.map(job => ({ id: job.id, name: job.name }))
    //   });
    // }

    // 삭제 전 매핑 데이터 (감사 로그용)
    const mappingData = {
      id: mappingToDelete.id,
      name: mappingToDelete.name,
      description: mappingToDelete.description,
      sourceSchemaId: mappingToDelete.sourceSchemaId,
      targetSchemaId: mappingToDelete.targetSchemaId,
      mappingRules: mappingToDelete.mappingRules,
      transformationScript: mappingToDelete.transformationScript,
      isActive: mappingToDelete.isActive
    };

    // 논리적 삭제 (soft delete) - Sequelize paranoid 모드 사용
    await mappingToDelete.destroy();

    await auditLogger.log({
      type: 'DATA_CHANGE',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'DELETE',
      resource: 'mappings',
      resourceId: mappingId,
      oldValues: mappingData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    logger.warn('매핑 삭제:', { mappingId, userId: req.user.id });

    res.json({
      success: true,
      message: 'Mapping deleted successfully'
    });
  } catch (error) {
    logger.error('매핑 삭제 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete mapping'
    });
  }
});

/**
 * @swagger
 * /api/v1/mappings/{id}/validate:
 *   post:
 *     summary: Validate mapping configuration
 *     tags: [Mappings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Mapping ID
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                 warnings:
 *                   type: array
 *                   items:
 *                     type: string
 */
// 매핑 검증 - 검증 권한 필요
router.post('/:id/validate', authorize('mappings', 'validate'), async (req, res) => {
  try {
    const mappingId = req.params.id;
    
    // 매핑 조회
    const { Mapping } = require('../models');
    const mapping = await Mapping.findByPk(mappingId, {
      include: [
        {
          model: require('../models').DataSchema,
          as: 'sourceSchema',
          attributes: ['id', 'name', 'schemaDefinition']
        },
        {
          model: require('../models').DataSchema,
          as: 'targetSchema',
          attributes: ['id', 'name', 'schemaDefinition']
        }
      ]
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Mapping not found'
      });
    }

    // 매핑 검증 로직
    const validationResult = await validateMapping(mapping);

    await auditLogger.log({
      type: 'MAPPING_VALIDATION',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'VALIDATE',
      resource: 'mappings',
      resourceId: mappingId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: validationResult.valid ? 'SUCCESS' : 'VALIDATION_FAILED',
      metadata: {
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length
      }
    });

    res.json({
      success: true,
      data: {
        mappingId: mappingId,
        mappingName: mapping.name,
        ...validationResult,
        validatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('매핑 검증 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate mapping'
    });
  }
});

// 매핑 검증 헬퍼 함수
async function validateMapping(mapping) {
  const errors = [];
  const warnings = [];
  const suggestions = [];

  try {
    // 1. 기본 매핑 정보 검증
    if (!mapping.mappingRules || Object.keys(mapping.mappingRules).length === 0) {
      errors.push('Mapping rules are empty or missing');
    }

    if (!mapping.sourceSchema || !mapping.targetSchema) {
      errors.push('Source or target schema is missing');
      return { valid: false, errors, warnings, suggestions };
    }

    // 2. 스키마 정의 파싱
    let sourceFields = [];
    let targetFields = [];

    try {
      if (mapping.sourceSchema.schemaDefinition) {
        sourceFields = extractFieldsFromSchema(mapping.sourceSchema.schemaDefinition);
      }
      if (mapping.targetSchema.schemaDefinition) {
        targetFields = extractFieldsFromSchema(mapping.targetSchema.schemaDefinition);
      }
    } catch (parseError) {
      errors.push(`Schema parsing error: ${parseError.message}`);
      return { valid: false, errors, warnings, suggestions };
    }

    // 3. 매핑 규칙 검증
    const mappingRules = mapping.mappingRules;
    
    // 소스 필드 검증
    if (mappingRules.fieldMappings) {
      for (const fieldMapping of mappingRules.fieldMappings) {
        const sourceField = fieldMapping.source;
        const targetField = fieldMapping.target;

        // 소스 필드 존재 확인
        if (!sourceFields.find(f => f.name === sourceField)) {
          errors.push(`Source field '${sourceField}' not found in source schema`);
        }

        // 타겟 필드 존재 확인
        if (!targetFields.find(f => f.name === targetField)) {
          errors.push(`Target field '${targetField}' not found in target schema`);
        }

        // 데이터 타입 호환성 검사
        const sourceFieldDef = sourceFields.find(f => f.name === sourceField);
        const targetFieldDef = targetFields.find(f => f.name === targetField);
        
        if (sourceFieldDef && targetFieldDef) {
          const typeCompatibility = checkTypeCompatibility(sourceFieldDef.type, targetFieldDef.type);
          if (!typeCompatibility.compatible) {
            if (typeCompatibility.severity === 'error') {
              errors.push(`Type incompatibility: ${sourceField} (${sourceFieldDef.type}) -> ${targetField} (${targetFieldDef.type})`);
            } else {
              warnings.push(`Potential type issue: ${sourceField} (${sourceFieldDef.type}) -> ${targetField} (${targetFieldDef.type}). ${typeCompatibility.message}`);
            }
          }
        }
      }
    }

    // 4. 필수 필드 매핑 확인
    const requiredTargetFields = targetFields.filter(f => !f.nullable);
    const mappedTargetFields = mappingRules.fieldMappings?.map(fm => fm.target) || [];
    
    for (const requiredField of requiredTargetFields) {
      if (!mappedTargetFields.includes(requiredField.name)) {
        errors.push(`Required target field '${requiredField.name}' is not mapped`);
      }
    }

    // 5. 변환 스크립트 검증 (기본 문법 검사)
    if (mapping.transformationScript) {
      try {
        // 기본 JavaScript 문법 검사
        new Function(mapping.transformationScript);
      } catch (scriptError) {
        errors.push(`Transformation script syntax error: ${scriptError.message}`);
      }
    }

    // 6. 성능 및 최적화 제안
    if (mappingRules.fieldMappings && mappingRules.fieldMappings.length > 50) {
      warnings.push('Large number of field mappings may impact performance');
    }

    if (!mapping.transformationScript && mappingRules.fieldMappings?.some(fm => fm.transformation)) {
      suggestions.push('Consider using transformation script for complex field transformations');
    }

    // 7. 데이터 무결성 검사 제안
    const hasDateFields = sourceFields.some(f => f.type.includes('date') || f.type.includes('timestamp'));
    if (hasDateFields) {
      suggestions.push('Consider adding date format validation for date/timestamp fields');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      statistics: {
        sourceFieldCount: sourceFields.length,
        targetFieldCount: targetFields.length,
        mappedFieldCount: mappingRules.fieldMappings?.length || 0,
        unmappedSourceFields: sourceFields.length - (mappingRules.fieldMappings?.length || 0),
        requiredFieldsMapped: requiredTargetFields.filter(rf => mappedTargetFields.includes(rf.name)).length,
        totalRequiredFields: requiredTargetFields.length
      }
    };
  } catch (error) {
    logger.error('매핑 검증 중 오류:', error);
    return {
      valid: false,
      errors: [`Validation error: ${error.message}`],
      warnings,
      suggestions
    };
  }
}

// 스키마에서 필드 추출
function extractFieldsFromSchema(schemaDefinition) {
  const fields = [];
  
  if (schemaDefinition.columns) {
    // 데이터베이스 스키마 형식
    for (const column of schemaDefinition.columns) {
      fields.push({
        name: column.name,
        type: column.type,
        nullable: column.nullable !== false,
        primaryKey: column.primaryKey === true
      });
    }
  } else if (schemaDefinition.fields) {
    // 커스텀 스키마 형식
    for (const field of schemaDefinition.fields) {
      fields.push({
        name: field.name,
        type: field.type || 'unknown',
        nullable: field.nullable !== false,
        primaryKey: field.primaryKey === true
      });
    }
  }
  
  return fields;
}

// 데이터 타입 호환성 검사
function checkTypeCompatibility(sourceType, targetType) {
  // 정확히 같은 타입
  if (sourceType === targetType) {
    return { compatible: true };
  }

  // 숫자 타입 호환성
  const numericTypes = ['int', 'integer', 'bigint', 'decimal', 'numeric', 'float', 'double', 'real'];
  const isSourceNumeric = numericTypes.some(type => sourceType.toLowerCase().includes(type));
  const isTargetNumeric = numericTypes.some(type => targetType.toLowerCase().includes(type));
  
  if (isSourceNumeric && isTargetNumeric) {
    return { 
      compatible: true, 
      message: 'Numeric types are generally compatible but may lose precision'
    };
  }

  // 문자열 타입 호환성
  const stringTypes = ['varchar', 'char', 'text', 'string'];
  const isSourceString = stringTypes.some(type => sourceType.toLowerCase().includes(type));
  const isTargetString = stringTypes.some(type => targetType.toLowerCase().includes(type));
  
  if (isSourceString && isTargetString) {
    return { 
      compatible: true,
      message: 'String types are compatible but check length constraints'
    };
  }

  // 날짜/시간 타입 호환성
  const dateTypes = ['date', 'datetime', 'timestamp', 'time'];
  const isSourceDate = dateTypes.some(type => sourceType.toLowerCase().includes(type));
  const isTargetDate = dateTypes.some(type => targetType.toLowerCase().includes(type));
  
  if (isSourceDate && isTargetDate) {
    return { 
      compatible: true,
      message: 'Date/time types are compatible but check format requirements'
    };
  }

  // 호환되지 않는 타입
  return {
    compatible: false,
    severity: 'error',
    message: 'Types are not compatible and may cause data conversion errors'
  };
}

module.exports = router;