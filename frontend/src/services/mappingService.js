import api from '@/services/api';

class MappingService {
  /**
   * 매핑 목록 조회
   * @param {Object} params - 쿼리 파라미터
   * @returns {Promise} API 응답
   */
  async getMappings(params = {}) {
    try {
      const response = await api.get('/mappings', { params });
      return response;
    } catch (error) {
      console.error('매핑 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 상세 조회
   * @param {string} id - 매핑 ID
   * @param {Object} params - 쿼리 파라미터
   * @returns {Promise} API 응답
   */
  async getMapping(id, params = {}) {
    try {
      const response = await api.get(`/mappings/${id}`, { params });
      return response;
    } catch (error) {
      console.error('매핑 상세 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 생성
   * @param {Object} mappingData - 매핑 데이터
   * @returns {Promise} API 응답
   */
  async createMapping(mappingData) {
    try {
      const response = await api.post('/mappings', mappingData);
      return response;
    } catch (error) {
      console.error('매핑 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 수정
   * @param {string} id - 매핑 ID
   * @param {Object} mappingData - 매핑 데이터
   * @returns {Promise} API 응답
   */
  async updateMapping(id, mappingData) {
    try {
      const response = await api.put(`/mappings/${id}`, mappingData);
      return response;
    } catch (error) {
      console.error('매핑 수정 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 삭제
   * @param {string} id - 매핑 ID
   * @returns {Promise} API 응답
   */
  async deleteMapping(id) {
    try {
      const response = await api.delete(`/mappings/${id}`);
      return response;
    } catch (error) {
      console.error('매핑 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 미리보기
   * @param {string} id - 매핑 ID
   * @param {Object} previewData - 미리보기 데이터
   * @returns {Promise} API 응답
   */
  async previewMapping(id, previewData) {
    try {
      const response = await api.post(`/mappings/${id}/preview`, previewData);
      return response;
    } catch (error) {
      console.error('매핑 미리보기 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 검증
   * @param {string} id - 매핑 ID
   * @returns {Promise} API 응답
   */
  async validateMapping(id) {
    try {
      const response = await api.post(`/mappings/${id}/validate`);
      return response;
    } catch (error) {
      console.error('매핑 검증 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 타입 목록 조회
   * @returns {Promise} API 응답
   */
  async getMappingTypes() {
    try {
      const response = await api.get('/mappings/meta/types');
      return response;
    } catch (error) {
      console.error('매핑 타입 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 통계 조회
   * @param {Object} params - 쿼리 파라미터
   * @returns {Promise} API 응답
   */
  async getMappingStats(params = {}) {
    try {
      const response = await api.get('/mappings/stats', { params });
      return response;
    } catch (error) {
      console.error('매핑 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 변환 함수 목록 조회
   * @returns {Promise} API 응답
   */
  async getTransformFunctions() {
    try {
      // Transform utils에서 사용 가능한 함수들을 반환
      const functions = [
        // 문자열 변환 함수
        { name: 'toUpperCase', label: '대문자 변환', category: 'string' },
        { name: 'toLowerCase', label: '소문자 변환', category: 'string' },
        { name: 'capitalize', label: '첫 글자 대문자', category: 'string' },
        { name: 'trim', label: '공백 제거', category: 'string' },
        { name: 'removeChars', label: '특정 문자 제거', category: 'string' },
        { name: 'replace', label: '문자열 치환', category: 'string' },
        { name: 'padLeft', label: '왼쪽 패딩', category: 'string' },
        { name: 'padRight', label: '오른쪽 패딩', category: 'string' },
        { name: 'substring', label: '문자열 자르기', category: 'string' },
        
        // 숫자 변환 함수
        { name: 'toInteger', label: '정수 변환', category: 'number' },
        { name: 'toFloat', label: '실수 변환', category: 'number' },
        { name: 'toString', label: '문자열 변환', category: 'number' },
        { name: 'round', label: '반올림', category: 'number' },
        { name: 'ceil', label: '올림', category: 'number' },
        { name: 'floor', label: '내림', category: 'number' },
        { name: 'abs', label: '절댓값', category: 'number' },
        
        // 날짜 변환 함수
        { name: 'toDate', label: '날짜 변환', category: 'date' },
        { name: 'formatDate', label: '날짜 포맷팅', category: 'date' },
        { name: 'now', label: '현재 날짜/시간', category: 'date' },
        { name: 'addDays', label: '날짜 더하기', category: 'date' },
        { name: 'dateDiff', label: '날짜 차이', category: 'date' },
        
        // 논리 변환 함수
        { name: 'toBoolean', label: '불린 변환', category: 'boolean' },
        { name: 'ifElse', label: '조건부 값', category: 'boolean' },
        { name: 'defaultValue', label: '기본값', category: 'boolean' },
        
        // 배열 변환 함수
        { name: 'arrayElement', label: '배열 요소 추출', category: 'array' },
        { name: 'arrayLength', label: '배열 길이', category: 'array' },
        { name: 'arrayJoin', label: '배열 합치기', category: 'array' },
        { name: 'split', label: '문자열 분할', category: 'array' },
        
        // 인코딩/디코딩 함수
        { name: 'base64Encode', label: 'Base64 인코딩', category: 'encoding' },
        { name: 'base64Decode', label: 'Base64 디코딩', category: 'encoding' },
        { name: 'urlEncode', label: 'URL 인코딩', category: 'encoding' },
        { name: 'urlDecode', label: 'URL 디코딩', category: 'encoding' },
        
        // 해시 함수
        { name: 'md5', label: 'MD5 해시', category: 'hash' },
        { name: 'sha1', label: 'SHA1 해시', category: 'hash' },
        { name: 'sha256', label: 'SHA256 해시', category: 'hash' },
        
        // 유효성 검사 함수
        { name: 'isEmail', label: '이메일 검증', category: 'validation' },
        { name: 'isPhoneNumber', label: '전화번호 검증', category: 'validation' },
        { name: 'isNumeric', label: '숫자 검증', category: 'validation' },
        { name: 'isDate', label: '날짜 검증', category: 'validation' },
        
        // 고급 변환 함수
        { name: 'regexMatch', label: '정규식 매칭', category: 'advanced' },
        { name: 'regexReplace', label: '정규식 치환', category: 'advanced' },
        { name: 'parseJSON', label: 'JSON 파싱', category: 'advanced' },
        { name: 'stringifyJSON', label: 'JSON 문자열화', category: 'advanced' },
        { name: 'generateUUID', label: '고유 ID 생성', category: 'advanced' },
        { name: 'randomString', label: '랜덤 문자열', category: 'advanced' },
        
        // 한국어 특화 함수
        { name: 'separateKorean', label: '한글 자모 분리', category: 'korean' },
        { name: 'getKoreanChosung', label: '한글 초성 추출', category: 'korean' }
      ];
      
      return { data: { functions } };
    } catch (error) {
      console.error('변환 함수 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 템플릿 생성
   * @param {Object} templateData - 템플릿 데이터
   * @returns {Promise} API 응답
   */
  async createMappingTemplate(templateData) {
    try {
      const response = await api.post('/mappings/template', templateData);
      return response;
    } catch (error) {
      console.error('매핑 템플릿 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 복사
   * @param {string} id - 매핑 ID
   * @param {Object} copyData - 복사 데이터
   * @returns {Promise} API 응답
   */
  async copyMapping(id, copyData) {
    try {
      const response = await api.post(`/mappings/${id}/copy`, copyData);
      return response;
    } catch (error) {
      console.error('매핑 복사 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 내보내기
   * @param {string} id - 매핑 ID
   * @param {string} format - 내보내기 형식 (json, xml, csv)
   * @returns {Promise} API 응답
   */
  async exportMapping(id, format = 'json') {
    try {
      const response = await api.get(`/mappings/${id}/export`, {
        params: { format },
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      console.error('매핑 내보내기 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 가져오기
   * @param {File} file - 가져올 파일
   * @param {Object} importOptions - 가져오기 옵션
   * @returns {Promise} API 응답
   */
  async importMapping(file, importOptions = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify(importOptions));

      const response = await api.post('/mappings/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response;
    } catch (error) {
      console.error('매핑 가져오기 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 실행
   * @param {string} id - 매핑 ID
   * @param {Object} executionData - 실행 데이터
   * @returns {Promise} API 응답
   */
  async executeMapping(id, executionData) {
    try {
      const response = await api.post(`/mappings/${id}/execute`, executionData);
      return response;
    } catch (error) {
      console.error('매핑 실행 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 실행 이력 조회
   * @param {string} id - 매핑 ID
   * @param {Object} params - 쿼리 파라미터
   * @returns {Promise} API 응답
   */
  async getMappingExecutionHistory(id, params = {}) {
    try {
      const response = await api.get(`/mappings/${id}/executions`, { params });
      return response;
    } catch (error) {
      console.error('매핑 실행 이력 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 버전 목록 조회
   * @param {string} parentId - 부모 매핑 ID
   * @returns {Promise} API 응답
   */
  async getMappingVersions(parentId) {
    try {
      const response = await api.get(`/mappings/${parentId}/versions`);
      return response;
    } catch (error) {
      console.error('매핑 버전 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 버전 비교
   * @param {string} sourceId - 소스 매핑 ID
   * @param {string} targetId - 타겟 매핑 ID
   * @returns {Promise} API 응답
   */
  async compareMappingVersions(sourceId, targetId) {
    try {
      const response = await api.get(`/mappings/${sourceId}/compare/${targetId}`);
      return response;
    } catch (error) {
      console.error('매핑 버전 비교 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 성능 분석
   * @param {string} id - 매핑 ID
   * @returns {Promise} API 응답
   */
  async analyzeMappingPerformance(id) {
    try {
      const response = await api.get(`/mappings/${id}/performance`);
      return response;
    } catch (error) {
      console.error('매핑 성능 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 최적화 제안
   * @param {string} id - 매핑 ID
   * @returns {Promise} API 응답
   */
  async getMappingOptimizationSuggestions(id) {
    try {
      const response = await api.get(`/mappings/${id}/optimize`);
      return response;
    } catch (error) {
      console.error('매핑 최적화 제안 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 활성화/비활성화
   * @param {string} id - 매핑 ID
   * @param {boolean} isActive - 활성화 여부
   * @returns {Promise} API 응답
   */
  async toggleMappingStatus(id, isActive) {
    try {
      const response = await api.patch(`/mappings/${id}/status`, { isActive });
      return response;
    } catch (error) {
      console.error('매핑 상태 변경 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 태그 관리
   * @param {string} id - 매핑 ID
   * @param {Array} tags - 태그 배열
   * @returns {Promise} API 응답
   */
  async updateMappingTags(id, tags) {
    try {
      const response = await api.patch(`/mappings/${id}/tags`, { tags });
      return response;
    } catch (error) {
      console.error('매핑 태그 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 검색
   * @param {Object} searchCriteria - 검색 조건
   * @returns {Promise} API 응답
   */
  async searchMappings(searchCriteria) {
    try {
      const response = await api.post('/mappings/search', searchCriteria);
      return response;
    } catch (error) {
      console.error('매핑 검색 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 종속성 분석
   * @param {string} id - 매핑 ID
   * @returns {Promise} API 응답
   */
  async analyzeMappingDependencies(id) {
    try {
      const response = await api.get(`/mappings/${id}/dependencies`);
      return response;
    } catch (error) {
      console.error('매핑 종속성 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 매핑 영향 분석
   * @param {string} id - 매핑 ID
   * @returns {Promise} API 응답
   */
  async analyzeMappingImpact(id) {
    try {
      const response = await api.get(`/mappings/${id}/impact`);
      return response;
    } catch (error) {
      console.error('매핑 영향 분석 실패:', error);
      throw error;
    }
  }
}

export const mappingService = new MappingService();
export default mappingService;