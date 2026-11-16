/**
 * RFC 6238 (TOTP) / RFC 4226 (HOTP) / RFC 4648 (Base32)
 * Pure Web Crypto API Implementation
 * Zero-Transmission: 100% Client-Side Computation
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * 160-bit (20-byte) 암호학적 난수를 생성하여 Base32 문자열로 반환
 * Math.random() 사용 금지 -> window.crypto.getRandomValues() 준수
 */
export function generateSecretKey(byteLength = 20) {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis.crypto);
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    throw new Error('CSPRNG (crypto.getRandomValues) is not supported in this environment.');
  }
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return base32Encode(bytes);
}

/**
 * Uint8Array 바이트 배열을 RFC 4648 Base32 문자열로 인코딩
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
 * Base32 문자열을 Uint8Array 바이트 배열로 디코딩
 * 공백, 하이픈 제거, 대소문자 무시, 패딩(=) 처리 지원
 */
export function base32Decode(base32Str) {
  if (typeof base32Str !== 'string') {
    throw new TypeError('Secret key must be a string');
  }

  const cleanInput = base32Str.replace(/[\s\-=]+/g, '').toUpperCase();
  if (cleanInput.length === 0) {
    return new Uint8Array(0);
  }

  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      throw new Error(`Invalid Base32 character encountered: '${char}'`);
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
 * 64-bit 카운터 숫자를 RFC 4226 규격의 8바이트 Big-Endian 버퍼로 변환
 */
export function counterToBigEndianBuffer(counter) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  // false: Big-Endian 바이트 오더 명시
  view.setBigUint64(0, BigInt(counter), false);
  return new Uint8Array(buffer);
}

/**
 * 바이트 배열을 2자리 Hex 문자열로 변환 (인스펙터 시각화용)
 */
export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * window.crypto.subtle API를 통한 비동기 HMAC-SHA1 서명 연산
 */
export async function computeHmacSha1(keyBytes, messageBytes) {
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    throw new Error('SubtleCrypto is not available in this environment.');
  }

  const cryptoKey = await cryptoSubtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await cryptoSubtle.sign('HMAC', cryptoKey, messageBytes);
  return new Uint8Array(signature);
}

/**
 * RFC 4226 Section 5.3 Dynamic Truncation
 * 20바이트 HMAC 다이제스트 -> 4바이트 추출 및 31비트 마스킹
 */
export function dynamicTruncate(hashBytes) {
  if (hashBytes.length < 20) {
    throw new Error('HMAC-SHA1 hash must be at least 20 bytes long.');
  }

  // 1. 마지막 바이트의 하위 4비트로 offset 결정 (0 ~ 15)
  const offset = hashBytes[19] & 0x0f;

  // 2. offset 위치부터 4바이트 추출 및 Big-Endian 32비트 조합
  // 3. 최상위 부호 비트를 0으로 마스킹 (0x7FFFFFFF) -> 부호 없는 31비트 양의 정수
  const binary =
    ((hashBytes[offset] & 0x7f) << 24) |
    ((hashBytes[offset + 1] & 0xff) << 16) |
    ((hashBytes[offset + 2] & 0xff) << 8) |
    (hashBytes[offset + 3] & 0xff);

  const truncatedBytes = Array.from(hashBytes.slice(offset, offset + 4));

  return {
    offset,
    truncatedBytes,
    binary,
  };
}

/**
 * 단일 카운터 값에 대한 6자리 OTP 코드 생성 (내부용)
 */
export async function generateOTPForCounter(secretBase32, counter, digits = 6) {
  const keyBytes = base32Decode(secretBase32);
  const msgBytes = counterToBigEndianBuffer(counter);
  const hmacBytes = await computeHmacSha1(keyBytes, msgBytes);
  const { binary } = dynamicTruncate(hmacBytes);
  const modulo = 10 ** digits;
  const otpCode = (binary % modulo).toString().padStart(digits, '0');
  return otpCode;
}

/**
 * RFC 6238 TOTP 코드 생성
 * @param {string} secretBase32 Base32 비밀 키
 * @param {number} timestamp Unix Timestamp (ms 단위, 기본 Date.now())
 * @param {number} timeStep 갱신 주기 (기본 30초)
 * @param {number} digits 자릿수 (기본 6자리)
 */
