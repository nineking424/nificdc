/**
 * 변환 함수 라이브러리
 * 재사용 가능한 데이터 변환 함수들의 모음
 */

/**
 * 날짜 변환 함수들
 */
const dateTransforms = {
  /**
   * 날짜를 지정된 형식으로 포맷
   * @param {Date|string|number} date - 변환할 날짜
   * @param {string} format - 출력 형식 (YYYY-MM-DD, DD/MM/YYYY 등)
   * @param {string} locale - 로케일 (기본: ko-KR)
   * @returns {string} 포맷된 날짜 문자열
   */
  formatDate: (date, format = 'YYYY-MM-DD', locale = 'ko-KR') => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const formatMap = {
      'YYYY': d.getFullYear(),
      'YY': String(d.getFullYear()).slice(-2),
      'MM': String(d.getMonth() + 1).padStart(2, '0'),
      'M': d.getMonth() + 1,
      'DD': String(d.getDate()).padStart(2, '0'),
      'D': d.getDate(),
      'HH': String(d.getHours()).padStart(2, '0'),
      'H': d.getHours(),
      'mm': String(d.getMinutes()).padStart(2, '0'),
      'm': d.getMinutes(),
      'ss': String(d.getSeconds()).padStart(2, '0'),
      's': d.getSeconds(),
      'SSS': String(d.getMilliseconds()).padStart(3, '0')
    };

    return format.replace(/YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s|SSS/g, match => formatMap[match]);
  },

  /**
   * 문자열을 날짜로 파싱
   * @param {string} dateString - 날짜 문자열
   * @param {string} inputFormat - 입력 형식 (선택적)
   * @returns {Date} 파싱된 날짜 객체
   */
  parseDate: (dateString, inputFormat = null) => {
    if (!dateString) return null;

    // 일반적인 형식들을 시도
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{2})\/(\d{2})\/(\d{2})$/, // MM/DD/YY
      /^(\d{4})(\d{2})(\d{2})$/, // YYYYMMDD
      /^(\d{2})-(\d{2})-(\d{4})$/ // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        // 각 형식에 따라 적절히 파싱
        const [, p1, p2, p3] = match;
        if (format.source.includes('YYYY')) {
          return new Date(p1, p2 - 1, p3);
        } else {
          return new Date(p3, p1 - 1, p2);
        }
      }
    }

    // 기본 Date 생성자 사용
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  },

  /**
   * 날짜에 일수 추가
   * @param {Date|string} date - 기준 날짜
   * @param {number} days - 추가할 일수 (음수 가능)
   * @returns {Date} 새로운 날짜
   */
  addDays: (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  },

  /**
   * 날짜에 월수 추가
   * @param {Date|string} date - 기준 날짜
   * @param {number} months - 추가할 월수 (음수 가능)
   * @returns {Date} 새로운 날짜
   */
  addMonths: (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  },

  /**
   * 날짜에 년수 추가
   * @param {Date|string} date - 기준 날짜
   * @param {number} years - 추가할 년수 (음수 가능)
   * @returns {Date} 새로운 날짜
   */
  addYears: (date, years) => {
    const d = new Date(date);
    d.setFullYear(d.getFullYear() + years);
    return d;
  },

  /**
   * 두 날짜 간의 차이 계산
   * @param {Date|string} date1 - 첫 번째 날짜
   * @param {Date|string} date2 - 두 번째 날짜
   * @param {string} unit - 단위 (days, months, years)
   * @returns {number} 날짜 차이
   */
  dateDiff: (date1, date2, unit = 'days') => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diff = Math.abs(d2.getTime() - d1.getTime());

    switch (unit) {
      case 'days':
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      case 'hours':
        return Math.floor(diff / (1000 * 60 * 60));
      case 'minutes':
        return Math.floor(diff / (1000 * 60));
      case 'seconds':
        return Math.floor(diff / 1000);
      default:
        return diff;
    }
  },

  /**
   * 날짜를 타임스탬프로 변환
   * @param {Date|string} date - 변환할 날짜
   * @returns {number} 타임스탬프
   */
  toTimestamp: (date) => {
    return new Date(date).getTime();
  },

  /**
   * 타임스탬프를 날짜로 변환
   * @param {number} timestamp - 타임스탬프
   * @returns {Date} 날짜 객체
   */
  fromTimestamp: (timestamp) => {
    return new Date(timestamp);
  }
};

