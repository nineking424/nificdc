<template>
  <AppLayout>
    <v-container fluid class="pa-6">
      <!-- 대시보드 헤더 정보 -->
      <v-row class="mb-6">
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center">
            <div>
              <p class="text-subtitle-1 text-medium-emphasis mb-2">
                실시간 시스템 상태와 성능 지표를 모니터링합니다
              </p>
              <div class="text-body-2">
                <span class="font-weight-medium text-primary">안녕하세요, {{ userName }}!</span>
                <span class="text-medium-emphasis ml-3">마지막 업데이트: {{ lastUpdated }}</span>
              </div>
            </div>
            <div class="d-flex gap-2">
              <v-btn color="primary" prepend-icon="mdi-refresh" @click="refreshDashboard">
                새로고침
              </v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-cog" @click="openSettings">
                설정
              </v-btn>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- 시스템 상태 카드 -->
      <v-row class="mb-6">
        <v-col cols="12">
          <h2 class="text-h5 font-weight-bold mb-4">시스템 상태</h2>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-card class="pa-4" elevation="2">
            <div class="d-flex align-center mb-3">
              <v-avatar color="success" size="48">
                <v-icon color="white">mdi-server</v-icon>
              </v-avatar>
              <div class="ml-4">
                <div class="text-h6 font-weight-bold">Backend API</div>
                <v-chip color="success" size="small" variant="tonal">정상 운영</v-chip>
              </div>
            </div>
            <v-divider class="mb-3"></v-divider>
            <div class="d-flex justify-space-between">
              <div>
                <div class="text-h5 font-weight-bold">99.9%</div>
                <div class="text-caption text-medium-emphasis">Uptime</div>
              </div>
              <div>
                <div class="text-h5 font-weight-bold">45ms</div>
                <div class="text-caption text-medium-emphasis">응답시간</div>
              </div>
            </div>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card class="pa-4" elevation="2">
            <div class="d-flex align-center mb-3">
              <v-avatar color="info" size="48">
                <v-icon color="white">mdi-database</v-icon>
              </v-avatar>
              <div class="ml-4">
                <div class="text-h6 font-weight-bold">Database</div>
                <v-chip color="success" size="small" variant="tonal">연결됨</v-chip>
              </div>
            </div>
            <v-divider class="mb-3"></v-divider>
            <div class="d-flex justify-space-between">
              <div>
                <div class="text-h5 font-weight-bold">1,234</div>
                <div class="text-caption text-medium-emphasis">쿼리/초</div>
              </div>
              <div>
                <div class="text-h5 font-weight-bold">25ms</div>
                <div class="text-caption text-medium-emphasis">지연시간</div>
              </div>
            </div>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card class="pa-4" elevation="2">
            <div class="d-flex align-center mb-3">
              <v-avatar color="primary" size="48">
                <v-icon color="white">mdi-memory</v-icon>
              </v-avatar>
              <div class="ml-4">
                <div class="text-h6 font-weight-bold">Redis Cache</div>
                <v-chip color="success" size="small" variant="tonal">캐시 활성</v-chip>
              </div>
            </div>
            <v-divider class="mb-3"></v-divider>
            <div class="d-flex justify-space-between">
              <div>
                <div class="text-h5 font-weight-bold">78%</div>
                <div class="text-caption text-medium-emphasis">사용률</div>
              </div>
              <div>
                <div class="text-h5 font-weight-bold">15K</div>
                <div class="text-caption text-medium-emphasis">키 수</div>
              </div>
            </div>
          </v-card>
        </v-col>
        
        <v-col cols="12" sm="6" md="3">
          <v-card class="pa-4" elevation="2">
            <div class="d-flex align-center mb-3">
              <v-avatar color="warning" size="48">
                <v-icon color="white">mdi-apache</v-icon>
              </v-avatar>
              <div class="ml-4">
                <div class="text-h6 font-weight-bold">Apache NiFi</div>
                <v-chip color="warning" size="small" variant="tonal">설정 필요</v-chip>
              </div>
            </div>
            <v-divider class="mb-3"></v-divider>
            <div class="d-flex justify-space-between">
              <div>
                <div class="text-h5 font-weight-bold">0</div>
                <div class="text-caption text-medium-emphasis">플로우</div>
              </div>
              <div>
                <div class="text-h5 font-weight-bold">-</div>
                <div class="text-caption text-medium-emphasis">상태</div>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- 메인 콘텐츠 영역 -->
      <v-row>
        <!-- 성능 차트 -->
        <v-col cols="12" md="8">
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
              <div class="d-flex align-center">
                <v-icon class="mr-2">mdi-chart-line</v-icon>
                시스템 성능
              </div>
              <v-btn-toggle
                v-model="timeFilter"
                variant="outlined"
                density="compact"
                mandatory
              >
                <v-btn value="1h">1시간</v-btn>
                <v-btn value="24h">24시간</v-btn>
                <v-btn value="7d">7일</v-btn>
              </v-btn-toggle>
            </v-card-title>
            <v-card-text>
              <div class="text-center py-8">
                <v-icon size="60" color="grey-300">mdi-chart-line</v-icon>
                <p class="text-h6 mt-4 mb-2">성능 모니터링</p>
                <p class="text-body-2 text-medium-emphasis">
                  실시간 모니터링 차트는 개발 중입니다.
                </p>
                <div class="mt-4">
                  <v-chip-group>
                    <v-chip size="small">CPU</v-chip>
                    <v-chip size="small">Memory</v-chip>
                    <v-chip size="small">Network</v-chip>
                    <v-chip size="small">Disk I/O</v-chip>
                  </v-chip-group>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 사이드바 콘텐츠 -->
        <v-col cols="12" md="4">
          <!-- 최근 알림 -->
          <v-card class="mb-4">
            <v-card-title class="d-flex justify-space-between align-center">
              <span>최근 알림</span>
              <v-btn size="small" variant="text">모두 보기</v-btn>
            </v-card-title>
            <v-list density="comfortable">
              <v-list-item>
                <template v-slot:prepend>
                  <v-icon color="success">mdi-check-circle</v-icon>
                </template>
                <v-list-item-title>시스템 정상 가동</v-list-item-title>
                <v-list-item-subtitle>방금 전</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template v-slot:prepend>
                  <v-icon color="info">mdi-database</v-icon>
                </template>
                <v-list-item-title>데이터베이스 연결 성공</v-list-item-title>
                <v-list-item-subtitle>5분 전</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template v-slot:prepend>
                  <v-icon color="warning">mdi-alert</v-icon>
                </template>
                <v-list-item-title>NiFi 설정 필요</v-list-item-title>
                <v-list-item-subtitle>1시간 전</v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template v-slot:prepend>
                  <v-icon color="success">mdi-sync</v-icon>
                </template>
                <v-list-item-title>데이터 동기화 완료</v-list-item-title>
                <v-list-item-subtitle>2시간 전</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <!-- 빠른 작업 -->
          <v-card>
            <v-card-title>빠른 작업</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="6">
                  <v-btn block variant="outlined" color="primary" size="small">
                    <v-icon>mdi-plus</v-icon>
                    <span class="d-none d-sm-inline ml-1">시스템 추가</span>
                  </v-btn>
                </v-col>
                <v-col cols="6">
                  <v-btn block variant="outlined" color="primary" size="small">
                    <v-icon>mdi-shuffle-variant</v-icon>
                    <span class="d-none d-sm-inline ml-1">매핑 생성</span>
                  </v-btn>
                </v-col>
                <v-col cols="6">
                  <v-btn block variant="outlined" color="primary" size="small">
                    <v-icon>mdi-play</v-icon>
                    <span class="d-none d-sm-inline ml-1">작업 실행</span>
                  </v-btn>
                </v-col>
                <v-col cols="6">
                  <v-btn block variant="outlined" color="primary" size="small">
                    <v-icon>mdi-chart-line</v-icon>
                    <span class="d-none d-sm-inline ml-1">모니터링</span>
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 빠른 시작 가이드 -->
      <v-row class="mt-6">
        <v-col cols="12">
          <h2 class="text-h5 font-weight-bold mb-4">빠른 시작 가이드</h2>
          <p class="text-body-1 text-medium-emphasis mb-4">단계별로 따라하며 NiFiCDC를 시작하세요</p>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="pa-4 h-100">
            <div class="d-flex align-center mb-3">
              <v-avatar color="primary" size="40" class="mr-3">
                <span class="text-h6">1</span>
              </v-avatar>
              <div>
                <h3 class="text-h6">시스템 연결</h3>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  데이터베이스와 외부 시스템을 연결하여 데이터 소스를 설정합니다.
                </p>
              </div>
            </div>
            <v-chip-group>
              <v-chip size="x-small" variant="tonal">다중 DB 지원</v-chip>
              <v-chip size="x-small" variant="tonal">실시간 테스트</v-chip>
              <v-chip size="x-small" variant="tonal">암호화 연결</v-chip>
            </v-chip-group>
            <v-btn block variant="outlined" color="primary" class="mt-3" size="small">
              시작하기
            </v-btn>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="pa-4 h-100">
            <div class="d-flex align-center mb-3">
              <v-avatar color="primary" size="40" class="mr-3">
                <span class="text-h6">2</span>
              </v-avatar>
              <div>
                <h3 class="text-h6">매핑 설정</h3>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  데이터 변환 규칙을 정의하고 스키마 매핑을 설정합니다.
                </p>
              </div>
            </div>
            <v-chip-group>
              <v-chip size="x-small" variant="tonal">드래그 & 드롭</v-chip>
              <v-chip size="x-small" variant="tonal">자동 매핑</v-chip>
              <v-chip size="x-small" variant="tonal">구조 변환</v-chip>
            </v-chip-group>
            <v-btn block variant="outlined" color="primary" class="mt-3" size="small">
              시작하기
            </v-btn>
          </v-card>
        </v-col>
        
        <v-col cols="12" md="4">
          <v-card class="pa-4 h-100">
            <div class="d-flex align-center mb-3">
              <v-avatar color="primary" size="40" class="mr-3">
                <span class="text-h6">3</span>
              </v-avatar>
              <div>
                <h3 class="text-h6">작업 실행</h3>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  데이터 동기화 작업을 생성하고 스케줄링을 설정합니다.
                </p>
              </div>
            </div>
            <v-chip-group>
              <v-chip size="x-small" variant="tonal">자동 스케줄</v-chip>
              <v-chip size="x-small" variant="tonal">실시간 모니터링</v-chip>
              <v-chip size="x-small" variant="tonal">오류 복구</v-chip>
            </v-chip-group>
            <v-btn block variant="outlined" color="primary" class="mt-3" size="small">
              시작하기
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </AppLayout>
</template>

