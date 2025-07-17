// services/api.js - API 서비스 모듈
import api from '@/utils/api'

/**
 * API 서비스 모듈
 * 각 도메인별 API 호출 함수들을 제공
 */

// 시스템 관련 API
export const systemApi = {
  // 시스템 목록 조회
  getList: (params = {}) => api.get('/systems', { params }),
  
  // 시스템 상세 조회
  getById: (id) => api.get(`/systems/${id}`),
  
  // 시스템 생성
  create: (data) => api.post('/systems', data),
  
  // 시스템 수정
  update: (id, data) => api.put(`/systems/${id}`, data),
  
  // 시스템 삭제
  delete: (id) => api.delete(`/systems/${id}`),
  
  // 시스템 연결 테스트
  testConnection: (id) => api.post(`/systems/${id}/test-connection`),
  
  // 시스템 타입 목록
  getTypes: () => api.get('/systems/types')
}

// 사용자 관련 API
export const userApi = {
  // 사용자 목록 조회
  getList: (params = {}) => api.get('/users', { params }),
  
  // 사용자 상세 조회
  getById: (id) => api.get(`/users/${id}`),
  
  // 사용자 생성
  create: (data) => api.post('/users', data),
  
  // 사용자 수정
  update: (id, data) => api.put(`/users/${id}`, data),
  
  // 사용자 삭제
  delete: (id) => api.delete(`/users/${id}`),
  
  // 사용자 역할 수정
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  
  // 사용자 활성화/비활성화
  toggleActive: (id) => api.put(`/users/${id}/toggle-active`)
}

// 인증 관련 API
export const authApi = {
  // 로그인
  login: (credentials) => api.post('/auth/login', credentials),
  
  // 로그아웃
  logout: () => api.post('/auth/logout'),
  
  // 토큰 갱신
  refreshToken: () => api.post('/auth/refresh'),
  
  // 비밀번호 변경
  changePassword: (data) => api.put('/auth/change-password', data),
  
  // 프로필 조회
  getProfile: () => api.get('/auth/profile'),
  
  // 프로필 수정
  updateProfile: (data) => api.put('/auth/profile', data)
}

// 스키마 관련 API
export const schemaApi = {
  // 스키마 목록 조회
  getList: (params = {}) => api.get('/schemas', { params }),
  
  // 스키마 상세 조회
  getById: (id) => api.get(`/schemas/${id}`),
  
  // 스키마 생성
  create: (data) => api.post('/schemas', data),
  
  // 스키마 수정
  update: (id, data) => api.put(`/schemas/${id}`, data),
  
  // 스키마 삭제
  delete: (id) => api.delete(`/schemas/${id}`),
  
  // 스키마 자동 탐색
  discover: (systemId, options = {}) => api.get(`/schemas/discover/${systemId}`, { params: options }),
  
  // 스키마 새로고침 (강제 재탐색)
  refresh: (systemId) => api.post(`/schemas/refresh/${systemId}`),
  
  // 스키마 샘플 데이터 조회
  getSampleData: (systemId, tableName, limit = 10) => 
    api.get(`/schemas/sample/${systemId}/${tableName}`, { params: { limit } }),
  
  // 스키마 통계 조회
  getStatistics: (systemId, tableName) => 
    api.get(`/schemas/statistics/${systemId}/${tableName}`),
  
  // 스키마 비교
  compare: (sourceSystemId, targetSystemId) => 
    api.get(`/schemas/compare/${sourceSystemId}/${targetSystemId}`),
  
  // 스키마 버전 목록
  getVersions: (id) => api.get(`/schemas/${id}/versions`),
  
  // 스키마 버전 비교
  compareVersions: (id, versionA, versionB) => 
    api.get(`/schemas/${id}/compare/${versionA}/${versionB}`),
  
  // 스키마 캐시 관리
  clearCache: (systemId) => api.delete(`/schemas/cache/${systemId}`),
  getCacheStatus: () => api.get('/schemas/cache/status')
}

// 매핑 관련 API
export const mappingApi = {
  // 매핑 목록 조회
  getList: (params = {}) => api.get('/mappings', { params }),
  
  // 매핑 상세 조회
  getById: (id) => api.get(`/mappings/${id}`),
  
  // 매핑 생성
  create: (data) => api.post('/mappings', data),
  
  // 매핑 수정
  update: (id, data) => api.put(`/mappings/${id}`, data),
  
  // 매핑 삭제
  delete: (id) => api.delete(`/mappings/${id}`),
  
  // 매핑 검증
  validate: (id) => api.post(`/mappings/${id}/validate`),
  
  // 매핑 미리보기
  preview: (id, sampleData) => api.post(`/mappings/${id}/preview`, { sampleData }),
  
  // 변환 함수 목록
  getTransformFunctions: () => api.get('/mappings/transform-functions')
}

