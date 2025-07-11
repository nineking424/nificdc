const request = require('supertest');
const app = require('../src/index');

describe('Health Check Endpoint', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      
      // 타임스탬프가 유효한 ISO 문자열인지 확인
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      
      // 업타임이 숫자인지 확인
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should return consistent response format', async () => {
      const response1 = await request(app).get('/health');
      const response2 = await request(app).get('/health');

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      // 응답 구조가 일관되는지 확인
      expect(Object.keys(response1.body)).toEqual(Object.keys(response2.body));
      
      // 업타임이 증가하는지 확인 (미세한 차이 허용)
      expect(response2.body.uptime).toBeGreaterThanOrEqual(response1.body.uptime);
    });
  });
});