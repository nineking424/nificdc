import api from '@/services/api';

class MonitoringService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000;
    this.isConnected = false;
    this.listeners = new Map();
    this.subscriptions = {};
  }

  /**
   * WebSocket 연결 설정
   * @param {string} token - 인증 토큰
   */
  connect(token) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/monitoring?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('모니터링 WebSocket 연결 성공');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // 구독 설정 전송
      if (Object.keys(this.subscriptions).length > 0) {
        this.send('subscribe', this.subscriptions);
      }
      
      this.notifyListeners('connected', { connected: true });
    };
    
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('WebSocket 메시지 파싱 오류:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('모니터링 WebSocket 연결 종료');
      this.isConnected = false;
      this.notifyListeners('disconnected', { connected: false });
      
      // 재연결 시도
      this.attemptReconnect(token);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket 오류:', error);
      this.notifyListeners('error', { error });
    };
  }

  /**
   * 재연결 시도
   * @param {string} token - 인증 토큰
   */
  attemptReconnect(token) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('최대 재연결 시도 횟수 초과');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      this.connect(token);
    }, this.reconnectInterval);
  }

  /**
   * WebSocket 메시지 처리
   * @param {Object} message - 수신된 메시지
   */
  handleMessage(message) {
    const { type, data, timestamp } = message;
    
    switch (type) {
      case 'initial_state':
        this.notifyListeners('initialState', data);
        break;
        
      case 'metrics':
        this.notifyListeners('metrics', data);
        break;
        
      case 'health':
        this.notifyListeners('health', data);
        break;
        
      case 'event':
        this.notifyListeners('event', { eventType: message.eventType, data });
        break;
        
      case 'job_details':
        this.notifyListeners('jobDetails', data);
        break;
        
      case 'execution_logs':
        this.notifyListeners('executionLogs', data);
        break;
        
      case 'pong':
        this.notifyListeners('pong', { timestamp });
        break;
        
      default:
        console.warn('알 수 없는 메시지 타입:', type);
    }
  }

  /**
   * 메시지 전송
   * @param {string} type - 메시지 타입
   * @param {Object} data - 전송할 데이터
   */
  send(type, data = {}) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket이 연결되지 않아 메시지를 전송할 수 없습니다.');
    }
  }

  /**
   * 구독 설정
   * @param {Object} subscriptions - 구독 정보
   */
  subscribe(subscriptions) {
    this.subscriptions = { ...this.subscriptions, ...subscriptions };
    if (this.isConnected) {
      this.send('subscribe', this.subscriptions);
    }
  }

  /**
   * 작업 상세 정보 요청
   * @param {string} jobId - 작업 ID
   */
  getJobDetails(jobId) {
    this.send('get_job_details', { jobId });
  }

  /**
   * 실행 로그 요청
   * @param {string} executionId - 실행 ID
   */
  getExecutionLogs(executionId) {
    this.send('get_execution_logs', { executionId });
  }

  /**
   * 핑 전송
   */
  ping() {
    this.send('ping');
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} event - 이벤트 타입
   * @param {Function} callback - 콜백 함수
   */
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 이벤트 리스너 제거
   * @param {string} event - 이벤트 타입
   * @param {Function} callback - 콜백 함수
   */
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 리스너들에게 이벤트 알림
   * @param {string} event - 이벤트 타입
   * @param {Object} data - 이벤트 데이터
   */
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('이벤트 리스너 오류:', error);
        }
      });
    }
  }

  /**
   * 연결 종료
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  // REST API 메서드들

  /**
   * 실시간 메트릭 조회
   * @returns {Promise} API 응답
   */
  async getMetrics() {
    try {
      const response = await api.get('/monitoring/metrics');
      return response;
    } catch (error) {
      console.error('실시간 메트릭 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 시스템 상태 조회
   * @returns {Promise} API 응답
   */
  async getHealth() {
    try {
      const response = await api.get('/monitoring/health');
      return response;
    } catch (error) {
      console.error('시스템 상태 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 최근 실행 내역 조회
   * @param {number} limit - 조회 개수
   * @returns {Promise} API 응답
   */
  async getRecentExecutions(limit = 50) {
    try {
      const response = await api.get('/monitoring/recent-executions', { 
        params: { limit } 
      });
      return response;
    } catch (error) {
      console.error('최근 실행 내역 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 시스템 통계 조회
   * @returns {Promise} API 응답
   */
  async getSystemStats() {
    try {
      const response = await api.get('/monitoring/system-stats');
      return response;
    } catch (error) {
      console.error('시스템 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 상위 성능 작업 조회
   * @param {number} limit - 조회 개수
   * @returns {Promise} API 응답
   */
  async getTopJobs(limit = 10) {
    try {
      const response = await api.get('/monitoring/top-jobs', { 
        params: { limit } 
      });
      return response;
    } catch (error) {
      console.error('상위 성능 작업 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 시간대별 실행 통계 조회
   * @param {number} hours - 조회 시간 (시간)
   * @returns {Promise} API 응답
   */
  async getHourlyStats(hours = 24) {
    try {
      const response = await api.get('/monitoring/hourly-stats', { 
        params: { hours } 
      });
      return response;
    } catch (error) {
      console.error('시간대별 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 전체 대시보드 데이터 조회
   * @returns {Promise} API 응답
   */
  async getDashboard() {
    try {
      const response = await api.get('/monitoring/dashboard');
      return response;
    } catch (error) {
      console.error('대시보드 데이터 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 이벤트 브로드캐스트
   * @param {string} eventType - 이벤트 타입
   * @param {Object} data - 이벤트 데이터
   * @returns {Promise} API 응답
   */
  async broadcastEvent(eventType, data) {
    try {
      const response = await api.post('/monitoring/broadcast', {
        eventType,
        data
      });
      return response;
    } catch (error) {
      console.error('이벤트 브로드캐스트 실패:', error);
      throw error;
    }
  }

  /**
   * 모니터링 서비스 상태 조회
   * @returns {Promise} API 응답
   */
  async getServiceStatus() {
    try {
      const response = await api.get('/monitoring/service-status');
      return response;
    } catch (error) {
      console.error('모니터링 서비스 상태 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 알림 설정 조회
   * @returns {Promise} API 응답
   */
  async getAlerts() {
    try {
      const response = await api.get('/monitoring/alerts');
      return response;
    } catch (error) {
      console.error('알림 설정 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 알림 설정 업데이트
   * @param {Object} alertConfig - 알림 설정
   * @returns {Promise} API 응답
   */
  async updateAlerts(alertConfig) {
    try {
      const response = await api.put('/monitoring/alerts', alertConfig);
      return response;
    } catch (error) {
      console.error('알림 설정 업데이트 실패:', error);
      throw error;
    }
  }

  /**
   * 성능 리포트 생성
   * @param {Object} reportConfig - 리포트 설정
   * @returns {Promise} API 응답
   */
  async generatePerformanceReport(reportConfig) {
    try {
      const response = await api.post('/monitoring/performance-report', reportConfig);
      return response;
    } catch (error) {
      console.error('성능 리포트 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 연결 상태 확인
   * @returns {boolean} 연결 상태
   */
  isConnectedToWebSocket() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 연결된 클라이언트 수 조회
   * @returns {Promise<number>} 연결된 클라이언트 수
   */
  async getConnectedClientsCount() {
    try {
      const response = await this.getServiceStatus();
      return response.data.connectedClients;
    } catch (error) {
      console.error('연결된 클라이언트 수 조회 실패:', error);
      return 0;
    }
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;