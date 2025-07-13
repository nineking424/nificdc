<template>
  <v-container fluid class="pa-0">
    <!-- 헤더 섹션 -->
    <v-app-bar color="primary" dark elevation="4">
      <v-toolbar-title class="text-h4 font-weight-bold">
        NiFiCDC
      </v-toolbar-title>
      
      <v-spacer />
      
      <v-btn icon="mdi-github" href="https://github.com/nineking424/nificdc" target="_blank" />
      
      <!-- 로그인/로그아웃 버튼 -->
      <v-btn 
        v-if="!isAuthenticated"
        variant="outlined" 
        color="white" 
        class="ml-4"
        @click="goToLogin"
      >
        로그인
      </v-btn>
      
      <v-menu v-else offset-y>
        <template #activator="{ props }">
          <v-btn
            variant="outlined"
            color="white"
            class="ml-4"
            v-bind="props"
          >
            <v-icon left>mdi-account</v-icon>
            {{ userName }}
          </v-btn>
        </template>
        
        <v-list>
          <v-list-item @click="goToDashboard">
            <v-list-item-title>
              <v-icon left>mdi-view-dashboard</v-icon>
              대시보드
            </v-list-item-title>
          </v-list-item>
          <v-divider />
          <v-list-item @click="logout">
            <v-list-item-title>
              <v-icon left>mdi-logout</v-icon>
              로그아웃
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- 메인 콘텐츠 -->
    <v-main>
      <!-- 히어로 섹션 -->
      <v-container fluid class="primary lighten-1 white--text py-16">
        <v-row justify="center" align="center" class="text-center">
          <v-col cols="12" md="8">
            <h1 class="text-h2 font-weight-bold mb-6">
              NiFiCDC Platform
            </h1>
            <p class="text-h5 mb-8 font-weight-light">
              Apache NiFi 기반의 실시간 데이터 변경 추적 및 동기화 플랫폼
            </p>
            <div class="d-flex justify-center gap-4 flex-wrap">
              <v-btn
                size="large"
                color="white"
                variant="outlined"
                prepend-icon="mdi-play"
                @click="navigateToPage('systems')"
              >
                시스템 관리
              </v-btn>
              <v-btn
                size="large"
                color="white"
                variant="outlined"
                prepend-icon="mdi-chart-line"
                @click="navigateToPage('monitoring')"
              >
                모니터링
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-container>

      <!-- 기능 소개 섹션 -->
      <v-container class="py-16">
        <v-row>
          <v-col cols="12" class="text-center mb-12">
            <h2 class="text-h3 font-weight-bold mb-4">
              주요 기능
            </h2>
            <p class="text-h6 grey--text">
              NiFiCDC가 제공하는 강력한 데이터 동기화 기능들을 확인해보세요
            </p>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="4" class="text-center">
            <v-card elevation="2" class="pa-6 h-100">
              <v-icon size="64" color="primary" class="mb-4">
                mdi-server-network
              </v-icon>
              <h3 class="text-h5 font-weight-bold mb-3">
                시스템 관리
              </h3>
              <p class="text-body-1">
                다양한 데이터베이스와 시스템을 연결하고 관리합니다.
                연결 테스트와 상태 모니터링을 제공합니다.
              </p>
              <v-btn 
                color="primary" 
                variant="text"
                @click="navigateToPage('systems')"
                class="mt-4"
              >
                자세히 보기
              </v-btn>
            </v-card>
          </v-col>

          <v-col cols="12" md="4" class="text-center">
            <v-card elevation="2" class="pa-6 h-100">
              <v-icon size="64" color="success" class="mb-4">
                mdi-shuffle-variant
              </v-icon>
              <h3 class="text-h5 font-weight-bold mb-3">
                매핑 관리
              </h3>
              <p class="text-body-1">
                데이터 변환 규칙을 시각적으로 설계하고 관리합니다.
                복잡한 데이터 매핑도 간단하게 처리할 수 있습니다.
              </p>
              <v-btn 
                color="success" 
                variant="text"
                @click="navigateToPage('mappings')"
                class="mt-4"
              >
                자세히 보기
              </v-btn>
            </v-card>
          </v-col>

          <v-col cols="12" md="4" class="text-center">
            <v-card elevation="2" class="pa-6 h-100">
              <v-icon size="64" color="info" class="mb-4">
                mdi-chart-timeline-variant
              </v-icon>
              <h3 class="text-h5 font-weight-bold mb-3">
                실시간 모니터링
              </h3>
              <p class="text-body-1">
                데이터 동기화 작업의 상태와 성능을 실시간으로 모니터링합니다.
                상세한 로그와 알림 기능을 제공합니다.
              </p>
              <v-btn 
                color="info" 
                variant="text"
                @click="navigateToPage('monitoring')"
                class="mt-4"
              >
                자세히 보기
              </v-btn>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- 아키텍처 섹션 -->
      <v-container fluid class="grey lighten-5 py-16">
        <v-container>
          <v-row>
            <v-col cols="12" class="text-center mb-8">
              <h2 class="text-h3 font-weight-bold mb-4">
                시스템 아키텍처
              </h2>
              <p class="text-h6 grey--text">
                안정적이고 확장 가능한 마이크로서비스 아키텍처
              </p>
            </v-col>
          </v-row>

          <v-row justify="center">
            <v-col cols="12" md="10">
              <v-card elevation="4" class="pa-8">
                <div class="d-flex justify-space-around align-center flex-wrap gap-4">
                  <div class="text-center">
                    <v-icon size="48" color="primary" class="mb-2">
                      mdi-vuejs
                    </v-icon>
                    <div class="font-weight-bold">Vue.js 3</div>
                    <div class="text-caption">Frontend</div>
                  </div>

                  <v-icon size="24" color="grey">mdi-arrow-right</v-icon>

                  <div class="text-center">
                    <v-icon size="48" color="success" class="mb-2">
                      mdi-nodejs
                    </v-icon>
                    <div class="font-weight-bold">Node.js</div>
                    <div class="text-caption">Backend API</div>
                  </div>

                  <v-icon size="24" color="grey">mdi-arrow-right</v-icon>

                  <div class="text-center">
                    <v-icon size="48" color="blue" class="mb-2">
                      mdi-database
                    </v-icon>
                    <div class="font-weight-bold">PostgreSQL</div>
                    <div class="text-caption">Database</div>
                  </div>

                  <v-icon size="24" color="grey">mdi-arrow-right</v-icon>

                  <div class="text-center">
                    <v-icon size="48" color="orange" class="mb-2">
                      mdi-apache
                    </v-icon>
                    <div class="font-weight-bold">Apache NiFi</div>
                    <div class="text-caption">Data Processing</div>
                  </div>
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-container>

      <!-- 상태 정보 섹션 -->
      <v-container class="py-16">
        <v-row>
          <v-col cols="12" class="text-center mb-8">
            <h2 class="text-h3 font-weight-bold mb-4">
              시스템 상태
            </h2>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" md="3" sm="6">
            <v-card color="success" dark class="text-center pa-4">
              <v-icon size="48" class="mb-2">mdi-check-circle</v-icon>
              <div class="text-h6 font-weight-bold">Frontend</div>
              <div class="text-caption">정상 운영</div>
            </v-card>
          </v-col>

          <v-col cols="12" md="3" sm="6">
            <v-card color="success" dark class="text-center pa-4">
              <v-icon size="48" class="mb-2">mdi-check-circle</v-icon>
              <div class="text-h6 font-weight-bold">Backend</div>
              <div class="text-caption">정상 운영</div>
            </v-card>
          </v-col>

          <v-col cols="12" md="3" sm="6">
            <v-card color="success" dark class="text-center pa-4">
              <v-icon size="48" class="mb-2">mdi-check-circle</v-icon>
              <div class="text-h6 font-weight-bold">Database</div>
              <div class="text-caption">정상 연결</div>
            </v-card>
          </v-col>

          <v-col cols="12" md="3" sm="6">
            <v-card color="warning" dark class="text-center pa-4">
              <v-icon size="48" class="mb-2">mdi-alert-circle</v-icon>
              <div class="text-h6 font-weight-bold">NiFi</div>
              <div class="text-caption">설정 필요</div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- 푸터 -->
    <v-footer color="grey darken-4" dark class="pa-4">
      <v-container>
        <v-row>
          <v-col cols="12" class="text-center">
            <div class="text-body-2">
              © 2024 NiFiCDC Platform. Built with Vue.js, Node.js, and Apache NiFi.
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-footer>
  </v-container>
