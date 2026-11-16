import {
  generateSecretKey,
  base32Decode,
  base32Encode,
  generateTOTP,
  getDetailedTOTPStep,
  verifyTOTP,
  generateOtpAuthUrl,
} from './src/utils/totp.js';

async function runTests() {
  console.log('--- 1. RFC 6238 Standard Test Vectors ---');
  // RFC 6238 Appendix B: SHA-1 Secret is ASCII "12345678901234567890" -> Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const testCases = [
    { timeSec: 59, expected: '287082' },
    { timeSec: 1111111109, expected: '081804' },
    { timeSec: 1111111111, expected: '050471' },
    { timeSec: 1234567890, expected: '005924' },
    { timeSec: 2000000000, expected: '279037' },
  ];

  let passed = true;
  for (const tc of testCases) {
    const code = await generateTOTP(secret, tc.timeSec * 1000, 30, 6);
    const ok = code === tc.expected;
    console.log(`[Time ${tc.timeSec}s] OTP: ${code} (Expected: ${tc.expected}) -> ${ok ? 'PASSED' : 'FAILED'}`);
    if (!ok) passed = false;
  }

  console.log('\n--- 2. CSPRNG & Base32 Roundtrip ---');
  const randSecret = generateSecretKey(20);
  console.log(`Generated 160-bit Secret (Base32): ${randSecret} (len: ${randSecret.length})`);
  const decoded = base32Decode(randSecret);
  const reEncoded = base32Encode(decoded);
  const roundtripOk = randSecret === reEncoded;
  console.log(`Roundtrip equality: ${roundtripOk ? 'PASSED' : 'FAILED'}`);
  if (!roundtripOk) passed = false;

  console.log('\n--- 3. Detailed Inspector Step ---');
  const details = await getDetailedTOTPStep(randSecret, Date.now());
  console.log(`Counter: ${details.counter} (Hex: ${details.counterHex})`);
  console.log(`HMAC-SHA1: ${details.hmacHex}`);
  console.log(`Offset: ${details.offset}, Truncated: ${details.truncatedHex}, Binary: ${details.binary}`);
  console.log(`Generated OTP: ${details.otpCode}`);

  console.log('\n--- 4. Verification with Tolerance Window ---');
  const now = Date.now();
  const currentOtp = await generateTOTP(randSecret, now);
  const vCurrent = await verifyTOTP(currentOtp, randSecret, now, 30, 6, 1);
  console.log(`Current OTP verification: valid=${vCurrent.valid}, matchedWindow=${vCurrent.matchedWindow}`);
  if (!vCurrent.valid || vCurrent.matchedWindow !== 'CURRENT') passed = false;

  // 30 seconds later, previous OTP should match 'PREVIOUS' with window=1
  const vPast = await verifyTOTP(currentOtp, randSecret, now + 30000, 30, 6, 1);
  console.log(`+30s delayed verification (window=1): valid=${vPast.valid}, matchedWindow=${vPast.matchedWindow}`);
  if (!vPast.valid || vPast.matchedWindow !== 'PREVIOUS') passed = false;

  // Strict window (window=0) should fail
  const vStrict = await verifyTOTP(currentOtp, randSecret, now + 30000, 30, 6, 0);
  console.log(`+30s delayed verification (window=0): valid=${vStrict.valid}`);
  if (vStrict.valid) passed = false;

  console.log('\n--- 5. OTPAuth URL Generation ---');
  const url = generateOtpAuthUrl({
    issuer: 'KopoCyberSec',
    account: 'student@kopo.ac.kr',
    secret: randSecret,
  });
  console.log(`Generated URL: ${url}`);
  if (!url.startsWith('otpauth://totp/')) passed = false;

  if (passed) {
    console.log('\n====================================');
    console.log('✅ ALL RFC 6238 UNIT TESTS PASSED!');
    console.log('====================================');
    process.exit(0);
  } else {
    console.error('\n❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
