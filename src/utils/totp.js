const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PERIOD_SECONDS = 30

export function createSecret() {
  if (!window.crypto?.getRandomValues) {
    throw new Error('보안 난수 생성 기능을 사용할 수 없습니다. HTTPS 또는 localhost에서 다시 열어 주세요.')
  }

  const bytes = window.crypto.getRandomValues(new Uint8Array(20))
  let bits = 0
  let value = 0
  let secret = ''

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      secret += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) secret += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return secret
}

export function decodeBase32(secret) {
  const normalized = secret.toUpperCase().replace(/=+$/, '')
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error('유효하지 않은 Base32 비밀 키입니다.')
  }

  const bytes = []
  let bits = 0
  let value = 0

  for (const character of normalized) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(character)
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) {
    throw new Error('Base32 비밀 키의 패딩 비트가 올바르지 않습니다.')
  }

  return new Uint8Array(bytes)
}

export function createOtpAuthUri({ secret, issuer, account }) {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: String(PERIOD_SECONDS),
  })
  return `otpauth://totp/${label}?${query.toString().replace(/\+/g, '%20')}`
}

export async function generateTotp(secret, timestamp = Date.now()) {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new Error('올바르지 않은 시간 값입니다.')
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API를 사용할 수 없습니다. HTTPS 또는 localhost에서 다시 열어 주세요.')
  }

  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    decodeBase32(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const counter = BigInt(Math.floor(timestamp / 1000 / PERIOD_SECONDS))
  const message = new ArrayBuffer(8)
  new DataView(message).setBigUint64(0, counter, false)
  const digest = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, message))
  const offset = digest[digest.length - 1] & 0x0f
  const binaryCode = (
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3]
  ) >>> 0

  return String(binaryCode % 1_000_000).padStart(6, '0')
}

export async function verifyTotp(secret, candidate, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(candidate)) return false
  const expected = await generateTotp(secret, timestamp)
  let difference = 0
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ candidate.charCodeAt(index)
  }
  return difference === 0
}
