<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height justify-center align-center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card elevation="8" class="rounded-lg">
          <v-card-title class="text-center text-h5 font-weight-bold primary--text mb-2">
            비밀번호 재설정
          </v-card-title>
          
          <v-card-text>
            <div v-if="!emailSent">
              <p class="text-body-1 mb-4 text-center">
                가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
              </p>
              
              <v-form @submit.prevent="handleResetRequest">
                <v-text-field
                  v-model="email"
                  label="이메일 주소"
                  type="email"
                  variant="outlined"
                  prepend-inner-icon="mdi-email"
                  :rules="emailRules"
                  required
                  class="mb-4"
                />
                
                <v-btn
                  type="submit"
                  block
                  color="primary"
                  size="large"
                  :loading="loading"
                  class="mb-3"
                >
                  재설정 링크 전송
                </v-btn>
                
                <div class="text-center">
                  <router-link to="/login" class="text-decoration-none">
                    로그인으로 돌아가기
                  </router-link>
                </div>
              </v-form>
            </div>
            
            <div v-else class="text-center">
              <v-icon size="64" color="success" class="mb-4">
                mdi-email-check
              </v-icon>
              
              <h3 class="text-h6 mb-3">이메일을 확인해주세요</h3>
              
              <p class="text-body-2 mb-4">
                {{ email }}로 비밀번호 재설정 링크를 보내드렸습니다.
                이메일을 확인하고 링크를 클릭해 비밀번호를 재설정해주세요.
              </p>
              
              <v-btn
                color="primary"
                variant="text"
                @click="emailSent = false"
                class="mb-2"
              >
                다른 이메일로 다시 시도
              </v-btn>
              
              <br>
              
              <router-link to="/login" class="text-decoration-none">
                로그인으로 돌아가기
              </router-link>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { ref } from 'vue'
import api from '@/services/api'

export default {
  name: 'ResetPassword',
  setup() {
    const email = ref('')
    const emailSent = ref(false)
    const loading = ref(false)
    
    const emailRules = [
      v => !!v || '이메일을 입력해주세요',
      v => /.+@.+\..+/.test(v) || '올바른 이메일 형식을 입력해주세요'
    ]
    
    const handleResetRequest = async () => {
      loading.value = true
      
      try {
        await api.auth.resetPassword({ email: email.value })
        emailSent.value = true
      } catch (error) {
        console.error('Reset request failed:', error)
      } finally {
        loading.value = false
      }
    }
    
    return {
      email,
      emailSent,
      loading,
      emailRules,
      handleResetRequest
    }
  }
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>