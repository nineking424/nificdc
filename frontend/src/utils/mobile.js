/**
 * 모바일 유틸리티 함수들
 */

// 디바이스 감지
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isTablet = () => {
  return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
};

export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroid = () => {
  return /Android/i.test(navigator.userAgent);
};

// 터치 디바이스 감지
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// 뷰포트 크기
export const getViewportSize = () => {
  return {
    width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
    height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
  };
};

// 브레이크포인트 체크
export const isBreakpoint = (breakpoint) => {
  const breakpoints = {
    xs: 375,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    xxl: 1536
  };
  
  const viewportWidth = getViewportSize().width;
  return viewportWidth <= breakpoints[breakpoint];
};

// 안전 영역 지원 체크
export const supportsSafeArea = () => {
  return CSS.supports('padding-top: env(safe-area-inset-top)');
};

// 햅틱 피드백 (iOS만)
export const hapticFeedback = (type = 'light') => {
  if (isIOS() && window.navigator && window.navigator.vibrate) {
    const patterns = {
      light: [10],
      medium: [10, 10, 10],
      heavy: [10, 10, 10, 10, 10]
    };
    window.navigator.vibrate(patterns[type] || patterns.light);
  }
};

// 스크롤 잠금 (모달 열릴 때 유용)
export const lockScroll = () => {
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
};

export const unlockScroll = () => {
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';
};

// 터치 제스처 감지
export const addSwipeGesture = (element, callbacks = {}) => {
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  
  const minSwipeDistance = 100;
  
  const handleTouchStart = (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  };
  
  const handleTouchEnd = (e) => {
    endX = e.changedTouches[0].clientX;
    endY = e.changedTouches[0].clientY;
    
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // 가로 스와이프
      if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          callbacks.swipeRight && callbacks.swipeRight();
        } else {
          callbacks.swipeLeft && callbacks.swipeLeft();
        }
      }
    } else {
      // 세로 스와이프
      if (Math.abs(deltaY) > minSwipeDistance) {
        if (deltaY > 0) {
          callbacks.swipeDown && callbacks.swipeDown();
        } else {
          callbacks.swipeUp && callbacks.swipeUp();
        }
      }
    }
  };
  
  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });
  
  // 정리 함수 반환
  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
  };
};

// 터치 피드백 추가
export const addTouchFeedback = (element) => {
  let touchTimeout;
  
  const handleTouchStart = () => {
    element.style.transform = 'scale(0.98)';
    element.style.opacity = '0.8';
    hapticFeedback('light');
  };
  
  const handleTouchEnd = () => {
    clearTimeout(touchTimeout);
    touchTimeout = setTimeout(() => {
      element.style.transform = '';
      element.style.opacity = '';
    }, 150);
  };
  
  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });
  element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  
  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd);
  };
};

// 키보드 표시/숨김 감지 (모바일)
export const detectVirtualKeyboard = (callback) => {
  if (!isMobile()) return;
  
  const initialViewportHeight = getViewportSize().height;
  
  const handleResize = () => {
    const currentHeight = getViewportSize().height;
    const heightDifference = initialViewportHeight - currentHeight;
    
    // 키보드가 표시되었다고 판단되는 임계값 (150px)
    const isKeyboardVisible = heightDifference > 150;
    
    callback(isKeyboardVisible, heightDifference);
  };
  
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
};

// 풀 스크린 모드
export const enterFullscreen = (element = document.documentElement) => {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
};

export const exitFullscreen = () => {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
};

// 화면 방향 감지
export const getOrientation = () => {
  if (screen.orientation) {
    return screen.orientation.angle === 0 || screen.orientation.angle === 180 ? 'portrait' : 'landscape';
  }
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
};

export const onOrientationChange = (callback) => {
  const handleOrientationChange = () => {
    // 방향 변경 후 약간의 지연을 두고 실행 (iOS 버그 방지)
    setTimeout(() => {
      callback(getOrientation());
    }, 100);
  };
  
  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('resize', handleOrientationChange);
  
  return () => {
    window.removeEventListener('orientationchange', handleOrientationChange);
    window.removeEventListener('resize', handleOrientationChange);
  };
};

// 네트워크 상태 감지
export const getNetworkStatus = () => {
  return {
    online: navigator.onLine,
    connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection
  };
};

export const onNetworkChange = (callback) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// PWA 설치 감지
export const canInstallPWA = () => {
  return 'beforeinstallprompt' in window;
};

export const isInStandaloneMode = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
};

// 모바일 최적화 초기화
export const initMobileOptimization = () => {
  // iOS Safari 100vh 버그 수정
  const setVHProperty = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  setVHProperty();
  window.addEventListener('resize', setVHProperty);
  window.addEventListener('orientationchange', () => {
    setTimeout(setVHProperty, 100);
  });
  
  // 터치 스크롤 개선
  document.addEventListener('touchstart', () => {}, { passive: true });
  
  // 탭 하이라이트 제거 (CSS로 처리되지만 추가 보장)
  document.addEventListener('touchstart', (e) => {
    e.target.style.webkitTapHighlightColor = 'transparent';
  }, { passive: true });
  
  return () => {
    window.removeEventListener('resize', setVHProperty);
    window.removeEventListener('orientationchange', setVHProperty);
  };
};

export default {
  isMobile,
  isTablet,
  isIOS,
  isAndroid,
  isTouchDevice,
  getViewportSize,
  isBreakpoint,
  supportsSafeArea,
  hapticFeedback,
  lockScroll,
  unlockScroll,
  addSwipeGesture,
  addTouchFeedback,
  detectVirtualKeyboard,
  enterFullscreen,
  exitFullscreen,
  getOrientation,
  onOrientationChange,
  getNetworkStatus,
  onNetworkChange,
  canInstallPWA,
  isInStandaloneMode,
  initMobileOptimization
};