<template>
  <AppLayout>
    <v-container fluid class="pa-6">
      <!-- 대시보드 헤더 -->
      <v-row class="mb-6">
        <v-col cols="12">
          <h1 class="text-h4 font-weight-bold text-primary mb-2">
            대시보드
          </h1>
          <p class="text-subtitle-1 text-medium-emphasis mb-0">
            실시간 시스템 상태와 성능 지표를 모니터링합니다
          </p>
        </v-col>
      </v-row>

      <!-- 상태 카드들 -->
      <v-row class="mb-6">
        <v-col cols="12" sm="6" md="3">
          <v-card color="success" dark>
            <v-card-text class="text-center">
              <v-icon size="48" class="mb-2">mdi-server</v-icon>
              <div class="text-h6 font-weight-bold">Backend</div>
              <div class="text-caption">정상 운영</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card color="info" dark>
            <v-card-text class="text-center">
              <v-icon size="48" class="mb-2">mdi-database</v-icon>
              <div class="text-h6 font-weight-bold">Database</div>
              <div class="text-caption">연결됨</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card color="primary" dark>
            <v-card-text class="text-center">
              <v-icon size="48" class="mb-2">mdi-memory</v-icon>
              <div class="text-h6 font-weight-bold">Redis</div>
              <div class="text-caption">캐시 활성</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card color="warning" dark>
            <v-card-text class="text-center">
              <v-icon size="48" class="mb-2">mdi-apache</v-icon>
              <div class="text-h6 font-weight-bold">NiFi</div>
              <div class="text-caption">설정 필요</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 메인 콘텐츠 영역 -->
      <v-row>
        <v-col cols="12" md="8">
          <v-card>
            <v-card-title>
              <v-icon left>mdi-chart-line</v-icon>
              시스템 성능
            </v-card-title>
            <v-card-text>
              <p>시스템 성능 차트가 여기에 표시됩니다.</p>
              <v-alert type="info" variant="tonal">
                실시간 모니터링 기능은 개발 중입니다.
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card>
            <v-card-title>
              <v-icon left>mdi-bell-outline</v-icon>
              최근 알림
            </v-card-title>
            <v-card-text>
              <v-list dense>
                <v-list-item>
                  <v-list-item-icon>
                    <v-icon color="success">mdi-check-circle</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>시스템 정상 가동</v-list-item-title>
                    <v-list-item-subtitle>방금 전</v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>

                <v-list-item>
                  <v-list-item-icon>
                    <v-icon color="info">mdi-information</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>데이터베이스 연결 성공</v-list-item-title>
                    <v-list-item-subtitle>5분 전</v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>

                <v-list-item>
                  <v-list-item-icon>
                    <v-icon color="warning">mdi-alert</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>NiFi 설정 필요</v-list-item-title>
                    <v-list-item-subtitle>1시간 전</v-list-item-subtitle>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 추가 정보 섹션 -->
      <v-row class="mt-6">
        <v-col cols="12">
          <v-card>
            <v-card-title>
              <v-icon left>mdi-information-outline</v-icon>
              빠른 시작 가이드
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="4">
                  <v-card variant="outlined" class="h-100">
                    <v-card-text class="text-center">
                      <v-icon size="48" color="primary" class="mb-3">mdi-server-network</v-icon>
                      <h4 class="mb-2">1. 시스템 연결</h4>
                      <p class="text-body-2">데이터베이스와 외부 시스템을 연결하여 데이터 소스를 설정합니다.</p>
                      <v-btn color="primary" variant="outlined" size="small" @click="$router.push('/systems')">
                        시스템 관리로 이동
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-col>
                
                <v-col cols="12" md="4">
                  <v-card variant="outlined" class="h-100">
                    <v-card-text class="text-center">
                      <v-icon size="48" color="success" class="mb-3">mdi-network-outline</v-icon>
                      <h4 class="mb-2">2. 매핑 설정</h4>
                      <p class="text-body-2">데이터 변환 규칙을 정의하고 매핑 관계를 설정합니다.</p>
                      <v-btn color="success" variant="outlined" size="small" @click="$router.push('/mappings')">
                        매핑 관리로 이동
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-col>
                
                <v-col cols="12" md="4">
                  <v-card variant="outlined" class="h-100">
                    <v-card-text class="text-center">
                      <v-icon size="48" color="info" class="mb-3">mdi-briefcase-outline</v-icon>
                      <h4 class="mb-2">3. 작업 실행</h4>
                      <p class="text-body-2">데이터 동기화 작업을 생성하고 스케줄을 설정합니다.</p>
                      <v-btn color="info" variant="outlined" size="small" @click="$router.push('/jobs')">
                        작업 관리로 이동
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </AppLayout>
</template>

<script>
import AppLayout from '@/components/AppLayout.vue'

export default {
  name: 'Dashboard',
  components: {
    AppLayout
  }
}
</script>

<style scoped>
.h-100 {
  height: 100%;
}
</style>