const logger = require('../src/utils/logger');
const MappingEngine = require('../src/utils/mappingEngine');
const transformLibrary = require('../src/utils/transformLibrary');

/**
 * 매핑 검증 서비스
 * 매핑 규칙의 유효성 검증 및 미리보기 기능 제공
 */
class MappingValidationService {
  constructor() {
    this.validationCache = new Map();
    this.previewCache = new Map();
    this.maxCacheSize = 500;
  }

  /**
   * 매핑 규칙 전체 검증
   * @param {Object} mapping - 매핑 정의
   * @param {Object} sourceSchema - 소스 스키마
   * @param {Object} targetSchema - 타겟 스키마
   * @returns {Promise<Object>} 검증 결과
   */
  async validateMapping(mapping, sourceSchema, targetSchema) {
    try {
      const validationResult = {
        valid: true,
        errors: [],
        warnings: [],
        coverage: {
          sourceCoverage: 0,
          targetCoverage: 0,
          requiredFieldsCovered: 0
        },
        suggestions: []
      };

      // 기본 구조 검증
      this.validateMappingStructure(mapping, validationResult);

      // 스키마 호환성 검증
      await this.validateSchemaCompatibility(mapping, sourceSchema, targetSchema, validationResult);

      // 매핑 규칙 검증
      await this.validateMappingRules(mapping.mappingRules, sourceSchema, targetSchema, validationResult);

      // 커버리지 계산
      this.calculateCoverage(mapping, sourceSchema, targetSchema, validationResult);

      // 개선 제안 생성
      this.generateSuggestions(mapping, sourceSchema, targetSchema, validationResult);

      // 전체 유효성 판단
      validationResult.valid = validationResult.errors.length === 0;

      return validationResult;

    } catch (error) {
      logger.error('매핑 검증 중 오류:', error);
      return {
        valid: false,
        errors: [`검증 중 오류 발생: ${error.message}`],
        warnings: [],
        coverage: { sourceCoverage: 0, targetCoverage: 0, requiredFieldsCovered: 0 },
        suggestions: []
      };
    }
  }

  /**
   * 매핑 구조 검증
   * @param {Object} mapping - 매핑 정의
   * @param {Object} result - 검증 결과 객체
   */
  validateMappingStructure(mapping, result) {
    // 필수 필드 확인
    if (!mapping.sourceSchemaId) {
      result.errors.push('소스 스키마가 지정되지 않았습니다.');
    }

    if (!mapping.targetSchemaId) {
      result.errors.push('타겟 스키마가 지정되지 않았습니다.');
    }

    if (!mapping.mappingRules || !Array.isArray(mapping.mappingRules)) {
      result.errors.push('매핑 규칙이 정의되지 않았습니다.');
      return;
    }

    if (mapping.mappingRules.length === 0) {
      result.warnings.push('매핑 규칙이 비어있습니다.');
    }

    // 매핑 타입 검증
    const validMappingTypes = ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'];
    if (!validMappingTypes.includes(mapping.mappingType)) {
      result.errors.push(`유효하지 않은 매핑 타입: ${mapping.mappingType}`);
    }

    // 변환 스크립트 검증 (있는 경우)
    if (mapping.transformationScript) {
      try {
        new Function(mapping.transformationScript);
      } catch (syntaxError) {
        result.errors.push(`변환 스크립트 구문 오류: ${syntaxError.message}`);
      }
    }
  }