/**
 * 문자열 변환 함수들
 */
const stringTransforms = {
  /**
   * 문자열을 대문자로 변환
   * @param {string} str - 변환할 문자열
   * @returns {string} 대문자 문자열
   */
  upper: (str) => String(str).toUpperCase(),

  /**
   * 문자열을 소문자로 변환
   * @param {string} str - 변환할 문자열
   * @returns {string} 소문자 문자열
   */
  lower: (str) => String(str).toLowerCase(),

  /**
   * 첫 글자만 대문자로 변환
   * @param {string} str - 변환할 문자열
   * @returns {string} 첫 글자가 대문자인 문자열
   */
  capitalize: (str) => {
    const s = String(str);
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  },

  /**
   * 각 단어의 첫 글자를 대문자로 변환
   * @param {string} str - 변환할 문자열
   * @returns {string} 제목 형식의 문자열
   */
  titleCase: (str) => {
    return String(str)
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * camelCase로 변환
   * @param {string} str - 변환할 문자열
   * @returns {string} camelCase 문자열
   */
  camelCase: (str) => {
    return String(str)
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+/g, '');
  },

  /**
   * snake_case로 변환
   * @param {string} str - 변환할 문자열
   * @returns {string} snake_case 문자열
   */
  snakeCase: (str) => {
    return String(str)
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('_');
  },

  /**
   * kebab-case로 변환
   * @param {string} str - 변환할 문자열
   * @returns {string} kebab-case 문자열
   */
  kebabCase: (str) => {
    return String(str)
      .replace(/\W+/g, ' ')
      .split(/ |\B(?=[A-Z])/)
      .map(word => word.toLowerCase())
      .join('-');
  },

  /**
   * 문자열 앞뒤 공백 제거
   * @param {string} str - 변환할 문자열
   * @returns {string} 공백이 제거된 문자열
   */
  trim: (str) => String(str).trim(),

  /**
   * 문자열 앞 공백 제거
   * @param {string} str - 변환할 문자열
   * @returns {string} 앞 공백이 제거된 문자열
   */
  ltrim: (str) => String(str).replace(/^\s+/, ''),

  /**
   * 문자열 뒤 공백 제거
   * @param {string} str - 변환할 문자열
   * @returns {string} 뒤 공백이 제거된 문자열
   */
  rtrim: (str) => String(str).replace(/\s+$/, ''),

  /**
   * 문자열 왼쪽 패딩
   * @param {string} str - 원본 문자열
   * @param {number} length - 총 길이
   * @param {string} padChar - 패딩 문자 (기본: 공백)
   * @returns {string} 패딩된 문자열
   */
  padLeft: (str, length, padChar = ' ') => String(str).padStart(length, padChar),

  /**
   * 문자열 오른쪽 패딩
   * @param {string} str - 원본 문자열
   * @param {number} length - 총 길이
   * @param {string} padChar - 패딩 문자 (기본: 공백)
   * @returns {string} 패딩된 문자열
   */
  padRight: (str, length, padChar = ' ') => String(str).padEnd(length, padChar),

  /**
   * 문자열 자르기
   * @param {string} str - 원본 문자열
   * @param {number} length - 최대 길이
   * @param {string} suffix - 말줄임표 (기본: '...')
   * @returns {string} 잘린 문자열
   */
  truncate: (str, length, suffix = '...') => {
    const s = String(str);
    return s.length > length ? s.substring(0, length - suffix.length) + suffix : s;
  },

  /**
   * 문자열 대체
   * @param {string} str - 원본 문자열
   * @param {string|RegExp} search - 검색할 문자열 또는 정규식
   * @param {string} replace - 대체할 문자열
   * @returns {string} 대체된 문자열
   */
  replace: (str, search, replace) => String(str).replace(new RegExp(search, 'g'), replace),

  /**
   * 문자열 분할
   * @param {string} str - 원본 문자열
   * @param {string} delimiter - 구분자
   * @param {number} limit - 최대 분할 개수
   * @returns {Array} 분할된 문자열 배열
   */
  split: (str, delimiter, limit = undefined) => String(str).split(delimiter, limit),

  /**
   * 배열을 문자열로 결합
   * @param {Array} arr - 결합할 배열
   * @param {string} delimiter - 구분자
   * @returns {string} 결합된 문자열
   */
  join: (arr, delimiter) => Array.isArray(arr) ? arr.join(delimiter) : '',

  /**
   * 문자열에서 HTML 태그 제거
   * @param {string} str - 원본 문자열
   * @returns {string} HTML 태그가 제거된 문자열
   */
  stripHtml: (str) => String(str).replace(/<[^>]*>/g, ''),

  /**
   * 문자열을 URL 슬러그로 변환
   * @param {string} str - 원본 문자열
   * @returns {string} URL 슬러그
   */
  slugify: (str) => {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
};

/**
 * 숫자 변환 함수들
 */
const numberTransforms = {
  /**
   * 숫자 반올림
   * @param {number} num - 반올림할 숫자
   * @param {number} decimals - 소수점 자릿수 (기본: 0)
   * @returns {number} 반올림된 숫자
   */
  round: (num, decimals = 0) => {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },

  /**
   * 숫자 올림
   * @param {number} num - 올림할 숫자
   * @returns {number} 올림된 숫자
   */
  ceil: (num) => Math.ceil(num),

  /**
   * 숫자 내림
   * @param {number} num - 내림할 숫자
   * @returns {number} 내림된 숫자
   */
  floor: (num) => Math.floor(num),

  /**
   * 절댓값
   * @param {number} num - 절댓값을 구할 숫자
   * @returns {number} 절댓값
   */
  abs: (num) => Math.abs(num),

  /**
   * 문자열을 정수로 변환
   * @param {string} str - 변환할 문자열
   * @param {number} radix - 진법 (기본: 10)
   * @returns {number} 정수
   */
  parseInt: (str, radix = 10) => parseInt(str, radix),

  /**
   * 문자열을 실수로 변환
   * @param {string} str - 변환할 문자열
   * @returns {number} 실수
   */
  parseFloat: (str) => parseFloat(str),

  /**
   * 숫자를 고정 소수점 형식으로 변환
   * @param {number} num - 변환할 숫자
   * @param {number} decimals - 소수점 자릿수 (기본: 2)
   * @returns {string} 고정 소수점 문자열
   */
  toFixed: (num, decimals = 2) => Number(num).toFixed(decimals),

  /**
   * 숫자를 통화 형식으로 변환
   * @param {number} num - 변환할 숫자
   * @param {string} currency - 통화 코드 (기본: KRW)
   * @param {string} locale - 로케일 (기본: ko-KR)
   * @returns {string} 통화 형식 문자열
   */
  toCurrency: (num, currency = 'KRW', locale = 'ko-KR') => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(num);
  },

  /**
   * 숫자를 퍼센트 형식으로 변환
   * @param {number} num - 변환할 숫자 (0.5 = 50%)
   * @param {number} decimals - 소수점 자릿수 (기본: 2)
   * @returns {string} 퍼센트 문자열
   */
  toPercent: (num, decimals = 2) => `${(num * 100).toFixed(decimals)}%`,

  /**
   * 숫자에 천 단위 구분자 추가
   * @param {number} num - 변환할 숫자
   * @param {string} separator - 구분자 (기본: ,)
   * @returns {string} 구분자가 추가된 문자열
   */
  addCommas: (num, separator = ',') => {
    return Number(num).toLocaleString();
  },

  /**
   * 범위 내 값으로 제한
   * @param {number} num - 제한할 숫자
   * @param {number} min - 최솟값
   * @param {number} max - 최댓값
   * @returns {number} 제한된 숫자
   */
  clamp: (num, min, max) => Math.min(Math.max(num, min), max),

  /**
   * 두 숫자 사이의 랜덤 값 생성
   * @param {number} min - 최솟값
   * @param {number} max - 최댓값
   * @returns {number} 랜덤 숫자
   */
  random: (min, max) => Math.random() * (max - min) + min,

  /**
   * 숫자를 바이트 단위로 변환
   * @param {number} bytes - 바이트 수
   * @param {number} decimals - 소수점 자릿수 (기본: 2)
   * @returns {string} 사람이 읽기 쉬운 바이트 단위
   */
  formatBytes: (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
};

/**
 * 배열 변환 함수들
 */
const arrayTransforms = {
  /**
   * 배열의 첫 번째 요소 반환
   * @param {Array} arr - 배열
   * @returns {*} 첫 번째 요소
   */
  first: (arr) => Array.isArray(arr) && arr.length > 0 ? arr[0] : null,

  /**
   * 배열의 마지막 요소 반환
   * @param {Array} arr - 배열
   * @returns {*} 마지막 요소
   */
  last: (arr) => Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null,

  /**
   * 배열의 중복 요소 제거
   * @param {Array} arr - 배열
   * @returns {Array} 중복이 제거된 배열
   */
  unique: (arr) => [...new Set(arr)],

  /**
   * 배열 평탄화
   * @param {Array} arr - 배열
   * @param {number} depth - 평탄화 깊이 (기본: Infinity)
   * @returns {Array} 평탄화된 배열
   */
  flatten: (arr, depth = Infinity) => arr.flat(depth),

  /**
   * 배열 정렬
   * @param {Array} arr - 배열
   * @param {Function|string} compareFn - 비교 함수 또는 키
   * @param {string} order - 정렬 순서 ('asc' | 'desc')
   * @returns {Array} 정렬된 배열
   */
  sort: (arr, compareFn = null, order = 'asc') => {
    const sorted = [...arr];
    
    if (typeof compareFn === 'string') {
      // 객체 배열을 키로 정렬
      const key = compareFn;
      sorted.sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
        return 0;
      });
    } else if (typeof compareFn === 'function') {
      sorted.sort(compareFn);
    } else {
      sorted.sort((a, b) => {
        if (a < b) return order === 'asc' ? -1 : 1;
        if (a > b) return order === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return sorted;
  },

  /**
   * 배열 역순 정렬
   * @param {Array} arr - 배열
   * @returns {Array} 역순 배열
   */
  reverse: (arr) => [...arr].reverse(),

  /**
   * 배열을 청크로 분할
   * @param {Array} arr - 배열
   * @param {number} size - 청크 크기
   * @returns {Array} 청크 배열
   */
  chunk: (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * 배열을 키로 그룹화
   * @param {Array} arr - 배열
   * @param {string|Function} key - 그룹화 키 또는 함수
   * @returns {Object} 그룹화된 객체
   */
  groupBy: (arr, key) => {
    return arr.reduce((groups, item) => {
      const group = typeof key === 'function' ? key(item) : item[key];
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
      return groups;
    }, {});
  },

  /**
   * 배열 합계
   * @param {Array} arr - 숫자 배열
   * @returns {number} 합계
   */
  sum: (arr) => arr.reduce((sum, val) => sum + Number(val), 0),

  /**
   * 배열 평균
   * @param {Array} arr - 숫자 배열
   * @returns {number} 평균
   */
  avg: (arr) => arr.length > 0 ? arr.reduce((sum, val) => sum + Number(val), 0) / arr.length : 0,

  /**
   * 배열 최댓값
   * @param {Array} arr - 숫자 배열
   * @returns {number} 최댓값
   */
  max: (arr) => Math.max(...arr.map(Number)),

  /**
   * 배열 최솟값
   * @param {Array} arr - 숫자 배열
   * @returns {number} 최솟값
   */
  min: (arr) => Math.min(...arr.map(Number)),

  /**
   * 배열에서 null/undefined 제거
   * @param {Array} arr - 배열
   * @returns {Array} 정리된 배열
   */
  compact: (arr) => arr.filter(val => val !== null && val !== undefined),

  /**
   * 두 배열의 차집합
   * @param {Array} arr1 - 첫 번째 배열
   * @param {Array} arr2 - 두 번째 배열
   * @returns {Array} 차집합 배열
   */
  difference: (arr1, arr2) => arr1.filter(x => !arr2.includes(x)),

  /**
   * 두 배열의 교집합
   * @param {Array} arr1 - 첫 번째 배열
   * @param {Array} arr2 - 두 번째 배열
   * @returns {Array} 교집합 배열
   */
  intersection: (arr1, arr2) => arr1.filter(x => arr2.includes(x)),

  /**
   * 두 배열의 합집합
   * @param {Array} arr1 - 첫 번째 배열
   * @param {Array} arr2 - 두 번째 배열
   * @returns {Array} 합집합 배열
   */
  union: (arr1, arr2) => [...new Set([...arr1, ...arr2])]
};

/**
 * 조건부 변환 함수들
 */
const conditionalTransforms = {
  /**
   * null이면 기본값 반환
   * @param {*} value - 검사할 값
   * @param {*} defaultValue - 기본값
   * @returns {*} 값 또는 기본값
   */
  ifNull: (value, defaultValue) => value === null || value === undefined ? defaultValue : value,

  /**
   * 빈 값이면 기본값 반환
   * @param {*} value - 검사할 값
   * @param {*} defaultValue - 기본값
   * @returns {*} 값 또는 기본값
   */
  ifEmpty: (value, defaultValue) => {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'string' && value.trim() === '') return defaultValue;
    if (Array.isArray(value) && value.length === 0) return defaultValue;
    if (typeof value === 'object' && Object.keys(value).length === 0) return defaultValue;
    return value;
  },

  /**
   * 조건에 따른 값 선택
   * @param {boolean} condition - 조건
   * @param {*} trueValue - 참일 때 값
   * @param {*} falseValue - 거짓일 때 값
   * @returns {*} 선택된 값
   */
  ifElse: (condition, trueValue, falseValue) => condition ? trueValue : falseValue,

  /**
   * 값의 범위 확인
   * @param {number} value - 검사할 값
   * @param {number} min - 최솟값
   * @param {number} max - 최댓값
   * @returns {boolean} 범위 내 여부
   */
  inRange: (value, min, max) => value >= min && value <= max,

  /**
   * 값이 배열에 포함되는지 확인
   * @param {*} value - 검사할 값
   * @param {Array} array - 배열
   * @returns {boolean} 포함 여부
   */
  inArray: (value, array) => Array.isArray(array) && array.includes(value),

  /**
   * switch-case 스타일 변환
   * @param {*} value - 검사할 값
   * @param {Object} cases - 케이스 객체
   * @param {*} defaultValue - 기본값
   * @returns {*} 매칭된 값
   */
  switchCase: (value, cases, defaultValue = null) => {
    return cases.hasOwnProperty(value) ? cases[value] : defaultValue;
  }
};

/**
 * 데이터 타입 변환 함수들
 */
const typeTransforms = {
  /**
   * 문자열로 변환
   * @param {*} value - 변환할 값
   * @returns {string} 문자열
   */
  toString: (value) => String(value),

  /**
   * 숫자로 변환
   * @param {*} value - 변환할 값
   * @returns {number} 숫자
   */
  toNumber: (value) => Number(value),

  /**
   * 불린으로 변환
   * @param {*} value - 변환할 값
   * @returns {boolean} 불린
   */
  toBoolean: (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on';
    }
    if (typeof value === 'number') return value !== 0;
    return Boolean(value);
  },

  /**
   * 배열로 변환
   * @param {*} value - 변환할 값
   * @returns {Array} 배열
   */
  toArray: (value) => {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
  },

  /**
   * JSON 문자열로 변환
   * @param {*} value - 변환할 값
   * @param {number} space - 들여쓰기 공간
   * @returns {string} JSON 문자열
   */
  toJson: (value, space = 0) => JSON.stringify(value, null, space),

  /**
   * JSON 문자열을 객체로 변환
   * @param {string} jsonString - JSON 문자열
   * @returns {*} 파싱된 객체
   */
  fromJson: (jsonString) => {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      return null;
    }
  }
};

