const TransformUtils = require('./transformUtils');

/**
 * 매핑 엔진 - 데이터 변환 및 매핑 처리
 * 다양한 매핑 타입과 변환 규칙을 지원
 */
class MappingEngine {
  /**
   * 매핑 규칙을 사용하여 데이터를 변환합니다.
   * @param {Object} mapping - 매핑 설정 객체
   * @param {Object|Array} sourceData - 소스 데이터
   * @returns {Promise<Object|Array>} 변환된 데이터
   */
  static async transform(mapping, sourceData) {
    if (!mapping || !mapping.mappingRules || mapping.mappingRules.length === 0) {
      throw new Error('매핑 규칙이 정의되지 않았습니다.');
    }

    const startTime = Date.now();
    
    try {
      let transformedData;
      
      // 매핑 타입에 따른 처리
      switch (mapping.mappingType) {
        case 'one_to_one':
          transformedData = await this.transformOneToOne(mapping, sourceData);
          break;
        case 'one_to_many':
          transformedData = await this.transformOneToMany(mapping, sourceData);
          break;
        case 'many_to_one':
          transformedData = await this.transformManyToOne(mapping, sourceData);
          break;
        case 'many_to_many':
          transformedData = await this.transformManyToMany(mapping, sourceData);
          break;
        default:
          throw new Error(`지원되지 않는 매핑 타입: ${mapping.mappingType}`);
      }

      // 변환 스크립트 실행 (있는 경우)
      if (mapping.transformationScript) {
        transformedData = await this.executeTransformationScript(
          mapping.transformationScript,
          transformedData,
          sourceData,
          mapping.transformationConfig
        );
      }

      // 검증 규칙 실행 (있는 경우)
      if (mapping.validationRules && mapping.validationRules.length > 0) {
        const validationResult = await this.validateTransformedData(
          transformedData,
          mapping.validationRules
        );
        
        if (!validationResult.valid) {
          throw new Error(`데이터 검증 실패: ${validationResult.errors.join(', ')}`);
        }
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 실행 통계 업데이트
      await this.updateExecutionStats(mapping, executionTime, true);

      return transformedData;
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // 실행 통계 업데이트 (실패)
      await this.updateExecutionStats(mapping, executionTime, false, error.message);

      throw error;
    }
  }

  /**
   * 1:1 매핑 처리
   */
  static async transformOneToOne(mapping, sourceData) {
    if (Array.isArray(sourceData)) {
      return await Promise.all(sourceData.map(item => this.applyMappingRules(mapping.mappingRules, item)));
    } else {
      return await this.applyMappingRules(mapping.mappingRules, sourceData);
    }
  }

  /**
   * 1:N 매핑 처리
   */
  static async transformOneToMany(mapping, sourceData) {
    const results = [];
    
    if (Array.isArray(sourceData)) {
      for (const item of sourceData) {
        const transformedItems = await this.expandToMultiple(mapping.mappingRules, item);
        results.push(...transformedItems);
      }
    } else {
      const transformedItems = await this.expandToMultiple(mapping.mappingRules, sourceData);
      results.push(...transformedItems);
    }

    return results;
  }

  /**
   * N:1 매핑 처리
   */
  static async transformManyToOne(mapping, sourceData) {
    if (!Array.isArray(sourceData)) {
      throw new Error('N:1 매핑에는 배열 형태의 소스 데이터가 필요합니다.');
    }

    return await this.aggregateToSingle(mapping.mappingRules, sourceData);
  }

  /**
   * N:N 매핑 처리
   */
  static async transformManyToMany(mapping, sourceData) {
    if (!Array.isArray(sourceData)) {
      throw new Error('N:N 매핑에는 배열 형태의 소스 데이터가 필요합니다.');
    }

    const results = [];
    
    for (const item of sourceData) {
      const transformedItems = await this.expandToMultiple(mapping.mappingRules, item);
      results.push(...transformedItems);
    }

    return results;
  }

  /**
   * 매핑 규칙 적용
   */
  static async applyMappingRules(rules, sourceData) {
    const result = {};

    for (const rule of rules) {
      try {
        const transformedValue = await this.applyMappingRule(rule, sourceData);
        
        if (transformedValue !== undefined) {
          this.setNestedValue(result, rule.targetField, transformedValue);
        }
      } catch (error) {
        if (rule.required) {
          throw new Error(`필수 필드 ${rule.targetField} 변환 실패: ${error.message}`);
        }
        // 선택 필드는 에러 로그만 남기고 계속 진행
        console.warn(`선택 필드 ${rule.targetField} 변환 실패:`, error.message);
      }
    }

    return result;
  }

  /**
   * 개별 매핑 규칙 적용
   */
  static async applyMappingRule(rule, sourceData) {
    // 조건부 매핑 확인
    if (rule.condition && !this.evaluateCondition(rule.condition, sourceData)) {
      return rule.defaultValue;
    }

    const sourceValue = this.getNestedValue(sourceData, rule.sourceField);

    switch (rule.mappingType) {
      case 'direct':
        return sourceValue;

      case 'transform':
        return await this.executeTransformFunction(rule.transformFunction, sourceValue, sourceData);

      case 'concat':
        return await this.handleConcatMapping(rule, sourceData);

      case 'split':
        return await this.handleSplitMapping(rule, sourceData);

      case 'lookup':
        return await this.handleLookupMapping(rule, sourceValue);

      case 'formula':
        return await this.handleFormulaMapping(rule, sourceData);

      default:
        throw new Error(`지원되지 않는 매핑 타입: ${rule.mappingType}`);
    }
  }

  /**
   * 연결 매핑 처리
   */
  static async handleConcatMapping(rule, sourceData) {
    const separator = rule.separator || '';
    const values = [];

    for (const field of rule.sourceFields || [rule.sourceField]) {
      const value = this.getNestedValue(sourceData, field);
      if (value !== null && value !== undefined) {
        values.push(String(value));
      }
    }

    return values.join(separator);
  }

  /**
   * 분할 매핑 처리
   */
  static async handleSplitMapping(rule, sourceData) {
    const sourceValue = this.getNestedValue(sourceData, rule.sourceField);
    if (!sourceValue) return null;

    const separator = rule.separator || '';
    const splitValues = String(sourceValue).split(separator);
    const index = rule.splitIndex || 0;

    return splitValues[index] || null;
  }

  /**
   * 조회 매핑 처리
   */
  static async handleLookupMapping(rule, sourceValue) {
    if (!rule.lookupTable || !rule.lookupKey) {
      throw new Error('조회 매핑에는 lookupTable과 lookupKey가 필요합니다.');
    }

    // 간단한 인메모리 조회 테이블 지원
    if (typeof rule.lookupTable === 'object') {
      return rule.lookupTable[sourceValue] || rule.defaultValue;
    }

    // 외부 데이터베이스 조회는 추후 구현
    throw new Error('외부 데이터베이스 조회는 아직 지원되지 않습니다.');
  }

  /**
   * 수식 매핑 처리
   */
  static async handleFormulaMapping(rule, sourceData) {
    if (!rule.formula) {
      throw new Error('수식 매핑에는 formula가 필요합니다.');
    }

    // 안전한 수식 평가를 위한 기본 구현
    const context = { ...sourceData };
    const formulaFunction = new Function('data', `
      const { ${Object.keys(context).join(', ')} } = data;
      return ${rule.formula};
    `);

    return formulaFunction(context);
  }

  /**
   * 1:N 확장 처리
   */
  static async expandToMultiple(rules, sourceData) {
    const results = [];
    
    // 확장 규칙 찾기
    const expandRule = rules.find(rule => rule.expandField);
    if (!expandRule) {
      // 확장 규칙이 없으면 일반 변환
      return [await this.applyMappingRules(rules, sourceData)];
    }

    const expandValues = this.getNestedValue(sourceData, expandRule.expandField);
    if (!Array.isArray(expandValues)) {
      throw new Error(`확장 필드 ${expandRule.expandField}는 배열이어야 합니다.`);
    }

    for (const expandValue of expandValues) {
      const expandedData = { ...sourceData, [expandRule.expandField]: expandValue };
      const result = await this.applyMappingRules(rules, expandedData);
      results.push(result);
    }

    return results;
  }

  /**
   * N:1 집계 처리
   */
  static async aggregateToSingle(rules, sourceDataArray) {
    const result = {};

    for (const rule of rules) {
      if (rule.aggregationType) {
        const values = sourceDataArray.map(item => this.getNestedValue(item, rule.sourceField))
          .filter(value => value !== null && value !== undefined);

        let aggregatedValue;
        switch (rule.aggregationType) {
          case 'sum':
            aggregatedValue = values.reduce((sum, val) => sum + Number(val), 0);
            break;
          case 'avg':
            aggregatedValue = values.reduce((sum, val) => sum + Number(val), 0) / values.length;
            break;
          case 'count':
            aggregatedValue = values.length;
            break;
          case 'max':
            aggregatedValue = Math.max(...values.map(Number));
            break;
          case 'min':
            aggregatedValue = Math.min(...values.map(Number));
            break;
          case 'first':
            aggregatedValue = values[0];
            break;
          case 'last':
            aggregatedValue = values[values.length - 1];
            break;
          case 'concat':
            aggregatedValue = values.join(rule.separator || ', ');
            break;
          default:
            throw new Error(`지원되지 않는 집계 타입: ${rule.aggregationType}`);
        }

        this.setNestedValue(result, rule.targetField, aggregatedValue);
      } else {
        // 일반 매핑 규칙 적용 (첫 번째 아이템 기준)
        const transformedValue = await this.applyMappingRule(rule, sourceDataArray[0]);
        this.setNestedValue(result, rule.targetField, transformedValue);
      }
    }

    return result;
  }

  /**
   * 변환 스크립트 실행
   */
  static async executeTransformationScript(script, transformedData, sourceData, config) {
    try {
      const transformFunction = new Function('transformed', 'source', 'config', 'utils', script);
      return transformFunction(transformedData, sourceData, config || {}, TransformUtils);
    } catch (error) {
      throw new Error(`변환 스크립트 실행 실패: ${error.message}`);
    }
  }

  /**
   * 변환 함수 실행
   */
  static async executeTransformFunction(functionName, value, sourceData) {
    if (!TransformUtils[functionName]) {
      throw new Error(`변환 함수 ${functionName}를 찾을 수 없습니다.`);
    }

    return await TransformUtils[functionName](value, sourceData);
  }

  /**
   * 조건 평가
   */
  static evaluateCondition(condition, sourceData) {
    const fieldValue = this.getNestedValue(sourceData, condition.field);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not_equals':
        return fieldValue !== conditionValue;
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      case 'contains':
        return String(fieldValue).includes(String(conditionValue));
      case 'starts_with':
        return String(fieldValue).startsWith(String(conditionValue));
      case 'ends_with':
        return String(fieldValue).endsWith(String(conditionValue));
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      default:
        throw new Error(`지원되지 않는 조건 연산자: ${condition.operator}`);
    }
  }

