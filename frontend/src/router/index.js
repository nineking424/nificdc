import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { 
          requiresAuth: true,
          title: '대시보드',
          icon: 'mdi-view-dashboard'
        }
      },
      {
        path: 'systems',
        name: 'Systems',
        component: () => import('@/views/Systems.vue'),
        meta: { 
          requiresAuth: true,
          title: '시스템 관리',
          icon: 'mdi-server'
        }
      },
      {
        path: 'systems/:id',
        name: 'SystemDetail',
        component: () => import('@/views/SystemDetail.vue'),
        meta: { 
          requiresAuth: true,
          title: '시스템 상세',
          parent: 'Systems'
        }
      },
      {
        path: 'data-schemas',
        name: 'DataSchemas',
        component: () => import('@/views/DataSchemas.vue'),
        meta: { 
          requiresAuth: true,
          title: '데이터 스키마',
          icon: 'mdi-table'
        }
      },
      {
        path: 'data-schemas/:id',
        name: 'DataSchemaDetail',
        component: () => import('@/views/DataSchemaDetail.vue'),
        meta: { 
          requiresAuth: true,
          title: '스키마 상세',
          parent: 'DataSchemas'
        }
      },
      {
        path: 'mappings',
        name: 'Mappings',
        component: () => import('@/views/Mappings.vue'),
        meta: { 
          requiresAuth: true,
          title: '매핑 관리',
          icon: 'mdi-shuffle-variant'
        }
      },
      {
        path: 'mappings/:id',
        name: 'MappingDetail',
        component: () => import('@/views/MappingDetail.vue'),
        meta: { 
          requiresAuth: true,
          title: '매핑 상세',
          parent: 'Mappings'
        }
      },
      {
        path: 'jobs',
        name: 'Jobs',
        component: () => import('@/views/Jobs.vue'),
        meta: { 
          requiresAuth: true,
          title: '작업 관리',
          icon: 'mdi-briefcase'
        }
      },
      {
        path: 'jobs/:id',
        name: 'JobDetail',
        component: () => import('@/views/JobDetail.vue'),
        meta: { 
          requiresAuth: true,
          title: '작업 상세',
          parent: 'Jobs'
        }
      },
      {
        path: 'monitoring',
        name: 'Monitoring',
        component: () => import('@/views/Monitoring.vue'),
        meta: { 
          requiresAuth: true,
          title: '모니터링',
          icon: 'mdi-monitor'
        }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings.vue'),
        meta: { 
          requiresAuth: true,
          title: '설정',
          icon: 'mdi-cog'
        }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { 
          requiresAuth: true,
          title: '프로필',
          icon: 'mdi-account'
        }
      }
    ]
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
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { 
      requiresAuth: false,
      title: '회원가입'
    }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPassword.vue'),
    meta: { 
      requiresAuth: false,
      title: '비밀번호 찾기'
    }
  },
  {
    path: '/reset-password/:token',
    name: 'ResetPassword',
    component: () => import('@/views/ResetPassword.vue'),
    meta: { 
      requiresAuth: false,
      title: '비밀번호 재설정'
    }
  },
  {
    path: '/unauthorized',
    name: 'Unauthorized',
    component: () => import('@/views/Unauthorized.vue'),
    meta: { 
      requiresAuth: false,
      title: '권한 없음'
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
  const authStore = useAuthStore()
  const appStore = useAppStore()
  
  // 로딩 상태 시작
  appStore.setLoading(true)
  
  try {
    // 인증이 필요한 페이지인지 확인
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    
    // 토큰이 있는 경우 사용자 정보 확인
    if (authStore.token && !authStore.user) {
      try {
        await authStore.fetchUser()
      } catch (error) {
        console.error('Failed to fetch user:', error)
        authStore.logout()
      }
    }
    
    // 인증이 필요한 페이지에 비인증 사용자가 접근하는 경우
    if (requiresAuth && !authStore.isAuthenticated) {
      next({ 
        name: 'Login', 
        query: { redirect: to.fullPath } 
      })
      return
    }
    
    // 인증된 사용자가 로그인 페이지에 접근하는 경우
    if (to.name === 'Login' && authStore.isAuthenticated) {
      next({ name: 'Dashboard' })
      return
    }
    
    // 페이지 타이틀 설정
    if (to.meta.title) {
      document.title = `${to.meta.title} - NiFiCDC`
    } else {
      document.title = 'NiFiCDC'
    }
    
    // 네비게이션 히스토리 업데이트
    appStore.addToHistory({
      name: to.name,
      path: to.path,
      title: to.meta.title,
      timestamp: Date.now()
    })
    
    next()
  } catch (error) {
    console.error('Navigation guard error:', error)
    next({ name: 'NotFound' })
  }
})

router.afterEach(() => {
  const appStore = useAppStore()
  // 로딩 상태 종료
  appStore.setLoading(false)
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