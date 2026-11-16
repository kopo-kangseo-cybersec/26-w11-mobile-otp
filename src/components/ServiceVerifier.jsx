import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  KeyRound, 
  Copy, 
  Check, 
  RefreshCw, 
  QrCode, 
  ShieldCheck, 
  ShieldAlert, 
  Building2, 
  User, 
  Clock 
} from 'lucide-react';
import { buildOtpAuthUri, verifyTOTP } from '../utils/totp';

export default function ServiceVerifier({
  issuer,
  setIssuer,
  account,
  setAccount,
  secret,
  onGenerateNewSecret,
  verificationInput,
  setVerificationInput
}) {
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null); // null | { success: boolean, message: string, timestamp: string }
  const [allowWindowSkew, setAllowWindowSkew] = useState(true);

  // 비밀키 클립보드 복사
  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 API 실패 대비
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  // 6자리 인증번호 검증 실행
  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (!verificationInput || verificationInput.trim().length === 0) {
      setVerificationResult({
        success: false,
        message: '6자리 숫자를 입력해 주세요.'
      });
      return;
    }

    setIsVerifying(true);
    try {
      const skew = allowWindowSkew ? 1 : 0;
      const res = await verifyTOTP(verificationInput, secret, skew, 30);
      const timeStr = new Date().toLocaleTimeString();

      if (res.valid) {
        let skewText = '';
        if (res.delta === 1) skewText = ' (다음 30초 윈도우 일치)';
        else if (res.delta === -1) skewText = ' (이전 30초 윈도우 일치)';
        else skewText = ' (현재 30초 정시 일치)';

        setVerificationResult({
          success: true,
          message: `인증 성공! 유효한 일회용 패스워드입니다.${skewText}`,
          timestamp: timeStr
        });
      } else {
        setVerificationResult({
          success: false,
          message: res.reason || '인증 실패! 코드가 올바르지 않거나 30초 유효시간이 만료되었습니다.',
          timestamp: timeStr
        });
      }
    } catch (err) {
      setVerificationResult({
        success: false,
        message: `검증 오류: ${err.message}`,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const otpAuthUri = buildOtpAuthUri(issuer, account, secret);

  return (
    <div className="card service-verifier-card">
      <div className="card-header">
        <div className="badge badge-primary">Service Provider</div>
        <h2>서비스 설정 & 로그인 검증기</h2>
        <p className="card-desc">
          서버 역할을 시뮬레이션합니다. 비밀키와 QR 코드를 발급하고 사용자가 입력한 6자리 번호를 검증합니다.
        </p>
      </div>

      {/* 1. 발급자 및 계정명 입력칸 */}
      <div className="form-section">
        <label className="section-title">1. 서비스 & 계정 메타데이터</label>
        <div className="input-group-row">
          <div className="input-field">
            <span className="field-label">
              <Building2 size={15} /> 발급자 (Issuer)
            </span>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="예: KopoCyberSec"
              className="text-input"
            />
          </div>
          <div className="input-field">
            <span className="field-label">
              <User size={15} /> 계정명 (Account)
            </span>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="예: student@kopo.ac.kr"
              className="text-input"
            />
          </div>
        </div>
      </div>

      {/* 2. 비밀키 발급 및 표시 */}
      <div className="form-section">
        <div className="section-title-row">
          <label className="section-title">2. Base32 보안 비밀키 (RFC 4648)</label>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onGenerateNewSecret}
            title="새로운 암호학적 난수(CSPRNG) 기반 비밀키를 생성합니다"
          >
            <RefreshCw size={14} /> 새 비밀키 발급
          </button>
        </div>

        <div className="secret-display-box">
          <KeyRound size={18} className="secret-icon" />
          <code className="secret-code" title={secret}>
            {secret.match(/.{1,4}/g)?.join(' ') || secret}
          </code>
          <button
            type="button"
            className={`btn-icon ${copied ? 'copied' : ''}`}
            onClick={handleCopySecret}
            title="비밀키 복사"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div className="security-micro-badge">
          🛡️ <code>window.crypto.getRandomValues()</code> 기반 암호학적 난수 (Math.random 사용 안 함)
        </div>
      </div>

      {/* 3. 스마트폰 스캔용 QR 코드 */}
      <div className="form-section">
        <label className="section-title">
          <QrCode size={16} /> 3. 스마트폰 등록용 QR 코드 (Zero-Transmission)
        </label>
        <div className="qr-container">
          <div className="qr-box">
            <QRCodeSVG
              value={otpAuthUri}
              size={170}
              level="M"
              includeMargin={true}
              bgColor="#ffffff"
              fgColor="#0f172a"
            />
          </div>
          <div className="qr-guide">
            <p className="qr-guide-title">📱 스마트폰 Authenticator 앱으로 스캔하세요</p>
            <ul className="qr-guide-steps">
              <li>Google Authenticator, Microsoft Authenticator 또는 2FAS 앱 실행</li>
              <li>'+' 또는 '계정 추가' &gt; <strong>QR 코드 스캔</strong> 선택</li>
              <li>스캔 즉시 스마트폰 앱에 동일한 6자리 번호가 30초마다 뜹니다.</li>
            </ul>
            <div className="qr-uri-preview">
              <span className="uri-label">URI:</span>
              <code className="uri-text" title={otpAuthUri}>{otpAuthUri}</code>
            </div>
          </div>
        </div>
      </div>

      {/* 4. 2단계 인증 로그인 검증기 */}
      <div className="form-section verification-section">
        <label className="section-title">
          <ShieldCheck size={16} /> 4. 2단계 인증(2FA) 로그인 검증
        </label>
        
        <form onSubmit={handleVerify} className="verify-form">
          <div className="verify-input-wrap">
            <input
              type="text"
              maxLength={6}
              value={verificationInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setVerificationInput(val);
                if (verificationResult) setVerificationResult(null);
              }}
              placeholder="000000"
              className="otp-verify-input"
            />
            <button
              type="submit"
              className="btn btn-primary verify-btn"
              disabled={isVerifying || verificationInput.length !== 6}
            >
              {isVerifying ? '검증 중...' : '인증 검증'}
            </button>
          </div>

          <div className="skew-toggle-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allowWindowSkew}
                onChange={(e) => setAllowWindowSkew(e.target.checked)}
              />
              <span>±1 스텝 오차 허용 (스마트폰 시계 미세 오차 허용, 권장)</span>
            </label>
          </div>
        </form>

        {/* 검증 결과 피드백 카드 */}
        {verificationResult && (
          <div className={`verification-feedback ${verificationResult.success ? 'feedback-success' : 'feedback-error'}`}>
            <div className="feedback-icon">
              {verificationResult.success ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
            </div>
            <div className="feedback-content">
              <div className="feedback-title">
                {verificationResult.success ? '인증 성공 (SUCCESS)' : '인증 실패 (FAILED)'}
              </div>
              <p className="feedback-message">{verificationResult.message}</p>
              <div className="feedback-timestamp">
                <Clock size={12} /> 검증 시각: {verificationResult.timestamp}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
