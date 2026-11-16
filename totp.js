const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * 1. 암호학적으로 안전한 Base32 비밀 키 생성 (window.crypto.getRandomValues 사용)
 * @param {number} byteLength - 기본 20바이트 (160비트, RFC 4226 권장 길이 -> 32자리 Base32 문자열)
 */
export function generateBase32Secret(byteLength = 20) {
  const randomBytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(randomBytes);

  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < randomBytes.length; i++) {
    value = (value << 8) | randomBytes[i];
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
 * 2. Base32 문자열을 Uint8Array 바이트 배열로 디코딩 (패딩 및 공백 유연 처리)
 */
export function base32ToBytes(base32) {
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`유효하지 않은 Base32 문자입니다: ${cleaned[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * 3. RFC 6238 표준 TOTP 6자리 코드 계산 (Web Crypto HMAC-SHA1)
 * @param {string} secretBase32 - Base32 비밀 키
 * @param {number} stepOffset - 시간 스텝 오프셋 (0: 현재, -1: 30초 전, +1: 30초 후)
 * @param {number} period - 갱신 주기 (기본 30초)
 */
export async function generateTOTP(secretBase32, stepOffset = 0, period = 30) {
  const keyBytes = base32ToBytes(secretBase32);

  // 현재 Unix 타임스탬프(초) 기반 30초 단위 카운터 계산
  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / period) + stepOffset;

  // 64-bit Big-Endian 버퍼 생성 (상위 32비트 + 하위 32비트)
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false); // false = Big-Endian
  view.setUint32(4, low, false);

  // 브라우저 내장 crypto.subtle로 HMAC-SHA1 서명
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmac = new Uint8Array(signature);

  // 동적 절단 (Dynamic Truncation - RFC 4226 Section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binaryCode % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * 4. TOTP 코드 검증 (기본 현재 스텝 또는 ±1 스텝 허용)
 */
export async function verifyTOTP(inputToken, secretBase32, allowWindow = true) {
  const cleanToken = inputToken.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) {
    return { valid: false, matchedStep: null };
  }

  const stepsToCheck = allowWindow ? [0, -1, 1] : [0];
  for (const step of stepsToCheck) {
    const expected = await generateTOTP(secretBase32, step);
    if (expected === cleanToken) {
      return { valid: true, matchedStep: step };
    }
  }

  return { valid: false, matchedStep: null };
}

/**
 * 5. Authenticator 앱 호환 otpauth:// URI 생성
 */
export function buildOtpAuthUri({ secret, issuer, account }) {
  const safeIssuer = encodeURIComponent(issuer.trim() || 'OTPStudio');
  const safeAccount = encodeURIComponent(account.trim() || 'user@example.com');
  return `otpauth://totp/${safeIssuer}:${safeAccount}?secret=${secret}&issuer=${safeIssuer}&algorithm=SHA1&digits=6&period=30`;
}