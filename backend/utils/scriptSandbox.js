const vm = require('vm');
const { performance } = require('perf_hooks');
const logger = require('./logger');

/**
 * 스크립트 샌드박스 - 사용자 정의 스크립트를 안전하게 실행
 */
class ScriptSandbox {
  constructor(options = {}) {
    this.timeout = options.timeout || 5000; // 기본 5초 제한
    this.memoryLimit = options.memoryLimit || 50 * 1024 * 1024; // 기본 50MB
    this.allowedModules = options.allowedModules || [];
    this.globalContext = this.createGlobalContext();
  }

  /**
   * 안전한 글로벌 컨텍스트 생성
   */
  createGlobalContext() {
    return {
      // 기본 JavaScript 객체 및 함수
      Object,
      Array,
      String,
      Number,
      Boolean,
      Date,
      Math,
      JSON,
      RegExp,
      Map,
      Set,
      
      // 안전한 콘솔 래퍼
      console: {
        log: (...args) => logger.info('Script:', ...args),
        error: (...args) => logger.error('Script:', ...args),
        warn: (...args) => logger.warn('Script:', ...args),
        info: (...args) => logger.info('Script:', ...args)
      },
      
      // 유틸리티 함수
      setTimeout: undefined, // 비활성화
      setInterval: undefined, // 비활성화
      setImmediate: undefined, // 비활성화
      
      // 에러 클래스
      Error,
      TypeError,
      ReferenceError,
      SyntaxError,
      
      // 프로미스 지원
      Promise,
      
      // 성능 측정
      performance: {
        now: () => performance.now()
      }
    };
  }

  /**
   * 스크립트 실행
   * @param {string} script - 실행할 스크립트
   * @param {Object} context - 스크립트 컨텍스트
   * @returns {Promise<*>} 실행 결과
   */
  async execute(script, context = {}) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      // 스크립트 전처리 및 검증
      const validationResult = this.validateScript(script);
      if (!validationResult.valid) {
        throw new Error(`스크립트 검증 실패: ${validationResult.errors.join(', ')}`);
      }
      
      // 샌드박스 컨텍스트 생성
      const sandboxContext = this.createSandboxContext(context);
      
      // 스크립트 래핑
      const wrappedScript = this.wrapScript(script);
      
      // VM 옵션
      const vmOptions = {
        timeout: this.timeout,
        displayErrors: true,
        breakOnSigint: true
      };
      
      // 스크립트 컴파일
      const compiledScript = new vm.Script(wrappedScript, {
        filename: 'user-script.js',
        produceCachedData: true
      });
      
      // 스크립트 실행
      const result = await new Promise((resolve, reject) => {
        // 메모리 모니터링
        const memoryInterval = setInterval(() => {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryUsed = currentMemory - startMemory;
          
          if (memoryUsed > this.memoryLimit) {
            clearInterval(memoryInterval);
            reject(new Error(`메모리 한계 초과: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`));
          }
        }, 100);
        
        try {
          const vmResult = compiledScript.runInNewContext(sandboxContext, vmOptions);
          
          // Promise 처리
          if (vmResult && typeof vmResult.then === 'function') {
            vmResult
              .then(res => {
                clearInterval(memoryInterval);
                resolve(res);
              })
              .catch(err => {
                clearInterval(memoryInterval);
                reject(err);
              });
          } else {
            clearInterval(memoryInterval);
            resolve(vmResult);
          }
        } catch (error) {
          clearInterval(memoryInterval);
          reject(error);
        }
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      logger.info(`스크립트 실행 완료: ${executionTime.toFixed(2)}ms`);
      
      return {
        success: true,
        result,
        executionTime,
        memoryUsed: process.memoryUsage().heapUsed - startMemory
      };
      
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      logger.error('스크립트 실행 실패:', error);
      
      return {
        success: false,
        error: error.message,
        executionTime,
        memoryUsed: process.memoryUsage().heapUsed - startMemory
      };
    }
  }

