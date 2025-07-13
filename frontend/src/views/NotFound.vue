<template>
  <v-container fluid class="fill-height">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" sm="8" md="6" lg="4" class="text-center">
        <v-card elevation="4" class="pa-8 rounded-lg">
          <v-icon 
            size="120" 
            color="error" 
            class="mb-6"
          >
            mdi-emoticon-sad-outline
          </v-icon>
          
          <h1 class="text-h3 font-weight-bold mb-4 error--text">
            404
          </h1>
          
          <h2 class="text-h5 font-weight-medium mb-4">
            페이지를 찾을 수 없습니다
          </h2>
          
          <p class="text-body-1 mb-6 grey--text text--darken-1">
            요청하신 페이지가 존재하지 않거나 이동되었습니다.<br>
            URL을 다시 확인해주세요.
          </p>
          
          <div class="d-flex flex-column flex-sm-row gap-3 justify-center">
            <v-btn 
              color="primary" 
              size="large"
              @click="goBack"
              prepend-icon="mdi-arrow-left"
            >
              이전 페이지
            </v-btn>
            
            <v-btn 
              color="secondary" 
              variant="outlined"
              size="large"
              @click="goHome"
              prepend-icon="mdi-home"
            >
              홈으로
            </v-btn>
          </div>
          
          <v-divider class="my-6" />
          
          <div class="text-center">
            <h3 class="text-h6 mb-3">도움이 필요하신가요?</h3>
            
            <div class="d-flex flex-wrap justify-center gap-2">
              <v-chip 
                color="info" 
                variant="outlined"
                size="small"
                @click="goHome"
                prepend-icon="mdi-home"
              >
                홈페이지
              </v-chip>
              
              <v-chip 
                color="info" 
                variant="outlined"
                size="small"
                to="/systems"
                prepend-icon="mdi-server"
              >
                시스템 관리
              </v-chip>
              
              <v-chip 
                color="info" 
                variant="outlined"
                size="small"
                to="/monitoring"
                prepend-icon="mdi-chart-line"
              >
                모니터링
              </v-chip>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { useRouter } from 'vue-router'

export default {
  name: 'NotFound',
  setup() {
    const router = useRouter()
    
    const goBack = () => {
      if (window.history.length > 1) {
        router.go(-1)
      } else {
        router.push('/')
      }
    }
    
    const goHome = () => {
      router.push('/')
    }
    
    return {
      goBack,
      goHome
    }
  }
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}

.gap-3 {
  gap: 12px;
}

.gap-2 {
  gap: 8px;
}
</style>