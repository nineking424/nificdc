const crypto = require('crypto');

class CryptoUtil {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    
    // 환경 변수에서 암호화 키 가져오기
    this.secretKey = process.env.ENCRYPTION_SECRET_KEY || 'default-secret-key-change-this-in-production';
    
    // 키가 32바이트가 되도록 조정
    this.key = crypto.createHash('sha256').update(this.secretKey).digest();
  }

  /**
   * 데이터를 암호화합니다.
   * @param {string} text - 암호화할 텍스트
   * @returns {string} - 암호화된 데이터 (base64 인코딩)
   */
  encrypt(text) {
    try {
      // 랜덤 IV 생성
      const iv = crypto.randomBytes(this.ivLength);
      
      // 암호화 객체 생성
      const cipher = crypto.createCipher(this.algorithm, this.key);
      cipher.setAAD(Buffer.from('nificdc-system-info'));
      
      // 암호화 수행
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // 인증 태그 가져오기
      const tag = cipher.getAuthTag();
      
      // IV, 태그, 암호화된 데이터를 결합
      const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'base64')]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`암호화 실패: ${error.message}`);
    }
  }

  /**
   * 데이터를 복호화합니다.
   * @param {string} encryptedData - 암호화된 데이터 (base64 인코딩)
   * @returns {string} - 복호화된 텍스트
   */
  decrypt(encryptedData) {
    try {
      // base64 디코딩
      const combined = Buffer.from(encryptedData, 'base64');
      
      // IV, 태그, 암호화된 데이터 분리
      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);
      
      // 복호화 객체 생성
      const decipher = crypto.createDecipher(this.algorithm, this.key);
      decipher.setAAD(Buffer.from('nificdc-system-info'));
      decipher.setAuthTag(tag);
      
      // 복호화 수행
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`복호화 실패: ${error.message}`);
    }
  }

  /**
   * 비밀번호를 해시합니다.
   * @param {string} password - 해시할 비밀번호
   * @param {string} salt - 선택적 솔트
   * @returns {Object} - 해시된 비밀번호와 솔트
   */
  hashPassword(password, salt = null) {
    try {
      if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
      }
      
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      
      return {
        hash,
        salt
      };
    } catch (error) {
      throw new Error(`비밀번호 해시 실패: ${error.message}`);
    }
  }

  /**
   * 비밀번호를 검증합니다.
   * @param {string} password - 검증할 비밀번호
   * @param {string} hash - 저장된 해시
   * @param {string} salt - 저장된 솔트
   * @returns {boolean} - 비밀번호 일치 여부
   */
  verifyPassword(password, hash, salt) {
    try {
      const { hash: computedHash } = this.hashPassword(password, salt);
      return computedHash === hash;
    } catch (error) {
      throw new Error(`비밀번호 검증 실패: ${error.message}`);
    }
  }

  /**
   * 랜덤 토큰을 생성합니다.
   * @param {number} length - 토큰 길이 (기본값: 32)
   * @returns {string} - 랜덤 토큰
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 데이터 무결성을 위한 해시를 생성합니다.
   * @param {string} data - 해시할 데이터
   * @returns {string} - SHA-256 해시
   */
  generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 민감한 데이터를 마스킹합니다.
   * @param {string} data - 마스킹할 데이터
   * @param {number} visibleStart - 앞쪽 노출 문자 수
   * @param {number} visibleEnd - 뒤쪽 노출 문자 수
   * @returns {string} - 마스킹된 데이터
   */
  maskSensitiveData(data, visibleStart = 2, visibleEnd = 2) {
    if (!data || data.length <= visibleStart + visibleEnd) {
      return '*'.repeat(data ? data.length : 0);
    }
    
    const start = data.substring(0, visibleStart);
    const end = data.substring(data.length - visibleEnd);
    const middle = '*'.repeat(data.length - visibleStart - visibleEnd);
    
    return start + middle + end;
  }
}

module.exports = new CryptoUtil();