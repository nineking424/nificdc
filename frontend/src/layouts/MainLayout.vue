<template>
  <v-app>
    <!-- 상단 앱바 -->
    <v-app-bar
      :elevation="appStore.isDarkTheme ? 0 : 1"
      :color="appStore.isDarkTheme ? 'surface' : 'primary'"
      :theme="appStore.isDarkTheme ? 'dark' : 'light'"
      density="comfortable"
      app
    >
      <!-- 사이드바 토글 버튼 -->
      <v-app-bar-nav-icon
        @click="appStore.toggleSidebar()"
        :color="appStore.isDarkTheme ? 'white' : 'white'"
      />
      
      <!-- 로고 및 타이틀 -->
      <v-toolbar-title class="d-flex align-center">
        <v-img
          src="/logo.png"
          max-height="32"
          max-width="32"
          class="mr-2"
          alt="NiFiCDC Logo"
        />
        <span class="font-weight-bold">NiFiCDC</span>
      </v-toolbar-title>
      
      <!-- 브레드크럼 (모바일에서 숨김) -->
      <v-breadcrumbs
        v-if="breadcrumbs.length > 0"
        :items="breadcrumbs"
        class="pa-0 ml-4 d-none d-md-flex"
        density="compact"
      >
        <template v-slot:divider>
          <v-icon size="small">mdi-chevron-right</v-icon>
        </template>
        <template v-slot:item="{ item }">
          <v-breadcrumbs-item
            :to="item.to"
            :disabled="item.disabled"
            class="text-body-2"
          >
            {{ item.text }}
          </v-breadcrumbs-item>
        </template>
      </v-breadcrumbs>
      
      <v-spacer />
      
      <!-- 글로벌 검색 (태블릿 이상에서만 표시) -->
      <v-text-field
        v-model="globalSearch"
        prepend-inner-icon="mdi-magnify"
        placeholder="전역 검색..."
        hide-details
        density="compact"
        variant="outlined"
        class="mr-4 d-none d-lg-flex"
        style="max-width: 300px;"
        @keyup.enter="performGlobalSearch"
      />
      
      <!-- 알림 버튼 -->
      <v-btn
        icon
        size="large"
        class="mr-2"
        @click="toggleNotifications"
      >
        <v-badge
          v-if="appStore.unreadNotifications > 0"
          :content="appStore.unreadNotifications"
          color="error"
          overlap
        >
          <v-icon>mdi-bell</v-icon>
        </v-badge>
        <v-icon v-else>mdi-bell-outline</v-icon>
      </v-btn>
      
      <!-- 테마 토글 -->
      <v-btn
        icon
        size="large"
        class="mr-2"
        @click="appStore.toggleTheme()"
      >
        <v-icon>
          {{ appStore.isDarkTheme ? 'mdi-brightness-7' : 'mdi-brightness-4' }}
        </v-icon>
      </v-btn>
      
      <!-- 사용자 메뉴 -->
      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            icon
            size="large"
          >
            <v-avatar size="36">
              <v-img
                v-if="authStore.user?.avatar"
                :src="authStore.user.avatar"
                :alt="authStore.userName"
              />
              <v-icon v-else>mdi-account</v-icon>
            </v-avatar>
          </v-btn>
        </template>
        
        <v-list density="compact" min-width="200">
          <v-list-item>
            <v-list-item-title>{{ authStore.userName }}</v-list-item-title>
            <v-list-item-subtitle>{{ authStore.userEmail }}</v-list-item-subtitle>
          </v-list-item>
          
          <v-divider />
          
          <v-list-item
            :to="{ name: 'Profile' }"
            prepend-icon="mdi-account"
          >
            <v-list-item-title>프로필</v-list-item-title>
          </v-list-item>
          
          <v-list-item
            :to="{ name: 'Settings' }"
            prepend-icon="mdi-cog"
          >
            <v-list-item-title>설정</v-list-item-title>
          </v-list-item>
          
          <v-divider />
          
          <v-list-item
            @click="logout"
            prepend-icon="mdi-logout"
            color="error"
          >
            <v-list-item-title>로그아웃</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>
    
    <!-- 사이드바 네비게이션 -->
    <v-navigation-drawer
      v-model="appStore.sidebar.isOpen"
      :rail="appStore.sidebar.isMini"
      :temporary="appStore.sidebar.isTemporary"
      :permanent="!appStore.sidebar.isTemporary"
      color="background"
      app
    >
      <!-- 사이드바 헤더 -->
      <v-list-item
        v-if="!appStore.sidebar.isMini"
        class="px-2 py-3"
      >
        <template v-slot:prepend>
          <v-avatar size="40">
            <v-img
              v-if="authStore.user?.avatar"
              :src="authStore.user.avatar"
              :alt="authStore.userName"
            />
            <v-icon v-else size="24">mdi-account</v-icon>
          </v-avatar>
        </template>
        
        <v-list-item-title class="font-weight-medium">
          {{ authStore.userName }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ authStore.userRole }}
        </v-list-item-subtitle>
        
        <template v-slot:append>
          <v-btn
            icon
            size="small"
            variant="text"
            @click="appStore.setSidebarMini(true)"
          >
            <v-icon>mdi-chevron-left</v-icon>
          </v-btn>
        </template>
      </v-list-item>
      
      <!-- 미니 모드에서 확장 버튼 -->
      <v-list-item
        v-else
        class="px-2 py-3"
        @click="appStore.setSidebarMini(false)"
      >
        <template v-slot:prepend>
          <v-icon>mdi-chevron-right</v-icon>
        </template>
      </v-list-item>
      
      <v-divider />
      
      <!-- 네비게이션 메뉴 -->
      <v-list density="compact" nav>
        <v-list-item
          v-for="item in navigationItems"
          :key="item.name"
          :to="{ name: item.name }"
          :prepend-icon="item.icon"
          :title="item.title"
          :active="$route.name === item.name"
          color="primary"
        />
      </v-list>
      
      <v-spacer />
      
      <!-- 하단 정보 -->
      <template v-slot:append>
        <v-divider />
        
        <!-- 온라인 상태 -->
        <v-list-item density="compact">
          <template v-slot:prepend>
            <v-icon
              :color="appStore.isOnline ? 'success' : 'error'"
              size="small"
            >
              {{ appStore.isOnline ? 'mdi-wifi' : 'mdi-wifi-off' }}
            </v-icon>
          </template>
          
          <v-list-item-title v-if="!appStore.sidebar.isMini" class="text-caption">
            {{ appStore.isOnline ? '온라인' : '오프라인' }}
          </v-list-item-title>
        </v-list-item>
        
        <!-- 버전 정보 -->
        <v-list-item
          v-if="!appStore.sidebar.isMini"
          density="compact"
          class="text-caption text-medium-emphasis"
        >
          <v-list-item-title>v1.0.0</v-list-item-title>
        </v-list-item>
      </template>
    </v-navigation-drawer>
    
    <!-- 메인 콘텐츠 영역 -->
    <v-main>
      <v-container fluid class="pa-4">
        <!-- 로딩 오버레이 -->
        <v-overlay
          v-model="appStore.isLoading"
          class="align-center justify-center"
        >
          <div class="text-center">
            <v-progress-circular
              indeterminate
              size="64"
              color="primary"
            />
            <div class="mt-4 text-h6">
              {{ appStore.loadingMessage }}
            </div>
          </div>
        </v-overlay>
        
        <!-- 에러 알림 -->
        <v-alert
          v-if="appStore.hasError"
          type="error"
          closable
          class="mb-4"
          @click:close="appStore.clearError()"
        >
          <div class="font-weight-medium">{{ appStore.error?.message }}</div>
          <div v-if="appStore.error?.details" class="text-caption mt-1">
            {{ appStore.error.details }}
          </div>
        </v-alert>
        
        <!-- 라우터 뷰 -->
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </v-container>
    </v-main>
    
    <!-- 알림 사이드 패널 -->
    <v-navigation-drawer
      v-model="showNotifications"
      location="right"
      temporary
      width="400"
    >
      <v-toolbar density="compact" color="primary">
        <v-toolbar-title class="text-white">알림</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          size="small"
          @click="appStore.markAllNotificationsAsRead()"
        >
          <v-icon color="white">mdi-check-all</v-icon>
        </v-btn>
        <v-btn
          icon
          size="small"
          @click="appStore.clearAllNotifications()"
        >
          <v-icon color="white">mdi-delete-sweep</v-icon>
        </v-btn>
      </v-toolbar>
      
      <v-list>
        <v-list-item
          v-for="notification in appStore.notifications"
          :key="notification.id"
          :class="{ 'bg-blue-grey-lighten-5': !notification.read }"
        >
          <template v-slot:prepend>
            <v-icon
              :color="getNotificationColor(notification.type)"
              size="small"
            >
              {{ getNotificationIcon(notification.type) }}
            </v-icon>
          </template>
          
          <v-list-item-title class="text-body-2">
            {{ notification.title }}
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            {{ notification.message }}
          </v-list-item-subtitle>
          <v-list-item-subtitle class="text-caption">
            {{ formatTime(notification.timestamp) }}
          </v-list-item-subtitle>
          
          <template v-slot:append>
            <v-btn
              icon
              size="x-small"
              variant="text"
              @click="appStore.removeNotification(notification.id)"
            >
              <v-icon size="small">mdi-close</v-icon>
            </v-btn>
          </template>
        </v-list-item>
        
        <v-list-item v-if="appStore.notifications.length === 0">
          <v-list-item-title class="text-center text-medium-emphasis">
            알림이 없습니다
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    
    <!-- 푸터 (선택적) -->
    <v-footer
      v-if="showFooter"
      app
      height="auto"
      class="pa-2 text-center"
    >
      <div class="text-caption text-medium-emphasis">
        © 2024 NiFiCDC. All rights reserved.
      </div>
    </v-footer>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { getMainRoutes, getBreadcrumbs } from '@/router'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

