const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PERIOD_SECONDS = 30

export function generateSecret() {
  const randomBytes = new Uint8Array(20)
  window.crypto.getRandomValues(randomBytes)

  let bits = 0
  let value = 0
  let encoded = ''

  for (const byte of randomBytes) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      encoded += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    encoded += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return encoded
}

export function decodeBase32(secret) {
  const normalized = secret.replace(/[\s=-]/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const bytes = []

  for (const character of normalized) {
    const digit = BASE32_ALPHABET.indexOf(character)

    if (digit === -1) {
      throw new Error('비밀 키에 올바르지 않은 Base32 문자가 있습니다.')
    }

    value = (value << 5) | digit
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  if (bytes.length === 0) {
    throw new Error('비밀 키를 입력해 주세요.')
  }

  return new Uint8Array(bytes)
}

function counterToBytes(counter) {
  const bytes = new Uint8Array(8)
  let remaining = BigInt(counter)

  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn)
    remaining >>= 8n
  }

  return bytes
}

async function generateTotpAtCounter(secret, counter) {
  const key = await window.crypto.subtle.importKey(
    'raw',
    decodeBase32(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const digest = new Uint8Array(
    await window.crypto.subtle.sign('HMAC', key, counterToBytes(counter)),
  )
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return String(binary % 1_000_000).padStart(6, '0')
}

export async function generateTotp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / PERIOD_SECONDS)
  return generateTotpAtCounter(secret, counter)
}

export async function verifyTotp(secret, token, timestamp = Date.now(), tolerance = 0) {
  if (!/^\d{6}$/.test(token)) {
    return false
  }

  const counter = Math.floor(timestamp / 1000 / PERIOD_SECONDS)

  for (let offset = -tolerance; offset <= tolerance; offset += 1) {
    if (counter + offset < 0) {
      continue
    }

    if ((await generateTotpAtCounter(secret, counter + offset)) === token) {
      return true
    }
  }

  return false
}

export function generateRecoveryCodes(count = 8) {
  const randomBytes = new Uint8Array(count * 8)
  window.crypto.getRandomValues(randomBytes)
  const codes = []

  for (let index = 0; index < count; index += 1) {
    const codeBytes = randomBytes.subarray(index * 8, (index + 1) * 8)
    const hex = Array.from(codeBytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    codes.push(`${hex.slice(0, 8)}-${hex.slice(8)}`)
  }

  return codes
}

export function normalizeRecoveryCode(code) {
  return code.replace(/[\s-]/g, '').toUpperCase()
}

export { PERIOD_SECONDS }
