<template>
  <div class="app-layout">
    <!-- 모던 사이드바 -->
    <aside class="modern-sidebar" :class="{ collapsed: !drawer }">
      <div class="sidebar-header">
        <div class="brand-section">
          <div class="brand-icon">
            <v-icon size="32" color="primary">mdi-hexagon-multiple</v-icon>
          </div>
          <h1 class="brand-text" v-show="drawer">
            <span class="brand-main">NiFiCDC</span>
            <span class="brand-sub">Data Sync</span>
          </h1>
        </div>
        
        <button class="toggle-btn" @click="toggleDrawer">
          <v-icon size="20">{{ drawer ? 'mdi-chevron-left' : 'mdi-chevron-right' }}</v-icon>
        </button>
      </div>
      
      <nav class="sidebar-nav">
        <ul class="nav-list">
          <li v-for="item in menuItems" :key="item.title" class="nav-item">
            <router-link 
              :to="item.to" 
              class="nav-link"
              :class="{ active: $route.path === item.to }"
            >
              <div class="nav-icon">
                <v-icon size="20">{{ item.icon }}</v-icon>
              </div>
              <span class="nav-text" v-show="drawer">{{ item.title }}</span>
              <div class="nav-indicator" v-show="$route.path === item.to"></div>
            </router-link>
          </li>
        </ul>
      </nav>
      
      <div class="sidebar-footer" v-show="drawer">
        <div class="user-info">
          <div class="user-avatar">
            <v-icon size="16">mdi-account</v-icon>
          </div>
          <div class="user-details">
            <span class="user-name">{{ userInfo.name }}</span>
            <span class="user-role">관리자</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- 모던 헤더 -->
    <header class="modern-header">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title">{{ currentPageTitle }}</h1>
          <div class="breadcrumb">
            <router-link to="/dashboard" class="breadcrumb-item">대시보드</router-link>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-current">{{ currentPageTitle }}</span>
          </div>
        </div>
        
        <div class="header-right">
          <div class="header-actions">
            <button class="action-btn" @click="refreshPage">
              <v-icon size="18">mdi-refresh</v-icon>
            </button>
            <button class="action-btn" @click="openNotifications">
              <v-icon size="18">mdi-bell-outline</v-icon>
              <span class="notification-badge">3</span>
            </button>
          </div>
          
          <div class="user-menu">
            <v-menu offset-y>
              <template #activator="{ props }">
                <button class="user-button" v-bind="props">
                  <div class="user-avatar">
                    <v-icon size="16">mdi-account</v-icon>
                  </div>
                  <div class="user-info">
                    <span class="user-name">{{ userInfo.name }}</span>
                    <span class="user-email">{{ userInfo.email }}</span>
                  </div>
                  <v-icon size="16" class="dropdown-icon">mdi-chevron-down</v-icon>
                </button>
              </template>
              
              <v-list class="user-dropdown">
                <v-list-item class="user-profile">
                  <div class="profile-content">
                    <div class="profile-avatar">
                      <v-icon size="20">mdi-account</v-icon>
                    </div>
                    <div class="profile-info">
                      <h4 class="profile-name">{{ userInfo.name }}</h4>
                      <p class="profile-email">{{ userInfo.email }}</p>
                    </div>
                  </div>
                </v-list-item>
                
                <v-divider />
                
                <v-list-item @click="openProfile" class="dropdown-item">
                  <v-icon class="mr-3" size="18">mdi-account-edit</v-icon>
                  프로필 설정
                </v-list-item>
                
                <v-list-item @click="openSettings" class="dropdown-item">
                  <v-icon class="mr-3" size="18">mdi-cog</v-icon>
                  설정
                </v-list-item>
                
                <v-divider />
                
                <v-list-item @click="logout" class="dropdown-item logout">
                  <v-icon class="mr-3" size="18">mdi-logout</v-icon>
                  로그아웃
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
      </div>
    </header>

    <!-- 메인 콘텐츠 영역 -->
    <main class="main-content">
      <div class="content-wrapper">
        <slot />
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

export default {
  name: 'AppLayout',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const authStore = useAuthStore()
    const toast = useToast()
    
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
      name: authStore.user?.name || authStore.user?.email || '사용자',
      email: authStore.user?.email || 'user@nificdc.com'
    }))
    
    // 메서드
    const toggleDrawer = () => {
      drawer.value = !drawer.value
      localStorage.setItem('sidebarCollapsed', !drawer.value)
    }
    
    const refreshPage = () => {
      window.location.reload()
    }
    
    const openNotifications = () => {
      toast.info('알림 기능은 개발 예정입니다.')
    }
    
    const openProfile = () => {
      toast.info('프로필 설정 기능은 개발 예정입니다.')
    }
    
    const openSettings = () => {
      toast.info('설정 기능은 개발 예정입니다.')
    }
    
    const logout = async () => {
      try {
        await authStore.logout()
        toast.success('로그아웃되었습니다.')
        router.push('/login')
      } catch (error) {
        console.error('Logout failed:', error)
        toast.error('로그아웃 중 오류가 발생했습니다.')
      }
    }
    
    // 라이프사이클
    onMounted(() => {
      // 저장된 사이드바 상태 복원
      const collapsed = localStorage.getItem('sidebarCollapsed')
      if (collapsed !== null) {
        drawer.value = collapsed === 'false'
      }
    })
    
    return {
      drawer,
      menuItems,
      currentPageTitle,
      userInfo,
      toggleDrawer,
      refreshPage,
      openNotifications,
      openProfile,
      openSettings,
      logout
    }
  }
}
</script>