// 작업 관련 API
export const jobApi = {
  // 작업 목록 조회
  getList: (params = {}) => api.get('/jobs', { params }),
  
  // 작업 상세 조회
  getById: (id) => api.get(`/jobs/${id}`),
  
  // 작업 생성
  create: (data) => api.post('/jobs', data),
  
  // 작업 수정
  update: (id, data) => api.put(`/jobs/${id}`, data),
  
  // 작업 삭제
  delete: (id) => api.delete(`/jobs/${id}`),
  
  // 작업 실행
  execute: (id) => api.post(`/jobs/${id}/execute`),
  
  // 작업 중지
  stop: (id) => api.post(`/jobs/${id}/stop`),
  
  // 작업 실행 이력
  getExecutions: (id, params = {}) => api.get(`/jobs/${id}/executions`, { params }),
  
  // 작업 스케줄 설정
  setSchedule: (id, schedule) => api.put(`/jobs/${id}/schedule`, schedule),
  
  // 작업 우선순위 변경
  setPriority: (id, priority) => api.put(`/jobs/${id}/priority`, { priority })
}

// 모니터링 관련 API
export const monitoringApi = {
  // 시스템 상태 조회
  getSystemStatus: () => api.get('/monitoring/system-status'),
  
  // 성능 메트릭 조회
  getMetrics: (params = {}) => api.get('/monitoring/metrics', { params }),
  
  // 실시간 통계
  getRealTimeStats: () => api.get('/monitoring/realtime-stats'),
  
  // 알림 목록 조회
  getAlerts: (params = {}) => api.get('/monitoring/alerts', { params }),
  
  // 알림 확인 처리
  markAlertAsRead: (id) => api.put(`/monitoring/alerts/${id}/read`),
  
  // 에러 로그 조회
  getErrorLogs: (params = {}) => api.get('/monitoring/error-logs', { params }),
  
  // 성능 리포트 생성
  generateReport: (params) => api.post('/monitoring/reports', params),
  
  // 대시보드 설정 조회
  getDashboardConfig: () => api.get('/monitoring/dashboard-config'),
  
  // 대시보드 설정 저장
  saveDashboardConfig: (config) => api.put('/monitoring/dashboard-config', config)
}

// 보안 관련 API
export const securityApi = {
  // 감사 로그 조회
  getAuditLogs: (params = {}) => api.get('/security/audit-logs', { params }),
  
  // 보안 이벤트 조회
  getSecurityEvents: (params = {}) => api.get('/security/events', { params }),
  
  // 취약점 스캔 결과 조회
  getVulnerabilityReports: (params = {}) => api.get('/security/vulnerability-reports', { params }),
  
  // 취약점 스캔 실행
  runVulnerabilityScan: () => api.post('/security/vulnerability-scan'),
  
  // 보안 설정 조회
  getSecuritySettings: () => api.get('/security/settings'),
  
  // 보안 설정 업데이트
  updateSecuritySettings: (settings) => api.put('/security/settings', settings),
  
  // 브루트포스 방어 상태 조회
  getBruteForceStatus: () => api.get('/security/brute-force-status'),
  
  // IP 차단 목록 조회
  getBlockedIPs: (params = {}) => api.get('/security/blocked-ips', { params }),
  
  // IP 차단 해제
  unblockIP: (ip) => api.delete(`/security/blocked-ips/${ip}`)
}

// 파일 관련 API
export const fileApi = {
  // 파일 업로드
  upload: (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      }
    })
  },
  
  // 파일 다운로드
  download: (fileId, filename) => {
    return api.get(`/files/${fileId}/download`, {
      responseType: 'blob'
    }).then(response => {
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    })
  },
  
  // 파일 목록 조회
  getList: (params = {}) => api.get('/files', { params }),
  
  // 파일 삭제
  delete: (fileId) => api.delete(`/files/${fileId}`)
}

// 설정 관련 API
export const settingsApi = {
  // 시스템 설정 조회
  getSystemSettings: () => api.get('/settings/system'),
  
  // 시스템 설정 업데이트
  updateSystemSettings: (settings) => api.put('/settings/system', settings),
  
  // 사용자 설정 조회
  getUserSettings: () => api.get('/settings/user'),
  
  // 사용자 설정 업데이트
  updateUserSettings: (settings) => api.put('/settings/user', settings),
  
  // 알림 설정 조회
  getNotificationSettings: () => api.get('/settings/notifications'),
  
  // 알림 설정 업데이트
  updateNotificationSettings: (settings) => api.put('/settings/notifications', settings)
}

// 통계 관련 API
export const statsApi = {
  // 대시보드 통계
  getDashboardStats: () => api.get('/stats/dashboard'),
  
  // 시스템 사용량 통계
  getUsageStats: (params = {}) => api.get('/stats/usage', { params }),
  
  // 성능 통계
  getPerformanceStats: (params = {}) => api.get('/stats/performance', { params }),
  
  // 에러 통계
  getErrorStats: (params = {}) => api.get('/stats/errors', { params }),
  
  // 사용자 활동 통계
  getUserActivityStats: (params = {}) => api.get('/stats/user-activity', { params })
}

// 기본 export
export default {
  system: systemApi,
  user: userApi,
  auth: authApi,
  schema: schemaApi,
  mapping: mappingApi,
  job: jobApi,
  monitoring: monitoringApi,
  security: securityApi,
  file: fileApi,
  settings: settingsApi,
  stats: statsApi
}