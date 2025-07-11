import api from '@/services/api';

class JobService {
  /**
   * 작업 목록 조회
   * @param {Object} params - 쿼리 파라미터
   * @returns {Promise} API 응답
   */
  async getJobs(params = {}) {
    try {
      const response = await api.get('/jobs', { params });
      return response;
    } catch (error) {
      console.error('작업 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 상세 조회
   * @param {string} id - 작업 ID
   * @param {Object} params - 쿼리 파라미터
   * @returns {Promise} API 응답
   */
  async getJob(id, params = {}) {
    try {
      const response = await api.get(`/jobs/${id}`, { params });
      return response;
    } catch (error) {
      console.error('작업 상세 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 생성
   * @param {Object} jobData - 작업 데이터
   * @returns {Promise} API 응답
   */
  async createJob(jobData) {
    try {
      const response = await api.post('/jobs', jobData);
      return response;
    } catch (error) {
      console.error('작업 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 수정
   * @param {string} id - 작업 ID
   * @param {Object} jobData - 작업 데이터
   * @returns {Promise} API 응답
   */
  async updateJob(id, jobData) {
    try {
      const response = await api.put(`/jobs/${id}`, jobData);
      return response;
    } catch (error) {
      console.error('작업 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 삭제
   * @param {string} id - 작업 ID
   * @returns {Promise} API 응답
   */
  async deleteJob(id) {
    try {
      const response = await api.delete(`/jobs/${id}`);
      return response;
    } catch (error) {
      console.error('작업 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 수동 실행
   * @param {string} id - 작업 ID
   * @param {Object} parameters - 실행 파라미터
   * @returns {Promise} API 응답
   */
  async executeJob(id, parameters = null) {
    try {
      const response = await api.post(`/jobs/${id}/execute`, { parameters });
      return response;
    } catch (error) {
      console.error('작업 실행 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 취소
   * @param {string} id - 작업 ID
   * @param {string} executionId - 실행 ID (선택사항)
   * @returns {Promise} API 응답
   */
  async cancelJob(id, executionId = null) {
    try {
      const response = await api.post(`/jobs/${id}/cancel`, { executionId });
      return response;
    } catch (error) {
      console.error('작업 취소 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 활성화/비활성화
   * @param {string} id - 작업 ID
   * @param {boolean} isActive - 활성화 여부
   * @returns {Promise} API 응답
   */
  async toggleJobStatus(id, isActive) {
    try {
      const response = await api.patch(`/jobs/${id}/status`, { isActive });
      return response;
    } catch (error) {
      console.error('작업 상태 변경 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 일시정지/재개
   * @param {string} id - 작업 ID
   * @param {boolean} paused - 일시정지 여부
   * @returns {Promise} API 응답
   */
  async pauseJob(id, paused) {
    try {
      const response = await api.patch(`/jobs/${id}/pause`, { paused });
      return response;
    } catch (error) {
      console.error('작업 일시정지/재개 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 실행 이력 조회
   * @param {string} id - 작업 ID
   * @param {Object} params - 쿼리 파라미터
   * @returns {Promise} API 응답
   */
  async getJobExecutions(id, params = {}) {
    try {
      const response = await api.get(`/jobs/${id}/executions`, { params });
      return response;
    } catch (error) {
      console.error('작업 실행 이력 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 실행 통계
   * @param {string} id - 작업 ID
   * @param {string} period - 기간 (예: '30d', '7d')
   * @returns {Promise} API 응답
   */
  async getJobStats(id, period = '30d') {
    try {
      const response = await api.get(`/jobs/${id}/stats`, { params: { period } });
      return response;
    } catch (error) {
      console.error('작업 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 스케줄 타입 목록 조회
   * @returns {Promise} API 응답
   */
  async getScheduleTypes() {
    try {
      const response = await api.get('/jobs/meta/schedule-types');
      return response;
    } catch (error) {
      console.error('스케줄 타입 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 상태 타입 목록 조회
   * @returns {Promise} API 응답
   */
  async getStatusTypes() {
    try {
      const response = await api.get('/jobs/meta/status-types');
      return response;
    } catch (error) {
      console.error('상태 타입 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 대시보드 통계 조회
   * @param {string} period - 기간
   * @returns {Promise} API 응답
   */
  async getDashboard(period = '7d') {
    try {
      const response = await api.get('/jobs/dashboard', { params: { period } });
      return response;
    } catch (error) {
      console.error('대시보드 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 복제
   * @param {string} id - 작업 ID
   * @param {Object} copyData - 복제 데이터
   * @returns {Promise} API 응답
   */
  async copyJob(id, copyData) {
    try {
      const response = await api.post(`/jobs/${id}/copy`, copyData);
      return response;
    } catch (error) {
      console.error('작업 복제 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 내보내기
   * @param {string} id - 작업 ID
   * @param {string} format - 내보내기 형식
   * @returns {Promise} API 응답
   */
  async exportJob(id, format = 'json') {
    try {
      const response = await api.get(`/jobs/${id}/export`, {
        params: { format },
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      console.error('작업 내보내기 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 가져오기
   * @param {File} file - 가져올 파일
   * @param {Object} importOptions - 가져오기 옵션
   * @returns {Promise} API 응답
   */
  async importJob(file, importOptions = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify(importOptions));

      const response = await api.post('/jobs/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response;
    } catch (error) {
      console.error('작업 가져오기 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 템플릿 생성
   * @param {Object} templateData - 템플릿 데이터
   * @returns {Promise} API 응답
   */
  async createJobTemplate(templateData) {
    try {
      const response = await api.post('/jobs/template', templateData);
      return response;
    } catch (error) {
      console.error('작업 템플릿 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 검색
   * @param {Object} searchCriteria - 검색 조건
   * @returns {Promise} API 응답
   */
  async searchJobs(searchCriteria) {
    try {
      const response = await api.post('/jobs/search', searchCriteria);
      return response;
    } catch (error) {
      console.error('작업 검색 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 스케줄 검증
   * @param {Object} scheduleConfig - 스케줄 설정
   * @returns {Promise} API 응답
   */
  async validateSchedule(scheduleConfig) {
    try {
      const response = await api.post('/jobs/validate-schedule', { scheduleConfig });
      return response;
    } catch (error) {
      console.error('스케줄 검증 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 종속성 분석
   * @param {string} id - 작업 ID
   * @returns {Promise} API 응답
   */
  async analyzeDependencies(id) {
    try {
      const response = await api.get(`/jobs/${id}/dependencies`);
      return response;
    } catch (error) {
      console.error('작업 종속성 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 성능 분석
   * @param {string} id - 작업 ID
   * @param {string} period - 분석 기간
   * @returns {Promise} API 응답
   */
  async analyzePerformance(id, period = '30d') {
    try {
      const response = await api.get(`/jobs/${id}/performance`, { params: { period } });
      return response;
    } catch (error) {
      console.error('작업 성능 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 최적화 제안
   * @param {string} id - 작업 ID
   * @returns {Promise} API 응답
   */
  async getOptimizationSuggestions(id) {
    try {
      const response = await api.get(`/jobs/${id}/optimize`);
      return response;
    } catch (error) {
      console.error('작업 최적화 제안 실패:', error);
      throw error;
    }
  }

  /**
   * 일괄 작업 실행
   * @param {Array} jobIds - 작업 ID 배열
   * @param {Object} parameters - 실행 파라미터
   * @returns {Promise} API 응답
   */
  async executeBatchJobs(jobIds, parameters = {}) {
    try {
      const response = await api.post('/jobs/batch/execute', { jobIds, parameters });
      return response;
    } catch (error) {
      console.error('일괄 작업 실행 실패:', error);
      throw error;
    }
  }

  /**
   * 일괄 작업 상태 변경
   * @param {Array} jobIds - 작업 ID 배열
   * @param {boolean} isActive - 활성화 여부
   * @returns {Promise} API 응답
   */
  async updateBatchJobStatus(jobIds, isActive) {
    try {
      const response = await api.patch('/jobs/batch/status', { jobIds, isActive });
      return response;
    } catch (error) {
      console.error('일괄 작업 상태 변경 실패:', error);
      throw error;
    }
  }

  /**
   * 일괄 작업 삭제
   * @param {Array} jobIds - 작업 ID 배열
   * @returns {Promise} API 응답
   */
  async deleteBatchJobs(jobIds) {
    try {
      const response = await api.delete('/jobs/batch', { data: { jobIds } });
      return response;
    } catch (error) {
      console.error('일괄 작업 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 태그 관리
   * @param {string} id - 작업 ID
   * @param {Array} tags - 태그 배열
   * @returns {Promise} API 응답
   */
  async updateJobTags(id, tags) {
    try {
      const response = await api.patch(`/jobs/${id}/tags`, { tags });
      return response;
    } catch (error) {
      console.error('작업 태그 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 알림 설정
   * @param {string} id - 작업 ID
   * @param {Object} notificationConfig - 알림 설정
   * @returns {Promise} API 응답
   */
  async updateJobNotifications(id, notificationConfig) {
    try {
      const response = await api.patch(`/jobs/${id}/notifications`, { notificationConfig });
      return response;
    } catch (error) {
      console.error('작업 알림 설정 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 백업
   * @param {string} id - 작업 ID
   * @returns {Promise} API 응답
   */
  async backupJob(id) {
    try {
      const response = await api.post(`/jobs/${id}/backup`);
      return response;
    } catch (error) {
      console.error('작업 백업 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 복원
   * @param {string} id - 작업 ID
   * @param {string} backupId - 백업 ID
   * @returns {Promise} API 응답
   */
  async restoreJob(id, backupId) {
    try {
      const response = await api.post(`/jobs/${id}/restore`, { backupId });
      return response;
    } catch (error) {
      console.error('작업 복원 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 모니터링 메트릭
   * @param {string} id - 작업 ID
   * @param {Object} params - 메트릭 파라미터
   * @returns {Promise} API 응답
   */
  async getJobMetrics(id, params = {}) {
    try {
      const response = await api.get(`/jobs/${id}/metrics`, { params });
      return response;
    } catch (error) {
      console.error('작업 메트릭 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 실시간 작업 상태 조회
   * @param {Array} jobIds - 작업 ID 배열
   * @returns {Promise} API 응답
   */
  async getRealTimeStatus(jobIds) {
    try {
      const response = await api.post('/jobs/status', { jobIds });
      return response;
    } catch (error) {
      console.error('실시간 작업 상태 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 로그 조회
   * @param {string} executionId - 실행 ID
   * @param {Object} params - 로그 파라미터
   * @returns {Promise} API 응답
   */
  async getExecutionLogs(executionId, params = {}) {
    try {
      const response = await api.get(`/jobs/executions/${executionId}/logs`, { params });
      return response;
    } catch (error) {
      console.error('실행 로그 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 구성 유효성 검증
   * @param {Object} jobConfig - 작업 구성
   * @returns {Promise} API 응답
   */
  async validateJobConfig(jobConfig) {
    try {
      const response = await api.post('/jobs/validate', jobConfig);
      return response;
    } catch (error) {
      console.error('작업 구성 검증 실패:', error);
      throw error;
    }
  }

  /**
   * 작업 실행 계획 조회
   * @param {string} id - 작업 ID
   * @param {Object} params - 계획 파라미터
   * @returns {Promise} API 응답
   */
  async getExecutionPlan(id, params = {}) {
    try {
      const response = await api.get(`/jobs/${id}/execution-plan`, { params });
      return response;
    } catch (error) {
      console.error('작업 실행 계획 조회 실패:', error);
      throw error;
    }
  }
}

export const jobService = new JobService();
export default jobService;