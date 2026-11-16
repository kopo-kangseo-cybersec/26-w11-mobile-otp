/**
 * RFC 6238 (TOTP) & RFC 4648 (Base32) Core Crypto Module
 * 
 * 100% 브라우저 내장 Web Crypto API (crypto.getRandomValues, crypto.subtle) 기반 구현.
 * 외부 라이브러리 및 외부 서버 전송 0건 (Zero-Transmission).
 */

const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Uint8Array 바이트 배열을 RFC 4648 표준 Base32 문자열로 인코딩 (패딩 '=' 제외)
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function bytesToBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += RFC4648_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * RFC 4648 표준 Base32 문자열을 Uint8Array 바이트 배열로 디코딩
 * @param {string} base32
 * @returns {Uint8Array}
 */
export function base32ToBytes(base32) {
  const cleaned = base32.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const index = RFC4648_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`유효하지 않은 Base32 문자입니다: ${char}`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

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
 * window.crypto.getRandomValues()를 사용해 암호학적으로 안전한 20바이트(160-bit)
 * Base32 비밀 키(Secret Key) 생성 (RFC 4226 / 6238 권장 규격)
 * @param {number} byteLength - 기본 20바이트 (32글자 Base32)
 * @returns {string}
 */
export function generateBase32Secret(byteLength = 20) {
  const cryptoObj = getCrypto();
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return bytesToBase32(bytes);
}

/**
 * 타임스탬프로부터 30초 스텝 카운터(T)를 계산: T = floor(CurrentTime / TimeStep)
 * @param {number} timestampMs - 밀리초 단위 타임스탬프 (기본값: Date.now())
 * @param {number} timeStep - 스텝 주기 (초 단위, 기본값: 30)
 * @returns {number}
 */
export function getStepCounter(timestampMs = Date.now(), timeStep = 30) {
  return Math.floor(timestampMs / 1000 / timeStep);
}

/**
 * 현재 30초 스텝 주기 내에서 경과한 시간 및 남은 시간(초) 계산
 * @param {number} timestampMs
 * @param {number} timeStep
 * @returns {{ remainingSeconds: number, elapsedSeconds: number, progressPercent: number }}
 */
export function getStepProgress(timestampMs = Date.now(), timeStep = 30) {
  const totalSeconds = Math.floor(timestampMs / 1000);
  const elapsedSeconds = totalSeconds % timeStep;
  const remainingSeconds = timeStep - elapsedSeconds;
  const progressPercent = ((timeStep - remainingSeconds) / timeStep) * 100;
  return {
    remainingSeconds,
    elapsedSeconds,
    progressPercent
  };
}

/**
 * 카운터 정수를 64-bit (8-byte) Big-Endian ArrayBuffer로 변환
 * @param {number|bigint} counter
 * @returns {ArrayBuffer}
 */
export function counterToBuffer(counter) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(counter), false); // false = Big-Endian
  return buffer;
}

/**
 * 64-bit 카운터 버퍼의 Hex 문자열 덤프 (원리 시각화용)
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/**
 * Web Crypto API (crypto.subtle)를 사용해 HMAC-SHA1 서명 및 Dynamic Truncation 후 6자리 TOTP 생성
 * @param {string} secretBase32 - Base32 인코딩된 비밀 키
 * @param {Object} options
 * @param {number} [options.timeStep=30]
 * @param {number} [options.digits=6]
 * @param {number} [options.timestamp=Date.now()]
 * @param {number} [options.counter=null]
 * @returns {Promise<{ otp: string, counter: number, offset: number, hmacHex: string }>}
 */
export async function generateTOTP(secretBase32, options = {}) {
  const {
    timeStep = 30,
    digits = 6,
    timestamp = Date.now(),
    counter = null
  } = options;

  const cryptoObj = getCrypto();
  if (!cryptoObj.subtle) {
    throw new Error('Web Crypto API (crypto.subtle)를 지원하지 않는 환경입니다.');
  }

  const keyBytes = base32ToBytes(secretBase32);
  const targetCounter = counter !== null ? counter : getStepCounter(timestamp, timeStep);
  const counterBuffer = counterToBuffer(targetCounter);

  // HMAC-SHA1 CryptoKey 임포트
  const cryptoKey = await cryptoObj.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  // 64-bit Big-Endian 카운터 서명
  const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);

  // Dynamic Truncation (RFC 4226 Section 5.4 / RFC 6238)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binaryCode % 10 ** digits).toString().padStart(digits, '0');

  const hmacHex = Array.from(hmac)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    otp,
    counter: targetCounter,
    offset,
    hmacHex
  };
}

