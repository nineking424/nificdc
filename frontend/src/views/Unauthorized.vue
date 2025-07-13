<template>
  <v-container fluid class="fill-height">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" sm="8" md="6" lg="4" class="text-center">
        <v-card elevation="4" class="pa-8 rounded-lg">
          <v-icon 
            size="120" 
            color="warning" 
            class="mb-6"
          >
            mdi-shield-alert
          </v-icon>
          
          <h1 class="text-h3 font-weight-bold mb-4 warning--text">
            403
          </h1>
          
          <h2 class="text-h5 font-weight-medium mb-4">
            접근 권한이 없습니다
          </h2>
          
          <p class="text-body-1 mb-6 grey--text text--darken-1">
            이 페이지에 접근할 권한이 없습니다.<br>
            관리자에게 문의하거나 적절한 권한을 요청해주세요.
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
            <p class="text-body-2 grey--text mb-2">
              문제가 지속되면 관리자에게 문의하세요
            </p>
            
            <v-btn 
              color="info" 
              variant="text" 
              size="small"
              href="mailto:admin@example.com"
              prepend-icon="mdi-email"
            >
              관리자 문의
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { useRouter } from 'vue-router'

export default {
  name: 'Unauthorized',
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
</style>