<script>
import AppLayout from '@/components/AppLayout.vue'
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default {
  name: 'Dashboard',
  components: {
    AppLayout
  },
  setup() {
    const authStore = useAuthStore()
    const toast = useToast()
    
    // 반응형 데이터
    const timeFilter = ref('1h')
    
    // 컴퓨티드 속성
    const userName = computed(() => authStore.userName || '사용자')
    const lastUpdated = computed(() => {
      return format(new Date(), 'yyyy. M. d. a h:mm:ss', { locale: ko })
    })
    
    // 메서드
    const refreshDashboard = () => {
      toast.success('대시보드가 새로고침되었습니다.')
    }
    
    const openSettings = () => {
      toast.info('설정 기능은 개발 중입니다.')
    }
    
    const setTimeFilter = (filter) => {
      timeFilter.value = filter
    }
    
    // 라이프사이클
    onMounted(() => {
      console.log('Dashboard mounted')
    })
    
    return {
      userName,
      lastUpdated,
      timeFilter,
      refreshDashboard,
      openSettings,
      setTimeFilter
    }
  }
}
</script>

<style scoped>
.h-100 {
  height: 100%;
}

.gap-2 {
  gap: 0.5rem;
}

/* 카드 호버 효과 */
.v-card {
  transition: all 0.2s ease;
}

.v-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>