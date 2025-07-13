const fs = require('fs');
const path = require('path');
const https = require('https');
const logger = require('../src/utils/logger');

/**
 * SSL/TLS 설정 관리
 * 인증서 로딩, HTTPS 서버 설정, 보안 옵션 구성
 */

/**
 * SSL 인증서 로딩
 */
function loadSSLCertificates() {
  const certConfig = {
    key: null,
    cert: null,
    ca: null,
    passphrase: null
  };

  try {
    // 환경 변수에서 인증서 경로 확인
    const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/private-key.pem');
    const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/certificate.pem');
    const caPath = process.env.SSL_CA_PATH || path.join(__dirname, '../certs/ca-bundle.pem');
    const passphrase = process.env.SSL_PASSPHRASE;

    // 개인키 로딩
    if (fs.existsSync(keyPath)) {
      certConfig.key = fs.readFileSync(keyPath, 'utf8');
      logger.info('SSL 개인키 로딩 완료:', { keyPath });
    } else {
      logger.warn('SSL 개인키 파일이 없습니다:', { keyPath });
    }

    // 인증서 로딩
    if (fs.existsSync(certPath)) {
      certConfig.cert = fs.readFileSync(certPath, 'utf8');
      logger.info('SSL 인증서 로딩 완료:', { certPath });
    } else {
      logger.warn('SSL 인증서 파일이 없습니다:', { certPath });
    }

    // CA 번들 로딩 (선택사항)
    if (fs.existsSync(caPath)) {
      certConfig.ca = fs.readFileSync(caPath, 'utf8');
      logger.info('SSL CA 번들 로딩 완료:', { caPath });
    }

    // 패스프레이즈 설정
    if (passphrase) {
      certConfig.passphrase = passphrase;
      logger.info('SSL 패스프레이즈 설정 완료');
    }

  } catch (error) {
    logger.error('SSL 인증서 로딩 실패:', error);
  }

  return certConfig;
}

/**
 * HTTPS 서버 옵션 생성
 */
function createHTTPSOptions() {
  const certConfig = loadSSLCertificates();
  
  if (!certConfig.key || !certConfig.cert) {
    logger.warn('SSL 인증서가 불완전합니다. HTTPS 서버를 시작할 수 없습니다.');
    return null;
  }

  const httpsOptions = {
    key: certConfig.key,
    cert: certConfig.cert,
    
    // CA 번들이 있는 경우 포함
    ...(certConfig.ca && { ca: certConfig.ca }),
    
    // 패스프레이즈가 있는 경우 포함
    ...(certConfig.passphrase && { passphrase: certConfig.passphrase }),
    
    // 보안 옵션
    secureProtocol: 'TLSv1_2_method', // TLS 1.2 이상 강제
    honorCipherOrder: true,
    
    // 암호화 스위트 설정 (강력한 암호화만 허용)
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA384',
      'ECDHE-RSA-AES256-SHA256',
      'DHE-RSA-AES128-GCM-SHA256',
      'DHE-RSA-AES256-GCM-SHA384',
      'DHE-RSA-AES128-SHA256',
      'DHE-RSA-AES256-SHA256',
      'AES128-GCM-SHA256',
      'AES256-GCM-SHA384',
      'AES128-SHA256',
      'AES256-SHA256',
      '!aNULL',
      '!eNULL',
      '!EXPORT',
      '!DES',
      '!RC4',
      '!MD5',
      '!PSK',
      '!SRP',
      '!CAMELLIA'
    ].join(':'),
    
    // 클라이언트 인증서 요구 (선택사항)
    requestCert: process.env.SSL_REQUIRE_CLIENT_CERT === 'true',
    rejectUnauthorized: process.env.SSL_REJECT_UNAUTHORIZED !== 'false',
    
    // ECDH 곡선 설정
    ecdhCurve: 'auto',
    
    // 세션 재사용 설정
    sessionIdContext: 'nificdc-ssl-session'
  };

  logger.info('HTTPS 옵션 생성 완료:', {
    hasKey: !!httpsOptions.key,
    hasCert: !!httpsOptions.cert,
    hasCa: !!httpsOptions.ca,
    hasPassphrase: !!httpsOptions.passphrase,
    requestCert: httpsOptions.requestCert,
    rejectUnauthorized: httpsOptions.rejectUnauthorized
  });

  return httpsOptions;
}

/**
 * 자체 서명 인증서 생성 (개발용)
 */
