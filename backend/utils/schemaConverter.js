const { 
  UNIVERSAL_TYPES, 
  mapToUniversalType, 
  mapFromUniversalType, 
  isTypeCompatible 
} = require('../constants/schemaTypes');

/**
 * Schema Converter Utility
 * 스키마 간 데이터 타입 변환 유틸리티
 */
class SchemaConverter {
  /**
   * Convert schema from one database type to another
   * @param {Object} schema - Source schema object
   * @param {string} sourceDbType - Source database type (mysql, postgresql, mongodb, etc.)
   * @param {string} targetDbType - Target database type
   * @returns {Object} Converted schema
   */
  static convertSchema(schema, sourceDbType, targetDbType) {
    if (!schema.columns || !Array.isArray(schema.columns)) {
      throw new Error('Schema must have columns array');
    }

    const convertedColumns = schema.columns.map(column => {
      // First convert to universal type
      const universalType = column.universalType || mapToUniversalType(sourceDbType, column.dataType);
      
      // Then convert to target database type
      const targetDataType = mapFromUniversalType(targetDbType, universalType);
      
      return {
        ...column,
        originalType: column.dataType,
        dataType: targetDataType,
        universalType,
        sourceDbType,
        targetDbType
      };
    });

    return {
      ...schema,
      columns: convertedColumns,
      sourceDbType,
      targetDbType,
      convertedAt: new Date()
    };
  }

  /**
   * Validate if schemas are compatible for mapping
   * @param {Object} sourceSchema - Source schema
   * @param {Object} targetSchema - Target schema
   * @returns {Object} Validation result with compatibility info
   */
  static validateSchemaCompatibility(sourceSchema, targetSchema) {
    const result = {
      isCompatible: true,
      compatibilityScore: 0,
      issues: [],
      mappingSuggestions: []
    };

    if (!sourceSchema.columns || !targetSchema.columns) {
      result.isCompatible = false;
      result.issues.push('Both schemas must have columns defined');
      return result;
    }

    // Check column compatibility
    sourceSchema.columns.forEach(sourceCol => {
      const sourceUniversalType = sourceCol.universalType || 
        mapToUniversalType('mysql', sourceCol.dataType);
      
      // Find all target columns (for name matching)
      const allTargets = targetSchema.columns;
      
      // Find compatible target columns (type-wise)
      const compatibleTargets = allTargets.filter(targetCol => {
        const targetUniversalType = targetCol.universalType || 
          mapToUniversalType('mysql', targetCol.dataType);
        
        return isTypeCompatible(sourceUniversalType, targetUniversalType);
      });

      // Always try to find best name match first
      const bestNameMatch = this.findBestColumnMatch(sourceCol, allTargets);
      
      if (bestNameMatch && bestNameMatch.score > 0.7) {
        // Check if this best name match is also type compatible
        const targetCol = bestNameMatch.column;
        const targetUniversalType = targetCol.universalType || 
          mapToUniversalType('mysql', targetCol.dataType);
        
        const typeCompatible = isTypeCompatible(sourceUniversalType, targetUniversalType);
        
        result.mappingSuggestions.push({
          sourceColumn: sourceCol.name,
          targetColumn: targetCol.name,
          confidence: bestNameMatch.score,
          typeCompatibility: typeCompatible ? 'full' : 'conversion_required'
        });
        result.compatibilityScore += bestNameMatch.score;
      } else if (compatibleTargets.length > 0) {
        // No good name match, but type compatible columns exist
        const bestMatch = this.findBestColumnMatch(sourceCol, compatibleTargets);
        result.mappingSuggestions.push({
          sourceColumn: sourceCol.name,
          targetColumn: bestMatch.column.name,
          confidence: bestMatch.score,
          typeCompatibility: 'full'
        });
        result.compatibilityScore += bestMatch.score;
      } else {
        // No compatible columns at all
        result.issues.push({
          column: sourceCol.name,
          type: 'NO_COMPATIBLE_TARGET',
          message: `No compatible target column found for ${sourceCol.name} (${sourceUniversalType})`
        });
      }
    });

    // Calculate average compatibility score
    if (sourceSchema.columns.length > 0) {
      result.compatibilityScore = result.compatibilityScore / sourceSchema.columns.length;
    }

    // Determine overall compatibility
    result.isCompatible = result.issues.length === 0 || 
      (result.issues.length < sourceSchema.columns.length * 0.3); // Allow 30% unmapped columns

    return result;
  }

  /**
   * Find best matching column based on name similarity
   * @param {Object} sourceColumn - Source column
   * @param {Array} targetColumns - Array of target columns
   * @returns {Object} Best match with score
   */
  static findBestColumnMatch(sourceColumn, targetColumns) {
    let bestMatch = null;
    let bestScore = 0;

    targetColumns.forEach(targetColumn => {
      const score = this.calculateNameSimilarity(sourceColumn.name, targetColumn.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = targetColumn;
      }
    });

    return { column: bestMatch, score: bestScore };
  }

