const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BASE32_LOOKUP = new Map(
  [...BASE32_ALPHABET].map((character, index) => [character, index]),
)

export function generateSecret() {
  const cryptoApi = globalThis.crypto

  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random number generation is not available.')
  }

  const randomBytes = cryptoApi.getRandomValues(new Uint8Array(20))
  return encodeBase32(randomBytes)
}

export function encodeBase32(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Base32 input must be a Uint8Array.')
  }

  let output = ''
  let buffer = 0
  let bitsInBuffer = 0

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bitsInBuffer += 8

    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5
      output += BASE32_ALPHABET[(buffer >>> bitsInBuffer) & 31]
    }
  }

  if (bitsInBuffer > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bitsInBuffer)) & 31]
  }

  return output
}

export function decodeBase32(secret) {
  if (typeof secret !== 'string') {
    throw new TypeError('Base32 secret must be a string.')
  }

  const normalized = secret.toUpperCase().replace(/\s/g, '').replace(/=+$/, '')
  if (!normalized || ![0, 2, 4, 5, 7].includes(normalized.length % 8)) {
    throw new Error('Base32 secret has an invalid length.')
  }

  const decoded = []
  let buffer = 0
  let bitsInBuffer = 0

  for (const character of normalized) {
    const value = BASE32_LOOKUP.get(character)
    if (value === undefined) {
      throw new Error(`Invalid Base32 character: ${character}`)
    }

    buffer = (buffer << 5) | value
    bitsInBuffer += 5

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8
      decoded.push((buffer >>> bitsInBuffer) & 255)
    }
  }

  if (bitsInBuffer > 0 && (buffer & ((1 << bitsInBuffer) - 1)) !== 0) {
    throw new Error('Base32 secret has non-zero trailing bits.')
  }

  return new Uint8Array(decoded)
}

export async function generateTOTP(
  secret,
  timestamp = Date.now() / 1000,
  digits = 6,
  period = 30,
) {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new RangeError('Timestamp must be a non-negative finite number.')
  }
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new RangeError('OTP digits must be an integer between 6 and 8.')
  }
  if (!Number.isInteger(period) || period <= 0) {
    throw new RangeError('TOTP period must be a positive integer.')
  }

  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto API is not available.')
  }

  const counter = BigInt(Math.floor(timestamp / period))
  const counterBytes = new ArrayBuffer(8)
  new DataView(counterBytes).setBigUint64(0, counter, false)

  const key = await cryptoApi.subtle.importKey(
    'raw',
    decodeBase32(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const digest = new Uint8Array(
    await cryptoApi.subtle.sign('HMAC', key, counterBytes),
  )
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  return String(binary % 10 ** digits).padStart(digits, '0')
}
