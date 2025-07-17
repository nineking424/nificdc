<template>
  <div class="app-layout">
    <!-- 모바일 오버레이 -->
    <div 
      v-if="isMobile && drawer" 
      class="mobile-overlay"
      @click="drawer = false"
    ></div>
    
    <!-- 모던 사이드바 -->
    <aside class="modern-sidebar" :class="{ 
      collapsed: !drawer,
      'mobile-sidebar': isMobile,
      'mobile-open': isMobile && drawer
    }">
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
        <v-menu location="top" :close-on-content-click="false">
          <template #activator="{ props }">
            <div class="user-info" v-bind="props">
              <div class="user-avatar">
                <v-icon size="16">mdi-account</v-icon>
              </div>
              <div class="user-details">
                <span class="user-name">{{ userInfo.name }}</span>
                <span class="user-role">관리자</span>
              </div>
              <v-icon size="16" class="user-dropdown-icon">mdi-chevron-up</v-icon>
            </div>
          </template>
          
          <v-list class="sidebar-user-dropdown">
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
        
        <button class="home-button" @click="goToHome">
          <v-icon size="18" class="mr-2">mdi-home</v-icon>
          홈으로
        </button>
      </div>
    </aside>

    <!-- 모던 헤더 -->
    <header class="modern-header">
      <div class="header-content">
        <div class="header-left">
          <!-- 모바일 메뉴 버튼 -->
          <button 
            v-if="isMobile"
            class="mobile-menu-btn"
            @click="toggleDrawer"
          >
            <v-icon size="24">mdi-menu</v-icon>
          </button>
          
          <div>
            <h1 class="page-title">{{ currentPageTitle }}</h1>
            <div class="breadcrumb">
              <router-link to="/dashboard" class="breadcrumb-item">대시보드</router-link>
              <span class="breadcrumb-separator">/</span>
              <span class="breadcrumb-current">{{ currentPageTitle }}</span>
            </div>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import { useDisplay } from 'vuetify'

export default {
  name: 'AppLayout',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const authStore = useAuthStore()
    const toast = useToast()
    const { mobile } = useDisplay()
    
    const drawer = ref(true)
    const isMobile = computed(() => mobile.value)
    
    const menuItems = [
      {
        title: '대시보드',
        icon: 'mdi-view-dashboard',
        to: '/dashboard',
        name: 'Dashboard'
      },
      {
        title: '시스템 관리',
        icon: 'mdi-server-network',
        to: '/systems',
        name: 'Systems'
      },
      {
        title: '매핑 관리',
        icon: 'mdi-network-outline',
        to: '/mappings',
        name: 'Mappings'
      },
      {
        title: '작업 관리',
        icon: 'mdi-briefcase-outline',
        to: '/jobs',
        name: 'Jobs'
      },
      {
        title: '모니터링',
        icon: 'mdi-monitor-dashboard',
        to: '/monitoring',
        name: 'Monitoring'
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
    
    const goToHome = () => {
      router.push('/')
    }
    
    // 라이프사이클
    onMounted(() => {
      // 모바일이 아닌 경우에만 저장된 사이드바 상태 복원
      if (!isMobile.value) {
        const collapsed = localStorage.getItem('sidebarCollapsed')
        if (collapsed !== null) {
          drawer.value = collapsed === 'false'
        }
      } else {
        // 모바일에서는 기본적으로 사이드바를 닫아둠
        drawer.value = false
      }
    })
    
    return {
      drawer,
      isMobile,
      menuItems,
      currentPageTitle,
      userInfo,
      toggleDrawer,
      refreshPage,
      openNotifications,
      openProfile,
      openSettings,
      logout,
      goToHome
    }
  }
}
</script>

<style scoped>
/* App Layout Container */
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--gray-50);
}

/* Sidebar */
.modern-sidebar {
  width: 260px;
  background: var(--white);
  border-right: 1px solid var(--gray-100);
  transition: all var(--transition-base);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  z-index: 1000;
}

.modern-sidebar.collapsed {
  width: 70px;
}

/* Mobile Overlay */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  backdrop-filter: blur(4px);
}

/* Mobile Sidebar */
.modern-sidebar.mobile-sidebar {
  transform: translateX(-100%);
  transition: transform var(--transition-base);
  width: 260px;
  z-index: 1001;
}

.modern-sidebar.mobile-open {
  transform: translateX(0);
  box-shadow: var(--shadow-xl);
}

/* Sidebar Header */
.sidebar-header {
  padding: var(--space-6) var(--space-4);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80px;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
}

.brand-icon {
  width: 42px;
  height: 42px;
  background: var(--primary-soft);
  border-radius: var(--radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--primary);
}

.brand-text {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.brand-main {
  font-size: var(--font-size-xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  line-height: 1.2;
}

.brand-sub {
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toggle-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--gray-50);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
  color: var(--gray-600);
  flex-shrink: 0;
}

.toggle-btn:hover {
  background: var(--gray-100);
  color: var(--gray-800);
}

/* Sidebar Navigation */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) 0;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item {
  margin: 0;
  padding: 0 var(--space-3);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-base);
  text-decoration: none;
  color: var(--gray-700);
  font-weight: var(--font-medium);
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
  position: relative;
}

