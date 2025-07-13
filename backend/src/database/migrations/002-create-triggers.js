module.exports = {
  up: async (queryInterface, Sequelize) => {
    // updated_at 자동 업데이트 트리거 함수 생성
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // 각 테이블에 트리거 생성
    const tables = ['users', 'systems', 'data_schemas', 'mappings', 'jobs', 'system_settings'];
    
    for (const table of tables) {
      await queryInterface.sequelize.query(`
        CREATE TRIGGER update_${table}_updated_at 
        BEFORE UPDATE ON ${table} 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    // 뷰 생성: 활성 작업 목록
    await queryInterface.sequelize.query(`
      CREATE VIEW active_jobs_view AS
      SELECT 
          j.id,
          j.name,
          j.description,
          j.priority,
          j.schedule_config,
          j.created_at,
          j.updated_at,
          m.name as mapping_name,
          ss.name as source_system_name,
          ts.name as target_system_name,
          ds_source.name as source_schema_name,
          ds_target.name as target_schema_name
      FROM jobs j
      JOIN mappings m ON j.mapping_id = m.id
      JOIN data_schemas ds_source ON m.source_schema_id = ds_source.id
      JOIN data_schemas ds_target ON m.target_schema_id = ds_target.id
      JOIN systems ss ON ds_source.system_id = ss.id
      JOIN systems ts ON ds_target.system_id = ts.id
      WHERE j.is_active = true 
        AND j.deleted_at IS NULL
        AND m.deleted_at IS NULL
        AND ds_source.deleted_at IS NULL
        AND ds_target.deleted_at IS NULL
        AND ss.deleted_at IS NULL
        AND ts.deleted_at IS NULL;
    `);

    // 뷰 생성: 작업 실행 통계
    await queryInterface.sequelize.query(`
      CREATE VIEW job_execution_stats_view AS
      SELECT 
          j.id as job_id,
          j.name as job_name,
          COUNT(je.id) as total_executions,
          COUNT(CASE WHEN je.status = 'completed' THEN 1 END) as successful_executions,
          COUNT(CASE WHEN je.status = 'failed' THEN 1 END) as failed_executions,
          COUNT(CASE WHEN je.status = 'running' THEN 1 END) as running_executions,
          AVG(CASE WHEN je.status = 'completed' THEN EXTRACT(EPOCH FROM (je.completed_at - je.started_at)) END) as avg_execution_time_seconds,
          MAX(je.completed_at) as last_execution_at
      FROM jobs j
      LEFT JOIN job_executions je ON j.id = je.job_id
      WHERE j.deleted_at IS NULL
      GROUP BY j.id, j.name;
    `);

    // 감사 로그 트리거 함수 생성
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION audit_trigger()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'DELETE' THEN
              INSERT INTO audit_logs(id, action, table_name, record_id, old_values, created_at)
              VALUES(uuid_generate_v4(), 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD), CURRENT_TIMESTAMP);
              RETURN OLD;
          ELSIF TG_OP = 'UPDATE' THEN
              INSERT INTO audit_logs(id, action, table_name, record_id, old_values, new_values, created_at)
              VALUES(uuid_generate_v4(), 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW), CURRENT_TIMESTAMP);
              RETURN NEW;
          ELSIF TG_OP = 'INSERT' THEN
              INSERT INTO audit_logs(id, action, table_name, record_id, new_values, created_at)
              VALUES(uuid_generate_v4(), 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW), CURRENT_TIMESTAMP);
              RETURN NEW;
          END IF;
          RETURN NULL;
      END;
      $$ language 'plpgsql';
    `);

    // 주요 테이블에 감사 로그 트리거 추가
    const auditTables = ['systems', 'data_schemas', 'mappings', 'jobs'];
    
    for (const table of auditTables) {
      await queryInterface.sequelize.query(`
        CREATE TRIGGER ${table}_audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION audit_trigger();
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // 트리거 제거
    const tables = ['users', 'systems', 'data_schemas', 'mappings', 'jobs', 'system_settings'];
    
    for (const table of tables) {
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
      `);
    }

    // 감사 로그 트리거 제거
    const auditTables = ['systems', 'data_schemas', 'mappings', 'jobs'];
    
    for (const table of auditTables) {
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS ${table}_audit_trigger ON ${table};
      `);
    }

    // 뷰 제거
    await queryInterface.sequelize.query('DROP VIEW IF EXISTS active_jobs_view;');
    await queryInterface.sequelize.query('DROP VIEW IF EXISTS job_execution_stats_view;');

    // 함수 제거
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS update_updated_at_column();');
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS audit_trigger();');
  }
};