/**
 * RFC 6238 (TOTP) & RFC 4226 (HOTP) & RFC 4648 (Base32) 구현 모듈
 * 보안 원칙:
 * 1. Math.random() 대신 crypto.getRandomValues() CSPRNG 사용
 * 2. 브라우저 내장 window.crypto.subtle을 통한 Zero-Transmission 로컬 HMAC-SHA1 연산
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// 브라우저 및 Node/SSR 환경 호환 Crypto 객체 참조
const getCrypto = () => {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API를 지원하지 않는 환경입니다.');
};

/**
 * 암호학적 안전한 난수(CSPRNG)를 사용하여 160비트(20바이트 -> 32자리 Base32) 비밀키를 생성합니다.
 * @returns {string} 32글자의 Base32 비밀키
 */
export function generateBase32Secret() {
  const cryptoObj = getCrypto();
  const randomBytes = new Uint8Array(20); // 160-bit (RFC 4226 권장)
  cryptoObj.getRandomValues(randomBytes);

  let bits = '';
  for (let i = 0; i < randomBytes.length; i++) {
    bits += randomBytes[i].toString(2).padStart(8, '0');
  }

  let secret = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5);
    const index = parseInt(chunk, 2);
    secret += BASE32_ALPHABET[index];
  }

  return secret;
}

/**
 * Base32 문자열을 Uint8Array 바이트 배열로 디코딩합니다.
 * @param {string} base32Str 
 * @returns {Uint8Array}
 */
export function base32ToUint8Array(base32Str) {
  if (!base32Str || typeof base32Str !== 'string') {
    throw new Error('유효한 Base32 문자열을 입력해주세요.');
  }

  const cleaned = base32Str.toUpperCase().replace(/[\s=-]/g, '');
  if (cleaned.length === 0) {
    throw new Error('Base32 비밀키가 비어 있습니다.');
  }

  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`허용되지 않은 Base32 문자입니다: '${char}'`);
    }
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}

/**
 * 64-bit Big-Endian 카운터 ArrayBuffer를 생성합니다.
 * @param {number|bigint} timeStep 
 * @returns {Uint8Array} 8바이트 버퍼
 */
export function getCounterBuffer(timeStep) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(timeStep), false); // false = Big-Endian
  return new Uint8Array(buffer);
}

/**
 * 특정 시점의 TOTP 6자리 코드를 계산합니다 (RFC 6238)
 * @param {string} base32Secret 
 * @param {number} epochTimeMs 기준 시각 (기본: Date.now())
 * @param {number} period 갱신 주기 (초, 기본: 30)
 * @returns {Promise<string>} 6자리 숫자 문자열
 */
export async function generateTOTP(base32Secret, epochTimeMs = Date.now(), period = 30) {
  const timeStep = Math.floor(epochTimeMs / 1000 / period);
  const keyBytes = base32ToUint8Array(base32Secret);
  const counterBytes = getCounterBuffer(timeStep);

  const cryptoObj = getCrypto();

  // 브라우저 Web Crypto API를 사용하여 키 로드 (Zero-Transmission)
  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  // HMAC-SHA1 연산 수행 (20바이트)
  const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, counterBytes);
  const hmacResult = new Uint8Array(signature);

  // Dynamic Truncation (동적 절단: RFC 4226 Section 5.4)
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const binaryCode =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = (binaryCode % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * 입력된 6자리 코드를 검증합니다 (시간 오차 범위 지원)
 * @param {string} token 사용자가 입력한 6자리 코드
 * @param {string} base32Secret 비밀키
 * @param {number} windowSkew 허용할 시간 스텝 오차 (기본값: 1 => -30초, 현재, +30초)
 * @param {number} period 갱신 주기 (기본값: 30)
 * @returns {Promise<{ valid: boolean, delta: number|null }>}
 */
export async function verifyTOTP(token, base32Secret, windowSkew = 1, period = 30) {
  const cleanToken = token.replace(/\s+/g, '');
  if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return { valid: false, delta: null, reason: '6자리 숫자를 입력해주세요.' };
  }

  const currentStep = Math.floor(Date.now() / 1000 / period);

  for (let i = -windowSkew; i <= windowSkew; i++) {
    const testStepTime = (currentStep + i) * period * 1000;
    try {
      const expectedOtp = await generateTOTP(base32Secret, testStepTime, period);
      if (cleanToken === expectedOtp) {
        return { valid: true, delta: i };
      }
    } catch {
      // 키 디코딩 오류 등
      return { valid: false, delta: null, reason: '비밀키 형식이 올바르지 않습니다.' };
    }
  }

  return { valid: false, delta: null, reason: '인증 번호가 일치하지 않습니다.' };
}

/**
 * 30초 주기 내 현재 남은 초(second)를 반환합니다.
 * @param {number} period (기본값: 30)
 * @returns {number} 1 ~ 30
 */
export function getRemainingSeconds(period = 30) {
  const currentSeconds = Math.floor(Date.now() / 1000) % period;
  return period - currentSeconds;
}

/**
 * 표준 otpauth URI 생성
 * @param {string} issuer 발급자
 * @param {string} account 계정명
 * @param {string} secret Base32 비밀키
 * @returns {string}
 */
export function buildOtpAuthUri(issuer, account, secret) {
  const cleanIssuer = issuer.trim();
  const cleanAccount = account.trim();
  const label = `${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(cleanAccount)}`;
  const params = new URLSearchParams({
    secret: secret.trim(),
    issuer: cleanIssuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30'
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
