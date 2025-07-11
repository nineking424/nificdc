import { createI18n } from 'vue-i18n'

// 한국어 메시지
const ko = {
  // 공통
  common: {
    ok: '확인',
    cancel: '취소',
    save: '저장',
    delete: '삭제',
    edit: '편집',
    add: '추가',
    search: '검색',
    filter: '필터',
    reset: '초기화',
    refresh: '새로고침',
    loading: '로딩 중...',
    noData: '데이터가 없습니다',
    error: '오류',
    success: '성공',
    warning: '경고',
    info: '정보',
    close: '닫기',
    back: '뒤로',
    next: '다음',
    previous: '이전',
    submit: '제출',
    clear: '지우기',
    select: '선택',
    upload: '업로드',
    download: '다운로드',
    export: '내보내기',
    import: '가져오기',
    copy: '복사',
    paste: '붙여넣기',
    cut: '잘라내기',
    undo: '실행 취소',
    redo: '다시 실행',
    settings: '설정',
    help: '도움말',
    about: '정보',
    version: '버전',
    language: '언어',
    theme: '테마',
    profile: '프로필',
    logout: '로그아웃',
    login: '로그인',
    register: '회원가입'
  },
  
  // 네비게이션
  nav: {
    dashboard: '대시보드',
    systems: '시스템 관리',
    dataSchemas: '데이터 스키마',
    mappings: '매핑 관리',
    jobs: '작업 관리',
    monitoring: '모니터링',
    settings: '설정',
    profile: '프로필'
  },
  
  // 대시보드
  dashboard: {
    title: '대시보드',
    overview: '개요',
    systemStatus: '시스템 상태',
    activeJobs: '활성 작업',
    recentJobs: '최근 작업',
    systemHealth: '시스템 상태',
    dataTransfer: '데이터 전송',
    errorRate: '오류율',
    throughput: '처리량'
  },
  
  // 시스템 관리
  systems: {
    title: '시스템 관리',
    add: '시스템 추가',
    edit: '시스템 편집',
    name: '시스템 이름',
    type: '시스템 타입',
    description: '설명',
    connectionInfo: '연결 정보',
    isActive: '활성 상태',
    createdAt: '생성일',
    updatedAt: '수정일',
    testConnection: '연결 테스트',
    connectionSuccess: '연결 성공',
    connectionFailed: '연결 실패',
    deleteConfirm: '정말로 이 시스템을 삭제하시겠습니까?',
    
    // 시스템 타입
    types: {
      oracle: 'Oracle Database',
      postgresql: 'PostgreSQL',
      mysql: 'MySQL',
      mssql: 'SQL Server',
      sqlite: 'SQLite',
      ftp: 'FTP Server',
      sftp: 'SFTP Server',
      local_fs: 'Local File System',
      aws_s3: 'Amazon S3',
      azure_blob: 'Azure Blob Storage'
    },
    
    // 연결 정보 필드
    connection: {
      host: '호스트',
      port: '포트',
      username: '사용자명',
      password: '비밀번호',
      database: '데이터베이스',
      serviceName: '서비스명',
      schema: '스키마',
      ssl: 'SSL 사용',
      timeout: '타임아웃',
      region: '리전',
      bucket: '버킷',
      path: '경로'
    }
  },
  
  // 데이터 스키마
  dataSchemas: {
    title: '데이터 스키마',
    add: '스키마 추가',
    edit: '스키마 편집',
    name: '스키마 이름',
    version: '버전',
    system: '시스템',
    columns: '컬럼',
    discover: '스키마 탐색',
    
    // 컬럼 정보
    column: {
      name: '컬럼명',
      dataType: '데이터 타입',
      nullable: 'NULL 허용',
      primaryKey: '기본키',
      length: '길이',
      precision: '정밀도',
      scale: '스케일',
      defaultValue: '기본값',
      comment: '설명'
    }
  },
  
  // 매핑 관리
  mappings: {
    title: '매핑 관리',
    add: '매핑 추가',
    edit: '매핑 편집',
    name: '매핑 이름',
    sourceSchema: '소스 스키마',
    targetSchema: '타겟 스키마',
    rules: '매핑 규칙',
    transformation: '변환 스크립트',
    preview: '미리보기',
    validate: '검증'
  },
  
  // 작업 관리
  jobs: {
    title: '작업 관리',
    add: '작업 추가',
    edit: '작업 편집',
    name: '작업 이름',
    mapping: '매핑',
    schedule: '스케줄',
    priority: '우선순위',
    status: '상태',
    lastRun: '마지막 실행',
    nextRun: '다음 실행',
    start: '시작',
    stop: '중지',
    pause: '일시정지',
    resume: '재개',
    
    // 작업 상태
    statuses: {
      pending: '대기',
      running: '실행 중',
      completed: '완료',
      failed: '실패',
      cancelled: '취소',
      paused: '일시정지'
    },
    
    // 우선순위
    priorities: {
      low: '낮음',
      medium: '보통',
      high: '높음',
      urgent: '긴급'
    }
  },
  
  // 모니터링
  monitoring: {
    title: '모니터링',
    realtime: '실시간 모니터링',
    history: '이력',
    alerts: '알림',
    logs: '로그',
    metrics: '메트릭',
    performance: '성능',
    
    // 메트릭
    cpu: 'CPU 사용률',
    memory: '메모리 사용률',
    disk: '디스크 사용률',
    network: '네트워크 사용률',
    connections: '연결 수',
    throughputPerSecond: '초당 처리량',
    errorRate: '오류율',
    responseTime: '응답 시간'
  },
  
  // 인증
  auth: {
    login: '로그인',
    logout: '로그아웃',
    register: '회원가입',
    email: '이메일',
    password: '비밀번호',
    confirmPassword: '비밀번호 확인',
    rememberMe: '로그인 상태 유지',
    forgotPassword: '비밀번호를 잊으셨나요?',
    resetPassword: '비밀번호 재설정',
    changePassword: '비밀번호 변경',
    currentPassword: '현재 비밀번호',
    newPassword: '새 비밀번호',
    confirmNewPassword: '새 비밀번호 확인'
  },
  
  // 에러 메시지
  error: {
    required: '필수 항목입니다',
    invalid: '유효하지 않은 값입니다',
    tooShort: '너무 짧습니다',
    tooLong: '너무 깁니다',
    invalidEmail: '유효하지 않은 이메일 주소입니다',
    passwordMismatch: '비밀번호가 일치하지 않습니다',
    networkError: '네트워크 오류가 발생했습니다',
    serverError: '서버 오류가 발생했습니다',
    unauthorized: '권한이 없습니다',
    forbidden: '접근이 금지되었습니다',
    notFound: '리소스를 찾을 수 없습니다',
    timeout: '요청 시간이 초과되었습니다'
  },
  
  // 성공 메시지
  success: {
    saved: '저장되었습니다',
    deleted: '삭제되었습니다',
    updated: '업데이트되었습니다',
    created: '생성되었습니다',
    sent: '전송되었습니다',
    uploaded: '업로드되었습니다',
    downloaded: '다운로드되었습니다'
  },
  
  // 확인 메시지
  confirm: {
    delete: '정말로 삭제하시겠습니까?',
    discard: '변경사항을 취소하시겠습니까?',
    logout: '로그아웃하시겠습니까?',
    reset: '초기화하시겠습니까?'
  },
  
  // 테이블
  table: {
    noData: '데이터가 없습니다',
    loading: '데이터를 불러오는 중...',
    rowsPerPage: '페이지당 행 수',
    of: '/',
    page: '페이지',
    sortBy: '정렬 기준',
    actions: '작업'
  },
  
  // 폼
  form: {
    selectOption: '옵션을 선택하세요',
    enterValue: '값을 입력하세요',
    chooseFile: '파일을 선택하세요',
    dropFile: '파일을 여기에 드롭하세요',
    required: '필수',
    optional: '선택'
  },
  
  // 날짜/시간
  datetime: {
    now: '지금',
    today: '오늘',
    yesterday: '어제',
    tomorrow: '내일',
    thisWeek: '이번 주',
    lastWeek: '지난 주',
    thisMonth: '이번 달',
    lastMonth: '지난 달',
    thisYear: '올해',
    lastYear: '작년'
  }
}

