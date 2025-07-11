-- NiFiCDC 데이터베이스 스키마 정의
-- PostgreSQL 15+ 사용

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 시스템 정의서 테이블
CREATE TABLE systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('oracle', 'postgresql', 'sqlite', 'mysql', 'mssql', 'ftp', 'sftp', 'local_fs', 'aws_s3', 'azure_blob')),
  connection_info JSONB NOT NULL, -- 암호화된 접속 정보
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- 인덱스
  CONSTRAINT systems_name_unique UNIQUE (name)
);

-- 데이터 정의서 테이블
CREATE TABLE data_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  version INTEGER DEFAULT 1,
  schema_definition JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- 인덱스
  CONSTRAINT data_schemas_system_name_version_unique UNIQUE (system_id, name, version)
);

-- 매핑 정의서 테이블
CREATE TABLE mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  source_schema_id UUID NOT NULL REFERENCES data_schemas(id) ON DELETE CASCADE,
  target_schema_id UUID NOT NULL REFERENCES data_schemas(id) ON DELETE CASCADE,
  mapping_rules JSONB NOT NULL,
  transformation_script TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- 인덱스
  CONSTRAINT mappings_name_unique UNIQUE (name),
  CONSTRAINT mappings_different_schemas CHECK (source_schema_id != target_schema_id)
);

-- 작업 정의서 테이블
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  mapping_id UUID NOT NULL REFERENCES mappings(id) ON DELETE CASCADE,
  schedule_config JSONB,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- 인덱스
  CONSTRAINT jobs_name_unique UNIQUE (name)
);

-- 작업 실행 이력 테이블
CREATE TABLE job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- 인덱스
  CONSTRAINT job_executions_start_end_check CHECK (completed_at IS NULL OR started_at <= completed_at)
);

-- 사용자 테이블 (인증 시스템용)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- 인덱스
  CONSTRAINT users_username_unique UNIQUE (username),
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- 감사 로그 테이블
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 시스템 설정 테이블
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- 인덱스
  CONSTRAINT system_settings_key_unique UNIQUE (key)
);

-- 인덱스 생성
CREATE INDEX idx_systems_type ON systems(type);
CREATE INDEX idx_systems_is_active ON systems(is_active);
CREATE INDEX idx_systems_created_at ON systems(created_at);

CREATE INDEX idx_data_schemas_system_id ON data_schemas(system_id);
CREATE INDEX idx_data_schemas_name ON data_schemas(name);
CREATE INDEX idx_data_schemas_version ON data_schemas(version);

CREATE INDEX idx_mappings_source_schema_id ON mappings(source_schema_id);
CREATE INDEX idx_mappings_target_schema_id ON mappings(target_schema_id);

CREATE INDEX idx_jobs_mapping_id ON jobs(mapping_id);
CREATE INDEX idx_jobs_is_active ON jobs(is_active);
CREATE INDEX idx_jobs_priority ON jobs(priority);

CREATE INDEX idx_job_executions_job_id ON job_executions(job_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);
CREATE INDEX idx_job_executions_started_at ON job_executions(started_at);
CREATE INDEX idx_job_executions_completed_at ON job_executions(completed_at);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 트리거 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_systems_updated_at BEFORE UPDATE ON systems FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_schemas_updated_at BEFORE UPDATE ON data_schemas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mappings_updated_at BEFORE UPDATE ON mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 뷰 생성: 활성 작업 목록
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

-- 뷰 생성: 작업 실행 통계
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

-- 기본 시스템 설정 삽입
INSERT INTO system_settings (key, value, description) VALUES
('nifi_connection_timeout', '30000', 'NiFi API 연결 타임아웃 (밀리초)'),
('max_concurrent_jobs', '10', '동시 실행 가능한 최대 작업 수'),
('log_retention_days', '30', '로그 보관 기간 (일)'),
('encryption_key_rotation_days', '90', '암호화 키 로테이션 주기 (일)'),
('api_rate_limit_per_minute', '1000', '분당 API 요청 제한'),
('backup_retention_days', '7', '백업 보관 기간 (일)');

-- 기본 관리자 계정 생성 (password: admin123)
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@nificdc.local', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');