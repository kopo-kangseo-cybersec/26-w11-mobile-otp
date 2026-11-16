import { useState } from 'react'
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  History,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import { getStepProgress } from '../utils/totp.js'

export function AuthenticatorPanel({
  currentOtp,
  currentTime,
  onVerify,
  verificationResult,
  verifyHistory,
  onClearHistory,
  allowTimeWindow,
  setAllowTimeWindow
}) {
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)

  const { remainingSeconds, progressPercent } = getStepProgress(currentTime, 30)

  // 3자리씩 띄어쓰기 (예: 123 456)
  const formattedOtp = currentOtp
    ? `${currentOtp.slice(0, 3)} ${currentOtp.slice(3, 6)}`
    : '--- ---'

  // 원형 게이지 계산 (r=42, 둘레 2 * PI * 42 ≈ 263.89)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference

  // 남은 시간에 따른 테마 색상 (위험도 강조)
  const isUrgent = remainingSeconds <= 5
  const isWarning = remainingSeconds <= 10 && remainingSeconds > 5
  const gaugeColor = isUrgent ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981'

  const handleCopyOtp = async () => {
    if (!currentOtp) return
    try {
      await navigator.clipboard.writeText(currentOtp)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('OTP 복사 실패:', err)
    }
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!inputCode.trim()) return
    onVerify(inputCode.trim())
  }

  const handleInputChange = (e) => {
    // 숫자만 추출하고 최대 6자리로 제한
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setInputCode(val)
  }

  return (
    <div className="panel authenticator-panel">
      <div className="panel-header">
        <div className="panel-tag auth-tag">
          <Smartphone className="icon-xs" />
          <span>인증기 & 로그인 검증기 역할</span>
        </div>
        <h2 className="panel-title">실시간 OTP & 2단계 인증 검증</h2>
        <p className="panel-desc">
          브라우저와 스마트폰이 동일한 시각·비밀키로 계산하는 일회용 비밀번호를 대조하고 검증합니다.
        </p>
      </div>

      <div className="panel-body">
        {/* 상단: 실시간 동기화 뷰 */}
        <div className="otp-live-card">
          <div className="otp-live-header">
            <div className="live-status-pill">
              <span className={`live-pulse-dot ${isUrgent ? 'urgent' : ''}`} />
              <span>실시간 동기화 중 (30초 주기)</span>
            </div>
            <span className="step-period-badge">RFC 6238 T0=0, X=30s</span>
          </div>

          <div className="otp-main-display">
            {/* 원형 카운트다운 게이지 */}
            <div className="gauge-container">
              <svg className="gauge-svg" width="104" height="104" viewBox="0 0 100 100">
                <circle
                  className="gauge-bg"
                  cx="50"
                  cy="50"
                  r={radius}
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  className="gauge-bar"
                  cx="50"
                  cy="50"
                  r={radius}
                  strokeWidth="8"
                  fill="none"
                  stroke={gaugeColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="gauge-center-text">
                <span className="gauge-seconds font-mono" style={{ color: gaugeColor }}>
                  {remainingSeconds}
                </span>
                <span className="gauge-unit">초 남음</span>
              </div>
            </div>

            {/* OTP 숫자 디스플레이 */}
            <div className="otp-number-box">
              <span className="otp-label">현재 유효한 6자리 코드</span>
              <div className="otp-value-row">
                <div className={`otp-digits font-mono ${isUrgent ? 'pulse-text' : ''}`}>
                  {formattedOtp}
                </div>
                <button
                  type="button"
                  className={`copy-otp-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyOtp}
                  title="현재 OTP 번호 복사"
                  aria-label="OTP 복사"
                >
                  {copied ? <Check className="icon-sm text-emerald" /> : <Copy className="icon-sm" />}
                </button>
              </div>
              <p className="otp-match-hint">
                👉 스마트폰 Authenticator 앱 화면의 숫자와 지금 똑같은지 확인해 보세요!
              </p>
            </div>
          </div>
        </div>

        {/* 중단: 2단계 인증 검증 시뮬레이터 */}
        <div className="verify-card">
          <div className="verify-card-header">
            <div className="verify-title-row">
              <ShieldCheck className="icon-sm text-cyan" />
              <h3 className="verify-title">2단계 인증 로그인 시뮬레이터</h3>
            </div>
            
            {/* 시간 오차 허용 스위치 토글 */}
            <label className="window-toggle-label" title="시계 오차(±30초)를 보정하기 위해 직전/직후 1스텝 코드를 인정할지 선택합니다.">
              <input
                type="checkbox"
                className="toggle-checkbox"
                checked={allowTimeWindow}
                onChange={(e) => setAllowTimeWindow(e.target.checked)}
              />
              <span className="toggle-slider" />
              <span className="toggle-text">
                시간 오차 허용 (±1 스텝 / 30초)
              </span>
            </label>
          </div>

          <form onSubmit={handleFormSubmit} className="verify-form">
            <div className="input-with-button">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="otp-input font-mono"
                placeholder="6자리 숫자 입력 (예: 123456)"
                value={inputCode}
                onChange={handleInputChange}
                autoComplete="one-time-code"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={inputCode.length !== 6}
              >
                <span>인증 검증</span>
              </button>
            </div>
          </form>

          {/* 빠른 테스트용 코드 채우기 버튼 */}
          <div className="quick-test-bar">
            <button
              type="button"
              className="quick-fill-btn"
              onClick={() => setInputCode(currentOtp)}
              disabled={!currentOtp}
            >
              <Sparkles className="icon-xs" />
              <span>현재 OTP 자동 입력하여 테스트</span>
            </button>
          </div>

          {/* 검증 결과 알림 배지 */}
          {verificationResult && (
            <div
              className={`result-alert ${
                verificationResult.valid ? 'result-success' : 'result-failure'
              }`}
            >
              <div className="result-icon-box">
                {verificationResult.valid ? (
                  <CheckCircle2 className="result-icon" />
                ) : (
                  <XCircle className="result-icon" />
                )}
              </div>
              <div className="result-content">
                <strong className="result-heading">
                  {verificationResult.valid ? '2단계 인증 통과 (Success)' : '2단계 인증 실패 (Failed)'}
                </strong>
                <p className="result-message">
                  {verificationResult.message}
                </p>
                {verificationResult.valid && (
                  <div className="result-meta">
                    <span className="meta-tag">
                      시간차: {verificationResult.delta === 0 ? '0초 (동일 타임스텝)' : `${verificationResult.delta * 30}초 오차 허용 적용`}
                    </span>
                    <span className="meta-tag font-mono">
                      검증 코드: {verificationResult.testedCode}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 하단: 검증 감사 로그 (Audit History) */}
        <div className="history-card">
          <div className="history-header">
            <div className="history-title-row">
              <History className="icon-xs" />
              <span>최근 검증 시도 로그</span>
            </div>
            {verifyHistory.length > 0 && (
              <button
                type="button"
                className="btn-text-clear"
                onClick={onClearHistory}
                title="로그 비우기"
              >
                <RotateCcw className="icon-xs" />
                <span>초기화</span>
              </button>
            )}
          </div>

          <div className="history-list">
            {verifyHistory.length === 0 ? (
              <p className="empty-history-text">
                아직 검증 시도 내역이 없습니다. 스마트폰 코드를 입력해 보세요!
              </p>
            ) : (
              verifyHistory.map((item) => (
                <div
                  key={item.id}
                  className={`history-item ${item.valid ? 'item-pass' : 'item-fail'}`}
                >
                  <div className="item-status-icon">
                    {item.valid ? (
                      <CheckCircle2 className="icon-xs text-emerald" />
                    ) : (
                      <XCircle className="icon-xs text-rose" />
                    )}
                  </div>
                  <div className="item-body">
                    <div className="item-row">
                      <span className="item-code font-mono">{item.code}</span>
                      <span className={`item-badge ${item.valid ? 'badge-pass' : 'badge-fail'}`}>
                        {item.valid ? 'PASS' : 'FAIL'}
                      </span>
                      <span className="item-time font-mono">{item.timestamp}</span>
                    </div>
                    <span className="item-reason">{item.reason}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
