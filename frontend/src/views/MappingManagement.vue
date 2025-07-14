<template>
  <AppLayout>
    <v-container fluid class="pa-6">
      <v-row class="mb-6">
        <v-col cols="12">
          <div class="d-flex justify-space-between align-center">
            <div>
              <p class="text-subtitle-1 text-medium-emphasis">데이터 변환 매핑 규칙을 관리합니다</p>
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="showAlert">
              새 매핑 추가
            </v-btn>
          </div>
        </v-col>
      </v-row>

      <!-- 안내 메시지 -->
      <v-row>
        <v-col cols="12">
          <v-alert type="info" variant="tonal" prominent>
            <v-alert-title>매핑 관리 페이지</v-alert-title>
            <div>매핑 관리 기능은 현재 개발 중입니다.</div>
            <div class="mt-2">
              <strong>예정된 기능:</strong>
              <ul class="mt-2">
                <li>소스-타겟 시스템 간 데이터 매핑 설정</li>
                <li>필드 매핑 및 변환 규칙 정의</li>
                <li>매핑 검증 및 테스트</li>
                <li>매핑 템플릿 관리</li>
              </ul>
            </div>
          </v-alert>
        </v-col>
      </v-row>

      <!-- 샘플 매핑 카드들 -->
      <v-row>
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>
              <v-icon left color="primary">mdi-shuffle-variant</v-icon>
              PostgreSQL → MySQL
            </v-card-title>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-chip color="success" size="small" class="mr-2">활성</v-chip>
                <span class="text-caption">마지막 실행: 5분 전</span>
              </div>
              <p class="text-body-2">사용자 데이터 테이블 동기화 매핑</p>
              <v-progress-linear value="100" color="success" height="4" class="mt-2"></v-progress-linear>
              <div class="text-caption mt-1">1,234 레코드 매핑 완료</div>
            </v-card-text>
            <v-card-actions>
              <v-btn size="small" variant="text" @click="showAlert">편집</v-btn>
              <v-btn size="small" variant="text" @click="showAlert">테스트</v-btn>
              <v-spacer></v-spacer>
              <v-btn size="small" variant="text" color="success" @click="showAlert">실행</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card>
            <v-card-title>
              <v-icon left color="orange">mdi-shuffle-variant</v-icon>
              Oracle → PostgreSQL
            </v-card-title>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-chip color="warning" size="small" class="mr-2">대기</v-chip>
                <span class="text-caption">다음 실행: 30분 후</span>
              </div>
              <p class="text-body-2">주문 데이터 ETL 매핑</p>
              <v-progress-linear value="0" color="orange" height="4" class="mt-2"></v-progress-linear>
              <div class="text-caption mt-1">실행 대기 중</div>
            </v-card-text>
            <v-card-actions>
              <v-btn size="small" variant="text" @click="showAlert">편집</v-btn>
              <v-btn size="small" variant="text" @click="showAlert">테스트</v-btn>
              <v-spacer></v-spacer>
              <v-btn size="small" variant="text" color="primary" @click="showAlert">실행</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- 매핑 통계 -->
      <v-row class="mt-6">
        <v-col cols="12">
          <v-card>
            <v-card-title>
              <v-icon left>mdi-chart-bar</v-icon>
              매핑 통계
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="6" md="3">
                  <div class="text-center">
                    <div class="text-h4 font-weight-bold text-primary">2</div>
                    <div class="text-caption">총 매핑</div>
                  </div>
                </v-col>
                <v-col cols="6" md="3">
                  <div class="text-center">
                    <div class="text-h4 font-weight-bold text-success">1</div>
                    <div class="text-caption">활성 매핑</div>
                  </div>
                </v-col>
                <v-col cols="6" md="3">
                  <div class="text-center">
                    <div class="text-h4 font-weight-bold text-info">1,234</div>
                    <div class="text-caption">처리된 레코드</div>
                  </div>
                </v-col>
                <v-col cols="6" md="3">
                  <div class="text-center">
                    <div class="text-h4 font-weight-bold text-warning">0</div>
                    <div class="text-caption">오류</div>
                  </div>
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
import { useToast } from 'vue-toastification'

export default {
  name: 'MappingManagement',
  components: {
    AppLayout
  },
  setup() {
    const toast = useToast()
    
    const showAlert = () => {
      toast.info('매핑 관리 기능은 현재 개발 중입니다.')
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