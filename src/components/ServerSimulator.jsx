import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Key, 
  RefreshCw, 
  Copy, 
  Check, 
  Smartphone, 
  ShieldCheck, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Clock,
  Server
} from 'lucide-react';
import { buildOtpAuthUrl, verifyTOTP } from '../utils/totp';

export default function ServerSimulator({
  issuer,
  setIssuer,
  account,
  setAccount,
  secret,
  onGenerateNewSecret,
  onAddToAuthenticator,
}) {
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [allowSkew, setAllowSkew] = useState(true);
  const [verifyResult, setVerifyResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const otpAuthUrl = buildOtpAuthUrl(issuer, account, secret);

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 API 폴백
      const textarea = document.createElement('textarea');
      textarea.value = secret;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const result = await verifyTOTP(inputCode, secret, allowSkew);
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({
        valid: false,
        message: `검증 중 오류 발생: ${err.message}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section className="panel-card server-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-icon-badge server-badge">
            <Server size={20} />
          </div>
          <div>
            <h2 className="panel-title">서비스 서버 시뮬레이터</h2>
            <p className="panel-subtitle">2FA 키 발급, QR 생성 및 로그인 검증기</p>
          </div>
        </div>
        <span className="system-pill server-pill">Server-Side 2FA</span>
      </div>

      <div className="panel-body">
        {/* 발급자 및 계정 설정 */}
        <div className="form-section">
          <label className="section-label">1. 서비스 & 계정 정보</label>
          <div className="input-grid">
            <div className="input-group">
              <span className="input-label">발급자 (Issuer)</span>
              <input
                type="text"
                className="text-input"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="예: KOPO-Security"
              />
            </div>
            <div className="input-group">
              <span className="input-label">계정명 (Account)</span>
              <input
                type="text"
                className="text-input"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="예: student@kopo.ac.kr"
              />
            </div>
          </div>
        </div>

        {/* 비밀 키 및 QR 코드 */}
        <div className="secret-qr-section">
          <div className="secret-header-row">
            <label className="section-label">2. 공유 비밀 키 (Shared Secret)</label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onGenerateNewSecret}
              title="암호학적 난수로 새로운 160비트 Base32 키 생성"
            >
              <RefreshCw size={14} />
              새 비밀 키 발급
            </button>
          </div>

          <div className="secret-display-box">
            <div className="secret-key-text">
              <Key size={16} className="text-accent" />
              <code className="secret-code">
                {showSecret
                  ? secret
                  : secret.replace(/./g, '•')}
              </code>
            </div>
            <div className="secret-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowSecret(!showSecret)}
                title={showSecret ? '키 숨기기' : '키 보기'}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={handleCopySecret}
                title="비밀 키 복사"
              >
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          {copied && <p className="hint-text text-success">✓ 클립보드에 복사되었습니다.</p>}

          {/* QR 코드 영역 */}
          <div className="qr-container-card">
            <div className="qr-wrapper">
              <QRCodeSVG
                value={otpAuthUrl}
                size={160}
                level="M"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>
            <div className="qr-instruction">
              <p className="qr-title">스마트폰 Authenticator 앱으로 스캔</p>
              <p className="qr-desc">
                Google Authenticator, Microsoft Authenticator, 2FAS 등에서 QR 코드를 스캔하여 계정을 등록하세요.
              </p>
              <button
                type="button"
                className="btn btn-accent btn-sm mt-2"
                onClick={onAddToAuthenticator}
              >
                <Smartphone size={14} />
                우측 가상 인증기에 계정 등록
              </button>
            </div>
          </div>
        </div>

        {/* 2단계 인증(2FA) 로그인 검증기 */}
        <div className="verification-section">
          <label className="section-label">3. 2단계 인증(2FA) 로그인 검증</label>
          <p className="section-description">
            스마트폰 앱이나 우측 인증기에 표시된 6자리 코드를 입력하여 일치 여부를 검증합니다.
          </p>

          <form onSubmit={handleVerify} className="verify-form">
            <div className="verify-input-row">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="otp-input"
                placeholder="000000"
                value={inputCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setInputCode(val);
                  if (verifyResult) setVerifyResult(null);
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={inputCode.length !== 6 || isVerifying}
              >
                <ShieldCheck size={16} />
                {isVerifying ? '검증 중...' : '인증 확인'}
              </button>
            </div>

            {/* 시간 오차 허용 토글 */}
            <div className="skew-toggle-container">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={allowSkew}
                  onChange={(e) => setAllowSkew(e.target.checked)}
                />
                <span className="toggle-custom"></span>
                <span className="toggle-text">
                  <Clock size={14} className="inline-icon" />
                  ±1 스텝(앞뒤 30초) 시간 오차 허용 (Time Skew Tolerance)
                </span>
              </label>
              <p className="skew-explanation">
                실제 인증 서버는 클라이언트와의 미세한 시계 오차(네트워크 지연, 기기 시각 차이)를 보정하기 위해 직전/직후 주기의 OTP도 안전하게 허용합니다.
              </p>
            </div>
          </form>

          {/* 검증 결과 배지 */}
          {verifyResult && (
            <div
              className={`result-banner ${
                verifyResult.valid ? 'result-success' : 'result-error'
              }`}
            >
              <div className="result-icon">
                {verifyResult.valid ? (
                  <ShieldCheck size={24} />
                ) : (
                  <AlertCircle size={24} />
                )}
              </div>
              <div className="result-content">
                <strong className="result-status">
                  {verifyResult.valid ? '인증 성공 (Verified)' : '인증 실패 (Failed)'}
                </strong>
                <p className="result-message">{verifyResult.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

