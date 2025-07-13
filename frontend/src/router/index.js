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
  // {
  //   path: '/systems',
  //   name: 'Systems',
  //   component: () => import('@/views/SystemManagement.vue'),
  //   meta: { 
  //     requiresAuth: false,
  //     title: '시스템 관리'
  //   }
  // },
  // {
  //   path: '/mappings',
  //   name: 'Mappings',
  //   component: () => import('@/views/MappingManagement.vue'),
  //   meta: { 
  //     requiresAuth: false,
  //     title: '매핑 관리'
  //   }
  // },
  // {
  //   path: '/jobs',
  //   name: 'Jobs',
  //   component: () => import('@/views/JobManagement.vue'),
  //   meta: { 
  //     requiresAuth: false,
  //     title: '작업 관리'
  //   }
  // },
  // {
  //   path: '/monitoring',
  //   name: 'Monitoring',
  //   component: () => import('@/views/MonitoringDashboard.vue'),
  //   meta: { 
  //     requiresAuth: false,
  //     title: '모니터링'
  //   }
  // },
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

// 간소화된 네비게이션 가드
router.beforeEach(async (to, from, next) => {
  try {
    // 페이지 타이틀 설정
    if (to.meta.title) {
      document.title = `${to.meta.title} - NiFiCDC`
    } else {
      document.title = 'NiFiCDC'
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