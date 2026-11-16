const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BASE32_LOOKUP = new Map(
  [...BASE32_ALPHABET].map((character, index) => [character, index]),
)

export function generateSecret(length = 20) {
  if (!Number.isSafeInteger(length) || length < 1 || length > 65536) {
    throw new RangeError('Secret length must be an integer between 1 and 65536.')
  }

  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable.')
  }

  const bytes = window.crypto.getRandomValues(new Uint8Array(length))
  let encoded = ''
  let buffer = 0
  let bits = 0

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8

    while (bits >= 5) {
      bits -= 5
      encoded += BASE32_ALPHABET[(buffer >> bits) & 31]
    }

    buffer &= (1 << bits) - 1
  }

  if (bits > 0) {
    encoded += BASE32_ALPHABET[(buffer << (5 - bits)) & 31]
  }

  return encoded
}

export function base32ToBytes(base32) {
  if (typeof base32 !== 'string') {
    throw new TypeError('Base32 secret must be a string.')
  }

  const normalized = base32.replace(/\s/g, '').replace(/=/g, '').toUpperCase()
  const remainder = normalized.length % 8

  if (![0, 2, 4, 5, 7].includes(remainder)) {
    throw new Error('Invalid Base32 string length.')
  }

  const bytes = new Uint8Array(Math.floor((normalized.length * 5) / 8))
  let buffer = 0
  let bits = 0
  let byteIndex = 0

  for (const character of normalized) {
    const value = BASE32_LOOKUP.get(character)
    if (value === undefined) {
      throw new Error(`Invalid Base32 character: ${character}`)
    }

    buffer = (buffer << 5) | value
    bits += 5

    if (bits >= 8) {
      bits -= 8
      bytes[byteIndex] = (buffer >> bits) & 255
      byteIndex += 1
    }

    buffer &= (1 << bits) - 1
  }

  if (buffer !== 0) {
    throw new Error('Invalid Base32 trailing bits.')
  }

  return bytes
}

export async function generateTOTP(secret, timeStep = 30, digits = 6) {
  if (!Number.isSafeInteger(timeStep) || timeStep < 1) {
    throw new RangeError('Time step must be a positive integer.')
  }
  if (!Number.isSafeInteger(digits) || digits < 1 || digits > 10) {
    throw new RangeError('Digits must be an integer between 1 and 10.')
  }
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable.')
  }

  const keyBytes = base32ToBytes(secret)
  if (keyBytes.length === 0) {
    throw new Error('Base32 secret must not be empty.')
  }

  const counter = Math.floor(Date.now() / 1000 / timeStep)
  if (!Number.isSafeInteger(counter)) {
    throw new RangeError('Time counter is outside the supported range.')
  }

  const counterBuffer = new ArrayBuffer(8)
  const counterView = new DataView(counterBuffer)
  const high = Math.floor(counter / 0x100000000)
  const low = counter % 0x100000000
  counterView.setUint32(0, high, false)
  counterView.setUint32(4, low, false)

  const key = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(
    await window.crypto.subtle.sign('HMAC', key, counterBuffer),
  )
  const offset = signature[signature.length - 1] & 0x0f
  const binary =
    ((signature[offset] & 0x7f) * 0x1000000) +
    (signature[offset + 1] << 16) +
    (signature[offset + 2] << 8) +
    signature[offset + 3]
  const otp = binary % 10 ** digits

  return String(otp).padStart(digits, '0')
}

export function generateOtpAuthUri(secret, accountName, issuer) {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`
}