// 반응형 데이터
const globalSearch = ref('')
const showNotifications = ref(false)
const showFooter = ref(false)

// 계산된 속성
const navigationItems = computed(() => getMainRoutes())
const breadcrumbs = computed(() => getBreadcrumbs(route))

// 메서드
const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
}

const performGlobalSearch = () => {
  if (globalSearch.value.trim()) {
    router.push({
      name: 'Search',
      query: { q: globalSearch.value.trim() }
    })
  }
}

const logout = async () => {
  try {
    await authStore.logout()
    router.push({ name: 'Login' })
  } catch (error) {
    console.error('Logout failed:', error)
  }
}

const getNotificationColor = (type) => {
  const colors = {
    info: 'blue',
    success: 'green',
    warning: 'orange',
    error: 'red'
  }
  return colors[type] || 'grey'
}

const getNotificationIcon = (type) => {
  const icons = {
    info: 'mdi-information',
    success: 'mdi-check-circle',
    warning: 'mdi-alert',
    error: 'mdi-alert-circle'
  }
  return icons[type] || 'mdi-bell'
}

const formatTime = (timestamp) => {
  return formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: ko
  })
}

// 라이프사이클
onMounted(() => {
  // 앱 초기화
  appStore.initialize()
  
  // 사용자 정보가 없으면 가져오기
  if (authStore.token && !authStore.user) {
    authStore.fetchUser()
  }
})

onUnmounted(() => {
  appStore.destroy()
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 커스텀 스크롤바 */
.v-navigation-drawer__content {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.v-navigation-drawer__content::-webkit-scrollbar {
  width: 6px;
}

.v-navigation-drawer__content::-webkit-scrollbar-track {
  background: transparent;
}

.v-navigation-drawer__content::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.v-navigation-drawer__content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
}
</style>