/**
 * 검증 함수들
 */
const validators = {
  /**
   * 이메일 형식 검증
   * @param {string} email - 이메일 주소
   * @returns {boolean} 유효성 여부
   */
  isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

  /**
   * URL 형식 검증
   * @param {string} url - URL
   * @returns {boolean} 유효성 여부
   */
  isUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 전화번호 형식 검증 (한국)
   * @param {string} phone - 전화번호
   * @returns {boolean} 유효성 여부
   */
  isPhone: (phone) => /^(010|011|016|017|018|019)-?\d{3,4}-?\d{4}$/.test(phone.replace(/\s/g, '')),

  /**
   * 주민등록번호 형식 검증
   * @param {string} ssn - 주민등록번호
   * @returns {boolean} 유효성 여부
   */
  isSsn: (ssn) => /^\d{6}-?\d{7}$/.test(ssn.replace(/\s/g, '')),

  /**
   * UUID 형식 검증
   * @param {string} uuid - UUID
   * @returns {boolean} 유효성 여부
   */
  isUuid: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid),

  /**
   * 신용카드 번호 검증 (Luhn 알고리즘)
   * @param {string} cardNumber - 신용카드 번호
   * @returns {boolean} 유효성 여부
   */
  isCreditCard: (cardNumber) => {
    const num = cardNumber.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;
    
    for (let i = num.length - 1; i >= 0; i--) {
      let digit = parseInt(num[i]);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  },

  /**
   * IP 주소 형식 검증
   * @param {string} ip - IP 주소
   * @returns {boolean} 유효성 여부
   */
  isIp: (ip) => {
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
    return ipv4.test(ip) || ipv6.test(ip);
  }
};

