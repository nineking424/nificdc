const crypto = require('crypto');

/**
 * 변환 함수 유틸리티 라이브러리
 * 매핑 엔진에서 사용할 수 있는 공통 변환 함수들을 제공
 */
class TransformUtils {
  
  // ===== 문자열 변환 함수 =====
  
  /**
   * 문자열을 대문자로 변환
   */
  static toUpperCase(value) {
    return value ? String(value).toUpperCase() : value;
  }

  /**
   * 문자열을 소문자로 변환
   */
  static toLowerCase(value) {
    return value ? String(value).toLowerCase() : value;
  }

  /**
   * 문자열의 첫 글자를 대문자로 변환
   */
  static capitalize(value) {
    if (!value) return value;
    const str = String(value);
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * 문자열 앞뒤 공백 제거
   */
  static trim(value) {
    return value ? String(value).trim() : value;
  }

  /**
   * 문자열에서 특정 문자 제거
   */
  static removeChars(value, chars) {
    if (!value) return value;
    let result = String(value);
    for (const char of chars) {
      result = result.replace(new RegExp(char, 'g'), '');
    }
    return result;
  }

  /**
   * 문자열 치환
   */
  static replace(value, search, replacement) {
    if (!value) return value;
    return String(value).replace(new RegExp(search, 'g'), replacement);
  }

  /**
   * 문자열 패딩
   */
  static padLeft(value, length, padChar = ' ') {
    if (!value) return value;
    return String(value).padStart(length, padChar);
  }

  static padRight(value, length, padChar = ' ') {
    if (!value) return value;
    return String(value).padEnd(length, padChar);
  }

  /**
   * 문자열 자르기
   */
  static substring(value, start, end) {
    if (!value) return value;
    return String(value).substring(start, end);
  }

  // ===== 숫자 변환 함수 =====

  /**
   * 문자열을 정수로 변환
   */
  static toInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * 문자열을 실수로 변환
   */
  static toFloat(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  /**
   * 숫자를 문자열로 변환
   */
  static toString(value) {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  /**
   * 숫자 반올림
   */
  static round(value, decimals = 0) {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * 숫자 올림
   */
  static ceil(value) {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : Math.ceil(num);
  }

  /**
   * 숫자 내림
   */
  static floor(value) {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : Math.floor(num);
  }

  /**
   * 절댓값
   */
  static abs(value) {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : Math.abs(num);
  }

  // ===== 날짜 변환 함수 =====

  /**
   * 문자열을 날짜로 변환
   */
  static toDate(value, format = null) {
    if (!value) return null;
    
    if (format) {
      return this.parseDate(value, format);
    }
    
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * 날짜를 문자열로 변환
   */
  static formatDate(value, format = 'YYYY-MM-DD') {
    if (!value) return null;
    
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * 현재 날짜/시간 반환
   */
  static now() {
    return new Date();
  }

  /**
   * 날짜에 일수 추가
   */
  static addDays(value, days) {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    
    date.setDate(date.getDate() + days);
    return date;
  }

  /**
   * 날짜 차이 계산 (일 단위)
   */
  static dateDiff(date1, date2) {
    if (!date1 || !date2) return null;
    
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ===== 논리 변환 함수 =====

  /**
   * 값을 불린으로 변환
   */
  static toBoolean(value) {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    
    const str = String(value).toLowerCase();
    return ['true', 'yes', '1', 'on', 'y'].includes(str);
  }

  /**
   * 조건부 값 반환
   */
  static ifElse(condition, trueValue, falseValue) {
    return condition ? trueValue : falseValue;
  }

  /**
   * null 또는 undefined인 경우 기본값 반환
   */
  static defaultValue(value, defaultVal) {
    return (value === null || value === undefined) ? defaultVal : value;
  }

  // ===== 배열 변환 함수 =====

  /**
   * 배열 요소 추출
   */
  static arrayElement(array, index) {
    if (!Array.isArray(array)) return null;
    return array[index] || null;
  }

  /**
   * 배열 길이
   */
  static arrayLength(array) {
    if (!Array.isArray(array)) return 0;
    return array.length;
  }

  /**
   * 배열 합치기
   */
  static arrayJoin(array, separator = ',') {
    if (!Array.isArray(array)) return null;
    return array.join(separator);
  }

  /**
   * 문자열을 배열로 분할
   */
  static split(value, separator = ',') {
    if (!value) return [];
    return String(value).split(separator);
  }

  // ===== 객체 변환 함수 =====

  /**
   * 객체에서 키 추출
   */
  static objectKeys(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj);
  }

  /**
   * 객체에서 값 추출
   */
  static objectValues(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.values(obj);
  }

  /**
   * 중첩된 객체에서 값 가져오기
   */
  static getProperty(obj, path) {
    if (!obj || !path) return null;
    
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  // ===== 인코딩/디코딩 함수 =====

  /**
   * Base64 인코딩
   */
  static base64Encode(value) {
    if (!value) return null;
    return Buffer.from(String(value)).toString('base64');
  }

  /**
   * Base64 디코딩
   */
  static base64Decode(value) {
    if (!value) return null;
    try {
      return Buffer.from(String(value), 'base64').toString('utf8');
    } catch (error) {
      return null;
    }
  }

  /**
   * URL 인코딩
   */
  static urlEncode(value) {
    if (!value) return null;
    return encodeURIComponent(String(value));
  }

  /**
   * URL 디코딩
   */
  static urlDecode(value) {
    if (!value) return null;
    try {
      return decodeURIComponent(String(value));
    } catch (error) {
      return null;
    }
  }

  // ===== 해시 함수 =====

  /**
   * MD5 해시
   */
  static md5(value) {
    if (!value) return null;
    return crypto.createHash('md5').update(String(value)).digest('hex');
  }

  /**
   * SHA1 해시
   */
  static sha1(value) {
    if (!value) return null;
    return crypto.createHash('sha1').update(String(value)).digest('hex');
  }

  /**
   * SHA256 해시
   */
  static sha256(value) {
    if (!value) return null;
    return crypto.createHash('sha256').update(String(value)).digest('hex');
  }

  // ===== 유효성 검사 함수 =====

  /**
   * 이메일 형식 검증
   */
  static isEmail(value) {
    if (!value) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(value));
  }

  /**
   * 전화번호 형식 검증 (한국)
   */
  static isPhoneNumber(value) {
    if (!value) return false;
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    return phoneRegex.test(String(value));
  }

  /**
   * 숫자 형식 검증
   */
  static isNumeric(value) {
    if (value === null || value === undefined) return false;
    return !isNaN(value) && !isNaN(parseFloat(value));
  }

  /**
   * 날짜 형식 검증
   */
  static isDate(value) {
    if (!value) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  // ===== 고급 변환 함수 =====

  /**
   * 정규식 매칭
   */
  static regexMatch(value, pattern, flags = 'g') {
    if (!value || !pattern) return null;
    
    try {
      const regex = new RegExp(pattern, flags);
      const matches = String(value).match(regex);
      return matches || [];
    } catch (error) {
      return null;
    }
  }

  /**
   * 정규식 치환
   */
  static regexReplace(value, pattern, replacement, flags = 'g') {
    if (!value || !pattern) return value;
    
    try {
      const regex = new RegExp(pattern, flags);
      return String(value).replace(regex, replacement);
    } catch (error) {
      return value;
    }
  }

  /**
   * JSON 파싱
   */
  static parseJSON(value) {
    if (!value) return null;
    
    try {
      return JSON.parse(String(value));
    } catch (error) {
      return null;
    }
  }

  /**
   * JSON 문자열화
   */
  static stringifyJSON(value) {
    if (value === null || value === undefined) return null;
    
    try {
      return JSON.stringify(value);
    } catch (error) {
      return null;
    }
  }

  /**
   * 고유 ID 생성
   */
  static generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * 랜덤 문자열 생성
   */
  static randomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // ===== 한국어 특화 함수 =====

  /**
   * 한글 자모 분리
   */
  static separateKorean(value) {
    if (!value) return null;
    
    const str = String(value);
    let result = '';
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(i);
      const code = char.charCodeAt(0);
      
      if (code >= 0xAC00 && code <= 0xD7A3) {
        // 한글 완성형 분리
        const base = code - 0xAC00;
        const chosung = Math.floor(base / 588);
        const jungsung = Math.floor((base % 588) / 28);
        const jongsung = base % 28;
        
        const chosungChars = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
        const jungsungChars = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
        const jongsungChars = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
        
        result += chosungChars[chosung];
        result += jungsungChars[jungsung];
        if (jongsung > 0) {
          result += jongsungChars[jongsung];
        }
      } else {
        result += char;
      }
    }
    
    return result;
  }

  /**
   * 한글 초성 추출
   */
  static getKoreanChosung(value) {
    if (!value) return null;
    
    const str = String(value);
    let result = '';
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(i);
      const code = char.charCodeAt(0);
      
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const base = code - 0xAC00;
        const chosung = Math.floor(base / 588);
        const chosungChars = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
        result += chosungChars[chosung];
      } else {
        result += char;
      }
    }
    
    return result;
  }

  // ===== 유틸리티 함수 =====

  /**
   * 사용 가능한 모든 함수 목록 반환
   */
  static getAvailableFunctions() {
    return Object.getOwnPropertyNames(this)
      .filter(name => typeof this[name] === 'function' && name !== 'constructor')
      .map(name => ({
        name,
        description: this.getFunctionDescription(name)
      }));
  }

  /**
   * 함수 설명 반환
   */
  static getFunctionDescription(functionName) {
    const descriptions = {
      // 문자열 함수
      toUpperCase: '문자열을 대문자로 변환',
      toLowerCase: '문자열을 소문자로 변환',
      capitalize: '첫 글자를 대문자로 변환',
      trim: '앞뒤 공백 제거',
      removeChars: '특정 문자 제거',
      replace: '문자열 치환',
      padLeft: '왼쪽 패딩',
      padRight: '오른쪽 패딩',
      substring: '문자열 자르기',
      
      // 숫자 함수
      toInteger: '정수로 변환',
      toFloat: '실수로 변환',
      toString: '문자열로 변환',
      round: '반올림',
      ceil: '올림',
      floor: '내림',
      abs: '절댓값',
      
      // 날짜 함수
      toDate: '날짜로 변환',
      formatDate: '날짜 포맷팅',
      now: '현재 날짜/시간',
      addDays: '날짜에 일수 추가',
      dateDiff: '날짜 차이 계산',
      
      // 논리 함수
      toBoolean: '불린으로 변환',
      ifElse: '조건부 값 반환',
      defaultValue: '기본값 반환',
      
      // 배열 함수
      arrayElement: '배열 요소 추출',
      arrayLength: '배열 길이',
      arrayJoin: '배열 합치기',
      split: '문자열 분할',
      
      // 객체 함수
      objectKeys: '객체 키 추출',
      objectValues: '객체 값 추출',
      getProperty: '중첩 속성 값 가져오기',
      
      // 인코딩/디코딩 함수
      base64Encode: 'Base64 인코딩',
      base64Decode: 'Base64 디코딩',
      urlEncode: 'URL 인코딩',
      urlDecode: 'URL 디코딩',
      
      // 해시 함수
      md5: 'MD5 해시',
      sha1: 'SHA1 해시',
      sha256: 'SHA256 해시',
      
      // 유효성 검사 함수
      isEmail: '이메일 형식 검증',
      isPhoneNumber: '전화번호 형식 검증',
      isNumeric: '숫자 형식 검증',
      isDate: '날짜 형식 검증',
      
      // 고급 변환 함수
      regexMatch: '정규식 매칭',
      regexReplace: '정규식 치환',
      parseJSON: 'JSON 파싱',
      stringifyJSON: 'JSON 문자열화',
      generateUUID: '고유 ID 생성',
      randomString: '랜덤 문자열 생성',
      
      // 한국어 특화 함수
      separateKorean: '한글 자모 분리',
      getKoreanChosung: '한글 초성 추출'
    };
    
    return descriptions[functionName] || '설명 없음';
  }

  /**
   * 특정 형식의 날짜 파싱
   */
  static parseDate(value, format) {
    if (!value || !format) return null;
    
    try {
      // 간단한 형식 파싱 구현
      const str = String(value);
      
      if (format === 'YYYY-MM-DD') {
        const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
      } else if (format === 'DD/MM/YYYY') {
        const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
          return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        }
      }
      
      return new Date(value);
    } catch (error) {
      return null;
    }
  }
}

module.exports = TransformUtils;