  /**
   * 스키마 호환성 검증
   * @param {Object} mapping - 매핑 정의
   * @param {Object} sourceSchema - 소스 스키마
   * @param {Object} targetSchema - 타겟 스키마
   * @param {Object} result - 검증 결과 객체
   */
  async validateSchemaCompatibility(mapping, sourceSchema, targetSchema, result) {
    if (!sourceSchema || !targetSchema) {
      result.errors.push('스키마 정보를 로드할 수 없습니다.');
      return;
    }

    // 스키마 ID 일치 확인
    if (mapping.sourceSchemaId !== sourceSchema.id) {
      result.errors.push('소스 스키마 ID가 일치하지 않습니다.');
    }

    if (mapping.targetSchemaId !== targetSchema.id) {
      result.errors.push('타겟 스키마 ID가 일치하지 않습니다.');
    }

    // 스키마 컬럼 존재 확인
    const sourceColumns = new Set(sourceSchema.columns.map(col => col.name));
    const targetColumns = new Set(targetSchema.columns.map(col => col.name));

    for (const rule of mapping.mappingRules) {
      if (!sourceColumns.has(rule.sourceField)) {
        result.errors.push(`소스 필드 '${rule.sourceField}'가 스키마에 존재하지 않습니다.`);
      }

      if (!targetColumns.has(rule.targetField)) {
        result.errors.push(`타겟 필드 '${rule.targetField}'가 스키마에 존재하지 않습니다.`);
      }
    }

    // 필수 타겟 필드 확인
    const requiredTargetFields = targetSchema.columns
      .filter(col => !col.nullable && !col.hasDefault)
      .map(col => col.name);

    const mappedTargetFields = new Set(mapping.mappingRules.map(rule => rule.targetField));

    for (const requiredField of requiredTargetFields) {
      if (!mappedTargetFields.has(requiredField)) {
        result.errors.push(`필수 타겟 필드 '${requiredField}'에 대한 매핑이 없습니다.`);
      }
    }
  }

  /**
   * 매핑 규칙 개별 검증
   * @param {Array} mappingRules - 매핑 규칙 배열
   * @param {Object} sourceSchema - 소스 스키마
   * @param {Object} targetSchema - 타겟 스키마
   * @param {Object} result - 검증 결과 객체
   */
  async validateMappingRules(mappingRules, sourceSchema, targetSchema, result) {
    const sourceColumnMap = new Map(sourceSchema.columns.map(col => [col.name, col]));
    const targetColumnMap = new Map(targetSchema.columns.map(col => [col.name, col]));
    const usedTargetFields = new Set();

    for (const [index, rule] of mappingRules.entries()) {
      const ruleErrors = [];
      const ruleWarnings = [];

      // 기본 필드 검증
      if (!rule.sourceField) {
        ruleErrors.push(`규칙 ${index + 1}: 소스 필드가 지정되지 않았습니다.`);
      }

      if (!rule.targetField) {
        ruleErrors.push(`규칙 ${index + 1}: 타겟 필드가 지정되지 않았습니다.`);
      }

      if (!rule.mappingType) {
        ruleErrors.push(`규칙 ${index + 1}: 매핑 타입이 지정되지 않았습니다.`);
      }

      // 중복 타겟 필드 확인
      if (rule.targetField) {
        if (usedTargetFields.has(rule.targetField)) {
          ruleErrors.push(`규칙 ${index + 1}: 타겟 필드 '${rule.targetField}'가 중복 매핑되었습니다.`);
        } else {
          usedTargetFields.add(rule.targetField);
        }
      }

      // 데이터 타입 호환성 검증
      if (rule.sourceField && rule.targetField) {
        const sourceColumn = sourceColumnMap.get(rule.sourceField);
        const targetColumn = targetColumnMap.get(rule.targetField);

        if (sourceColumn && targetColumn) {
          const compatibility = this.checkDataTypeCompatibility(
            sourceColumn.dataType,
            targetColumn.dataType,
            rule.mappingType
          );

          if (!compatibility.compatible) {
            if (rule.mappingType === 'direct') {
              ruleErrors.push(
                `규칙 ${index + 1}: ${sourceColumn.dataType}에서 ${targetColumn.dataType}로 직접 변환할 수 없습니다.`
              );
            } else {
              ruleWarnings.push(
                `규칙 ${index + 1}: ${sourceColumn.dataType}에서 ${targetColumn.dataType} 변환 시 데이터 손실이 있을 수 있습니다.`
              );
            }
          }

          // 크기 제한 확인
          if (sourceColumn.maxLength && targetColumn.maxLength) {
            if (sourceColumn.maxLength > targetColumn.maxLength && rule.mappingType === 'direct') {
              ruleWarnings.push(
                `규칙 ${index + 1}: 소스 필드 크기(${sourceColumn.maxLength})가 타겟 필드 크기(${targetColumn.maxLength})보다 큽니다.`
              );
            }
          }
        }
      }

      // 매핑 타입별 검증
      this.validateMappingRuleType(rule, index + 1, ruleErrors, ruleWarnings);

      // 변환 함수 검증
      if (rule.transformFunction) {
        this.validateTransformFunction(rule.transformFunction, rule.transformParams, index + 1, ruleErrors);
      }

      // 조건 검증
      if (rule.condition) {
        this.validateCondition(rule.condition, sourceColumnMap, index + 1, ruleErrors);
      }

      result.errors.push(...ruleErrors);
      result.warnings.push(...ruleWarnings);
    }
  }

