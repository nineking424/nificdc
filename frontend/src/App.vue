<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<script>
export default {
  name: 'App',
  mounted() {
    // 앱 초기화 시 테마 설정
    this.$vuetify.theme.global.name = 'light'
    
    // 로컬 스토리지에서 테마 설정 불러오기
    const savedTheme = localStorage.getItem('nificdc-theme')
    if (savedTheme) {
      this.$vuetify.theme.global.name = savedTheme
    }
  }
}
</script>

<style>
/* 모바일 터치 문제 수정 */
@import '@/styles/mobile-fix.css';

/* 글로벌 스타일 리셋 */
* {
  box-sizing: border-box;
}

html {
  overflow-y: auto;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f5f5;
}

#app {
  min-height: 100vh;
  width: 100%;
}

/* 스크롤바 스타일링 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 커스텀 애니메이션 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from {
  transform: translateX(-100%);
}

.slide-leave-to {
  transform: translateX(100%);
}

/* 유틸리티 클래스 */
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cursor-pointer {
  cursor: pointer;
}

.full-height {
  height: 100vh;
}

.full-width {
  width: 100%;
}

/* 로딩 스피너 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* 에러 상태 */
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.error-icon {
  font-size: 4rem;
  color: #f44336;
  margin-bottom: 1rem;
}

.error-message {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 1rem;
}

/* 성공 상태 */
.success-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.success-icon {
  font-size: 4rem;
  color: #4caf50;
  margin-bottom: 1rem;
}

.success-message {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 1rem;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .hide-mobile {
    display: none !important;
  }
  
  .full-width-mobile {
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  .hide-mobile-small {
    display: none !important;
  }
}
</style>