export async function generateTOTP(secretBase32, timestamp = Date.now(), timeStep = 30, digits = 6) {
  const timeSeconds = Math.floor(timestamp / 1000);
  const counter = Math.floor(timeSeconds / timeStep);
  return generateOTPForCounter(secretBase32, counter, digits);
}

/**
 * 교육용 인스펙터를 위한 상세 단계별 중간 연산 데이터 반환
 */
export async function getDetailedTOTPStep(secretBase32, timestamp = Date.now(), timeStep = 30, digits = 6) {
  const timeSeconds = Math.floor(timestamp / 1000);
  const counter = Math.floor(timeSeconds / timeStep);
  const remainingSeconds = timeStep - (timeSeconds % timeStep);
  const progressRatio = remainingSeconds / timeStep;

  let keyBytes = new Uint8Array(0);
  let keyHex = '';
  let counterHex = '';
  let hmacHex = '';
  let offset = 0;
  let truncatedHex = '';
  let binary = 0;
  let otpCode = '------';
  let error = null;

  try {
    keyBytes = base32Decode(secretBase32);
    keyHex = bytesToHex(keyBytes);

    const msgBytes = counterToBigEndianBuffer(counter);
    counterHex = bytesToHex(msgBytes);

    const hmacBytes = await computeHmacSha1(keyBytes, msgBytes);
    hmacHex = bytesToHex(hmacBytes);

    const truncation = dynamicTruncate(hmacBytes);
    offset = truncation.offset;
    truncatedHex = bytesToHex(truncation.truncatedBytes);
    binary = truncation.binary;

    const modulo = 10 ** digits;
    otpCode = (binary % modulo).toString().padStart(digits, '0');
  } catch (err) {
    error = err.message;
  }

  return {
    timestamp,
    timeSeconds,
    timeStep,
    counter,
    remainingSeconds,
    progressRatio,
    keyHex,
    counterHex,
    hmacHex,
    offset,
    truncatedHex,
    binary,
    otpCode,
    error,
  };
}

/**
 * 사용자가 입력한 OTP 코드 검증
 * @param {string} inputOtp 사용자가 입력한 6자리 코드
 * @param {string} secretBase32 Base32 비밀 키
 * @param {number} timestamp 기준 Unix Timestamp (ms)
 * @param {number} timeStep 갱신 주기 (기본 30초)
 * @param {number} digits 자릿수 (기본 6)
 * @param {number} window 허용 스텝 윈도우 (0: 엄격, 1: 앞뒤 30초 허용)
 */
export async function verifyTOTP(
  inputOtp,
  secretBase32,
  timestamp = Date.now(),
  timeStep = 30,
  digits = 6,
  window = 1
) {
  const cleanInput = (inputOtp || '').replace(/\s+/g, '').trim();
  if (cleanInput.length !== digits || !/^\d+$/.test(cleanInput)) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }

  const timeSeconds = Math.floor(timestamp / 1000);
  const currentCounter = Math.floor(timeSeconds / timeStep);

  // window = 1이면 [0, -1, 1] 순서로 검사
  const stepsToCheck = [0];
  for (let w = 1; w <= window; w++) {
    stepsToCheck.push(-w);
    stepsToCheck.push(w);
  }

  for (const step of stepsToCheck) {
    const candidateCounter = currentCounter + step;
    const expectedOtp = await generateOTPForCounter(secretBase32, candidateCounter, digits);
    if (cleanInput === expectedOtp) {
      return {
        valid: true,
        matchedStep: step,
        matchedWindow: step === 0 ? 'CURRENT' : step < 0 ? 'PREVIOUS' : 'NEXT',
      };
    }
  }

  return { valid: false, reason: 'CODE_MISMATCH' };
}

/**
 * Google Authenticator / 2FAS 호환 otpauth:// URI 생성
 */
export function generateOtpAuthUrl({
  issuer = 'KopoCyberSec',
  account = 'student@kopo.ac.kr',
  secret = '',
  timeStep = 30,
  digits = 6,
}) {
  const cleanSecret = secret.replace(/[\s\-=]+/g, '').toUpperCase();
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: cleanSecret,
    issuer: issuer,
    algorithm: 'SHA1',
    digits: digits.toString(),
    period: timeStep.toString(),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}
