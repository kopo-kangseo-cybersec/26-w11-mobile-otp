import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Server,
  KeyRound,
  Copy,
  Check,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { generateOtpAuthUrl } from '../utils/totp.js';

export default function ServerPanel({
  issuer,
  setIssuer,
  account,
  setAccount,
  secretKey,
  onGenerateNewSecret,
  onVerifyOtp,
  verificationResult,
  onClearVerification,
  inputOtp,
  setInputOtp,
}) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [allowToleranceWindow, setAllowToleranceWindow] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  const otpAuthUrl = generateOtpAuthUrl({
    issuer: issuer.trim() || 'Service',
    account: account.trim() || 'user',
    secret: secretKey,
  });

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(secretKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (e) {
      console.error('Failed to copy secret key', e);
    }
  };

  const handleCopyUri = async () => {
    try {
      await navigator.clipboard.writeText(otpAuthUrl);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } catch (e) {
      console.error('Failed to copy URI', e);
    }
  };

  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setInputOtp(val);
    if (verificationResult) {
      onClearVerification();
    }
  };

  const handleSubmitVerify = async (e) => {
    e.preventDefault();
    if (!inputOtp || inputOtp.length !== 6) return;
    setIsVerifying(true);
    await onVerifyOtp(inputOtp, allowToleranceWindow ? 1 : 0);
    setIsVerifying(false);
  };

  return (
    <div className="panel server-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-icon-badge server-badge">
            <Server size={20} />
          </div>
          <div>
            <h2 className="panel-title">서비스 서버 시뮬레이터</h2>
            <p className="panel-desc">2FA 등록 및 OTP 검증을 수행하는 인증 서비스 서버</p>
          </div>
        </div>
      </div>

      <div className="panel-body">
        {/* 발급자 및 계정 설정 */}
        <section className="card-section">
          <h3 className="section-title">
            <Sparkles size={16} className="text-accent" /> 1. 서비스 & 계정 프로필
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="issuer-input">발급자 명 (Issuer)</label>
              <input
                id="issuer-input"
                type="text"
                className="input-field"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="예: KopoCyberSec"
                maxLength={30}
              />
            </div>
            <div className="form-group">
              <label htmlFor="account-input">계정명 (Account / Email)</label>
              <input
                id="account-input"
                type="text"
                className="input-field"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="예: student@kopo.ac.kr"
                maxLength={40}
              />
            </div>
          </div>
        </section>

        {/* 비밀 키 (Secret Key) 발급 */}
        <section className="card-section">
          <div className="section-header-row">
            <h3 className="section-title">
              <KeyRound size={16} className="text-accent" /> 2. 암호학적 비밀 키 (Shared Secret)
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onGenerateNewSecret}
              title="crypto.getRandomValues로 160-bit 새 키 발급"
            >
              <RefreshCw size={14} /> 새 비밀 키 발급
            </button>
          </div>

          <div className="secret-display-card">
            <div className="secret-header">
              <span className="secret-format-badge">Base32 (RFC 4648) • 160-bit CSPRNG</span>
              <button
                type="button"
                className="btn-icon"
                onClick={handleCopyKey}
                title="비밀 키 클립보드 복사"
              >
                {copiedKey ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              </button>
            </div>
            <div className="secret-key-text">
              {secretKey.match(/.{1,4}/g)?.join(' ') || secretKey}
            </div>
            {copiedKey && <div className="copy-notice">클립보드에 비밀 키가 복사되었습니다!</div>}
          </div>
        </section>

        {/* QR 코드 연동 */}
        <section className="card-section qr-section">
          <h3 className="section-title">
            <QrCode size={16} className="text-accent" /> 3. 스마트폰 Authenticator 앱 등록 (QR)
          </h3>
          <p className="section-guide-text">
            Google Authenticator, Microsoft Authenticator, 2FAS 앱의 <strong>[QR 코드 스캔]</strong>으로 카메라를 비추세요.
          </p>

          <div className="qr-container-box">
            <div className="qr-wrapper">
              <QRCodeSVG
                value={otpAuthUrl}
                size={180}
                level="M"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>

            <div className="qr-info-box">
              <div className="uri-header">
                <span className="uri-label">인증 URI (otpauth://)</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={handleCopyUri}
                >
                  {copiedUri ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  <span>{copiedUri ? '복사됨' : 'URI 복사'}</span>
                </button>
              </div>
              <code className="uri-code-preview" title={otpAuthUrl}>
                {otpAuthUrl}
              </code>
              <p className="uri-note">
                💡 카메라 인식이 어렵다면 위 비밀 키를 앱의 <strong>[설정 키 직접 입력]</strong>에 붙여넣어도 동일하게 등록됩니다.
              </p>
            </div>
          </div>
        </section>

        {/* OTP 검증 창 */}
        <section className="card-section verify-section">
          <h3 className="section-title">
            <ShieldCheck size={16} className="text-accent" /> 4. 2단계 인증 번호 검증 시뮬레이터
          </h3>
          <p className="section-guide-text">
            스마트폰 앱 또는 우측 가상 인증기에 표시된 6자리 번호를 입력하고 일치 여부를 검증하세요.
          </p>

          <form onSubmit={handleSubmitVerify} className="verify-form">
            <div className="verify-input-row">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="input-field verify-otp-input"
                placeholder="000000"
                value={inputOtp}
                onChange={handleOtpChange}
              />
              <button
                type="submit"
                className="btn btn-primary verify-submit-btn"
                disabled={inputOtp.length !== 6 || isVerifying}
              >
                <span>검증하기</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="verify-options-row">
              <label className="checkbox-label" title="클라이언트와 서버 시계의 오차(Time Drift) 보정을 위해 앞뒤 30초 윈도우를 허용합니다.">
                <input
                  type="checkbox"
                  checked={allowToleranceWindow}
                  onChange={(e) => setAllowToleranceWindow(e.target.checked)}
                />
                <Clock size={14} />
                <span>±1 스텝(앞뒤 30초) 시간 오차 허용 (권장)</span>
              </label>
            </div>
          </form>

          {/* 검증 결과 피드백 */}
          {verificationResult && (
            <div
              className={`verification-result-card ${
                verificationResult.valid ? 'result-success' : 'result-failure'
              }`}
            >
              <div className="result-icon-wrapper">
                {verificationResult.valid ? (
                  <ShieldCheck size={26} className="result-icon success" />
                ) : (
                  <ShieldAlert size={26} className="result-icon failure" />
                )}
              </div>
              <div className="result-text-group">
                <h4 className="result-title">
                  {verificationResult.valid ? '2단계 인증 성공 (ACCESS GRANTED)' : '인증 실패 (ACCESS DENIED)'}
                </h4>
                <p className="result-detail">
                  {verificationResult.valid ? (
                    verificationResult.matchedStep === 0 ? (
                      '정확히 현재 30초 시간 윈도우(Current Step 0)에서 일치하였습니다.'
                    ) : verificationResult.matchedStep < 0 ? (
                      `이전 시간 윈도우(-30s, Step ${verificationResult.matchedStep})에서 일치하여 허용되었습니다.`
                    ) : (
                      `다음 시간 윈도우(+30s, Step +${verificationResult.matchedStep})에서 일치하여 허용되었습니다.`
                    )
                  ) : verificationResult.reason === 'INVALID_FORMAT' ? (
                    '입력한 OTP 번호는 6자리 숫자여야 합니다.'
                  ) : (
                    '입력된 OTP 번호가 현재 유효한 시간 윈도우의 코드와 일치하지 않습니다.'
                  )}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