/**
 * 전체 변환 라이브러리
 */
const transformLibrary = {
  date: dateTransforms,
  string: stringTransforms,
  number: numberTransforms,
  array: arrayTransforms,
  conditional: conditionalTransforms,
  type: typeTransforms,
  validator: validators,

  /**
   * 함수 실행
   * @param {string} category - 카테고리
   * @param {string} functionName - 함수명
   * @param {Array} args - 인수 배열
   * @returns {*} 실행 결과
   */
  execute: (category, functionName, ...args) => {
    const categoryFns = transformLibrary[category];
    if (!categoryFns) {
      throw new Error(`변환 카테고리 '${category}'를 찾을 수 없습니다.`);
    }

    const fn = categoryFns[functionName];
    if (!fn) {
      throw new Error(`변환 함수 '${category}.${functionName}'을 찾을 수 없습니다.`);
    }

    return fn(...args);
  },

  /**
   * 사용 가능한 함수 목록 반환
   * @returns {Object} 함수 목록
   */
  getFunctions: () => {
    const result = {};
    for (const [category, functions] of Object.entries(transformLibrary)) {
      if (typeof functions === 'object' && !Array.isArray(functions)) {
        result[category] = Object.keys(functions);
      }
    }
    return result;
  },

  /**
   * 함수 정보 반환
   * @param {string} category - 카테고리
   * @param {string} functionName - 함수명
   * @returns {Object} 함수 정보
   */
  getFunctionInfo: (category, functionName) => {
    const categoryFns = transformLibrary[category];
    if (!categoryFns) return null;

    const fn = categoryFns[functionName];
    if (!fn) return null;

    return {
      name: functionName,
      category: category,
      length: fn.length,
      source: fn.toString()
    };
  }
};

module.exports = transformLibrary;