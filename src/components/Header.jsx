import { ShieldCheck, KeyRound, Lock } from 'lucide-react'

export function Header({ currentTime }) {
  const formattedTime = new Date(currentTime).toLocaleTimeString('ko-KR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  return (
    <header className="studio-header">
      <div className="header-top">
        <div className="title-group">
          <div className="title-badge">
            <Lock className="icon-sm" />
            <span>RFC 6238 TOTP Standard</span>
          </div>
          <h1 className="studio-title">
            모바일 OTP 2단계 인증 체험 스튜디오
          </h1>
          <p className="studio-subtitle">
            스마트폰 Authenticator(Google/MS) 앱과 실시간 동기화되는 순수 클라이언트 2FA 보안 시스템
          </p>
        </div>

        <div className="header-badges">
          <div className="security-badge zero-transmission">
            <ShieldCheck className="badge-icon text-emerald" />
            <div>
              <span className="badge-label">보안 규격</span>
              <strong className="badge-value">Zero-Transmission (외부 전송 0건)</strong>
            </div>
          </div>

          <div className="security-badge csprng">
            <KeyRound className="badge-icon text-cyan" />
            <div>
              <span className="badge-label">난수 엔진</span>
              <strong className="badge-value">crypto.getRandomValues (160-bit)</strong>
            </div>
          </div>

          <div className="security-badge clock-badge">
            <span className="live-dot" />
            <div>
              <span className="badge-label">브라우저 시각</span>
              <strong className="badge-value font-mono">{formattedTime}</strong>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
