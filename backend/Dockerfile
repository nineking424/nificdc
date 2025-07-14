# Backend Dockerfile - Node.js RESTful API
FROM node:18-alpine

WORKDIR /app

# 의존성 먼저 복사하여 캐시 활용
COPY package*.json ./
RUN npm ci --omit=dev

# 소스 코드 복사
COPY . .

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1

# 애플리케이션 실행
CMD ["node", "src/index.js"]