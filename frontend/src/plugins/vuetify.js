import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mdi } from 'vuetify/iconsets/mdi'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

// 커스텀 테마 정의
const lightTheme = {
  dark: false,
  colors: {
    primary: '#1976D2',
    secondary: '#424242',
    accent: '#82B1FF',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
    
    // 커스텀 컬러
    background: '#FAFAFA',
    surface: '#FFFFFF',
    'surface-variant': '#F5F5F5',
    'on-surface-variant': '#424242',
    
    // NiFi 관련 컬러
    nifi: '#1976D2',
    'nifi-light': '#42A5F5',
    'nifi-dark': '#1565C0',
    
    // 상태 컬러
    running: '#4CAF50',
    stopped: '#F44336',
    disabled: '#9E9E9E',
    invalid: '#FF5722',
    validating: '#FF9800',
    
    // 데이터 타입 컬러
    string: '#2196F3',
    number: '#4CAF50',
    boolean: '#FF9800',
    date: '#9C27B0',
    object: '#607D8B'
  }
}

const darkTheme = {
  dark: true,
  colors: {
    primary: '#2196F3',
    secondary: '#616161',
    accent: '#FF4081',
    error: '#F44336',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FF9800',
    
    // 커스텀 컬러
    background: '#121212',
    surface: '#1E1E1E',
    'surface-variant': '#2C2C2C',
    'on-surface-variant': '#E0E0E0',
    
    // NiFi 관련 컬러
    nifi: '#2196F3',
    'nifi-light': '#64B5F6',
    'nifi-dark': '#1976D2',
    
    // 상태 컬러
    running: '#66BB6A',
    stopped: '#EF5350',
    disabled: '#BDBDBD',
    invalid: '#FF7043',
    validating: '#FFB74D',
    
    // 데이터 타입 컬러
    string: '#64B5F6',
    number: '#81C784',
    boolean: '#FFB74D',
    date: '#BA68C8',
    object: '#90A4AE'
  }
}

// Vuetify 설정
export default createVuetify({
  components,
  directives,
  
  // 아이콘 설정
  icons: {
    defaultSet: 'mdi',
    sets: {
      mdi
    }
  },
  
  // 테마 설정
  theme: {
    defaultTheme: 'light',
    themes: {
      light: lightTheme,
      dark: darkTheme
    },
    variations: {
      colors: ['primary', 'secondary', 'accent', 'error', 'info', 'success', 'warning'],
      lighten: 4,
      darken: 4
    }
  },
  
  // 기본 설정
  defaults: {
    // 버튼
    VBtn: {
      variant: 'flat',
      style: [
        {
          textTransform: 'none',
          fontWeight: '500'
        }
      ]
    },
    
    // 카드
    VCard: {
      variant: 'elevated',
      elevation: 1
    },
    
    // 데이터 테이블
    VDataTable: {
      noDataText: '데이터가 없습니다.',
      itemsPerPageText: '페이지당 항목:',
      pageText: '{0}-{1} / {2}',
      density: 'default',
      showSelect: false
    },
    
    // 텍스트 필드
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto'
    },
    
    // 셀렉트
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      hideDetails: 'auto'
    },
    
    // 체크박스
    VCheckbox: {
      hideDetails: 'auto',
      density: 'comfortable'
    },
    
    // 스위치
    VSwitch: {
      hideDetails: 'auto',
      density: 'comfortable',
      inset: true
    },
    
    // 탭
    VTabs: {
      color: 'primary',
      sliderColor: 'primary'
    },
    
    // 칩
    VChip: {
      variant: 'tonal',
      size: 'small'
    },
    
    // 뱃지
    VBadge: {
      location: 'top end'
    },
    
    // 툴팁
    VTooltip: {
      location: 'top'
    },
    
    // 다이얼로그
    VDialog: {
      maxWidth: '600px'
    },
    
    // 스낵바
    VSnackbar: {
      timeout: 4000,
      location: 'bottom'
    },
    
    // 앱바
    VAppBar: {
      elevation: 1
    },
    
    // 네비게이션 드로어
    VNavigationDrawer: {
      elevation: 1
    }
  },
  
  // 디스플레이 설정 (반응형)
  display: {
    mobileBreakpoint: 'sm',
    thresholds: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
      xxl: 2560
    }
  },
  
  // 로케일 설정
  locale: {
    locale: 'ko',
    fallback: 'en',
    messages: {
      ko: {
        badge: '뱃지',
        close: '닫기',
        dataIterator: {
          noResultsText: '검색 결과가 없습니다.',
          loadingText: '항목을 불러오는 중...'
        },
        dataTable: {
          itemsPerPageText: '페이지당 행:',
          ariaLabel: {
            sortDescending: '내림차순으로 정렬됨.',
            sortAscending: '오름차순으로 정렬됨.',
            sortNone: '정렬되지 않음.',
            activateNone: '정렬을 제거하려면 활성화하세요.',
            activateDescending: '내림차순으로 정렬하려면 활성화하세요.',
            activateAscending: '오름차순으로 정렬하려면 활성화하세요.'
          },
          sortBy: '정렬 기준'
        },
        dataFooter: {
          itemsPerPageText: '페이지당 항목:',
          itemsPerPageAll: '전체',
          nextPage: '다음 페이지',
          prevPage: '이전 페이지',
          firstPage: '첫 페이지',
          lastPage: '마지막 페이지',
          pageText: '{2}개 중 {0}-{1}'
        },
        dateRangeInput: {
          divider: '~'
        },
        datePicker: {
          ok: '확인',
          cancel: '취소',
          range: {
            title: '날짜 선택',
            header: '날짜 입력'
          },
          title: '날짜 선택',
          header: '날짜 입력',
          input: {
            placeholder: '날짜 입력'
          }
        },
        noDataText: '데이터가 없습니다.',
        carousel: {
          prev: '이전 슬라이드',
          next: '다음 슬라이드',
          ariaLabel: {
            delimiter: '캐러셀 슬라이드 {0} / {1}'
          }
        },
        calendar: {
          moreEvents: '{0}개 더'
        },
        input: {
          clear: '지우기',
          prependAction: '{0} 앞 작업',
          appendAction: '{0} 뒤 작업'
        },
        fileInput: {
          counter: '{0}개 파일',
          counterSize: '{0}개 파일 (총 {1})'
        },
        timePicker: {
          am: 'AM',
          pm: 'PM'
        },
        pagination: {
          ariaLabel: {
            root: '페이지네이션 네비게이션',
            next: '다음 페이지',
            previous: '이전 페이지',
            page: '페이지 {0}로 이동',
            currentPage: '현재 페이지, 페이지 {0}',
            first: '첫 페이지',
            last: '마지막 페이지'
          }
        },
        stepper: {
          next: '다음',
          prev: '이전'
        },
        rating: {
          ariaLabel: {
            item: '평점 {0} / {1}'
          }
        },
        loading: '불러오는 중...',
        infiniteScroll: {
          loadMore: '더 보기',
          empty: '더 이상 항목이 없습니다.'
        }
      }
    }
  }
})