  /**
   * 매핑 타입별 검증
   * @param {Object} rule - 매핑 규칙
   * @param {number} ruleIndex - 규칙 인덱스
   * @param {Array} errors - 에러 배열
   * @param {Array} warnings - 경고 배열
   */
  validateMappingRuleType(rule, ruleIndex, errors, warnings) {
    switch (rule.mappingType) {
      case 'concat':
        if (!rule.transformParams || !rule.transformParams.separator) {
          warnings.push(`규칙 ${ruleIndex}: 연결 매핑에 구분자가 지정되지 않았습니다.`);
        }
        break;

      case 'split':
        if (!rule.transformParams || !rule.transformParams.delimiter) {
          errors.push(`규칙 ${ruleIndex}: 분할 매핑에 구분자가 필요합니다.`);
        }
        if (!rule.transformParams || rule.transformParams.index === undefined) {
          errors.push(`규칙 ${ruleIndex}: 분할 매핑에 인덱스가 필요합니다.`);
        }
        break;

      case 'lookup':
        if (!rule.transformParams || !rule.transformParams.lookupTable) {
          errors.push(`규칙 ${ruleIndex}: 조회 매핑에 조회 테이블이 필요합니다.`);
        }
        break;

      case 'formula':
        if (!rule.transformParams || !rule.transformParams.formula) {
          errors.push(`규칙 ${ruleIndex}: 수식 매핑에 수식이 필요합니다.`);
        } else {
          // 수식 구문 검증
          try {
            new Function('return ' + rule.transformParams.formula);
          } catch (syntaxError) {
            errors.push(`규칙 ${ruleIndex}: 수식 구문 오류 - ${syntaxError.message}`);
          }
        }
        break;

      case 'conditional':
        if (!rule.condition) {
          errors.push(`규칙 ${ruleIndex}: 조건부 매핑에 조건이 필요합니다.`);
        }
        break;
    }
  }

  /**
   * 변환 함수 검증
   * @param {string} functionName - 함수명
   * @param {Object} params - 함수 파라미터
   * @param {number} ruleIndex - 규칙 인덱스
   * @param {Array} errors - 에러 배열
   */
  validateTransformFunction(functionName, params, ruleIndex, errors) {
    // 함수명 형식 확인
    const parts = functionName.split('.');
    if (parts.length !== 2) {
      errors.push(`규칙 ${ruleIndex}: 변환 함수명은 'category.function' 형식이어야 합니다.`);
      return;
    }

    const [category, func] = parts;
    
    // 라이브러리에서 함수 존재 확인
    try {
      const categoryFunctions = transformLibrary[category];
      if (!categoryFunctions) {
        errors.push(`규칙 ${ruleIndex}: 변환 카테고리 '${category}'를 찾을 수 없습니다.`);
        return;
      }

      if (!categoryFunctions[func]) {
        errors.push(`규칙 ${ruleIndex}: 변환 함수 '${functionName}'을 찾을 수 없습니다.`);
        return;
      }

      // 함수 파라미터 개수 확인
      const functionInfo = transformLibrary.getFunctionInfo(category, func);
      if (functionInfo && params) {
        const paramCount = Object.keys(params).length;
        if (paramCount > functionInfo.length - 1) { // 첫 번째 파라미터는 값
          errors.push(`규칙 ${ruleIndex}: 변환 함수 '${functionName}'의 파라미터가 너무 많습니다.`);
        }
      }
    } catch (error) {
      errors.push(`규칙 ${ruleIndex}: 변환 함수 검증 중 오류 - ${error.message}`);
    }
  }