  /**
   * 변환된 데이터 검증
   */
  static async validateTransformedData(data, validationRules) {
    const errors = [];

    for (const rule of validationRules) {
      const fieldValue = this.getNestedValue(data, rule.field);

      switch (rule.type) {
        case 'required':
          if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
            errors.push(`필수 필드 ${rule.field}가 누락되었습니다.`);
          }
          break;

        case 'type':
          if (fieldValue !== null && fieldValue !== undefined) {
            const actualType = typeof fieldValue;
            if (actualType !== rule.expectedType) {
              errors.push(`필드 ${rule.field}의 타입이 올바르지 않습니다. 예상: ${rule.expectedType}, 실제: ${actualType}`);
            }
          }
          break;

        case 'format':
          if (fieldValue && !new RegExp(rule.pattern).test(String(fieldValue))) {
            errors.push(`필드 ${rule.field}의 형식이 올바르지 않습니다.`);
          }
          break;

        case 'range':
          if (fieldValue !== null && fieldValue !== undefined) {
            const numValue = Number(fieldValue);
            if (rule.min !== undefined && numValue < rule.min) {
              errors.push(`필드 ${rule.field}의 값이 최소값 ${rule.min}보다 작습니다.`);
            }
            if (rule.max !== undefined && numValue > rule.max) {
              errors.push(`필드 ${rule.field}의 값이 최대값 ${rule.max}보다 큽니다.`);
            }
          }
          break;

        case 'length':
          if (fieldValue) {
            const length = String(fieldValue).length;
            if (rule.minLength !== undefined && length < rule.minLength) {
              errors.push(`필드 ${rule.field}의 길이가 최소 길이 ${rule.minLength}보다 짧습니다.`);
            }
            if (rule.maxLength !== undefined && length > rule.maxLength) {
              errors.push(`필드 ${rule.field}의 길이가 최대 길이 ${rule.maxLength}보다 깁니다.`);
            }
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 스키마 호환성 검증
   */
  static async validateSchemaCompatibility(sourceSchema, targetSchema, mappingRules) {
    const errors = [];

    // 소스 스키마 컬럼 확인
    for (const rule of mappingRules) {
      const sourceColumn = sourceSchema.columns.find(col => col.name === rule.sourceField);
      if (!sourceColumn) {
        errors.push(`소스 스키마에서 필드 ${rule.sourceField}를 찾을 수 없습니다.`);
      }
    }

    // 타겟 스키마 컬럼 확인
    const targetFields = mappingRules.map(rule => rule.targetField);
    const requiredTargetColumns = targetSchema.columns.filter(col => !col.nullable);

    for (const column of requiredTargetColumns) {
      if (!targetFields.includes(column.name)) {
        errors.push(`필수 타겟 필드 ${column.name}에 대한 매핑이 정의되지 않았습니다.`);
      }
    }

    // 데이터 타입 호환성 확인
    for (const rule of mappingRules) {
      const sourceColumn = sourceSchema.columns.find(col => col.name === rule.sourceField);
      const targetColumn = targetSchema.columns.find(col => col.name === rule.targetField);

      if (sourceColumn && targetColumn) {
        const compatible = this.isDataTypeCompatible(sourceColumn.dataType, targetColumn.dataType, rule.mappingType);
        if (!compatible) {
          errors.push(`필드 ${rule.sourceField}(${sourceColumn.dataType})와 ${rule.targetField}(${targetColumn.dataType})의 데이터 타입이 호환되지 않습니다.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 데이터 타입 호환성 확인
   */
  static isDataTypeCompatible(sourceType, targetType, mappingType) {
    // 직접 매핑의 경우 타입 호환성 확인
    if (mappingType === 'direct') {
      const typeGroups = {
        string: ['VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT'],
        number: ['INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'],
        date: ['DATE', 'TIME', 'DATETIME', 'TIMESTAMP'],
        boolean: ['BOOLEAN'],
        binary: ['BLOB', 'BINARY'],
        json: ['JSON', 'JSONB']
      };

      for (const [group, types] of Object.entries(typeGroups)) {
        if (types.includes(sourceType) && types.includes(targetType)) {
          return true;
        }
      }

      return false;
    }

    // 변환 매핑의 경우 모든 타입 허용
    return true;
  }

  /**
   * 실행 통계 업데이트
   */
  static async updateExecutionStats(mapping, executionTime, success, errorMessage = null) {
    const stats = mapping.executionStats || {};
    
    stats.totalExecutions = (stats.totalExecutions || 0) + 1;
    stats.totalExecutionTime = (stats.totalExecutionTime || 0) + executionTime;
    stats.averageExecutionTime = stats.totalExecutionTime / stats.totalExecutions;
    
    if (success) {
      stats.successCount = (stats.successCount || 0) + 1;
    } else {
      stats.failureCount = (stats.failureCount || 0) + 1;
      stats.lastError = errorMessage;
    }
    
    stats.successRate = (stats.successCount || 0) / stats.totalExecutions;
    stats.lastExecutedAt = new Date().toISOString();

    // 매핑 모델 업데이트
    if (mapping.update) {
      await mapping.update({
        executionStats: stats,
        lastExecutedAt: new Date(),
        lastExecutionStatus: success ? 'success' : 'failed',
        lastExecutionError: errorMessage
      });
    }
  }

  /**
   * 중첩된 객체에서 값 가져오기
   */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * 중첩된 객체에 값 설정
   */
  static setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);

    target[lastKey] = value;
  }
}

module.exports = MappingEngine;