// 영어 메시지
const en = {
  // 공통
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    reset: 'Reset',
    refresh: 'Refresh',
    loading: 'Loading...',
    noData: 'No data available',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    submit: 'Submit',
    clear: 'Clear',
    select: 'Select',
    upload: 'Upload',
    download: 'Download',
    export: 'Export',
    import: 'Import',
    copy: 'Copy',
    paste: 'Paste',
    cut: 'Cut',
    undo: 'Undo',
    redo: 'Redo',
    settings: 'Settings',
    help: 'Help',
    about: 'About',
    version: 'Version',
    language: 'Language',
    theme: 'Theme',
    profile: 'Profile',
    logout: 'Logout',
    login: 'Login',
    register: 'Register'
  },
  
  // 네비게이션
  nav: {
    dashboard: 'Dashboard',
    systems: 'Systems',
    dataSchemas: 'Data Schemas',
    mappings: 'Mappings',
    jobs: 'Jobs',
    monitoring: 'Monitoring',
    settings: 'Settings',
    profile: 'Profile'
  },
  
  // 대시보드
  dashboard: {
    title: 'Dashboard',
    overview: 'Overview',
    systemStatus: 'System Status',
    activeJobs: 'Active Jobs',
    recentJobs: 'Recent Jobs',
    systemHealth: 'System Health',
    dataTransfer: 'Data Transfer',
    errorRate: 'Error Rate',
    throughput: 'Throughput'
  },
  
  // 시스템 관리
  systems: {
    title: 'System Management',
    add: 'Add System',
    edit: 'Edit System',
    name: 'System Name',
    type: 'System Type',
    description: 'Description',
    connectionInfo: 'Connection Info',
    isActive: 'Active',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    testConnection: 'Test Connection',
    connectionSuccess: 'Connection Successful',
    connectionFailed: 'Connection Failed',
    deleteConfirm: 'Are you sure you want to delete this system?',
    
    // 시스템 타입
    types: {
      oracle: 'Oracle Database',
      postgresql: 'PostgreSQL',
      mysql: 'MySQL',
      mssql: 'SQL Server',
      sqlite: 'SQLite',
      ftp: 'FTP Server',
      sftp: 'SFTP Server',
      local_fs: 'Local File System',
      aws_s3: 'Amazon S3',
      azure_blob: 'Azure Blob Storage'
    },
    
    // 연결 정보 필드
    connection: {
      host: 'Host',
      port: 'Port',
      username: 'Username',
      password: 'Password',
      database: 'Database',
      serviceName: 'Service Name',
      schema: 'Schema',
      ssl: 'Use SSL',
      timeout: 'Timeout',
      region: 'Region',
      bucket: 'Bucket',
      path: 'Path'
    }
  },
  
  // 기타 영어 번역은 한국어와 유사한 구조로 구현...
}

// i18n 인스턴스 생성
const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('nificdc-language') || 'ko',
  fallbackLocale: 'en',
  globalInjection: true,
  messages: {
    ko,
    en
  }
})

export default i18n