  /**
   * 조건 검증
   * @param {Object} condition - 조건 객체
   * @param {Map} sourceColumnMap - 소스 컬럼 맵
   * @param {number} ruleIndex - 규칙 인덱스
   * @param {Array} errors - 에러 배열
   */
  validateCondition(condition, sourceColumnMap, ruleIndex, errors) {
    if (!condition.field) {
      errors.push(`규칙 ${ruleIndex}: 조건에 필드가 지정되지 않았습니다.`);
      return;
    }

    if (!condition.operator) {
      errors.push(`규칙 ${ruleIndex}: 조건에 연산자가 지정되지 않았습니다.`);
      return;
    }

    // 조건 필드 존재 확인
    if (condition.field !== 'self' && !sourceColumnMap.has(condition.field)) {
      errors.push(`규칙 ${ruleIndex}: 조건 필드 '${condition.field}'가 소스 스키마에 존재하지 않습니다.`);
    }

    // 연산자 검증
    const validOperators = [
      '==', '===', '!=', '!==', '>', '>=', '<', '<=',
      'contains', 'startsWith', 'endsWith', 'in', 'notIn',
      'isNull', 'isNotNull'
    ];

    if (!validOperators.includes(condition.operator)) {
      errors.push(`규칙 ${ruleIndex}: 유효하지 않은 조건 연산자 '${condition.operator}'입니다.`);
    }

    // 값이 필요한 연산자 확인
    const valueRequiredOperators = ['==', '===', '!=', '!==', '>', '>=', '<', '<=', 'contains', 'startsWith', 'endsWith', 'in', 'notIn'];
    if (valueRequiredOperators.includes(condition.operator) && condition.value === undefined) {
      errors.push(`규칙 ${ruleIndex}: 조건 연산자 '${condition.operator}'에는 값이 필요합니다.`);
    }
  }

