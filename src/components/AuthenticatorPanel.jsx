import React, { useState } from 'react';
import {
  Smartphone,
  Copy,
  Check,
  SendHorizontal,
  Wifi,
  Battery,
  Shield,
  RotateCw,
} from 'lucide-react';
import InspectorModal from './InspectorModal.jsx';

export default function AuthenticatorPanel({
  issuer,
  account,
  otpCode,
  remainingSeconds,
  progressRatio,
  inspectorData,
  onFillOtpToVerification,
}) {
  const [copied, setCopied] = useState(false);

  // 3자리 - 3자리 분리 포맷팅 (예: 123 456)
  const formattedOtp = otpCode && otpCode.length === 6
    ? `${otpCode.slice(0, 3)} ${otpCode.slice(3, 6)}`
    : '------';

  const handleCopyOtp = async () => {
    if (!otpCode || otpCode === '------') return;
    try {
      await navigator.clipboard.writeText(otpCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy OTP code', e);
    }
  };

  // SVG 원형 프로그레스 바 계산
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  // ratio는 1 (시작) -> 0 (종료)
  const strokeDashoffset = circumference * (1 - progressRatio);

  const isUrgent = remainingSeconds <= 5;

  return (
    <div className="panel authenticator-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-icon-badge client-badge">
            <Smartphone size={20} />
          </div>
          <div>
            <h2 className="panel-title">가상 Authenticator & 인스펙터</h2>
            <p className="panel-desc">스마트폰 앱과 동일한 방식으로 30초마다 6자리 코드를 산출</p>
          </div>
        </div>
      </div>

      <div className="panel-body">
        {/* 가상 스마트폰 목업 컨테이너 */}
        <div className="phone-mockup">
          {/* 폰 상단 노치 및 상태 바 */}
          <div className="phone-top-bar">
            <span className="phone-carrier">Kopo 5G</span>
            <div className="phone-notch"></div>
            <div className="phone-icons">
              <Wifi size={14} />
              <Battery size={14} />
            </div>
          </div>

          {/* 앱 헤더 */}
          <div className="mockup-app-header">
            <div className="app-title-row">
              <Shield size={18} className="text-primary" />
              <span className="app-title-text">Virtual Authenticator</span>
            </div>
            <span className="app-account-tag">{issuer || 'Service'}</span>
          </div>

          {/* OTP 계정 카드 */}
          <div className="otp-card">
            <div className="otp-card-top">
              <div className="otp-account-info">
                <span className="otp-issuer-name">{issuer || 'Service'}</span>
                <span className="otp-account-email">{account || 'account'}</span>
              </div>

              {/* 30초 원형 타이머 */}
              <div className="timer-wrapper" title={`30초 주기 중 ${remainingSeconds}초 남음`}>
                <svg className="timer-svg" width="56" height="56" viewBox="0 0 56 56">
                  {/* 배경 원 */}
                  <circle
                    className="timer-circle-bg"
                    cx="28"
                    cy="28"
                    r={radius}
                  />
                  {/* 진행 원 */}
                  <circle
                    className={`timer-circle-progress ${isUrgent ? 'urgent' : ''}`}
                    cx="28"
                    cy="28"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <div className={`timer-seconds ${isUrgent ? 'urgent-text' : ''}`}>
                  {remainingSeconds}s
                </div>
              </div>
            </div>

            {/* 6자리 OTP 대형 디스플레이 */}
            <div className="otp-display-wrapper">
              <div
                className={`otp-digits ${isUrgent ? 'otp-urgent' : ''}`}
                onClick={handleCopyOtp}
                title="클릭하여 6자리 번호 복사"
              >
                {formattedOtp}
              </div>
              <div className="otp-actions-bar">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={handleCopyOtp}
                >
                  {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  <span>{copied ? '복사됨' : '번호 복사'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-xs fill-btn"
                  onClick={() => onFillOtpToVerification(otpCode)}
                  title="좌측 검증 시뮬레이터 입력창에 이 번호를 자동으로 채웁니다"
                >
                  <SendHorizontal size={13} />
                  <span>좌측 검증창에 채우기</span>
                </button>
              </div>
            </div>

            <div className="otp-sync-indicator">
              <RotateCw size={12} className="spin-slow" />
              <span>실제 스마트폰 Google Authenticator와 동일한 번호가 계산됩니다.</span>
            </div>
          </div>
        </div>

        {/* RFC 6238 내부 연산 인스펙터 */}
        <InspectorModal inspectorData={inspectorData} />
      </div>
    </div>
  );
}
