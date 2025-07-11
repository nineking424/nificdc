const crypto = require('crypto');
const logger = require('./logger');

// 기본 설정
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const TAG_LENGTH = 16; // 128 bits

class EncryptionUtil {
  constructor() {
    this.encryptionKey = this.getEncryptionKey();
  }

  /**
   * 암호화 키 생성 또는 가져오기
   */
  getEncryptionKey() {
    const keyFromEnv = process.env.ENCRYPTION_KEY;
    
    if (keyFromEnv) {
      // 환경변수에서 키 가져오기 (Base64 인코딩된 키)
      try {
        const key = Buffer.from(keyFromEnv, 'base64');
        if (key.length !== KEY_LENGTH) {
          throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
        }
        return key;
      } catch (error) {
        logger.error('Invalid encryption key in environment variable:', error);
        throw new Error('Invalid encryption key configuration');
      }
    }
    
    // 개발/테스트 환경에서만 기본 키 사용 (운영에서는 반드시 환경변수 설정 필요)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    
    logger.warn('Using default encryption key for development/testing. Set ENCRYPTION_KEY in production!');
    return crypto.scryptSync('default-dev-password', 'salt', KEY_LENGTH);
  }

  /**
   * 새로운 암호화 키 생성
   */
  static generateKey() {
    return crypto.randomBytes(KEY_LENGTH);
  }

  /**
   * 키를 Base64 문자열로 인코딩
   */
  static encodeKey(key) {
    return key.toString('base64');
  }

  /**
   * 데이터 암호화
   * @param {string|object} data - 암호화할 데이터
   * @returns {string} - 암호화된 데이터 (Base64)
   */
  encrypt(data) {
    try {
      // 객체인 경우 JSON 문자열로 변환
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      
      // IV 생성
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // 암호화 객체 생성
      const cipher = crypto.createCipher(ALGORITHM, this.encryptionKey, { iv });
      
      // 데이터 암호화
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // 인증 태그 가져오기
      const tag = cipher.getAuthTag();
      
      // IV + 태그 + 암호화된 데이터를 하나의 버퍼로 결합
      const result = Buffer.concat([iv, tag, encrypted]);
      
      return result.toString('base64');
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * 데이터 복호화
   * @param {string} encryptedData - 암호화된 데이터 (Base64)
   * @param {boolean} parseJson - JSON 파싱 여부
   * @returns {string|object} - 복호화된 데이터
   */
  decrypt(encryptedData, parseJson = false) {
    try {
      if (!encryptedData) {
        throw new Error('No data to decrypt');
      }

      // Base64 디코딩
      const buffer = Buffer.from(encryptedData, 'base64');
      
      if (buffer.length < IV_LENGTH + TAG_LENGTH) {
        throw new Error('Invalid encrypted data format');
      }
      
      // IV, 태그, 암호화된 데이터 분리
      const iv = buffer.subarray(0, IV_LENGTH);
      const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
      
      // 복호화 객체 생성
      const decipher = crypto.createDecipher(ALGORITHM, this.encryptionKey, { iv });
      decipher.setAuthTag(tag);
      
      // 데이터 복호화
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      const plaintext = decrypted.toString('utf8');
      
      // JSON 파싱이 요청된 경우
      if (parseJson) {
        try {
          return JSON.parse(plaintext);
        } catch (parseError) {
          logger.warn('Failed to parse decrypted data as JSON, returning as string');
          return plaintext;
        }
      }
      
      return plaintext;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * 연결 정보 암호화 (민감한 필드만)
   * @param {object} connectionInfo - 연결 정보 객체
   * @returns {object} - 민감한 필드가 암호화된 연결 정보
   */
  encryptConnectionInfo(connectionInfo) {
    if (!connectionInfo || typeof connectionInfo !== 'object') {
      throw new Error('Connection info must be an object');
    }

    const sensitiveFields = ['password', 'token', 'apiKey', 'secretKey', 'privateKey', 'passphrase'];
    const encrypted = { ...connectionInfo };

    sensitiveFields.forEach(field => {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
        encrypted[`${field}_encrypted`] = true;
      }
    });

    return encrypted;
  }

  /**
   * 연결 정보 복호화
   * @param {object} encryptedConnectionInfo - 암호화된 연결 정보
   * @returns {object} - 복호화된 연결 정보
   */
  decryptConnectionInfo(encryptedConnectionInfo) {
    if (!encryptedConnectionInfo || typeof encryptedConnectionInfo !== 'object') {
      throw new Error('Encrypted connection info must be an object');
    }

    const decrypted = { ...encryptedConnectionInfo };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secretKey', 'privateKey', 'passphrase'];

    sensitiveFields.forEach(field => {
      if (decrypted[field] && decrypted[`${field}_encrypted`]) {
        decrypted[field] = this.decrypt(decrypted[field]);
        delete decrypted[`${field}_encrypted`];
      }
    });

    return decrypted;
  }

  /**
   * 데이터 해시 생성 (무결성 검증용)
   * @param {string} data - 해시할 데이터
   * @returns {string} - SHA256 해시 (hex)
   */
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 해시 검증
   * @param {string} data - 원본 데이터
   * @param {string} hash - 비교할 해시
   * @returns {boolean} - 검증 결과
   */
  verifyHash(data, hash) {
    const computedHash = this.hash(data);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }

  /**
   * 키 로테이션 (새로운 키로 데이터 재암호화)
   * @param {string} encryptedData - 기존 암호화된 데이터
   * @param {Buffer} newKey - 새로운 암호화 키
   * @returns {string} - 새로운 키로 암호화된 데이터
   */
  rotateKey(encryptedData, newKey) {
    try {
      // 기존 키로 복호화
      const decryptedData = this.decrypt(encryptedData);
      
      // 새로운 키로 암호화
      const oldKey = this.encryptionKey;
      this.encryptionKey = newKey;
      const reencryptedData = this.encrypt(decryptedData);
      
      // 기존 키 복원 (다른 데이터에 영향을 주지 않기 위해)
      this.encryptionKey = oldKey;
      
      return reencryptedData;
    } catch (error) {
      logger.error('Key rotation failed:', error);
      throw new Error('Failed to rotate encryption key');
    }
  }

  /**
   * 민감한 데이터 마스킹 (로그용)
   * @param {object} data - 마스킹할 데이터
   * @returns {object} - 마스킹된 데이터
   */
  static maskSensitiveData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'apiKey', 'secretKey', 'privateKey', 'passphrase'];
    const masked = { ...data };

    sensitiveFields.forEach(field => {
      if (masked[field]) {
        masked[field] = '***';
      }
    });

    return masked;
  }
}

// 싱글톤 인스턴스
const encryptionUtil = new EncryptionUtil();

module.exports = {
  EncryptionUtil,
  encrypt: (data) => encryptionUtil.encrypt(data),
  decrypt: (data, parseJson = false) => encryptionUtil.decrypt(data, parseJson),
  encryptConnectionInfo: (info) => encryptionUtil.encryptConnectionInfo(info),
  decryptConnectionInfo: (info) => encryptionUtil.decryptConnectionInfo(info),
  hash: (data) => encryptionUtil.hash(data),
  verifyHash: (data, hash) => encryptionUtil.verifyHash(data, hash),
  rotateKey: (data, newKey) => encryptionUtil.rotateKey(data, newKey),
  maskSensitiveData: EncryptionUtil.maskSensitiveData,
  generateKey: EncryptionUtil.generateKey,
  encodeKey: EncryptionUtil.encodeKey
};