  /**
   * 스크립트 검증
   * @param {string} script - 검증할 스크립트
   * @returns {Object} 검증 결과
   */
  validateScript(script) {
    const errors = [];
    
    // 위험한 패턴 검사
    const dangerousPatterns = [
      // 파일 시스템 접근
      /require\s*\(\s*['"`]fs['"`]\s*\)/,
      /require\s*\(\s*['"`]child_process['"`]\s*\)/,
      /require\s*\(\s*['"`]cluster['"`]\s*\)/,
      /require\s*\(\s*['"`]worker_threads['"`]\s*\)/,
      
      // 네트워크 접근
      /require\s*\(\s*['"`]net['"`]\s*\)/,
      /require\s*\(\s*['"`]http['"`]\s*\)/,
      /require\s*\(\s*['"`]https['"`]\s*\)/,
      /require\s*\(\s*['"`]dgram['"`]\s*\)/,
      
      // 프로세스 제어
      /process\s*\.\s*(exit|abort|kill)/,
      /process\s*\.\s*(env|argv|execPath)/,
      
      // eval 및 동적 코드 실행
      /eval\s*\(/,
      /new\s+Function\s*\(/,
      
      // 글로벌 객체 접근
      /global\s*\./,
      /__dirname/,
      /__filename/,
      
      // 무한 루프 가능성
      /while\s*\(\s*true\s*\)/,
      /for\s*\(\s*;\s*;\s*\)/
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(script)) {
        errors.push(`위험한 패턴 감지: ${pattern.source}`);
      }
    }
    
    // 구문 검사
    try {
      new vm.Script(script, { displayErrors: false });
    } catch (syntaxError) {
      errors.push(`구문 오류: ${syntaxError.message}`);
    }
    
    // 복잡도 검사
    const complexity = this.calculateComplexity(script);
    if (complexity > 100) {
      errors.push(`스크립트 복잡도가 너무 높습니다: ${complexity}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      complexity
    };
  }

  /**
   * 스크립트 복잡도 계산
   * @param {string} script - 스크립트
   * @returns {number} 복잡도 점수
   */
  calculateComplexity(script) {
    let complexity = 1;
    
    // 제어 구조 카운트
    const controlStructures = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /else\s*{/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /do\s*{/g,
      /switch\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*.*\s*:/g // 삼항 연산자
    ];
    
    for (const pattern of controlStructures) {
      const matches = script.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    // 함수 정의 카운트
    const functionPatterns = [
      /function\s+\w+\s*\(/g,
      /\w+\s*:\s*function\s*\(/g,
      /\w+\s*=\s*function\s*\(/g,
      /\w+\s*=>\s*{/g,
      /\(\s*\w*\s*\)\s*=>\s*{/g
    ];
    
    for (const pattern of functionPatterns) {
      const matches = script.match(pattern);
      if (matches) {
        complexity += matches.length * 2;
      }
    }
    
    return complexity;
  }

  /**
   * 샌드박스 컨텍스트 생성
   * @param {Object} userContext - 사용자 컨텍스트
   * @returns {Object} 샌드박스 컨텍스트
   */
  createSandboxContext(userContext) {
    // 기본 글로벌 컨텍스트 복사
    const sandboxContext = { ...this.globalContext };
    
    // 사용자 컨텍스트 추가 (안전한 항목만)
    const safeUserContext = this.sanitizeContext(userContext);
    Object.assign(sandboxContext, safeUserContext);
    
    // 보조 함수 추가
    sandboxContext.utils = this.createUtilityFunctions();
    
    return vm.createContext(sandboxContext);
  }

  /**
   * 사용자 컨텍스트 정제
   * @param {Object} context - 원본 컨텍스트
   * @returns {Object} 정제된 컨텍스트
   */
  sanitizeContext(context) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      // 함수는 제외
      if (typeof value === 'function') {
        continue;
      }
      
      // 순환 참조 확인
      try {
        JSON.stringify(value);
        sanitized[key] = this.deepClone(value);
      } catch (error) {
        logger.warn(`컨텍스트 항목 '${key}' 제외: 순환 참조 또는 직렬화 불가`);
      }
    }
    
    return sanitized;
  }

  /**
   * 깊은 복사
   * @param {*} obj - 복사할 객체
   * @returns {*} 복사된 객체
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj);
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (obj instanceof Object) {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
  }

  /**
   * 유틸리티 함수 생성
   * @returns {Object} 유틸리티 함수 객체
   */
  createUtilityFunctions() {
    return {
      // 날짜 관련
      formatDate: (date, format = 'YYYY-MM-DD') => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
          .replace('YYYY', year)
          .replace('MM', month)
          .replace('DD', day)
          .replace('HH', hours)
          .replace('mm', minutes)
          .replace('ss', seconds);
      },
      
      parseDate: (dateString) => {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
      },
      
      // 문자열 관련
      trim: (str) => String(str).trim(),
      upper: (str) => String(str).toUpperCase(),
      lower: (str) => String(str).toLowerCase(),
      capitalize: (str) => {
        const s = String(str);
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      },
      padLeft: (str, length, padChar = ' ') => String(str).padStart(length, padChar),
      padRight: (str, length, padChar = ' ') => String(str).padEnd(length, padChar),
      
      // 숫자 관련
      round: (num, decimals = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(num * factor) / factor;
      },
      floor: (num) => Math.floor(num),
      ceil: (num) => Math.ceil(num),
      abs: (num) => Math.abs(num),
      
      // 배열 관련
      unique: (arr) => [...new Set(arr)],
      sum: (arr) => arr.reduce((sum, val) => sum + Number(val), 0),
      avg: (arr) => arr.length > 0 ? arr.reduce((sum, val) => sum + Number(val), 0) / arr.length : 0,
      max: (arr) => Math.max(...arr.map(Number)),
      min: (arr) => Math.min(...arr.map(Number)),
      
      // 객체 관련
      keys: (obj) => Object.keys(obj),
      values: (obj) => Object.values(obj),
      entries: (obj) => Object.entries(obj),
      merge: (...objects) => Object.assign({}, ...objects),
      
      // 타입 체크
      isString: (val) => typeof val === 'string',
      isNumber: (val) => typeof val === 'number' && !isNaN(val),
      isBoolean: (val) => typeof val === 'boolean',
      isArray: (val) => Array.isArray(val),
      isObject: (val) => val !== null && typeof val === 'object' && !Array.isArray(val),
      isNull: (val) => val === null,
      isUndefined: (val) => val === undefined,
      isEmpty: (val) => {
        if (val === null || val === undefined) return true;
        if (typeof val === 'string') return val.trim() === '';
        if (Array.isArray(val)) return val.length === 0;
        if (typeof val === 'object') return Object.keys(val).length === 0;
        return false;
      },
      
      // 변환 함수
      toString: (val) => String(val),
      toNumber: (val) => Number(val),
      toBoolean: (val) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
          const lower = val.toLowerCase();
          return lower === 'true' || lower === 'yes' || lower === '1';
        }
        return Boolean(val);
      },
      toArray: (val) => {
        if (Array.isArray(val)) return val;
        if (val === null || val === undefined) return [];
        return [val];
      },
      
      // 조건부 함수
      ifNull: (val, defaultVal) => val === null || val === undefined ? defaultVal : val,
      ifEmpty: (val, defaultVal) => {
        if (val === null || val === undefined) return defaultVal;
        if (typeof val === 'string' && val.trim() === '') return defaultVal;
        if (Array.isArray(val) && val.length === 0) return defaultVal;
        if (typeof val === 'object' && Object.keys(val).length === 0) return defaultVal;
        return val;
      }
    };
  }

  /**
   * 스크립트 래핑
   * @param {string} script - 원본 스크립트
   * @returns {string} 래핑된 스크립트
   */
  wrapScript(script) {
    // async/await 지원을 위한 래핑
    return `
      (async function() {
        'use strict';
        ${script}
      })()
    `;
  }

  /**
   * 스크립트 캐시 지우기
   */
  clearCache() {
    // V8 컴파일 캐시 지우기
    if (global.gc) {
      global.gc();
    }
  }
}

module.exports = ScriptSandbox;