  /**
   * 데이터 타입 호환성 확인
   * @param {string} sourceType - 소스 타입
   * @param {string} targetType - 타겟 타입
   * @param {string} mappingType - 매핑 타입
   * @returns {Object} 호환성 결과
   */
  checkDataTypeCompatibility(sourceType, targetType, mappingType) {
    const typeGroups = {
      numeric: ['INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'NUMBER'],
      string: ['VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'STRING'],
      date: ['DATE', 'TIME', 'DATETIME', 'TIMESTAMP'],
      boolean: ['BOOLEAN', 'BOOL'],
      binary: ['BLOB', 'BINARY'],
      json: ['JSON', 'JSONB']
    };

    const getTypeGroup = (type) => {
      const upperType = type.toUpperCase();
      for (const [group, types] of Object.entries(typeGroups)) {
        if (types.includes(upperType)) return group;
      }
      return 'unknown';
    };

    const sourceGroup = getTypeGroup(sourceType);
    const targetGroup = getTypeGroup(targetType);

    // 같은 그룹이면 호환 가능
    if (sourceGroup === targetGroup) {
      return { compatible: true, lossy: false };
    }

    // 직접 매핑에서 호환 가능한 변환
    if (mappingType === 'direct') {
      const compatibleConversions = {
        'numeric': ['string'],
        'string': ['numeric', 'date', 'boolean'],
        'date': ['string'],
        'boolean': ['string', 'numeric'],
        'json': ['string']
      };

      if (compatibleConversions[sourceGroup]?.includes(targetGroup)) {
        return { compatible: true, lossy: true };
      }

      return { compatible: false, lossy: false };
    }

    // 변환 매핑에서는 모든 타입 허용
    return { compatible: true, lossy: sourceGroup !== targetGroup };
  }

  /**
   * 커버리지 계산
   * @param {Object} mapping - 매핑 정의
   * @param {Object} sourceSchema - 소스 스키마
   * @param {Object} targetSchema - 타겟 스키마
   * @param {Object} result - 결과 객체
   */
  calculateCoverage(mapping, sourceSchema, targetSchema, result) {
    const mappedSourceFields = new Set(mapping.mappingRules.map(rule => rule.sourceField));
    const mappedTargetFields = new Set(mapping.mappingRules.map(rule => rule.targetField));
    const requiredTargetFields = targetSchema.columns.filter(col => !col.nullable && !col.hasDefault);

    result.coverage.sourceCoverage = Math.round(
      (mappedSourceFields.size / sourceSchema.columns.length) * 100
    );

    result.coverage.targetCoverage = Math.round(
      (mappedTargetFields.size / targetSchema.columns.length) * 100
    );

    const coveredRequiredFields = requiredTargetFields.filter(col => 
      mappedTargetFields.has(col.name)
    ).length;

    result.coverage.requiredFieldsCovered = requiredTargetFields.length > 0 ? 
      Math.round((coveredRequiredFields / requiredTargetFields.length) * 100) : 100;
  }

  /**
   * 개선 제안 생성
   * @param {Object} mapping - 매핑 정의
   * @param {Object} sourceSchema - 소스 스키마
   * @param {Object} targetSchema - 타겟 스키마
   * @param {Object} result - 결과 객체
   */
  generateSuggestions(mapping, sourceSchema, targetSchema, result) {
    const mappedSourceFields = new Set(mapping.mappingRules.map(rule => rule.sourceField));
    const mappedTargetFields = new Set(mapping.mappingRules.map(rule => rule.targetField));

    // 미매핑 필수 필드 제안
    const unmappedRequiredFields = targetSchema.columns
      .filter(col => !col.nullable && !col.hasDefault && !mappedTargetFields.has(col.name));

    for (const field of unmappedRequiredFields) {
      // 이름 유사도로 소스 필드 추천
      const similarSourceField = this.findSimilarField(field.name, sourceSchema.columns);
      if (similarSourceField) {
        result.suggestions.push({
          type: 'missing_required_field',
          message: `필수 필드 '${field.name}'에 대한 매핑을 추가하세요.`,
          suggestion: `'${similarSourceField.name}' 필드와 매핑하는 것을 고려해보세요.`,
          targetField: field.name,
          suggestedSourceField: similarSourceField.name
        });
      } else {
        result.suggestions.push({
          type: 'missing_required_field',
          message: `필수 필드 '${field.name}'에 대한 매핑을 추가하세요.`,
          suggestion: '적절한 소스 필드를 선택하거나 기본값을 설정하세요.',
          targetField: field.name
        });
      }
    }

    // 사용되지 않은 소스 필드 제안
    const unusedSourceFields = sourceSchema.columns
      .filter(col => !mappedSourceFields.has(col.name))
      .slice(0, 5); // 최대 5개까지

    if (unusedSourceFields.length > 0) {
      result.suggestions.push({
        type: 'unused_source_fields',
        message: `${unusedSourceFields.length}개의 소스 필드가 사용되지 않습니다.`,
        suggestion: '필요한 경우 추가 매핑을 고려해보세요.',
        fields: unusedSourceFields.map(col => col.name)
      });
    }

    // 데이터 타입 변환 최적화 제안
    for (const rule of mapping.mappingRules) {
      if (rule.mappingType === 'direct') {
        const sourceColumn = sourceSchema.columns.find(col => col.name === rule.sourceField);
        const targetColumn = targetSchema.columns.find(col => col.name === rule.targetField);

        if (sourceColumn && targetColumn) {
          const compatibility = this.checkDataTypeCompatibility(
            sourceColumn.dataType,
            targetColumn.dataType,
            rule.mappingType
          );

          if (compatibility.lossy) {
            result.suggestions.push({
              type: 'lossy_conversion',
              message: `'${rule.sourceField}' → '${rule.targetField}' 변환에서 데이터 손실 가능성이 있습니다.`,
              suggestion: '변환 함수를 사용하여 더 정확한 변환을 고려해보세요.',
              sourceField: rule.sourceField,
              targetField: rule.targetField,
              sourceType: sourceColumn.dataType,
              targetType: targetColumn.dataType
            });
          }
        }
      }
    }
  }

  /**
   * 유사한 필드명 찾기
   * @param {string} targetFieldName - 타겟 필드명
   * @param {Array} sourceColumns - 소스 컬럼 배열
   * @returns {Object|null} 유사한 필드
   */
  findSimilarField(targetFieldName, sourceColumns) {
    const target = targetFieldName.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const column of sourceColumns) {
      const source = column.name.toLowerCase();
      
      // 정확한 일치
      if (source === target) {
        return column;
      }

      // 부분 일치 점수 계산
      let score = 0;
      
      // 포함 관계
      if (source.includes(target) || target.includes(source)) {
        score += 0.7;
      }

      // 시작/끝 일치
      if (source.startsWith(target) || target.startsWith(source)) {
        score += 0.5;
      }

      if (source.endsWith(target) || target.endsWith(source)) {
        score += 0.3;
      }

      // 편집 거리 기반 유사도 (간단한 버전)
      const editDistance = this.calculateEditDistance(source, target);
      const maxLength = Math.max(source.length, target.length);
      const similarity = 1 - (editDistance / maxLength);
      
      if (similarity > 0.6) {
        score += similarity * 0.4;
      }

      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = column;
      }
    }

    return bestMatch;
  }

