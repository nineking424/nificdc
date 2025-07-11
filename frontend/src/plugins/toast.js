import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

const options = {
  position: 'top-right',
  timeout: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false,
  transition: 'Vue-Toastification__bounce',
  maxToasts: 5,
  newestOnTop: true,
  
  // 커스텀 CSS 클래스
  toastClassName: 'nificdc-toast',
  bodyClassName: 'nificdc-toast-body',
  containerClassName: 'nificdc-toast-container',
  
  // 토스트 타입별 설정
  toastDefaults: {
    success: {
      timeout: 3000,
      hideProgressBar: false
    },
    error: {
      timeout: 6000,
      hideProgressBar: false
    },
    warning: {
      timeout: 5000,
      hideProgressBar: false
    },
    info: {
      timeout: 4000,
      hideProgressBar: false
    }
  }
}

export default {
  install(app) {
    app.use(Toast, options)
  }
}