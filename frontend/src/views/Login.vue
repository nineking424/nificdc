<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <v-col cols="12" md="6" class="d-flex align-center justify-center pa-8">
        <v-card max-width="400" width="100%" elevation="8" class="rounded-lg">
          <v-card-title class="text-center text-h4 font-weight-bold primary--text mb-4">
            NiFiCDC
          </v-card-title>
          
          <v-card-text>
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="form.email"
                label="이메일"
                type="email"
                variant="outlined"
                prepend-inner-icon="mdi-email"
                :rules="emailRules"
                required
                class="mb-3"
              />
              
              <v-text-field
                v-model="form.password"
                label="비밀번호"
                :type="showPassword ? 'text' : 'password'"
                variant="outlined"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showPassword = !showPassword"
                :rules="passwordRules"
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
                로그인
              </v-btn>
              
              <div class="text-center">
                <router-link to="/reset-password" class="text-decoration-none">
                  비밀번호를 잊으셨나요?
                </router-link>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
      
      <v-col cols="12" md="6" class="d-none d-md-flex primary lighten-1">
        <div class="d-flex flex-column justify-center align-center text-center white--text pa-8">
          <h1 class="text-h2 font-weight-bold mb-4">Welcome Back!</h1>
          <p class="text-h6 mb-4">
            NiFiCDC를 통해 효율적인 데이터 변경 추적 및 동기화를 경험해보세요.
          </p>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    
    const form = ref({
      email: '',
      password: ''
    })
    
    const showPassword = ref(false)
    const loading = ref(false)
    
    const emailRules = [
      v => !!v || '이메일을 입력해주세요',
      v => /.+@.+\..+/.test(v) || '올바른 이메일 형식을 입력해주세요'
    ]
    
    const passwordRules = [
      v => !!v || '비밀번호를 입력해주세요',
      v => v.length >= 6 || '비밀번호는 최소 6자 이상이어야 합니다'
    ]
    
    const handleLogin = async () => {
      loading.value = true
      
      try {
        await authStore.login(form.value)
        
        const redirect = router.currentRoute.value.query.redirect || '/dashboard'
        router.push(redirect)
      } catch (error) {
        console.error('Login failed:', error)
      } finally {
        loading.value = false
      }
    }
    
    return {
      form,
      showPassword,
      loading,
      emailRules,
      passwordRules,
      handleLogin
    }
  }
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>