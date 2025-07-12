const ScriptSandbox = require('../utils/scriptSandbox');
const logger = require('../utils/logger');

/**
 * 변환 서비스 - 데이터 변환 및 스크립트 실행 관리
 */
class TransformationService {
  constructor() {
    this.sandbox = new ScriptSandbox({
      timeout: 10000, // 10초 제한
      memoryLimit: 100 * 1024 * 1024, // 100MB 제한
      allowedModules: [] // 외부 모듈 사용 금지
    });
    
    this.functionLibrary = this.initializeFunctionLibrary();
    this.executionCache = new Map();
    this.maxCacheSize = 1000;
  }

  /**
   * 변환 스크립트 실행
   * @param {string} script - 변환 스크립트
   * @param {Object} sourceData - 소스 데이터
   * @param {Object} targetData - 타겟 데이터 (변환 중)
   * @param {Object} mappingConfig - 매핑 설정
   * @returns {Promise<Object>} 변환 결과
   */
  async executeTransformation(script, sourceData, targetData, mappingConfig = {}) {
    try {
      // 캐시 확인
      const cacheKey = this.generateCacheKey(script, sourceData);
      if (this.executionCache.has(cacheKey)) {
        logger.info('캐시된 변환 결과 사용');
        return this.executionCache.get(cacheKey);
      }
      
      // 실행 컨텍스트 준비
      const context = {
        source: this.deepFreeze(sourceData), // 소스 데이터 보호
        target: targetData, // 타겟 데이터는 수정 가능
        config: mappingConfig,
        functions: this.functionLibrary,
        
        // 헬퍼 변수
        _mappingType: mappingConfig.mappingType || 'one_to_one',
        _timestamp: new Date().toISOString(),
        _executionId: this.generateExecutionId()
      };
      
      // 스크립트 실행
      const result = await this.sandbox.execute(script, context);
      
      if (!result.success) {
        throw new Error(`스크립트 실행 실패: ${result.error}`);
      }
      
      // 결과 검증
      const validationResult = this.validateTransformationResult(result.result, mappingConfig);
      if (!validationResult.valid) {
        throw new Error(`변환 결과 검증 실패: ${validationResult.errors.join(', ')}`);
      }
      
      // 캐시 저장
      this.addToCache(cacheKey, result.result);
      
      // 실행 통계 기록
      this.recordExecutionStats({
        script: script.substring(0, 100), // 스크립트 미리보기
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        success: true
      });
      
      return result.result;
      
    } catch (error) {
      logger.error('변환 스크립트 실행 실패:', error);
      
      // 실행 통계 기록 (실패)
      this.recordExecutionStats({
        script: script.substring(0, 100),
        executionTime: 0,
        memoryUsed: 0,
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * 함수 라이브러리 초기화
   * @returns {Object} 함수 라이브러리
   */
  initializeFunctionLibrary() {
    return {
      // 날짜 변환 함수
      dateTransforms: {
        toISO: (date) => new Date(date).toISOString(),
        toTimestamp: (date) => new Date(date).getTime(),
        addDays: (date, days) => {
          const d = new Date(date);
          d.setDate(d.getDate() + days);
          return d;
        },
        formatDate: (date, format) => {
          const d = new Date(date);
          const formats = {
            'YYYY-MM-DD': `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            'DD/MM/YYYY': `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
            'MM/DD/YYYY': `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
          };
          return formats[format] || d.toString();
        }
      },
      
      // 문자열 변환 함수
      stringTransforms: {
        trim: (str) => String(str).trim(),
        upper: (str) => String(str).toUpperCase(),
        lower: (str) => String(str).toLowerCase(),
        capitalize: (str) => {
          const s = String(str);
          return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        },
        camelCase: (str) => {
          return String(str)
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => 
              index === 0 ? word.toLowerCase() : word.toUpperCase()
            )
            .replace(/\s+/g, '');
        },
        snakeCase: (str) => {
          return String(str)
            .replace(/\W+/g, ' ')
            .split(/ |\B(?=[A-Z])/)
            .map(word => word.toLowerCase())
            .join('_');
        },
        kebabCase: (str) => {
          return String(str)
            .replace(/\W+/g, ' ')
            .split(/ |\B(?=[A-Z])/)
            .map(word => word.toLowerCase())
            .join('-');
        },
        truncate: (str, length, suffix = '...') => {
          const s = String(str);
          return s.length > length ? s.substring(0, length - suffix.length) + suffix : s;
        },
        padLeft: (str, length, char = ' ') => String(str).padStart(length, char),
        padRight: (str, length, char = ' ') => String(str).padEnd(length, char),
        replace: (str, search, replace) => String(str).replace(new RegExp(search, 'g'), replace),
        split: (str, delimiter) => String(str).split(delimiter),
        join: (arr, delimiter) => Array.isArray(arr) ? arr.join(delimiter) : ''
      },
      
      // 숫자 변환 함수
      numberTransforms: {
        round: (num, decimals = 0) => Number(num.toFixed(decimals)),
        floor: (num) => Math.floor(num),
        ceil: (num) => Math.ceil(num),
        abs: (num) => Math.abs(num),
        parseInt: (str, radix = 10) => parseInt(str, radix),
        parseFloat: (str) => parseFloat(str),
        toFixed: (num, decimals = 2) => Number(num).toFixed(decimals),
        toCurrency: (num, currency = 'USD', locale = 'en-US') => {
          return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
          }).format(num);
        },
        toPercent: (num, decimals = 2) => `${(num * 100).toFixed(decimals)}%`
      },
      
      // 배열 변환 함수
      arrayTransforms: {
        map: (arr, fn) => Array.isArray(arr) ? arr.map(fn) : [],
        filter: (arr, fn) => Array.isArray(arr) ? arr.filter(fn) : [],
        reduce: (arr, fn, initial) => Array.isArray(arr) ? arr.reduce(fn, initial) : initial,
        find: (arr, fn) => Array.isArray(arr) ? arr.find(fn) : null,
        findIndex: (arr, fn) => Array.isArray(arr) ? arr.findIndex(fn) : -1,
        includes: (arr, value) => Array.isArray(arr) ? arr.includes(value) : false,
        unique: (arr) => [...new Set(arr)],
        flatten: (arr) => arr.flat(Infinity),
        sort: (arr, fn) => [...arr].sort(fn),
        reverse: (arr) => [...arr].reverse(),
        slice: (arr, start, end) => arr.slice(start, end),
        concat: (...arrays) => [].concat(...arrays),
        groupBy: (arr, key) => {
          return arr.reduce((groups, item) => {
            const group = item[key];
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
            return groups;
          }, {});
        }
      },
      
      // 객체 변환 함수
      objectTransforms: {
        keys: (obj) => Object.keys(obj),
        values: (obj) => Object.values(obj),
        entries: (obj) => Object.entries(obj),
        fromEntries: (entries) => Object.fromEntries(entries),
        merge: (...objects) => Object.assign({}, ...objects),
        pick: (obj, keys) => {
          return keys.reduce((result, key) => {
            if (key in obj) result[key] = obj[key];
            return result;
          }, {});
        },
        omit: (obj, keys) => {
          const result = { ...obj };
          keys.forEach(key => delete result[key]);
          return result;
        },
        mapKeys: (obj, fn) => {
          return Object.entries(obj).reduce((result, [key, value]) => {
            result[fn(key, value)] = value;
            return result;
          }, {});
        },
        mapValues: (obj, fn) => {
          return Object.entries(obj).reduce((result, [key, value]) => {
            result[key] = fn(value, key);
            return result;
          }, {});
        }
      },
      
      // 데이터 검증 함수
      validators: {
        isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        isURL: (url) => {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        },
        isPhone: (phone) => /^[\d\s\-\+\(\)]+$/.test(phone),
        isPostalCode: (code, country = 'US') => {
          const patterns = {
            US: /^\d{5}(-\d{4})?$/,
            UK: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
            CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i
          };
          return patterns[country] ? patterns[country].test(code) : false;
        },
        isUUID: (uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid),
        isJSON: (str) => {
          try {
            JSON.parse(str);
            return true;
          } catch {
            return false;
          }
        }
      },
      
      // 비즈니스 로직 함수
      business: {
        calculateAge: (birthDate) => {
          const today = new Date();
          const birth = new Date(birthDate);
          let age = today.getFullYear() - birth.getFullYear();
          const monthDiff = today.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
          return age;
        },
        maskSensitiveData: (data, type = 'email') => {
          switch (type) {
            case 'email':
              const [user, domain] = String(data).split('@');
              return user.substring(0, 3) + '***@' + domain;
            case 'phone':
              const phone = String(data).replace(/\D/g, '');
              return phone.substring(0, 3) + '****' + phone.substring(7);
            case 'ssn':
              return '***-**-' + String(data).substring(7);
            default:
              return '***';
          }
        },
        generateId: (prefix = '') => {
          return prefix + Date.now() + Math.random().toString(36).substring(2, 9);
        }
      }
    };
  }

  /**
   * 변환 결과 검증
   * @param {*} result - 변환 결과
   * @param {Object} config - 매핑 설정
   * @returns {Object} 검증 결과
   */
  validateTransformationResult(result, config) {
    const errors = [];
    
    // null/undefined 체크
    if (result === null || result === undefined) {
      if (config.allowNull === false) {
        errors.push('변환 결과가 null입니다.');
      }
    }
    
    // 타입 검증
    if (config.expectedType) {
      const actualType = Array.isArray(result) ? 'array' : typeof result;
      if (actualType !== config.expectedType) {
        errors.push(`예상 타입: ${config.expectedType}, 실제 타입: ${actualType}`);
      }
    }
    
    // 필수 필드 검증 (객체인 경우)
    if (config.requiredFields && typeof result === 'object' && !Array.isArray(result)) {
      for (const field of config.requiredFields) {
        if (!(field in result)) {
          errors.push(`필수 필드 누락: ${field}`);
        }
      }
    }
    
    // 배열 크기 검증
    if (Array.isArray(result) && config.arrayConstraints) {
      const { minLength, maxLength } = config.arrayConstraints;
      if (minLength !== undefined && result.length < minLength) {
        errors.push(`배열 최소 길이: ${minLength}, 실제: ${result.length}`);
      }
      if (maxLength !== undefined && result.length > maxLength) {
        errors.push(`배열 최대 길이: ${maxLength}, 실제: ${result.length}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 객체 깊은 동결 (불변성 보장)
   * @param {*} obj - 동결할 객체
   * @returns {*} 동결된 객체
   */
  deepFreeze(obj) {
    Object.freeze(obj);
    
    Object.getOwnPropertyNames(obj).forEach(prop => {
      if (obj[prop] !== null && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function')) {
        this.deepFreeze(obj[prop]);
      }
    });
    
    return obj;
  }

  /**
   * 캐시 키 생성
   * @param {string} script - 스크립트
   * @param {Object} sourceData - 소스 데이터
   * @returns {string} 캐시 키
   */
  generateCacheKey(script, sourceData) {
    const scriptHash = this.hashString(script);
    const dataHash = this.hashString(JSON.stringify(sourceData));
    return `${scriptHash}_${dataHash}`;
  }

  /**
   * 문자열 해시
   * @param {string} str - 해시할 문자열
   * @returns {string} 해시값
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * 캐시에 추가
   * @param {string} key - 캐시 키
   * @param {*} value - 캐시 값
   */
  addToCache(key, value) {
    // 캐시 크기 제한
    if (this.executionCache.size >= this.maxCacheSize) {
      const firstKey = this.executionCache.keys().next().value;
      this.executionCache.delete(firstKey);
    }
    
    this.executionCache.set(key, value);
  }

  /**
   * 실행 ID 생성
   * @returns {string} 실행 ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 실행 통계 기록
   * @param {Object} stats - 실행 통계
   */
  recordExecutionStats(stats) {
    logger.info('변환 실행 통계:', stats);
    // TODO: 데이터베이스에 통계 저장
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.executionCache.clear();
    this.sandbox.clearCache();
  }

  /**
   * 스크립트 검증
   * @param {string} script - 검증할 스크립트
   * @returns {Object} 검증 결과
   */
  validateScript(script) {
    return this.sandbox.validateScript(script);
  }
}

module.exports = new TransformationService();