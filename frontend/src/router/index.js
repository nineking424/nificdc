import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: { 
      requiresAuth: false,
      title: 'NiFiCDC Platform'
    }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { 
      requiresAuth: true,
      title: '대시보드',
      icon: 'mdi-view-dashboard'
    }
  },
  {
    path: '/systems',
    name: 'Systems',
    component: () => import('@/views/SystemManagement.vue'),
    meta: { 
      requiresAuth: true,
      title: '시스템 관리',
      icon: 'mdi-server-network'
    }
  },
  {
    path: '/mappings',
    name: 'Mappings',
    component: () => import('@/views/MappingManagement.vue'),
    meta: { 
      requiresAuth: true,
      title: '매핑 관리',
      icon: 'mdi-network-outline'
    }
  },
  {
    path: '/jobs',
    name: 'Jobs',
    component: () => import('@/views/JobManagement.vue'),
    meta: { 
      requiresAuth: true,
      title: '작업 관리',
      icon: 'mdi-briefcase-outline'
    }
  },
  {
    path: '/monitoring',
    name: 'Monitoring',
    component: () => import('@/views/MonitoringDashboard.vue'),
    meta: { 
      requiresAuth: true,
      title: '모니터링',
      icon: 'mdi-monitor-dashboard'
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { 
      requiresAuth: false,
      title: '로그인'
    }
  },
  {
    path: '/not-found',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
    meta: { 
      requiresAuth: false,
      title: '페이지를 찾을 수 없음'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/not-found'
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// 네비게이션 가드
router.beforeEach(async (to, from, next) => {
  try {
    // 페이지 타이틀 설정
    if (to.meta.title) {
      document.title = `${to.meta.title} - NiFiCDC`
    } else {
      document.title = 'NiFiCDC'
    }
    
    // 인증이 필요한 페이지 확인
    if (to.meta.requiresAuth) {
      const authStore = useAuthStore()
      
      // 토큰이 있지만 사용자 정보가 없는 경우 (새로고침 후)
      if (authStore.token && !authStore.user) {
        try {
          // 사용자 정보 복원 시도
          await authStore.initialize()
        } catch (error) {
          console.error('Failed to restore user session:', error)
          // 초기화 실패 시 로그아웃 처리
          await authStore.logout()
        }
      }
      
      // 인증 상태 재확인
      if (!authStore.isAuthenticated) {
        // 로그인 페이지로 리다이렉트
        next({ 
          name: 'Login', 
          query: { redirect: to.fullPath } 
        })
        return
      }
    }
    
    // 로그인한 사용자가 로그인 페이지에 접근하려 할 때
    if (to.name === 'Login') {
      const authStore = useAuthStore()
      
      // 토큰이 있지만 사용자 정보가 없는 경우 초기화 시도
      if (authStore.token && !authStore.user) {
        try {
          await authStore.initialize()
        } catch (error) {
          console.error('Failed to restore user session:', error)
          await authStore.logout()
        }
      }
      
      if (authStore.isAuthenticated) {
        const redirectPath = to.query.redirect || '/dashboard'
        next({ path: redirectPath })
        return
      }
    }
    
    next()
  } catch (error) {
    console.error('Navigation guard error:', error)
    next({ name: 'NotFound' })
  }
})

// 라우터 에러 핸들링
router.onError((error) => {
  console.error('Router error:', error)
  const appStore = useAppStore()
  appStore.setError({
    message: '페이지 로딩 중 오류가 발생했습니다.',
    details: error.message
  })
})

export default router

// 라우터 유틸리티 함수들
export const getRouteTitle = (routeName) => {
  const route = routes.find(r => r.name === routeName)
  return route?.meta?.title || routeName
}

export const getMainRoutes = () => {
  return routes[0].children.filter(route => 
    route.meta?.icon && !route.meta?.parent
  )
}

export const getBreadcrumbs = (currentRoute) => {
  const breadcrumbs = []
  
  // 부모 라우트가 있는 경우 추가
  if (currentRoute.meta.parent) {
    const parentRoute = routes[0].children.find(route => 
      route.name === currentRoute.meta.parent
    )
    if (parentRoute) {
      breadcrumbs.push({
        text: parentRoute.meta.title,
        to: { name: parentRoute.name },
        disabled: false
      })
    }
  }
  
  // 현재 라우트 추가
  breadcrumbs.push({
    text: currentRoute.meta.title,
    to: { name: currentRoute.name },
    disabled: true
  })
  
  return breadcrumbs
}