</template>

<script>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

export default {
  name: 'Home',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const toast = useToast()
    
    // 인증 상태 컴퓨티드
    const isAuthenticated = computed(() => authStore.isAuthenticated)
    const userName = computed(() => authStore.userName)
    
    // 로그인 페이지로 이동
    const goToLogin = () => {
      router.push({ name: 'Login' })
    }
    
    // 대시보드로 이동
    const goToDashboard = () => {
      router.push({ name: 'Dashboard' })
    }
    
    // 로그아웃
    const logout = async () => {
      try {
        await authStore.logout()
        toast.success('로그아웃되었습니다.')
        router.push({ name: 'Home' })
      } catch (error) {
        console.error('Logout error:', error)
        toast.error('로그아웃 중 오류가 발생했습니다.')
      }
    }
    
    // 페이지 네비게이션 (인증 상태 확인)
    const navigateToPage = (routeName) => {
      if (isAuthenticated.value) {
        // 로그인된 상태면 바로 이동
        router.push({ name: routeName })
      } else {
        // 로그인이 필요한 경우 로그인 페이지로 리다이렉트
        toast.info('로그인이 필요한 서비스입니다.')
        router.push({ 
          name: 'Login', 
          query: { redirect: router.resolve({ name: routeName }).fullPath }
        })
      }
    }
    
    return {
      isAuthenticated,
      userName,
      goToLogin,
      goToDashboard,
      logout,
      navigateToPage
    }
  }
}
</script>

<style scoped>
.h-100 {
  height: 100%;
}

.gap-4 {
  gap: 16px;
}
</style>