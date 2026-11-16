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

  const input = base32.replace(/\s/g, '').toUpperCase()
  const paddingIndex = input.indexOf('=')
  const normalized = paddingIndex === -1 ? input : input.slice(0, paddingIndex)
  const remainder = normalized.length % 8

  if (![0, 2, 4, 5, 7].includes(remainder)) {
    throw new Error('Invalid Base32 string length.')
  }

  if (paddingIndex !== -1) {
    const padding = input.slice(paddingIndex)
    const expectedPadding = { 0: 0, 2: 6, 4: 4, 5: 3, 7: 1 }[remainder]

    if (padding !== '='.repeat(expectedPadding) || input.length % 8 !== 0) {
      throw new Error('Invalid Base32 padding.')
    }
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

export function generateTOTP(secret, timeStep = 30, digits = 6) {
  return generateTOTPAtTime(secret, Date.now(), timeStep, digits)
}

export async function generateTOTPAtTime(
  secret,
  timestamp = Date.now(),
  timeStep = 30,
  digits = 6,
) {
  if (!Number.isSafeInteger(timeStep) || timeStep < 1) {
    throw new RangeError('Time step must be a positive integer.')
  }
  if (!Number.isSafeInteger(digits) || digits < 1 || digits > 10) {
    throw new RangeError('Digits must be an integer between 1 and 10.')
  }
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new RangeError('Timestamp must be a non-negative number of milliseconds.')
  }
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable.')
  }

  const keyBytes = base32ToBytes(secret)
  if (keyBytes.length === 0) {
    throw new Error('Base32 secret must not be empty.')
  }

  const numericCounter = Math.floor(timestamp / 1000 / timeStep)
  if (!Number.isSafeInteger(numericCounter)) {
    throw new RangeError('Time counter is outside the supported range.')
  }
  const counter = BigInt(numericCounter)

  const counterBuffer = new ArrayBuffer(8)
  new DataView(counterBuffer).setBigUint64(0, counter, false)

  const key = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const hmacDigest = new Uint8Array(
    await window.crypto.subtle.sign('HMAC', key, counterBuffer),
  )
  const offset = hmacDigest[19] & 0x0f
  const binary =
    new DataView(hmacDigest.buffer, hmacDigest.byteOffset, hmacDigest.byteLength)
      .getUint32(offset, false) & 0x7fffffff
  const otp = binary % 10 ** digits

  return String(otp).padStart(digits, '0')
}

export function generateOtpAuthUri(secret, accountName, issuer) {
  const secretBytes = base32ToBytes(secret)
  if (secretBytes.length === 0) {
    throw new Error('Base32 secret must not be empty.')
  }

  const normalizedSecret = secret.replace(/\s/g, '').replace(/=/g, '').toUpperCase()

  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${encodeURIComponent(normalizedSecret)}&issuer=${encodeURIComponent(issuer)}`
}
