import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  generateOtpAuthUri,
  generateSecret,
  generateTOTP,
  generateTOTPAtTime,
} from './utils/totp.js'
import './App.css'

function App() {
  const [issuer, setIssuer] = useState('MySecurityApp')
  const [accountName, setAccountName] = useState('user@example.com')
  const [secret, setSecret] = useState('')
  const [otp, setOtp] = useState('')
  const [debugOtps, setDebugOtps] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [verificationCode, setVerificationCode] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let intervalId
    const timeoutId = window.setTimeout(() => {
      setCurrentTime(Date.now())
      intervalId = window.setInterval(() => setCurrentTime(Date.now()), 1000)
    }, 1000 - (Date.now() % 1000))

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [])

  const timeCounter = Math.floor(currentTime / 1000 / 30)
  const secondsRemaining = 30 - (Math.floor(currentTime / 1000) % 30)

  useEffect(() => {
    if (!secret || timeCounter === 0) return

    let active = true
    const counterTimestamp = timeCounter * 30_000
    Promise.all([
      generateTOTPAtTime(secret, counterTimestamp - 30_000),
      generateTOTPAtTime(secret, counterTimestamp),
      generateTOTPAtTime(secret, counterTimestamp + 30_000),
    ])
      .then(([previous, current, next]) => {
        if (active) {
          setOtp(current)
          setDebugOtps({ previous, current, next })
        }
      })
      .catch((cause) => {
        if (active) setError(`OTP를 생성하지 못했습니다: ${cause.message}`)
      })

    return () => {
      active = false
    }
  }, [secret, timeCounter])

  const otpAuthUri = secret
    ? generateOtpAuthUri(secret, accountName, issuer)
    : ''
  const progress = (secondsRemaining / 30) * 100

  function issueSecret() {
    try {
      setSecret(generateSecret())
      setOtp('')
      setDebugOtps(null)
      setVerificationCode('')
      setFeedback(null)
      setError('')
      setCopied(false)
    } catch (cause) {
      setError(`비밀 키를 발급하지 못했습니다: ${cause.message}`)
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (cause) {
      setError(`클립보드에 복사하지 못했습니다: ${cause.message}`)
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    setFeedback(null)

    if (!secret) {
      setFeedback({ success: false, message: '먼저 새 비밀 키를 발급해 주세요.' })
      return
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setFeedback({ success: false, message: '6자리 숫자 코드를 입력해 주세요.' })
      return
    }

    try {
      const currentOtp = await generateTOTP(secret)
      setFeedback(
        currentOtp === verificationCode
          ? { success: true, message: '인증 성공 — 로그인 완료!' }
          : { success: false, message: '인증 실패 — 코드가 일치하지 않습니다.' },
      )
    } catch (cause) {
      setError(`코드를 확인하지 못했습니다: ${cause.message}`)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="SecureFlow 홈">
          <span className="brand-icon"><ShieldCheck size={21} /></span>
          <span>SecureFlow<span className="brand-dot">.</span></span>
        </a>
        <div className="topbar-status"><span /> 클라이언트에서 안전하게 처리 중</div>
      </header>

      <section className="page-heading">
        <div className="eyebrow"><LockKeyhole size={15} /> 보안 실습 · 2단계 인증</div>
        <h1>모바일 OTP 로그인</h1>
        <p>Authenticator 앱을 등록하고, 시간 기반 일회용 비밀번호로 로그인을 테스트하세요.</p>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="steps" aria-label="인증 단계">
        <article className="panel setup-panel">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div>
              <h2>인증기 등록</h2>
              <p>계정 정보를 입력하고 QR 코드를 스캔하세요.</p>
            </div>
          </div>

          <div className="form-fields">
            <label>
              <span>발급자 <small>ISSUER</small></span>
              <input
                value={issuer}
                onChange={(event) => setIssuer(event.target.value)}
                placeholder="MySecurityApp"
                autoComplete="organization"
              />
            </label>
            <label>
              <span>계정명 <small>ACCOUNT</small></span>
              <input
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="user@example.com"
                autoComplete="username"
              />
            </label>
          </div>

          <button className="button button-primary issue-button" onClick={issueSecret}>
            <KeyRound size={17} /> 새 비밀 키 발급
          </button>

          {secret ? (
            <div className="registration-result">
              <div className="secret-label">BASE32 비밀 키</div>
              <div className="secret-value">
                <code>{secret}</code>
                <button className="icon-button" onClick={copySecret} aria-label="비밀 키 복사">
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                </button>
              </div>
              <div className="qr-card">
                <QRCodeSVG value={otpAuthUri} size={176} level="M" marginSize={2} />
              </div>
              <p className="qr-hint">Authenticator 앱에서 QR 코드를 스캔하세요.</p>
            </div>
          ) : (
            <div className="empty-qr">
              <div className="empty-qr-icon"><KeyRound size={24} /></div>
              <strong>아직 등록된 키가 없습니다</strong>
              <span>비밀 키를 발급하면 QR 코드가 표시됩니다.</span>
            </div>
          )}
        </article>

        <div className="right-column">
          <article className="panel monitor-panel">
            <div className="panel-heading">
              <span className="step-number">02</span>
              <div>
                <h2>실시간 OTP 모니터</h2>
                <p>현재 시간 기준으로 생성된 인증 코드</p>
              </div>
              <span className="live-badge"><span /> LIVE</span>
            </div>

            <div className={`otp-display${otp ? '' : ' is-empty'}`} aria-live="polite">
              {otp || '------'}
            </div>
            <div className="timer-row">
              <span>다음 코드까지</span>
              <strong>{secondsRemaining}초</strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="다음 OTP까지 남은 시간"
              aria-valuemin={0}
              aria-valuemax={30}
              aria-valuenow={secondsRemaining}
            >
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="monitor-footnote">
              <span className="status-dot" /> 30초마다 자동으로 새로고침됩니다
            </div>
          </article>

          <article className="panel verify-panel">
            <div className="panel-heading">
              <span className="step-number">03</span>
              <div>
                <h2>로그인 확인</h2>
                <p>스마트폰에 표시된 6자리 코드를 입력하세요.</p>
              </div>
            </div>
            <form onSubmit={verifyCode}>
              <label className="code-label" htmlFor="verification-code">인증 코드</label>
              <input
                id="verification-code"
                className="code-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(event) => {
                  setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  setFeedback(null)
                }}
                aria-describedby={feedback ? 'verification-feedback' : undefined}
              />
              <button className="button button-dark verify-button" type="submit">
                <LockKeyhole size={16} /> 인증하기
              </button>
            </form>
            {feedback && (
              <div
                id="verification-feedback"
                className={`feedback ${feedback.success ? 'feedback-success' : 'feedback-failure'}`}
                role="status"
              >
                {feedback.success ? <Check size={17} /> : <LockKeyhole size={17} />}
                {feedback.message}
              </div>
            )}
          </article>
        </div>
      </section>

      <footer className="page-footer">
        <span><LockKeyhole size={14} /> 비밀 키와 인증 코드는 브라우저 안에서만 처리됩니다.</span>
        <span>HMAC-SHA1 · RFC 6238</span>
      </footer>

      <section className="debug-panel" aria-labelledby="debug-title">
        <div className="debug-heading">
          <div>
            <span className="debug-label">TEMPORARY DIAGNOSTICS</span>
            <h2 id="debug-title">시간 동기화 디버그</h2>
          </div>
          <span className="debug-badge">개발용</span>
        </div>
        <div className="debug-metrics">
          <div className="debug-metric">
            <span>브라우저 Unix Timestamp</span>
            <code>{currentTime ? Math.floor(currentTime / 1000) : '대기 중'}</code>
          </div>
          <div className="debug-metric">
            <span>현재 30초 카운터</span>
            <code>{currentTime ? timeCounter : '대기 중'}</code>
          </div>
        </div>
        <div className="debug-otp-list">
          <div><span>이전 · −30초</span><code>{debugOtps?.previous ?? '------'}</code></div>
          <div className="debug-current"><span>현재</span><code>{debugOtps?.current ?? '------'}</code></div>
          <div><span>다음 · +30초</span><code>{debugOtps?.next ?? '------'}</code></div>
        </div>
        <p className="debug-note">Unix Timestamp를 신뢰할 수 있는 표준시와 비교해 기기 시계 오차를 확인하세요.</p>
      </section>
    </main>
  )
}

export default App