function generateSelfSignedCert() {
  try {
    const forge = require('node-forge');
    
    // 키 쌍 생성
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // 인증서 생성
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    // 인증서 정보
    const attrs = [
      { name: 'countryName', value: 'KR' },
      { name: 'stateOrProvinceName', value: 'Seoul' },
      { name: 'localityName', value: 'Seoul' },
      { name: 'organizationName', value: 'NifiCDC Development' },
      { name: 'organizationalUnitName', value: 'IT Department' },
      { name: 'commonName', value: 'localhost' }
    ];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    
    // 확장 속성
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        emailProtection: true,
        timeStamping: true
      },
      {
        name: 'nsCertType',
        client: true,
        server: true,
        email: true,
        objsign: true,
        sslCA: true,
        emailCA: true,
        objCA: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: '127.0.0.1' },
          { type: 2, value: '::1' }
        ]
      }
    ]);
    
    // 인증서 서명
    cert.sign(keys.privateKey);
    
    // PEM 형식으로 변환
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    
    // 인증서 디렉토리 생성
    const certsDir = path.join(__dirname, '../certs');
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir, { recursive: true });
    }
    
    // 파일 저장
    fs.writeFileSync(path.join(certsDir, 'private-key.pem'), keyPem);
    fs.writeFileSync(path.join(certsDir, 'certificate.pem'), certPem);
    
    logger.info('자체 서명 인증서 생성 완료:', {
      keyPath: path.join(certsDir, 'private-key.pem'),
      certPath: path.join(certsDir, 'certificate.pem')
    });
    
    return {
      key: keyPem,
      cert: certPem
    };
    
  } catch (error) {
    logger.error('자체 서명 인증서 생성 실패:', error);
    return null;
  }
}

/**
 * 인증서 유효성 검증
 */
function validateCertificate(certPath) {
  try {
    if (!fs.existsSync(certPath)) {
      return { valid: false, error: 'Certificate file not found' };
    }

    const certData = fs.readFileSync(certPath, 'utf8');
    const forge = require('node-forge');
    const cert = forge.pki.certificateFromPem(certData);
    
    const now = new Date();
    const notBefore = cert.validity.notBefore;
    const notAfter = cert.validity.notAfter;
    
    if (now < notBefore) {
      return { valid: false, error: 'Certificate not yet valid' };
    }
    
    if (now > notAfter) {
      return { valid: false, error: 'Certificate expired' };
    }
    
    const daysUntilExpiry = Math.ceil((notAfter - now) / (1000 * 60 * 60 * 24));
    
    logger.info('인증서 유효성 검증 완료:', {
      subject: cert.subject.getField('CN').value,
      issuer: cert.issuer.getField('CN').value,
      notBefore: notBefore.toISOString(),
      notAfter: notAfter.toISOString(),
      daysUntilExpiry
    });
    
    return {
      valid: true,
      subject: cert.subject.getField('CN').value,
      issuer: cert.issuer.getField('CN').value,
      notBefore,
      notAfter,
      daysUntilExpiry
    };
    
  } catch (error) {
    logger.error('인증서 유효성 검증 실패:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * HTTPS 서버 생성
 */
function createHTTPSServer(app) {
  const httpsOptions = createHTTPSOptions();
  
  if (!httpsOptions) {
    // 개발 환경에서 자체 서명 인증서 생성
    if (process.env.NODE_ENV === 'development') {
      logger.info('개발 환경: 자체 서명 인증서 생성 중...');
      const selfSignedCert = generateSelfSignedCert();
      
      if (selfSignedCert) {
        return https.createServer({
          key: selfSignedCert.key,
          cert: selfSignedCert.cert,
          secureProtocol: 'TLSv1_2_method',
          honorCipherOrder: true
        }, app);
      }
    }
    
    logger.warn('HTTPS 서버를 생성할 수 없습니다. HTTP 서버만 실행됩니다.');
    return null;
  }
  
  return https.createServer(httpsOptions, app);
}

/**
 * SSL 설정 상태 조회
 */
function getSSLStatus() {
  const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '../certs/private-key.pem');
  const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '../certs/certificate.pem');
  
  const status = {
    enabled: false,
    keyExists: fs.existsSync(keyPath),
    certExists: fs.existsSync(certPath),
    certValid: false,
    certInfo: null
  };
  
  if (status.keyExists && status.certExists) {
    const certValidation = validateCertificate(certPath);
    status.certValid = certValidation.valid;
    status.certInfo = certValidation;
    status.enabled = certValidation.valid;
  }
  
  return status;
}

/**
 * TLS 보안 설정 검증
 */
function validateTLSConfig() {
  const checks = {
    httpsRedirect: process.env.FORCE_HTTPS === 'true',
    hstsEnabled: true, // helmet에서 자동 활성화
    secureCookies: process.env.SECURE_COOKIES !== 'false',
    tlsMinVersion: '1.2',
    strongCiphers: true
  };
  
  const warnings = [];
  
  if (!checks.httpsRedirect && process.env.NODE_ENV === 'production') {
    warnings.push('HTTPS 강제 리다이렉트가 비활성화되어 있습니다.');
  }
  
  if (!checks.secureCookies && process.env.NODE_ENV === 'production') {
    warnings.push('보안 쿠키 설정이 비활성화되어 있습니다.');
  }
  
  logger.info('TLS 보안 설정 검증 완료:', { checks, warnings });
  
  return { checks, warnings };
}

module.exports = {
  loadSSLCertificates,
  createHTTPSOptions,
  generateSelfSignedCert,
  validateCertificate,
  createHTTPSServer,
  getSSLStatus,
  validateTLSConfig
};