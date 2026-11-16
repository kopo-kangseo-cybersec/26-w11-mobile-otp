
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// 안전한 Base32 비밀키 생성
export function generateSecret(length = 20) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let bits = "";
  bytes.forEach(byte => {
    bits += byte.toString(2).padStart(8, "0");
  });

  let result = "";

  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    result += BASE32[parseInt(chunk.padEnd(5, "0"), 2)];
  }

  return result;
}

// Base32 디코딩
export function base32Decode(secret) {
  const clean = secret.replace(/=+$/g, "").toUpperCase();

  let bits = "";

  for (const char of clean) {
    const index = BASE32.indexOf(char);

    if (index === -1) {
      throw new Error("잘못된 Base32 비밀키입니다.");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}

// HMAC-SHA1 기반 OTP 생성
export async function generateTOTP(secret, time = Date.now()) {
  const counter = Math.floor(time / 1000 / 30);

  const keyData = base32Decode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  // 64-bit Big Endian Counter
  const message = new ArrayBuffer(8);
  const view = new DataView(message);

  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;

  view.setUint32(0, high);
  view.setUint32(4, low);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    message
  );

  const hash = new Uint8Array(signature);

  const offset = hash[hash.length - 1] & 0x0f;

  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(binary % 1000000).padStart(6, "0");
}

// OTP 검증
export async function verifyTOTP(secret, input, time = Date.now()) {
  if (!/^\d{6}$/.test(input)) return false;

  // 현재 시간 기준 앞뒤 30초 허용
  for (let offset = -1; offset <= 1; offset++) {
    const expected = await generateTOTP(
      secret,
      time + offset * 30000
    );

    if (expected === input) return true;
  }

  return false;
}