.nav-link:hover {
  background: var(--gray-50);
  color: var(--gray-900);
}

.nav-link.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: var(--font-semibold);
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
  transition: opacity var(--transition-base);
}

.collapsed .nav-text {
  opacity: 0;
  display: none;
}

.nav-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--primary);
  border-radius: 0 var(--radius-full) var(--radius-full) 0;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: var(--space-4);
  border-top: 1px solid var(--gray-100);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--gray-50);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.user-info:hover {
  background: var(--gray-100);
}

.user-avatar {
  width: 36px;
  height: 36px;
  background: var(--primary-soft);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.user-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: var(--font-size-xs);
  color: var(--gray-500);
}

.user-dropdown-icon {
  color: var(--gray-400);
  transition: transform var(--transition-base);
}

.user-info:hover .user-dropdown-icon {
  transform: rotate(180deg);
}

/* Header */
.modern-header {
  background: var(--white);
  border-bottom: 1px solid var(--gray-100);
  position: fixed;
  top: 0;
  right: 0;
  left: 260px;
  height: 80px;
  z-index: 100;
  transition: left var(--transition-base);
}

.collapsed ~ .modern-header {
  left: 70px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  height: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.mobile-menu-btn {
  display: none;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--gray-50);
  border-radius: var(--radius-base);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
  color: var(--gray-600);
}

.mobile-menu-btn:hover {
  background: var(--gray-100);
  color: var(--gray-800);
}

.page-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  margin-top: var(--space-1);
}

.breadcrumb-item {
  color: var(--gray-500);
  text-decoration: none;
  transition: color var(--transition-base);
}

.breadcrumb-item:hover {
  color: var(--primary);
}

.breadcrumb-separator {
  color: var(--gray-300);
}

.breadcrumb-current {
  color: var(--gray-700);
  font-weight: var(--font-medium);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.action-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--gray-50);
  border-radius: var(--radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
  color: var(--gray-600);
  position: relative;
}

.action-btn:hover {
  background: var(--gray-100);
  color: var(--gray-800);
}

.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  background: var(--error);
  color: var(--white);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-1);
  border: 2px solid var(--white);
}

/* User Dropdown */
.sidebar-user-dropdown {
  border-radius: var(--radius-base) !important;
  box-shadow: var(--shadow-lg) !important;
  border: 1px solid var(--gray-100) !important;
  padding: var(--space-2) 0 !important;
  min-width: 240px;
  background: var(--white) !important;
}

.user-profile {
  padding: var(--space-4) !important;
  border-bottom: 1px solid var(--gray-100) !important;
}

.profile-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.profile-avatar {
  width: 48px;
  height: 48px;
  background: var(--primary-soft);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-1) 0;
}

.profile-email {
  font-size: var(--font-size-sm);
  color: var(--gray-500);
  margin: 0;
}

.dropdown-item {
  padding: var(--space-3) var(--space-4) !important;
  transition: background-color var(--transition-base) !important;
  cursor: pointer;
  display: flex !important;
  align-items: center !important;
  font-size: var(--font-size-sm) !important;
}

.dropdown-item:hover {
  background-color: var(--gray-50) !important;
}

.dropdown-item.logout:hover {
  background-color: var(--error-soft) !important;
  color: var(--error) !important;
}

/* Main Content */
.main-content {
  position: fixed;
  top: 80px;
  left: 260px;
  right: 0;
  bottom: 0;
  transition: left var(--transition-base);
  background: var(--gray-50);
  overflow-y: auto;
}

.collapsed ~ .main-content {
  left: 70px;
}

.content-wrapper {
  min-height: 100%;
  padding-bottom: var(--space-8);
}

/* Home Button */
.home-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: var(--space-3);
  margin-top: var(--space-3);
  background: var(--primary-soft);
  border: none;
  border-radius: var(--radius-base);
  color: var(--primary);
  font-weight: var(--font-medium);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.home-button:hover {
  background: var(--primary);
  color: var(--white);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .modern-sidebar {
    transform: translateX(-100%);
  }
  
  .modern-sidebar.collapsed {
    transform: translateX(-100%);
  }
  
  .modern-header {
    left: 0;
  }
  
  .main-content {
    left: 0;
  }
  
  .mobile-menu-btn {
    display: flex;
  }
}

@media (max-width: 768px) {
  .header-content {
    padding: 0 var(--space-4);
  }
  
  .page-title {
    font-size: var(--font-size-xl);
  }
  
  .breadcrumb {
    display: none;
  }
  
  .header-actions {
    gap: var(--space-1);
  }
  
  .action-btn {
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 640px) {
  .modern-sidebar {
    width: 260px;
  }
  
  .header-content {
    padding: 0 var(--space-3);
  }
  
  .sidebar-header {
    padding: var(--space-4);
    height: 64px;
  }
  
  .nav-link {
    padding: var(--space-3);
    min-height: 44px;
  }
}
</style>