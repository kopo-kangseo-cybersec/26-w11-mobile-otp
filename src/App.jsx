import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck,
  QrCode,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Terminal,
  Cpu,
  Lock,
} from 'lucide-react';
import {
  generateSecret,
  calculateTOTP,
  verifyTOTP,
  generateOtpauthURI,
} from './utils/totp';
import './App.css';

export default function App() {
  // 상태 관리: 기본 발급자 및 계정 설정
  const [issuer, setIssuer] = useState('CyberSecLab');
  const [account, setAccount] = useState('student@kopo.ac.kr');
  // 초기 비밀 키 생성 (160-bit 암호학적 난수, Lazy State Initialization)
  const [secret, setSecret] = useState(() => generateSecret(20));
  const [copied, setCopied] = useState(false);

  // 실시간 TOTP 연산 모니터 데이터 상태
  const [monitorData, setMonitorData] = useState({
    otp: '------',
    remainingSeconds: 30,
    timestamp: 0,
    counter: 0,
    hmacHex: '0'.repeat(40),
    offset: 0,
  });

  // 사용자 검증 상태
  const [userOtp, setUserOtp] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  // 1초 주기로 실시간 연산 및 카운트다운 동기화
  useEffect(() => {
    if (!secret) return;
    let isMounted = true;

    const tick = async () => {
      const data = await calculateTOTP(secret, 30);
      if (isMounted) {
        setMonitorData(data);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [secret]);

  // 새로운 비밀 키 발급 핸들러
  const handleGenerateNewSecret = () => {
    const newSecret = generateSecret(20);
    setSecret(newSecret);
    setVerifyResult(null);
    setUserOtp('');
  };

  // 클립보드 비밀 키 복사 핸들러
  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사 오류 예외 처리
    }
  };

  // OTP 검증 실행 핸들러
  const handleVerify = async (e) => {
    e?.preventDefault();
    if (!userOtp.trim()) return;

    const result = await verifyTOTP(userOtp, secret, 1, 30);
    if (result.isValid) {
      const stepText =
        result.delta === 0
          ? '현재 시각 동기화 완벽 일치'
          : `허용 시간 오차 범위 일치 (Δ = ${result.delta > 0 ? '+' : ''}${result.delta} step)`;
      setVerifyResult({
        success: true,
        message: `[인증 성공] RFC 6238 검증 통과! (${stepText})`,
      });
    } else {
      setVerifyResult({
        success: false,
        message: '[인증 실패] 입력한 OTP 번호가 일치하지 않거나 만료되었습니다.',
      });
    }
  };

  // otpauth:// URI 생성
  const otpauthURI = useMemo(() => {
    if (!secret) return '';
    return generateOtpauthURI(issuer, account, secret);
  }, [issuer, account, secret]);

  // 5초 이하 경고 상태 플래그
  const isWarning = monitorData.remainingSeconds <= 5;

  // HMAC Hex 다이제스트를 2바이트 청크로 나누고, 동적 절단 오프셋(4바이트) 하이라이트
  const formattedHexChunks = useMemo(() => {
    const hex = monitorData.hmacHex || '';
    const chunks = [];
    const offset = monitorData.offset || 0;

    for (let i = 0; i < hex.length; i += 2) {
      const byteIndex = i / 2;
      const isSelected = byteIndex >= offset && byteIndex < offset + 4;
      chunks.push({
        byte: hex.substring(i, i + 2),
        isSelected,
        index: byteIndex,
      });
    }
    return chunks;
  }, [monitorData.hmacHex, monitorData.offset]);

  // 6자리 OTP 가독성 분할 (예: 123 456)
  const formattedOtpDisplay = useMemo(() => {
    const raw = monitorData.otp;
    if (raw.length === 6) {
      return `${raw.slice(0, 3)} ${raw.slice(3, 6)}`;
    }
    return raw;
  }, [monitorData.otp]);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="brand-section">
          <div className="shield-icon-wrapper">
            <ShieldCheck size={26} />
          </div>
          <div className="brand-titles">
            <h1>
              TOTP 2단계 인증 보안 대시보드
              <span style={{ fontSize: '14px', color: 'var(--accent-cyan)' }}>
                [RFC 6238]
              </span>
            </h1>
            <p>사이버보안 실습: 순수 Web Crypto API 기반 무전송 모바일 OTP</p>
          </div>
        </div>

        <div className="badge-group">
          <div className="sec-badge safe">
            <span className="status-dot"></span>
            Zero-Transmission 보장 (100% 로컬 연산)
          </div>
          <div className="sec-badge crypto">
            <Lock size={12} />
            Web Crypto Native
          </div>
        </div>
      </header>

      {/* 2단 분할 대시보드 그리드 */}
      <div className="dashboard-grid">
        {/* 좌측 패널: 프로비저닝 및 검증 */}
        <section className="panel-card">
          <div className="card-title">
            <QrCode size={18} />
            <span>2FA 프로비저닝 & 사용자 인증 검증</span>
          </div>

          {/* 발급자 및 계정 설정 */}
          <div className="form-group-row">
            <div className="input-field">
              <label>발급자 (Issuer)</label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="CyberSecLab"
              />
            </div>
            <div className="input-field">
              <label>계정 식별자 (Account)</label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="student@kopo.ac.kr"
              />
            </div>
          </div>

          {/* 비밀 키 표시 및 액션 */}
          <div className="secret-box-wrapper">
            <div className="secret-label-row">
              <span className="secret-title">
                RFC 4648 Base32 비밀 키 (160-bit Secret)
              </span>
              <div className="secret-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCopySecret}
                  title="비밀 키 복사"
                >
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copied ? '복사됨' : '복사'}</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleGenerateNewSecret}
                  title="암호학적 난수로 새 키 생성"
                >
                  <RefreshCw size={14} />
                  <span>새 키 발급</span>
                </button>
              </div>
            </div>
            <div className="secret-code-display">{secret || 'GENERATING...'}</div>
          </div>

          {/* 클라이언트 로컬 QR 코드 렌더링 카드 */}
          <div className="qr-preview-section">
            <div className="qr-code-wrapper">
              {otpauthURI && (
                <QRCodeSVG
                  value={otpauthURI}
                  size={180}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0a0d14"
                />
              )}
            </div>
            <p className="qr-instruction">
              스마트폰 <strong>Google / Microsoft / 2FAS Authenticator</strong> 앱으로
              위 QR 코드를 스캔해 계정을 등록하세요.
            </p>
          </div>

          {/* 사용자 OTP 입력 및 검증 폼 */}
          <div className="verification-box">
            <form className="verify-form" onSubmit={handleVerify}>
              <input
                type="text"
                className="verify-input"
                placeholder="000000"
                maxLength={6}
                value={userOtp}
                onChange={(e) => setUserOtp(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <button type="submit" className="verify-btn">
                <CheckCircle2 size={16} />
                <span>검증하기</span>
              </button>
            </form>

            {verifyResult && (
              <div
                className={`verify-alert ${
                  verifyResult.success ? 'success' : 'error'
                }`}
              >
                {verifyResult.success ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <XCircle size={18} />
                )}
                <span>{verifyResult.message}</span>
              </div>
            )}
          </div>
        </section>

        {/* 우측 패널: 실시간 연산 모니터 */}
        <section className="panel-card">
          <div className="card-title">
            <Cpu size={18} />
            <span>실시간 Web Crypto TOTP 연산 모니터</span>
          </div>

          {/* 대형 6자리 TOTP 디스플레이 */}
          <div className="monitor-hero">
            <div className="otp-digit-wrapper">
              <div
                className={`otp-large-digits ${isWarning ? 'warning' : ''}`}
                title="스마트폰 OTP 번호와 비교해 보세요"
              >
                {formattedOtpDisplay}
              </div>
            </div>

            {/* 30초 카운트다운 프로그레스 바 */}
            <div className="progress-container">
              <div className="progress-info">
                <span>
                  남은 시간:{' '}
                  <strong
                    className={`time-counter-label ${isWarning ? 'warning' : ''}`}
                  >
                    {monitorData.remainingSeconds}초
                  </strong>
                </span>
                <span>주기: 30초</span>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-bar-fill ${isWarning ? 'warning' : ''}`}
                  style={{
                    width: `${(monitorData.remainingSeconds / 30) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* 실시간 암호 연산 상태 메트릭 */}
          <div className="compute-grid">
            <div className="compute-item">
              <span className="compute-meta">Unix Timestamp (Epoch)</span>
              <span className="compute-val">{monitorData.timestamp || '---'}</span>
            </div>
            <div className="compute-item">
              <span className="compute-meta">Time Counter (T = Epoch / 30)</span>
              <span className="compute-val">{monitorData.counter || '---'}</span>
            </div>
            <div className="compute-item">
              <span className="compute-meta">Dynamic Truncation Offset</span>
              <span className="compute-val">
                Offset: {monitorData.offset} (0x{monitorData.offset.toString(16)})
              </span>
            </div>
            <div className="compute-item">
              <span className="compute-meta">알고리즘 및 자릿수</span>
              <span className="compute-val">HMAC-SHA1 / 6 Digits</span>
            </div>
          </div>

          {/* HMAC-SHA1 20바이트 Hex 다이제스트 모니터 */}
          <div className="digest-box">
            <div className="digest-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={14} color="var(--accent-cyan)" />
                <span>HMAC-SHA1 20-Byte Hex 다이제스트 (실시간 서명)</span>
              </div>
              <span className="digest-tag">Web Crypto API</span>
            </div>

            <div className="digest-hex-display">
              {formattedHexChunks.map((chunk) => (
                <span
                  key={chunk.index}
                  className={`hex-chunk ${chunk.isSelected ? 'highlight' : ''}`}
                  title={
                    chunk.isSelected
                      ? `Dynamic Truncation 추출 바이트 [Offset + ${
                          chunk.index - monitorData.offset
                        }]`
                      : `Byte [${chunk.index}]`
                  }
                >
                  {chunk.byte}
                </span>
              ))}
            </div>

            <p className="digest-footnote">
              * 하늘색으로 강조된 4바이트(Offset: {monitorData.offset} ~{' '}
              {monitorData.offset + 3})가 RFC 4226 동적 절단 공식으로 추출되어 6자리
              OTP({monitorData.otp})를 결정합니다.
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="footer-tags">
          <span>RFC 6238 TOTP Standard</span>
          <span>•</span>
          <span>RFC 4226 HOTP Dynamic Truncation</span>
          <span>•</span>
          <span>RFC 4648 Base32 Secret</span>
          <span>•</span>
          <span>100% Zero-Transmission</span>
        </div>
        <div>
          한국폴리텍대학 강서캠퍼스 사이버보안과 | 26-w11-mobile-otp 실습
        </div>
      </footer>
    </div>
  );
}
