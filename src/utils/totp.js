/**
 * RFC 6238 표준 준수 TOTP (Time-based One-Time Password) 핵심 모듈
 * - RFC 4648 Base32 인코딩/디코딩
 * - 암호학적 난수 생성 (window.crypto.getRandomValues)
 * - 브라우저 내장 Web Crypto API (crypto.subtle HMAC-SHA1) 기반 Zero-Transmission 연산
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function getCrypto() {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API를 지원하지 않는 환경입니다.');
}

/**
 * Uint8Array 바이트 배열을 RFC 4648 Base32 문자열로 인코딩 (패딩 '=' 제거)
 * @param {Uint8Array} bytes
 * @returns {string} Base32 인코딩 문자열
 */
export function bytesToBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 문자열을 Uint8Array 바이트 배열로 디코딩
 * - 공백, 하이픈 제거 및 대문자 정규화 처리
 * @param {string} base32Str
 * @returns {Uint8Array} 디코딩된 바이트 배열
 */
export function base32ToBytes(base32Str) {
  if (!base32Str) return new Uint8Array(0);

  const cleanStr = base32Str.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`유효하지 않은 Base32 문자입니다: "${char}"`);
    }
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * 암호학적 난수(CSPRNG)를 활용해 160-bit (20 bytes) Base32 비밀 키 생성
 * - Math.random() 사용 절대 금지
 * @param {number} byteLength 기본값 20바이트 (160비트)
 * @returns {string} RFC 4648 Base32 비밀 키 (패딩 없음)
 */
export function generateSecret(byteLength = 20) {
  const cryptoObj = getCrypto();
  const randomBytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(randomBytes);
  return bytesToBase32(randomBytes);
}

/**
 * 특정 카운터 값에 대해 HMAC-SHA1 및 Dynamic Truncation을 수행하여 6자리 OTP 생성
 * @param {string} secretBase32 Base32 비밀 키
 * @param {number} counter 8바이트 카운터 정수 (Time / 30)
 * @returns {Promise<string>} 6자리 0-패딩 OTP 문자열
 */
export async function computeTOTPForCounter(secretBase32, counter) {
  const keyBytes = base32ToBytes(secretBase32);
  if (keyBytes.length === 0) {
    throw new Error('비밀 키가 비어있습니다.');
  }

  // 8바이트 (64-bit) Big-Endian ArrayBuffer 생성
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(counter), false); // false = Big-Endian

  // Web Crypto API HMAC-SHA1 키 임포트 및 서명 연산 (Zero-Transmission)
  const cryptoObj = getCrypto();
  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, buffer);
  const hash = new Uint8Array(signature);

  // RFC 6238 / RFC 4226 Dynamic Truncation (동적 절단)
  // hash[19]의 하위 4비트를 오프셋(0~15)으로 사용
  const offset = hash[19] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * 현재 시각(또는 특정 오프셋 스텝)에 대한 6자리 TOTP 번호 생성
 * @param {string} secretBase32 Base32 비밀 키
 * @param {number} timeOffsetSteps 앞뒤 스텝 오프셋 (-1, 0, +1 등)
 * @param {number} timeStepSeconds 주기 (기본 30초)
 * @returns {Promise<string>} 6자리 OTP
 */
export async function generateTOTP(secretBase32, timeOffsetSteps = 0, timeStepSeconds = 30) {
  const currentEpoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(currentEpoch / timeStepSeconds) + timeOffsetSteps;
  return await computeTOTPForCounter(secretBase32, counter);
}

/**
 * 30초 주기 내 남은 시간(초) 계산
 * @param {number} timeStepSeconds 기본 30초
 * @returns {number} 1~30초
 */
export function getRemainingSeconds(timeStepSeconds = 30) {
  const epoch = Math.floor(Date.now() / 1000);
  const remainder = epoch % timeStepSeconds;
  return timeStepSeconds - remainder;
}

/**
 * 사용자가 입력한 6자리 코드 검증
 * - allowSkew = true인 경우 앞뒤 1주기 (±30초, 즉 -1, 0, +1 스텝) 허용
 * @param {string} token 사용자가 입력한 6자리 문자열
 * @param {string} secretBase32 서버에 저장된 Base32 비밀 키
 * @param {boolean} allowSkew 시간 오차(±1 스텝) 허용 여부
 * @param {number} timeStepSeconds 기본 30초
 * @returns {Promise<{ valid: boolean, matchedDelta?: number, message: string }>}
 */
export async function verifyTOTP(token, secretBase32, allowSkew = false, timeStepSeconds = 30) {
  const cleanToken = (token || '').replace(/\s+/g, '');
  if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return {
      valid: false,
      message: '6자리 숫자를 정확히 입력해 주세요.',
    };
  }

  const stepsToTest = allowSkew ? [0, -1, 1] : [0];

  for (const delta of stepsToTest) {
    try {
      const expected = await generateTOTP(secretBase32, delta, timeStepSeconds);
      if (expected === cleanToken) {
        let deltaDesc = '현재 시간 기준 정확히 일치';
        if (delta === -1) deltaDesc = '이전 주기(-30초) 코드 허용 일치';
        if (delta === 1) deltaDesc = '다음 주기(+30초) 코드 허용 일치';

        return {
          valid: true,
          matchedDelta: delta,
          message: `인증 성공! (${deltaDesc})`,
        };
      }
    } catch (err) {
      return {
        valid: false,
        message: `키 처리 오류: ${err.message}`,
      };
    }
  }

  return {
    valid: false,
    message: allowSkew
      ? '인증 실패: 현재 시각 및 ±30초 오차 범위 내 일치하는 코드가 없습니다.'
      : '인증 실패: 6자리 코드가 현재 시각의 OTP와 일치하지 않습니다.',
  };
}

/**
 * Google Authenticator / Microsoft Authenticator 연동용 otpauth URL 생성
 * @param {string} issuer 발급 서비스명 (예: KOPO-Security)
 * @param {string} account 계정명 (예: student@kopo.ac.kr)
 * @param {string} secret Base32 비밀 키
 * @returns {string} otpauth URI
 */
export function buildOtpAuthUrl(issuer, account, secret) {
  const cleanIssuer = encodeURIComponent((issuer || 'KOPO-Security').trim());
  const cleanAccount = encodeURIComponent((account || 'student@kopo.ac.kr').trim());
  const cleanSecret = (secret || '').toUpperCase().replace(/[\s=-]/g, '');

  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${cleanSecret}&issuer=${cleanIssuer}`;
}
