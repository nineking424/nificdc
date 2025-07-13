<template>
  <v-app>
    <!-- 네비게이션 드로어 -->
    <v-navigation-drawer
      v-model="drawer"
      permanent
      app
      color="primary"
      dark
      width="260"
    >
      <v-list-item class="px-2">
        <v-list-item-avatar>
          <v-icon size="40">mdi-hexagon-multiple</v-icon>
        </v-list-item-avatar>
        <v-list-item-title class="text-h6">
          NiFiCDC
        </v-list-item-title>
      </v-list-item>

      <v-divider></v-divider>

      <v-list nav dense>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          router
          exact
        >
          <v-list-item-icon>
            <v-icon>{{ item.icon }}</v-icon>
          </v-list-item-icon>
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- 앱 바 -->
    <v-app-bar app color="white" elevation="1" height="64">
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      
      <v-toolbar-title class="text-h6 font-weight-regular">
        {{ currentPageTitle }}
      </v-toolbar-title>

      <v-spacer></v-spacer>

      <!-- 사용자 메뉴 -->
      <v-menu offset-y>
        <template v-slot:activator="{ props }">
          <v-btn icon v-bind="props">
            <v-avatar size="36">
              <v-icon>mdi-account-circle</v-icon>
            </v-avatar>
          </v-btn>
        </template>
        
        <v-list>
          <v-list-item class="px-4">
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium">
                {{ userInfo.name }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ userInfo.email }}
              </v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
          
          <v-divider></v-divider>
          
          <v-list-item @click="logout">
            <v-list-item-icon>
              <v-icon>mdi-logout</v-icon>
            </v-list-item-icon>
            <v-list-item-title>로그아웃</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- 메인 콘텐츠 -->
    <v-main>
      <slot />
    </v-main>
  </v-app>
</template>

<script>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'AppLayout',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const authStore = useAuthStore()
    
    const drawer = ref(true)
    
    const menuItems = [
      {
        title: '대시보드',
        icon: 'mdi-view-dashboard',
        to: '/dashboard'
      },
      {
        title: '시스템 관리',
        icon: 'mdi-server-network',
        to: '/systems'
      },
      {
        title: '매핑 관리',
        icon: 'mdi-network-outline',
        to: '/mappings'
      },
      {
        title: '작업 관리',
        icon: 'mdi-briefcase-outline',
        to: '/jobs'
      },
      {
        title: '모니터링',
        icon: 'mdi-monitor-dashboard',
        to: '/monitoring'
      }
    ]
    
    const currentPageTitle = computed(() => {
      return route.meta.title || 'NiFiCDC'
    })
    
    const userInfo = computed(() => ({
      name: authStore.userName || 'User',
      email: authStore.userEmail || 'user@example.com'
    }))
    
    const logout = async () => {
      try {
        await authStore.logout()
        router.push('/login')
      } catch (error) {
        console.error('Logout failed:', error)
      }
    }
    
    return {
      drawer,
      menuItems,
      currentPageTitle,
      userInfo,
      logout
    }
  }
}
</script>

<style scoped>
.v-list-item--active {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>