/**
 * TOTP (Time-based One-Time Password) - RFC 6238 / RFC 4226 모듈
 * 외부 라이브러리 없이 브라우저 내장 Web Crypto API (crypto.subtle)와
 * 암호학적 난수 생성기 (crypto.getRandomValues)만을 사용하여 Zero-Transmission을 구현합니다.
 */

// Base32 (RFC 4648) 알파벳
export const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * 암호학적으로 안전한 Base32 비밀 키 생성 (Math.random 사용 금지)
 * @param {number} length - 생성할 비밀키 길이 (기본값 32문자 = 160비트 엔트로피)
 * @returns {string} Base32로 인코딩된 비밀 키
 */
export function generateBase32Secret(length = 32) {
  const randomBytes = new Uint8Array(length);
  window.crypto.getRandomValues(randomBytes);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_ALPHABET[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Base32 문자열을 Uint8Array 바이트 배열로 디코딩
 * @param {string} base32 - 디코딩할 Base32 문자열
 * @returns {Uint8Array}
 */
export function base32ToBytes(base32) {
  if (!base32) return new Uint8Array(0);
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

/**
 * Uint8Array 바이트 배열을 Base32 문자열로 인코딩
 * @param {Uint8Array} bytes 
 * @returns {string}
 */
export function bytesToBase32(bytes) {
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, '0');
  }
  let base32 = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    const index = parseInt(bits.substring(i, i + 5), 2);
    base32 += BASE32_ALPHABET[index];
  }
  return base32;
}

/**
 * RFC 6238 TOTP 코드 생성
 * Web Crypto API (HMAC-SHA1)와 64-bit Big-Endian 카운터, Dynamic Truncation 적용
 * @param {string} secret - Base32 비밀 키
 * @param {number} timeInSeconds - Unix 타임스탬프 (초 단위, 기본값: 현재 시각)
 * @param {number} digits - OTP 자릿수 (기본 6자리)
 * @param {number} period - 주기 (기본 30초)
 * @returns {Promise<string>} 6자리 OTP 문자열
 */
export async function generateTOTP(
  secret,
  timeInSeconds = Math.floor(Date.now() / 1000),
  digits = 6,
  period = 30
) {
  const keyBytes = base32ToBytes(secret);
  if (keyBytes.length === 0) return '000000';

  // 카운터 계산: T = floor(UnixTime / 30)
  const counter = Math.floor(timeInSeconds / period);

  // 64-bit (8바이트) Big-Endian 정수 버퍼 구성
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(counter), false); // false = Big-Endian

  // Web Crypto API를 통한 HMAC-SHA1 키 임포트 및 서명 (외부 네트워크 전송 없음)
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hashBytes = new Uint8Array(signature);

  // RFC 4226 Dynamic Truncation (동적 절단)
  // 해시의 마지막 바이트의 하위 4비트를 오프셋(0~15)으로 사용
  const offset = hashBytes[hashBytes.length - 1] & 0x0f;
  const binary =
    ((hashBytes[offset] & 0x7f) << 24) |
    ((hashBytes[offset + 1] & 0xff) << 16) |
    ((hashBytes[offset + 2] & 0xff) << 8) |
    (hashBytes[offset + 3] & 0xff);

  const otp = binary % (10 ** digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * 사용자 입력 OTP 검증 (시간 오차 범위 지원)
 * @param {string} token - 사용자가 입력한 6자리 코드
 * @param {string} secret - Base32 비밀 키
 * @param {number} window - 허용할 시간 오차 단위 (0: 현재 30초만, 1: 앞뒤 ±30초 허용)
 * @param {number} period - 주기 (30초)
 * @returns {Promise<{ valid: boolean, delta: number }>}
 */
export async function verifyTOTP(token, secret, window = 1, period = 30) {
  const cleanToken = token.replace(/\s+/g, '');
  if (!cleanToken || cleanToken.length !== 6) {
    return { valid: false, delta: 0 };
  }

  const currentSeconds = Math.floor(Date.now() / 1000);
  for (let step = -window; step <= window; step++) {
    const checkTime = currentSeconds + step * period;
    const expected = await generateTOTP(secret, checkTime, 6, period);
    if (cleanToken === expected) {
      return { valid: true, delta: step };
    }
  }
  return { valid: false, delta: 0 };
}

/**
 * 스마트폰 Authenticator 앱 등록을 위한 표준 otpauth URI 생성
 * @param {string} issuer - 발급자 (예: KOPO-CyberSec)
 * @param {string} account - 사용자 계정명 (예: student@kopo.ac.kr)
 * @param {string} secret - Base32 비밀 키
 * @returns {string} otpauth://totp/... URI
 */
export function generateOtpAuthUri(issuer, account, secret) {
  const cleanIssuer = encodeURIComponent(issuer.trim() || 'MyService');
  const cleanAccount = encodeURIComponent(account.trim() || 'user@example.com');
  const cleanSecret = secret.trim().replace(/\s+/g, '');
  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${cleanSecret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * 1회용 백업 복구 코드 생성 (암호학적 난수 기반)
 * @param {number} count - 생성할 코드 개수
 * @returns {string[]} 8자리 백업 코드 목록 (예: "A3F8-2B9D")
 */
export function generateBackupCodes(count = 5) {
  const chars = '0123456789ABCDEF';
  const codes = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % 16];
    }
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }
  return codes;
}

/**
 * 현재 30초 주기에서 남은 초 계산
 * @param {number} period - 주기 (30초)
 * @returns {number} 1 ~ 30 사이의 정수
 */
export function getRemainingSeconds(period = 30) {
  const now = Math.floor(Date.now() / 1000);
  return period - (now % period);
}