  /**
   * Calculate name similarity score (0-1)
   * @param {string} name1 - First name
   * @param {string} name2 - Second name
   * @returns {number} Similarity score
   */
  static calculateNameSimilarity(name1, name2) {
    const n1 = name1.toLowerCase().replace(/[_-]/g, '');
    const n2 = name2.toLowerCase().replace(/[_-]/g, '');

    // Exact match
    if (n1 === n2) return 1.0;

    // One contains the other
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;

    // Levenshtein distance
    const distance = this.levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    const similarity = 1 - (distance / maxLength);

    return Math.max(0, similarity);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  static levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Generate automatic mapping based on schema analysis
   * @param {Object} sourceSchema - Source schema
   * @param {Object} targetSchema - Target schema
   * @returns {Array} Array of mapping rules
   */
  static generateAutoMapping(sourceSchema, targetSchema) {
    const compatibility = this.validateSchemaCompatibility(sourceSchema, targetSchema);
    const mappingRules = [];

    compatibility.mappingSuggestions.forEach(suggestion => {
      if (suggestion.confidence > 0.7) { // Only auto-map high confidence matches
        const sourceCol = sourceSchema.columns.find(c => c.name === suggestion.sourceColumn);
        const targetCol = targetSchema.columns.find(c => c.name === suggestion.targetColumn);

        mappingRules.push({
          sourceField: suggestion.sourceColumn,
          targetField: suggestion.targetColumn,
          transformationType: this.determineTransformationType(sourceCol, targetCol),
          confidence: suggestion.confidence,
          isAutoGenerated: true
        });
      }
    });

    return mappingRules;
  }

  /**
   * Determine required transformation type between columns
   * @param {Object} sourceColumn - Source column
   * @param {Object} targetColumn - Target column
   * @returns {string} Transformation type
   */
  static determineTransformationType(sourceColumn, targetColumn) {
    const sourceType = sourceColumn.universalType || 
      mapToUniversalType('mysql', sourceColumn.dataType);
    const targetType = targetColumn.universalType || 
      mapToUniversalType('mysql', targetColumn.dataType);

    // Same type - direct mapping
    if (sourceType === targetType) {
      return 'direct';
    }

    // Type conversion needed
    const conversionMap = {
      [`${UNIVERSAL_TYPES.STRING}_${UNIVERSAL_TYPES.INTEGER}`]: 'stringToInteger',
      [`${UNIVERSAL_TYPES.STRING}_${UNIVERSAL_TYPES.FLOAT}`]: 'stringToFloat',
      [`${UNIVERSAL_TYPES.STRING}_${UNIVERSAL_TYPES.BOOLEAN}`]: 'stringToBoolean',
      [`${UNIVERSAL_TYPES.INTEGER}_${UNIVERSAL_TYPES.STRING}`]: 'integerToString',
      [`${UNIVERSAL_TYPES.FLOAT}_${UNIVERSAL_TYPES.STRING}`]: 'floatToString',
      [`${UNIVERSAL_TYPES.BOOLEAN}_${UNIVERSAL_TYPES.STRING}`]: 'booleanToString',
      [`${UNIVERSAL_TYPES.DATE}_${UNIVERSAL_TYPES.STRING}`]: 'dateToString',
      [`${UNIVERSAL_TYPES.STRING}_${UNIVERSAL_TYPES.DATE}`]: 'stringToDate',
      [`${UNIVERSAL_TYPES.TIMESTAMP}_${UNIVERSAL_TYPES.DATE}`]: 'timestampToDate',
      [`${UNIVERSAL_TYPES.DATE}_${UNIVERSAL_TYPES.TIMESTAMP}`]: 'dateToTimestamp'
    };

    const conversionKey = `${sourceType}_${targetType}`;
    return conversionMap[conversionKey] || 'custom';
  }

  /**
   * Create a schema diff report
   * @param {Object} schema1 - First schema
   * @param {Object} schema2 - Second schema
   * @returns {Object} Diff report
   */
  static createSchemaDiff(schema1, schema2) {
    const diff = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };

    const schema1Columns = new Map(schema1.columns.map(col => [col.name, col]));
    const schema2Columns = new Map(schema2.columns.map(col => [col.name, col]));

    // Find added columns
    schema2Columns.forEach((col, name) => {
      if (!schema1Columns.has(name)) {
        diff.added.push(col);
      }
    });

    // Find removed columns
    schema1Columns.forEach((col, name) => {
      if (!schema2Columns.has(name)) {
        diff.removed.push(col);
      }
    });

    // Find modified and unchanged columns
    schema1Columns.forEach((col1, name) => {
      const col2 = schema2Columns.get(name);
      if (col2) {
        const changes = this.compareColumns(col1, col2);
        if (changes.length > 0) {
          diff.modified.push({ column: name, changes });
        } else {
          diff.unchanged.push(name);
        }
      }
    });

    return diff;
  }

  /**
   * Compare two columns and return differences
   * @param {Object} col1 - First column
   * @param {Object} col2 - Second column
   * @returns {Array} Array of changes
   */
  static compareColumns(col1, col2) {
    const changes = [];
    const compareFields = ['dataType', 'universalType', 'nullable', 'defaultValue', 'length'];

    compareFields.forEach(field => {
      if (col1[field] !== col2[field]) {
        changes.push({
          field,
          from: col1[field],
          to: col2[field]
        });
      }
    });

    return changes;
  }
}

module.exports = SchemaConverter;