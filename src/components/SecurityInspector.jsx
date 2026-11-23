import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  WifiOff,
  CheckCircle2,
  Play,
  Layers,
  Terminal,
  RefreshCw
} from 'lucide-react';
import {
  generateTOTP,
  base32ToBytes,
  generateBase32Secret
} from '../utils/totp';

export default function SecurityInspector() {
  const [testSecret, setTestSecret] = useState('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  const [inspectData, setInspectData] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // 실시간 TOTP 연산 단계별 분해 계산
  useEffect(() => {
    let isMounted = true;
    const computeSteps = async () => {
      try {
        const cleanSecret = testSecret.toUpperCase().replace(/[^A-Z2-7]/g, '');
        const keyBytes = base32ToBytes(cleanSecret);
        const nowSeconds = Math.floor(Date.now() / 1000);
        const counter = Math.floor(nowSeconds / 30);

        // 64-bit Big-Endian 버퍼
        const counterBuffer = new ArrayBuffer(8);
        const counterView = new DataView(counterBuffer);
        counterView.setBigUint64(0, BigInt(counter), false);
        const counterBytes = new Uint8Array(counterBuffer);

        // HMAC-SHA1
        const cryptoKey = await window.crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'HMAC', hash: { name: 'SHA-1' } },
          false,
          ['sign']
        );
        const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
        const hashBytes = new Uint8Array(signature);

        // Dynamic Truncation
        const offset = hashBytes[hashBytes.length - 1] & 0x0f;
        const binary =
          ((hashBytes[offset] & 0x7f) << 24) |
          ((hashBytes[offset + 1] & 0xff) << 16) |
          ((hashBytes[offset + 2] & 0xff) << 8) |
          (hashBytes[offset + 3] & 0xff);

        const otp = (binary % 1000000).toString().padStart(6, '0');

        if (isMounted) {
          setInspectData({
            nowSeconds,
            counter,
            counterHex: Array.from(counterBytes).map((b) => b.toString(16).padStart(2, '0')).join(' '),
            keyBytesHex: Array.from(keyBytes).map((b) => b.toString(16).padStart(2, '0')).join(' '),
            hashHex: Array.from(hashBytes).map((b) => b.toString(16).padStart(2, '0')).join(' '),
            offset,
            extracted4Bytes: [
              hashBytes[offset],
              hashBytes[offset + 1],
              hashBytes[offset + 2],
              hashBytes[offset + 3]
            ].map((b) => b.toString(16).padStart(2, '0')).join(' '),
            binary,
            otp
          });
        }
      } catch (err) {
        console.error('Inspector calculation failed:', err);
      }
    };

    computeSteps();
    const interval = setInterval(computeSteps, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [testSecret]);

  // RFC 6238 표준 테스트 벡터 검증기
  const runRfcVectors = async () => {
    setTesting(true);
    const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const testCases = [
      { time: 59, expected: '287082' },
      { time: 1111111109, expected: '081804' },
      { time: 1111111111, expected: '050471' },
      { time: 1234567890, expected: '005924' },
      { time: 2000000000, expected: '279037' }
    ];

    const results = [];
    let passCount = 0;

    for (const tc of testCases) {
      const code = await generateTOTP(rfcSecret, tc.time);
      const passed = code === tc.expected;
      if (passed) passCount++;
      results.push({
        time: tc.time,
        expected: tc.expected,
        actual: code,
        passed
      });
    }

    setTestResult({
      total: testCases.length,
      passed: passCount,
      allPassed: passCount === testCases.length,
      details: results
    });
    setTesting(false);
  };

  return (
    <div className="inspector-container">
      {/* 1. 사이버보안 2대 핵심 체크포인트 안내 배너 */}
      <div className="security-banner-grid">
        <div className="security-card">
          <div className="security-card-header">
            <Cpu className="text-primary" size={24} />
            <div>
              <h4>1. 암호학적 난수 원칙</h4>
              <p className="text-xs text-muted">crypto.getRandomValues vs Math.random</p>
            </div>
          </div>
          <p className="text-sm">
            <code>Math.random()</code>은 선형 합동 생성기(PRNG) 기반으로 과거 난수로부터 미래 값을 예측할 수 있어 보안 키 생성에 절대 금지됩니다.
            반면 <code>window.crypto.getRandomValues()</code>는 OS의 엔트로피 풀(하드웨어 잡음, 마우스 인터럽트 등)을 사용하여 <strong>예측 불가능한 암호학적 난수(CSPRNG)</strong>를 보장합니다.
          </p>
        </div>

        <div className="security-card">
          <div className="security-card-header">
            <WifiOff className="text-success" size={24} />
            <div>
              <h4>2. Zero-Transmission (무전송 원칙)</h4>
              <p className="text-xs text-muted">개발자도구 Network 탭 0건 검증</p>
            </div>
          </div>
          <p className="text-sm">
            모든 HMAC-SHA1 연산과 비밀 키 관리는 브라우저의 내장 <code>window.crypto.subtle</code> 하드웨어 가속 암호화 모듈에서만 실행됩니다.
            서버로 비밀 키가 전송되지 않으므로 <strong>중간자 공격(MITM) 및 서버 탈취 위험이 원천 차단</strong>됩니다.
          </p>
        </div>
      </div>

      {/* 2. RFC 6238 TOTP 수학 연산 과정 실시간 디버거 */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <Layers className="text-primary" size={20} />
            <h3>RFC 6238 TOTP 수학·비트 연산 파이프라인</h3>
          </div>
          <div className="flex-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setTestSecret(generateBase32Secret(32))}
            >
              <RefreshCw size={13} /> 랜덤 키로 변경
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setTestSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')}
            >
              RFC 표준 키로 복원
            </button>
          </div>
        </div>

        <div className="pipeline-steps">
          {/* 단계 1: Base32 Secret */}
          <div className="step-box">
            <div className="step-title">
              <span className="step-num">1</span>
              <span>Base32 Secret &rarr; Raw Byte Key</span>
            </div>
            <div className="step-content">
              <div className="code-line">
                <span className="label">Base32 Secret:</span>
                <code>{testSecret}</code>
              </div>
              <div className="code-line">
                <span className="label">Raw Hex Bytes:</span>
                <code className="text-primary">{inspectData?.keyBytesHex || '...'}</code>
              </div>
            </div>
          </div>

          {/* 단계 2: Unix Timestamp & 카운터 */}
          <div className="step-box">
            <div className="step-title">
              <span className="step-num">2</span>
              <span>Time Counter: T = floor(UnixTime / 30)</span>
            </div>
            <div className="step-content">
              <div className="code-line">
                <span className="label">Unix Time:</span>
                <code>{inspectData?.nowSeconds}s</code>
              </div>
              <div className="code-line">
                <span className="label">Counter (T):</span>
                <code className="text-warning">{inspectData?.counter}</code>
              </div>
              <div className="code-line">
                <span className="label">64-bit Big-Endian Hex:</span>
                <code className="font-mono">{inspectData?.counterHex}</code>
              </div>
            </div>
          </div>

          {/* 단계 3: HMAC-SHA1 서명 */}
          <div className="step-box">
            <div className="step-title">
              <span className="step-num">3</span>
              <span>Web Crypto HMAC-SHA1 (20 Bytes Hash)</span>
            </div>
            <div className="step-content">
              <div className="code-line">
                <span className="label">HMAC Output:</span>
                <code className="hash-code">{inspectData?.hashHex || '...'}</code>
              </div>
            </div>
          </div>

          {/* 단계 4: Dynamic Truncation */}
          <div className="step-box">
            <div className="step-title">
              <span className="step-num">4</span>
              <span>Dynamic Truncation (동적 절단)</span>
            </div>
            <div className="step-content">
              <div className="code-line">
                <span className="label">Offset (마지막 바이트 & 0x0F):</span>
                <code className="text-danger font-bold">{inspectData?.offset}</code>
              </div>
              <div className="code-line">
                <span className="label">추출된 4바이트 (Offset부터):</span>
                <code>{inspectData?.extracted4Bytes}</code>
              </div>
              <div className="code-line">
                <span className="label">31-bit Binary Integer:</span>
                <code>{inspectData?.binary}</code>
              </div>
            </div>
          </div>

          {/* 단계 5: 6자리 OTP */}
          <div className="step-box step-highlight">
            <div className="step-title">
              <span className="step-num">5</span>
              <span>최종 OTP 번호: Binary % 10^6</span>
            </div>
            <div className="step-content flex-between">
              <div>
                <span className="text-xs text-muted">스마트폰 인증기 화면과 일치하는 6자리:</span>
                <div className="final-otp-display">{inspectData?.otp}</div>
              </div>
              <div className="flex-center gap-1 text-success text-sm font-semibold">
                <CheckCircle2 size={18} /> RFC 6238 동기화 완료
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RFC 6238 표준 테스트 벡터 검증기 */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <Terminal className="text-primary" size={20} />
            <h3>RFC 6238 공식 표준 테스트 벡터(Test Vectors) 검증</h3>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={runRfcVectors}
            disabled={testing}
          >
            <Play size={14} /> {testing ? '검증 중...' : '공식 테스트 벡터 검증 실행'}
          </button>
        </div>

        <p className="card-desc">
          IETF RFC 6238 부록 B(Appendix B)에 정의된 SHA-1 알고리즘 표준 테스트 케이스 5개를 Web Crypto API로 직접 연산하여 일치 여부를 검증합니다.
        </p>

        {testResult && (
          <div className="test-results-container">
            <div
              className={`test-summary ${
                testResult.allPassed ? 'summary-success' : 'summary-fail'
              }`}
            >
              {testResult.allPassed ? (
                <ShieldCheck size={20} className="text-success" />
              ) : (
                <ShieldAlert size={20} className="text-danger" />
              )}
              <span className="font-bold">
                {testResult.passed} / {testResult.total} 테스트 케이스 통과 (
                {testResult.allPassed ? '100% 호환 인증 완료' : '불일치 발생'})
              </span>
            </div>

            <div className="test-table-wrapper">
              <table className="test-table">
                <thead>
                  <tr>
                    <th>Unix Time (초)</th>
                    <th>표준 기대값 (RFC)</th>
                    <th>브라우저 연산값</th>
                    <th>판정</th>
                  </tr>
                </thead>
                <tbody>
                  {testResult.details.map((tc, idx) => (
                    <tr key={idx} className={tc.passed ? 'row-pass' : 'row-fail'}>
                      <td className="font-mono">{tc.time}</td>
                      <td className="font-mono font-bold">{tc.expected}</td>
                      <td className="font-mono">{tc.actual}</td>
                      <td>
                        <span className={`status-pill ${tc.passed ? 'pill-pass' : 'pill-fail'}`}>
                          {tc.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
