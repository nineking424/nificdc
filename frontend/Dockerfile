# Frontend Dockerfile - Vue.js SPA
FROM node:18-alpine AS builder

WORKDIR /app

# 의존성 먼저 복사하여 캐시 활용
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사 및 빌드
COPY . .
RUN npm run build

# Production 이미지
FROM nginx:alpine

# Nginx 설정
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]