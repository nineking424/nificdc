'use strict';

const { UNIVERSAL_TYPES, SCHEMA_FORMATS } = require('../../../constants/schemaTypes');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add schemaFormat field
    await queryInterface.addColumn('data_schemas', 'schemaFormat', {
      type: Sequelize.ENUM(...Object.values(SCHEMA_FORMATS)),
      allowNull: false,
      defaultValue: SCHEMA_FORMATS.RELATIONAL,
      comment: '스키마 형식 (relational, document, key-value, etc.)',
      after: 'schemaType'
    });

    // Add universalType field (for future use, columns will have their own universalType)
    await queryInterface.addColumn('data_schemas', 'universalType', {
      type: Sequelize.ENUM(...Object.values(UNIVERSAL_TYPES)),
      allowNull: true,
      comment: '범용 데이터 타입 (컬럼별로 정의됨)',
      after: 'schemaFormat'
    });

    // Update existing schemas to have default schemaFormat
    await queryInterface.sequelize.query(`
      UPDATE data_schemas 
      SET "schemaFormat" = '${SCHEMA_FORMATS.RELATIONAL}'
      WHERE "schemaFormat" IS NULL
    `);

    // Migrate existing column definitions to include universalType
    const [schemas] = await queryInterface.sequelize.query(`
      SELECT id, columns, "schemaType" FROM data_schemas
    `);

    for (const schema of schemas) {
      if (schema.columns && Array.isArray(schema.columns)) {
        const updatedColumns = schema.columns.map(column => {
          // Determine universal type based on existing dataType
          let universalType = UNIVERSAL_TYPES.STRING; // default
          
          if (column.dataType) {
            const dataTypeLower = column.dataType.toLowerCase();
            
            // Text types
            if (dataTypeLower.includes('varchar') || dataTypeLower.includes('char')) {
              universalType = UNIVERSAL_TYPES.STRING;
            } else if (dataTypeLower.includes('text')) {
              universalType = UNIVERSAL_TYPES.TEXT;
            }
            // Numeric types
            else if (dataTypeLower.includes('int') && !dataTypeLower.includes('bigint')) {
              universalType = UNIVERSAL_TYPES.INTEGER;
            } else if (dataTypeLower.includes('bigint')) {
              universalType = UNIVERSAL_TYPES.LONG;
            } else if (dataTypeLower.includes('float')) {
              universalType = UNIVERSAL_TYPES.FLOAT;
            } else if (dataTypeLower.includes('double')) {
              universalType = UNIVERSAL_TYPES.DOUBLE;
            } else if (dataTypeLower.includes('decimal') || dataTypeLower.includes('numeric')) {
              universalType = UNIVERSAL_TYPES.DECIMAL;
            }
            // Boolean
            else if (dataTypeLower.includes('bool')) {
              universalType = UNIVERSAL_TYPES.BOOLEAN;
            }
            // Date/Time types
            else if (dataTypeLower === 'date') {
              universalType = UNIVERSAL_TYPES.DATE;
            } else if (dataTypeLower === 'time') {
              universalType = UNIVERSAL_TYPES.TIME;
            } else if (dataTypeLower.includes('datetime')) {
              universalType = UNIVERSAL_TYPES.DATETIME;
            } else if (dataTypeLower.includes('timestamp')) {
              universalType = UNIVERSAL_TYPES.TIMESTAMP;
            }
            // Binary
            else if (dataTypeLower.includes('blob') || dataTypeLower.includes('binary')) {
              universalType = UNIVERSAL_TYPES.BINARY;
            }
            // JSON
            else if (dataTypeLower.includes('json')) {
              universalType = UNIVERSAL_TYPES.JSON;
            }
            // Array
            else if (dataTypeLower.includes('array')) {
              universalType = UNIVERSAL_TYPES.ARRAY;
            }
          }
          
          return {
            ...column,
            universalType,
            originalType: column.dataType
          };
        });

        await queryInterface.sequelize.query(
          `UPDATE data_schemas SET columns = :columns WHERE id = :id`,
          {
            replacements: {
              columns: JSON.stringify(updatedColumns),
              id: schema.id
            }
          }
        );
      }
    }

    // Add indexes for better query performance
    await queryInterface.addIndex('data_schemas', ['schemaFormat'], {
      name: 'idx_data_schemas_schema_format'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index
    await queryInterface.removeIndex('data_schemas', 'idx_data_schemas_schema_format');

    // Remove columns from existing schemas
    const [schemas] = await queryInterface.sequelize.query(`
      SELECT id, columns FROM data_schemas
    `);

    for (const schema of schemas) {
      if (schema.columns && Array.isArray(schema.columns)) {
        const revertedColumns = schema.columns.map(column => {
          const { universalType, originalType, ...rest } = column;
          return rest;
        });

        await queryInterface.sequelize.query(
          `UPDATE data_schemas SET columns = :columns WHERE id = :id`,
          {
            replacements: {
              columns: JSON.stringify(revertedColumns),
              id: schema.id
            }
          }
        );
      }
    }

    // Remove columns
    await queryInterface.removeColumn('data_schemas', 'universalType');
    await queryInterface.removeColumn('data_schemas', 'schemaFormat');
  }
};