  /**
   * 편집 거리 계산 (Levenshtein distance)
   * @param {string} str1 - 첫 번째 문자열
   * @param {string} str2 - 두 번째 문자열
   * @returns {number} 편집 거리
   */
  calculateEditDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // 삭제
          matrix[j][i - 1] + 1,     // 삽입
          matrix[j - 1][i - 1] + cost // 대체
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 매핑 미리보기
   * @param {Object} mapping - 매핑 정의
   * @param {Array} sampleData - 샘플 데이터
   * @param {Object} options - 옵션
   * @returns {Promise<Object>} 미리보기 결과
   */
  async generatePreview(mapping, sampleData, options = {}) {
    try {
      const previewResult = {
        success: true,
        transformedData: [],
        errors: [],
        statistics: {
          totalRecords: sampleData.length,
          successfulRecords: 0,
          failedRecords: 0,
          processingTime: 0
        }
      };

      const startTime = Date.now();
      const maxRecords = options.maxRecords || Math.min(sampleData.length, 100);
      const recordsToProcess = sampleData.slice(0, maxRecords);

      for (let i = 0; i < recordsToProcess.length; i++) {
        try {
          const sourceRecord = recordsToProcess[i];
          const transformedRecord = await MappingEngine.transform(mapping, sourceRecord);
          
          previewResult.transformedData.push({
            index: i,
            source: sourceRecord,
            target: transformedRecord,
            success: true
          });
          
          previewResult.statistics.successfulRecords++;
        } catch (error) {
          previewResult.transformedData.push({
            index: i,
            source: recordsToProcess[i],
            target: null,
            success: false,
            error: error.message
          });
          
          previewResult.statistics.failedRecords++;
          previewResult.errors.push({
            recordIndex: i,
            error: error.message
          });
        }
      }

      previewResult.statistics.processingTime = Date.now() - startTime;
      previewResult.success = previewResult.statistics.failedRecords === 0;

      return previewResult;

    } catch (error) {
      logger.error('매핑 미리보기 생성 실패:', error);
      return {
        success: false,
        transformedData: [],
        errors: [{ error: error.message }],
        statistics: {
          totalRecords: sampleData.length,
          successfulRecords: 0,
          failedRecords: sampleData.length,
          processingTime: 0
        }
      };
    }
  }

  /**
   * 매핑 성능 분석
   * @param {Object} mapping - 매핑 정의
   * @param {Array} sampleData - 샘플 데이터
   * @returns {Promise<Object>} 성능 분석 결과
   */
  async analyzePerformance(mapping, sampleData) {
    const batchSizes = [1, 10, 50, 100];
    const results = [];

    for (const batchSize of batchSizes) {
      const batch = sampleData.slice(0, batchSize);
      const startTime = Date.now();
      
      try {
        await MappingEngine.transform(mapping, batch);
        const processingTime = Date.now() - startTime;
        
        results.push({
          batchSize,
          processingTime,
          recordsPerSecond: Math.round((batchSize / processingTime) * 1000),
          success: true
        });
      } catch (error) {
        results.push({
          batchSize,
          processingTime: 0,
          recordsPerSecond: 0,
          success: false,
          error: error.message
        });
      }
    }

    return {
      results,
      recommendation: this.generatePerformanceRecommendation(results)
    };
  }

  /**
   * 성능 최적화 추천 생성
   * @param {Array} results - 성능 테스트 결과
   * @returns {string} 추천 사항
   */
  generatePerformanceRecommendation(results) {
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return '매핑 실행에 실패했습니다. 매핑 규칙을 검토해주세요.';
    }

    const avgRecordsPerSecond = successfulResults.reduce((sum, r) => sum + r.recordsPerSecond, 0) / successfulResults.length;

    if (avgRecordsPerSecond > 1000) {
      return '매핑 성능이 우수합니다. 현재 설정을 유지하세요.';
    } else if (avgRecordsPerSecond > 500) {
      return '매핑 성능이 양호합니다. 대용량 데이터 처리 시 배치 크기를 고려해보세요.';
    } else if (avgRecordsPerSecond > 100) {
      return '매핑 성능이 보통입니다. 복잡한 변환 로직을 최적화하는 것을 고려해보세요.';
    } else {
      return '매핑 성능이 낮습니다. 변환 스크립트를 단순화하거나 매핑 규칙을 최적화해주세요.';
    }
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.validationCache.clear();
    this.previewCache.clear();
  }
}

module.exports = new MappingValidationService();