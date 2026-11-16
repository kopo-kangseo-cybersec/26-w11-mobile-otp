/**
 * RFC 6238 TOTP (Time-Based One-Time Password) & RFC 4226 HOTP Engine
 * Pure Web Crypto API Native Implementation (Zero External Crypto Libraries)
 * Zero-Transmission: 100% Client-Side In-Browser Execution
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// 브라우저 window.crypto 및 Node.js / Worker 환경 지원
const cryptoObj =
  typeof window !== 'undefined' && window.crypto
    ? window.crypto
    : globalThis.crypto;

/**
 * window.crypto.getRandomValues()를 사용해 160비트(20바이트) 보안 난수를 생성하고
 * RFC 4648 표준 Base32(패딩 제거)로 인코딩합니다. (Math.random 사용 엄격 금지)
 * @param {number} byteLength 기본값 20바이트 (160비트)
 * @returns {string} 32자리의 Base32 비밀 키 문자열
 */
export function generateSecret(byteLength = 20) {
  const randomBytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(randomBytes);
  return base32Encode(randomBytes);
}

/**
 * Uint8Array 바이트 배열을 RFC 4648 표준 Base32 문자열로 인코딩합니다. (패딩 '=' 제거)
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function base32Encode(bytes) {
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
 * Base32 문자열을 디코딩하여 Uint8Array 바이트 배열로 변환합니다.
 * @param {string} base32Str
 * @returns {Uint8Array}
 */
export function base32Decode(base32Str) {
  const cleaned = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      continue; // 잘못된 문자 무시 또는 스킵
    }
    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * 64비트 정수 카운터(T)를 8바이트 Big-Endian Uint8Array 버퍼로 변환합니다.
 * @param {number} counter
 * @returns {Uint8Array}
 */
export function counterToBuffer(counter) {
  const buffer = new ArrayBuffer(8);
  const dataView = new DataView(buffer);
  dataView.setBigUint64(0, BigInt(counter), false); // false = Big-Endian
  return new Uint8Array(buffer);
}

/**
 * 주어진 카운터 T와 Base32 비밀 키로 HMAC-SHA1을 계산하고 6자리 OTP 및 상세 정보를 반환합니다.
 * @param {string} secret Base32 인코딩된 비밀 키
 * @param {number} counter Time Step Counter (T)
 * @returns {Promise<{ otp: string, hmacHex: string, offset: number, binaryCode: number }>}
 */
export async function calculateHOTP(secret, counter) {
  const keyBytes = base32Decode(secret);
  if (keyBytes.length === 0) {
    throw new Error('유효하지 않은 Base32 비밀 키입니다.');
  }

  // Web Crypto API 네이티브 importKey
  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  // 8바이트 Big-Endian 카운터 버퍼 서명
  const counterBuffer = counterToBuffer(counter);
  const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmacBytes = new Uint8Array(signature);

  // 20바이트 HMAC-SHA1 Hex 다이제스트 생성
  const hmacHex = Array.from(hmacBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // RFC 4226 Dynamic Truncation (동적 절단)
  // 1. 마지막 바이트의 하위 4비트로 오프셋(0~15) 결정
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;

  // 2. 오프셋 위치부터 4바이트 추출 후 최상위 비트 마스킹 (31-bit 양의 정수)
  const binaryCode =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  // 3. Modulo 1,000,000으로 6자리 숫자 생성 후 패딩
  const otpNumber = binaryCode % 1000000;
  const otp = otpNumber.toString().padStart(6, '0');

  return {
    otp,
    hmacHex,
    offset,
    binaryCode,
  };
}

/**
 * 현재 시각 기준의 6자리 TOTP와 실시간 연산 모니터 데이터를 계산합니다.
 * @param {string} secret Base32 비밀 키
 * @param {number} timeStep 시간 주기 (기본 30초)
 * @returns {Promise<{
 *   otp: string,
 *   remainingSeconds: number,
 *   timestamp: number,
 *   counter: number,
 *   hmacHex: string,
 *   offset: number
 * }>}
 */
export async function calculateTOTP(secret, timeStep = 30) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  const remainingSeconds = timeStep - (epoch % timeStep);

  try {
    const { otp, hmacHex, offset } = await calculateHOTP(secret, counter);
    return {
      otp,
      remainingSeconds,
      timestamp: epoch,
      counter,
      hmacHex,
      offset,
    };
  } catch (error) {
    return {
      otp: '------',
      remainingSeconds,
      timestamp: epoch,
      counter,
      hmacHex: '00'.repeat(20),
      offset: 0,
      error: error.message,
    };
  }
}

/**
 * 사용자가 입력한 6자리 OTP를 현재 시간 기준 오차(Time Window: ±1 step)를 고려하여 검증합니다.
 * @param {string} userOtp 사용자가 입력한 6자리 OTP
 * @param {string} secret Base32 비밀 키
 * @param {number} window 앞뒤 허용 스텝 수 (기본 1: ±30초 허용)
 * @param {number} timeStep 주기 (기본 30초)
 * @returns {Promise<{ isValid: boolean, delta: number | null }>}
 */
export async function verifyTOTP(userOtp, secret, window = 1, timeStep = 30) {
  const cleanedOtp = String(userOtp).trim();
  if (!/^\d{6}$/.test(cleanedOtp)) {
    return { isValid: false, delta: null };
  }

  const epoch = Math.floor(Date.now() / 1000);
  const currentCounter = Math.floor(epoch / timeStep);

  // [-window, 0, +window] 스텝 검사 (현재 시각 우선)
  for (let delta = 0; delta <= window; delta++) {
    // 0 먼저 검사 후, +delta, -delta 검사
    const deltasToCheck = delta === 0 ? [0] : [delta, -delta];
    for (const d of deltasToCheck) {
      try {
        const { otp } = await calculateHOTP(secret, currentCounter + d);
        if (otp === cleanedOtp) {
          return { isValid: true, delta: d };
        }
      } catch {
        // 계산 오류 무시
      }
    }
  }

  return { isValid: false, delta: null };
}

/**
 * 스마트폰 Authenticator 앱(Google / Microsoft / 2FAS 등)과 호환되는 표준 otpauth URI를 생성합니다.
 * @param {string} issuer 서비스/발급자 이름
 * @param {string} account 계정명/이메일
 * @param {string} secret Base32 비밀 키
 * @returns {string} otpauth URI
 */
export function generateOtpauthURI(issuer, account, secret) {
  const safeIssuer = encodeURIComponent(issuer.trim() || 'CyberSecLab');
  const safeAccount = encodeURIComponent(account.trim() || 'user');
  const safeSecret = secret.trim().toUpperCase().replace(/[^A-Z2-7]/g, '');

  return `otpauth://totp/${safeIssuer}:${safeAccount}?secret=${safeSecret}&issuer=${safeIssuer}&algorithm=SHA1&digits=6&period=30`;
}