/**
 * 사용자가 입력한 OTP 토큰을 검증 (시간 오차 ±window 스텝 허용 옵션 지원)
 * @param {string} inputToken - 검증할 6자리 숫자 문자열
 * @param {string} secretBase32 - Base32 비밀 키
 * @param {Object} options
 * @param {number} [options.window=1] - 허용할 시간 오차 스텝 (0: 현재만, 1: ±1스텝/총 3스텝)
 * @param {number} [options.timeStep=30]
 * @param {number} [options.digits=6]
 * @param {number} [options.timestamp=Date.now()]
 * @returns {Promise<{ valid: boolean, delta: number|null, reason?: string, matchedCounter?: number }>}
 */
export async function verifyTOTP(inputToken, secretBase32, options = {}) {
  const {
    window: stepWindow = 1,
    timeStep = 30,
    digits = 6,
    timestamp = Date.now()
  } = options;

  if (!inputToken) {
    return { valid: false, delta: null, reason: 'OTP 코드를 입력해 주세요.' };
  }

  const cleanedInput = String(inputToken).replace(/\s+/g, '').trim();
  if (!/^\d+$/.test(cleanedInput) || cleanedInput.length !== digits) {
    return { valid: false, delta: null, reason: `${digits}자리 숫자만 입력 가능합니다.` };
  }

  const currentCounter = getStepCounter(timestamp, timeStep);

  for (let delta = -stepWindow; delta <= stepWindow; delta++) {
    const checkCounter = currentCounter + delta;
    const result = await generateTOTP(secretBase32, {
      timeStep,
      digits,
      counter: checkCounter
    });

    if (result.otp === cleanedInput) {
      return {
        valid: true,
        delta,
        matchedCounter: checkCounter,
        reason: delta === 0 ? '정확히 현재 스텝과 일치합니다.' : `${delta * timeStep}초 오차 허용 범위 내에서 일치합니다.`
      };
    }
  }

  return {
    valid: false,
    delta: null,
    reason: stepWindow > 0
      ? `현재 시각 및 ±${stepWindow * timeStep}초 허용 범위 내 유효한 코드와 일치하지 않습니다.`
      : '현재 시각 유효한 코드와 일치하지 않습니다.'
  };
}

/**
 * Authenticator 앱 등록용 표준 URI 생성
 * 형식: otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30
 * @param {string} issuer - 발급자 (예: KopoCyberSec)
 * @param {string} account - 계정명 (예: student@kopo.ac.kr)
 * @param {string} secret - Base32 비밀 키
 * @returns {string}
 */
export function buildOtpAuthUri(issuer, account, secret) {
  const cleanIssuer = (issuer || 'KopoCyberSec').trim();
  const cleanAccount = (account || 'student@kopo.ac.kr').trim();
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

/**
 * RFC 6238 공식 테스트 벡터 (Appendix B) 검증
 * Secret: "12345678901234567890" (ASCII 20바이트 -> Base32: GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ)
 * Time: 59s -> T=1 -> OTP=287082
 * Time: 1111111109s -> T=37037036 -> OTP=081804
 * Time: 1111111111s -> T=37037037 -> OTP=050471
 * Time: 1234567890s -> T=41152263 -> OTP=005924
 * Time: 2000000000s -> T=66666666 -> OTP=279037
 * @returns {Promise<boolean>}
 */
export async function runRfc6238SelfTest() {
  const rfcSecretBase32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const testVectors = [
    { time: 59, expected: '287082' },
    { time: 1111111109, expected: '081804' },
    { time: 1111111111, expected: '050471' },
    { time: 1234567890, expected: '005924' },
    { time: 2000000000, expected: '279037' }
  ];

  for (const v of testVectors) {
    const res = await generateTOTP(rfcSecretBase32, {
      timestamp: v.time * 1000,
      timeStep: 30,
      digits: 6
    });
    if (res.otp !== v.expected) {
      console.error(`RFC 6238 Self-Test 실패: time=${v.time}, got=${res.otp}, expected=${v.expected}`);
      return false;
    }
  }
  return true;
}