<style scoped>
/* 앱 레이아웃 전체 컨테이너 */
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--gray-50);
}

/* 모던 사이드바 */
.modern-sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  z-index: 1000;
}

.modern-sidebar.collapsed {
  width: 80px;
}

.sidebar-header {
  padding: 1.5rem 1rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 80px;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.brand-icon {
  width: 48px;
  height: 48px;
  background: var(--primary-100);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.brand-main {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--gray-900);
  line-height: 1.2;
}

.brand-sub {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toggle-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--gray-600);
  flex-shrink: 0;
}

.toggle-btn:hover {
  background: var(--gray-200);
  color: var(--gray-800);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  margin: 0;
  padding: 0 1rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--gray-700);
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.nav-link:hover {
  background: var(--primary-50);
  color: var(--primary-700);
}

.nav-link.active {
  background: var(--primary-100);
  color: var(--primary-800);
  font-weight: 600;
}

.nav-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-text {
  flex: 1;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.collapsed .nav-text {
  opacity: 0;
}

.nav-indicator {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--primary-600);
  border-radius: var(--radius-full) 0 0 var(--radius-full);
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--gray-200);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--gray-50);
  border-radius: var(--radius-lg);
}

.user-info .user-avatar {
  width: 32px;
  height: 32px;
  background: var(--primary-100);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-600);
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 0.75rem;
  color: var(--gray-500);
}

/* 모던 헤더 */
.modern-header {
  background: white;
  border-bottom: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
  margin-left: 280px;
  transition: margin-left 0.3s ease;
}

.collapsed + .modern-header {
  margin-left: 80px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  min-height: 80px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.breadcrumb-item {
  color: var(--gray-500);
  text-decoration: none;
  transition: color 0.2s ease;
}

.breadcrumb-item:hover {
  color: var(--primary-600);
}

.breadcrumb-separator {
  color: var(--gray-400);
}

.breadcrumb-current {
  color: var(--gray-700);
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--gray-100);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--gray-600);
  position: relative;
}

.action-btn:hover {
  background: var(--gray-200);
  color: var(--gray-800);
  transform: translateY(-1px);
}

.notification-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  background: var(--error-500);
  color: white;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.user-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 0;
}

.user-button:hover {
  background: var(--gray-100);
  border-color: var(--gray-300);
}

.user-button .user-avatar {
  width: 32px;
  height: 32px;
  background: var(--primary-100);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-600);
  flex-shrink: 0;
}

.user-button .user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  flex: 1;
}

.user-button .user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.user-button .user-email {
  font-size: 0.75rem;
  color: var(--gray-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.dropdown-icon {
  color: var(--gray-400);
  flex-shrink: 0;
}

/* 사용자 드롭다운 */
.user-dropdown {
  border-radius: var(--radius-lg) !important;
  box-shadow: var(--shadow-lg) !important;
  border: 1px solid var(--gray-200) !important;
  padding: 0.5rem 0 !important;
  min-width: 240px;
}

.user-profile {
  padding: 1rem !important;
  border-bottom: 1px solid var(--gray-200) !important;
  margin-bottom: 0.5rem !important;
}

.profile-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.profile-avatar {
  width: 48px;
  height: 48px;
  background: var(--primary-100);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-600);
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 0.25rem 0;
  word-wrap: break-word;
}

.profile-email {
  font-size: 0.875rem;
  color: var(--gray-500);
  margin: 0;
  word-wrap: break-word;
}

.dropdown-item {
  padding: 0.75rem 1rem !important;
  transition: background-color 0.2s ease !important;
  cursor: pointer;
  display: flex !important;
  align-items: center !important;
}

.dropdown-item:hover {
  background-color: var(--gray-50) !important;
}

.dropdown-item.logout:hover {
  background-color: var(--error-50) !important;
  color: var(--error-700) !important;
}

/* 메인 콘텐츠 */
.main-content {
  flex: 1;
  margin-left: 280px;
  transition: margin-left 0.3s ease;
  min-height: 100vh;
  background: var(--gray-50);
}

.collapsed + * .main-content {
  margin-left: 80px;
}

.content-wrapper {
  min-height: calc(100vh - 80px);
  margin-top: 80px;
}

/* 반응형 디자인 */
@media (max-width: 1024px) {
  .modern-sidebar {
    transform: translateX(-100%);
    z-index: 1100;
  }
  
  .modern-sidebar.collapsed {
    transform: translateX(-100%);
  }
  
  .modern-header {
    margin-left: 0;
  }
  
  .main-content {
    margin-left: 0;
  }
  
  .user-button .user-info {
    display: none;
  }
  
  .dropdown-icon {
    display: none;
  }
}

@media (max-width: 768px) {
  .header-content {
    padding: 1rem;
  }
  
  .page-title {
    font-size: 1.25rem;
  }
  
  .breadcrumb {
    display: none;
  }
  
  .header-actions {
    gap: 0.25rem;
  }
  
  .action-btn {
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 640px) {
  .header-right {
    gap: 1rem;
  }
  
  .user-button {
    padding: 0.5rem;
  }
}
</style>