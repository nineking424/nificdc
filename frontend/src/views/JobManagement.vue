<template>
  <AppLayout>
    <v-container fluid class="pa-6">
      <v-row class="mb-6">
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center">
            <div>
              <h1 class="text-h4 font-weight-bold text-primary mb-2">작업 관리</h1>
              <p class="text-subtitle-1 text-medium-emphasis">데이터 동기화 작업을 관리하고 모니터링합니다</p>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="showAlert">
              새 작업 생성
            </v-btn>
          </div>
        </v-col>
      </v-row>

      <!-- 안내 메시지 -->
      <v-row>
        <v-col cols="12">
          <v-alert type="info" variant="tonal" prominent>
            <v-alert-title>작업 관리 페이지</v-alert-title>
            <div>작업 관리 기능은 현재 개발 중입니다.</div>
            <div class="mt-2">
              <strong>예정된 기능:</strong>
              <ul class="mt-2">
                <li>데이터 동기화 작업 생성 및 관리</li>
                <li>작업 스케줄링 및 실행</li>
                <li>작업 모니터링 및 로그 확인</li>
                <li>작업 성능 분석 및 최적화</li>
              </ul>
            </div>
          </v-alert>
        </v-col>
      </v-row>

      <!-- 작업 상태 카드들 -->
      <v-row>
        <v-col cols="12" sm="6" md="3">
          <v-card color="success" dark>
            <v-card-text class="text-center">
              <v-icon size="48" class="mb-2">mdi-check-circle</v-icon>
              <div class="text-h6 font-weight-bold">실행 중</div>
              <div class="text-h4">3</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card color="warning" dark>
            <v-card-text class="text-center">
              <v-icon size="48" class="mb-2">mdi-pause-circle</v-icon>
              <div class="text-h6 font-weight-bold">대기 중</div>
              <div class="text-h4">2</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card color="error" dark>
            <v-card-text class="text-center">
              <v-icon size="48" class="mb-2">mdi-alert-circle</v-icon>
              <div class="text-h6 font-weight-bold">실패</div>
              <div class="text-h4">0</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-card color="info" dark>
            <v-card-text class="text-center">
              <v-icon size="48" class="mb-2">mdi-clock-outline</v-icon>
              <div class="text-h6 font-weight-bold">예약됨</div>
              <div class="text-h4">1</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 최근 작업 목록 -->
      <v-row class="mt-6">
        <v-col cols="12">
          <v-card>
            <v-card-title>
              <v-icon left>mdi-format-list-bulleted</v-icon>
              최근 작업
            </v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item>
                  <template #prepend>
                    <v-avatar color="success">
                      <v-icon>mdi-database-sync</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title>사용자 데이터 동기화</v-list-item-title>
                  <v-list-item-subtitle>PostgreSQL → MySQL | 실행 중 (85% 완료)</v-list-item-subtitle>
                  <template #append>
                    <v-chip color="success" size="small">실행 중</v-chip>
                  </template>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-avatar color="warning">
                      <v-icon>mdi-database-sync</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title>주문 데이터 ETL</v-list-item-title>
                  <v-list-item-subtitle>Oracle → PostgreSQL | 다음 실행: 15:00</v-list-item-subtitle>
                  <template #append>
                    <v-chip color="warning" size="small">대기 중</v-chip>
                  </template>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-avatar color="info">
                      <v-icon>mdi-database-sync</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title>로그 아카이빙</v-list-item-title>
                  <v-list-item-subtitle>MySQL → S3 | 매일 자정 실행</v-list-item-subtitle>
                  <template #append>
                    <v-chip color="info" size="small">예약됨</v-chip>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn variant="text" @click="showAlert">모든 작업 보기</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- 작업 성능 차트 영역 -->
      <v-row class="mt-6">
        <v-col cols="12" md="8">
          <v-card>
            <v-card-title>
              <v-icon left>mdi-chart-line</v-icon>
              작업 성능 추이
            </v-card-title>
            <v-card-text>
              <div class="text-center py-8">
                <v-icon size="64" color="grey-lighten-1">mdi-chart-line</v-icon>
                <div class="text-h6 mt-4">성능 차트</div>
                <div class="text-body-2 text-medium-emphasis mt-2">
                  작업 성능 차트는 개발 중입니다.
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card>
            <v-card-title>
              <v-icon left>mdi-speedometer</v-icon>
              성능 지표
            </v-card-title>
            <v-card-text>
              <div class="mb-4">
                <div class="d-flex justify-space-between align-center mb-1">
                  <span class="text-body-2">평균 처리 시간</span>
                  <span class="font-weight-bold">2.3초</span>
                </div>
                <v-progress-linear value="65" color="primary" height="6"></v-progress-linear>
              </div>

              <div class="mb-4">
                <div class="d-flex justify-space-between align-center mb-1">
                  <span class="text-body-2">성공률</span>
                  <span class="font-weight-bold">98.5%</span>
                </div>
                <v-progress-linear value="98.5" color="success" height="6"></v-progress-linear>
              </div>

              <div class="mb-4">
                <div class="d-flex justify-space-between align-center mb-1">
                  <span class="text-body-2">처리량 (records/min)</span>
                  <span class="font-weight-bold">1,250</span>
                </div>
                <v-progress-linear value="80" color="info" height="6"></v-progress-linear>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </AppLayout>
</template>

<script>
import AppLayout from '@/components/AppLayout.vue'
import { useToast } from 'vue-toastification'

export default {
  name: 'JobManagement',
  components: {
    AppLayout
  },
  setup() {
    const toast = useToast()
    
    const showAlert = () => {
      toast.info('작업 관리 기능은 현재 개발 중입니다.')
    }
    
    return {
      showAlert
    }
  }
}
</script>

<style scoped>
.h-100 {
  height: 100%;
}
</style>