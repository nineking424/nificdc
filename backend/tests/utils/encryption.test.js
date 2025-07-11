const {
  encrypt,
  decrypt,
  encryptConnectionInfo,
  decryptConnectionInfo,
  hash,
  verifyHash,
  maskSensitiveData,
  generateKey,
  encodeKey,
  EncryptionUtil
} = require('../../src/utils/encryption');

describe('Encryption Utility', () => {
  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt string data', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt object data', () => {
      const data = {
        username: 'testuser',
        password: 'testpass',
        port: 5432
      };

      const encrypted = encrypt(data);
      const decrypted = decrypt(encrypted, true);

      expect(encrypted).not.toBe(JSON.stringify(data));
      expect(decrypted).toEqual(data);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '한글 테스트 🚀 émojis';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Connection Info Encryption', () => {
    it('should encrypt sensitive fields in connection info', () => {
      const connectionInfo = {
        host: 'localhost',
        port: 5432,
        username: 'testuser',
        password: 'testpass',
        ssl: true
      };

      const encrypted = encryptConnectionInfo(connectionInfo);

      expect(encrypted.host).toBe('localhost');
      expect(encrypted.port).toBe(5432);
      expect(encrypted.username).toBe('testuser');
      expect(encrypted.ssl).toBe(true);
      expect(encrypted.password).not.toBe('testpass');
      expect(encrypted.password_encrypted).toBe(true);
    });

    it('should decrypt connection info', () => {
      const connectionInfo = {
        host: 'localhost',
        port: 5432,
        username: 'testuser',
        password: 'testpass',
        apiKey: 'secret-api-key'
      };

      const encrypted = encryptConnectionInfo(connectionInfo);
      const decrypted = decryptConnectionInfo(encrypted);

      expect(decrypted.host).toBe('localhost');
      expect(decrypted.port).toBe(5432);
      expect(decrypted.username).toBe('testuser');
      expect(decrypted.password).toBe('testpass');
      expect(decrypted.apiKey).toBe('secret-api-key');
      expect(decrypted.password_encrypted).toBeUndefined();
      expect(decrypted.apiKey_encrypted).toBeUndefined();
    });

    it('should handle multiple sensitive fields', () => {
      const connectionInfo = {
        host: 'aws.example.com',
        username: 'user',
        password: 'pass',
        token: 'jwt-token',
        apiKey: 'api-key',
        secretKey: 'secret-key',
        privateKey: 'private-key',
        passphrase: 'passphrase'
      };

      const encrypted = encryptConnectionInfo(connectionInfo);
      const decrypted = decryptConnectionInfo(encrypted);

      expect(decrypted.host).toBe('aws.example.com');
      expect(decrypted.username).toBe('user');
      expect(decrypted.password).toBe('pass');
      expect(decrypted.token).toBe('jwt-token');
      expect(decrypted.apiKey).toBe('api-key');
      expect(decrypted.secretKey).toBe('secret-key');
      expect(decrypted.privateKey).toBe('private-key');
      expect(decrypted.passphrase).toBe('passphrase');
    });

    it('should handle connection info without sensitive fields', () => {
      const connectionInfo = {
        host: 'localhost',
        port: 5432,
        ssl: true,
        timeout: 30000
      };

      const encrypted = encryptConnectionInfo(connectionInfo);
      const decrypted = decryptConnectionInfo(encrypted);

      expect(encrypted).toEqual(connectionInfo);
      expect(decrypted).toEqual(connectionInfo);
    });
  });

  describe('Hashing', () => {
    it('should generate consistent hash for same data', () => {
      const data = 'test data';
      const hash1 = hash(data);
      const hash2 = hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different hashes for different data', () => {
      const data1 = 'test data 1';
      const data2 = 'test data 2';
      const hash1 = hash(data1);
      const hash2 = hash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should verify hash correctly', () => {
      const data = 'test data';
      const dataHash = hash(data);

      expect(verifyHash(data, dataHash)).toBe(true);
      expect(verifyHash('wrong data', dataHash)).toBe(false);
    });
  });

  describe('Key Management', () => {
    it('should generate valid encryption key', () => {
      const key = generateKey();

      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // 256 bits
    });

    it('should encode key to base64', () => {
      const key = generateKey();
      const encoded = encodeKey(key);

      expect(typeof encoded).toBe('string');
      expect(Buffer.from(encoded, 'base64')).toEqual(key);
    });
  });

  describe('Data Masking', () => {
    it('should mask sensitive fields', () => {
      const data = {
        host: 'localhost',
        username: 'user',
        password: 'secret',
        token: 'jwt-token',
        apiKey: 'api-key',
        port: 5432
      };

      const masked = maskSensitiveData(data);

      expect(masked.host).toBe('localhost');
      expect(masked.username).toBe('user');
      expect(masked.port).toBe(5432);
      expect(masked.password).toBe('***');
      expect(masked.token).toBe('***');
      expect(masked.apiKey).toBe('***');
    });

    it('should handle non-object data', () => {
      expect(maskSensitiveData('string')).toBe('string');
      expect(maskSensitiveData(123)).toBe(123);
      expect(maskSensitiveData(null)).toBe(null);
      expect(maskSensitiveData(undefined)).toBe(undefined);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid encrypted data', () => {
      expect(() => decrypt('invalid-data')).toThrow('Failed to decrypt data');
    });

    it('should throw error for empty encrypted data', () => {
      expect(() => decrypt('')).toThrow('Failed to decrypt data');
    });

    it('should throw error for null encrypted data', () => {
      expect(() => decrypt(null)).toThrow('Failed to decrypt data');
    });

    it('should throw error for invalid connection info', () => {
      expect(() => encryptConnectionInfo('not-an-object')).toThrow('Connection info must be an object');
      expect(() => decryptConnectionInfo('not-an-object')).toThrow('Encrypted connection info must be an object');
    });
  });

  describe('Key Rotation', () => {
    it('should rotate encryption key successfully', () => {
      const util = new EncryptionUtil();
      const plaintext = 'test data for rotation';
      const originalEncrypted = util.encrypt(plaintext);
      
      const newKey = generateKey();
      const reencrypted = util.rotateKey(originalEncrypted, newKey);
      
      // Should be different encrypted values
      expect(reencrypted).not.toBe(originalEncrypted);
      
      // Should decrypt to same plaintext with new key
      const newUtil = new EncryptionUtil();
      newUtil.encryptionKey = newKey;
      const decrypted = newUtil.decrypt(reencrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Large Data Handling', () => {
    it('should handle large data encryption/decryption', () => {
      const largeData = 'x'.repeat(10000); // 10KB of data
      const encrypted = encrypt(largeData);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(largeData);
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, 3, { nested: 'value' }],
              string: 'test',
              number: 42,
              boolean: true,
              null: null
            }
          }
        },
        topLevel: 'value'
      };

      const encrypted = encrypt(complexData);
      const decrypted = decrypt(encrypted, true);

      expect(decrypted).toEqual(complexData);
    });
  });
});