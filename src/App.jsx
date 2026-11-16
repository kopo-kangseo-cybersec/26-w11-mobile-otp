import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clipboard,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react'
import { createSecret, createOtpAuthUri, generateTotp, verifyTotp } from './utils/totp.js'
import './App.css'

const PERIOD_SECONDS = 30

function App() {
  const [secret, setSecret] = useState('')
  const [issuer, setIssuer] = useState('OTP Studio')
  const [account, setAccount] = useState('student@example.com')
  const [otp, setOtp] = useState('')
  const [secondsRemaining, setSecondsRemaining] = useState(PERIOD_SECONDS)
  const [inputCode, setInputCode] = useState('')
  const [verification, setVerification] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const trimmedIssuer = issuer.trim()
  const trimmedAccount = account.trim()
  const provisioningUri = useMemo(() => {
    if (!secret || !trimmedIssuer || !trimmedAccount) return ''
    return createOtpAuthUri({ secret, issuer: trimmedIssuer, account: trimmedAccount })
  }, [secret, trimmedIssuer, trimmedAccount])

  useEffect(() => {
    if (!secret) {
      setOtp('')
      setSecondsRemaining(PERIOD_SECONDS)
      return undefined
    }

    let activeCounter = -1n
    let disposed = false

    const updateOtp = async () => {
      const now = Date.now()
      const unixSeconds = Math.floor(now / 1000)
      const counter = BigInt(Math.floor(unixSeconds / PERIOD_SECONDS))
      setSecondsRemaining(PERIOD_SECONDS - (unixSeconds % PERIOD_SECONDS))

      if (counter !== activeCounter) {
        activeCounter = counter
        try {
          const nextOtp = await generateTotp(secret, now)
          if (!disposed) setOtp(nextOtp)
        } catch (cause) {
          if (!disposed) {
            setError(cause instanceof Error ? cause.message : 'OTP를 생성하지 못했습니다.')
          }
        }
      }
    }

    void updateOtp()
    const intervalId = window.setInterval(updateOtp, 250)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [secret])

  const generateNewSecret = () => {
    try {
      setSecret(createSecret())
      setInputCode('')
      setVerification(null)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '비밀 키를 생성하지 못했습니다.')
    }
  }

  const copyToClipboard = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1800)
    } catch (cause) {
      const detail = cause instanceof Error ? ` (${cause.message})` : ''
      setError(`클립보드에 복사할 수 없습니다. 브라우저 권한을 확인해 주세요.${detail}`)
    }
  }

  const submitCode = async (event) => {
    event.preventDefault()
    if (!secret || !/^\d{6}$/.test(inputCode)) return

    try {
      const isValid = await verifyTotp(secret, inputCode)
      setVerification(isValid)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '코드를 검증하지 못했습니다.')
    }
  }

  const progress = (secondsRemaining / PERIOD_SECONDS) * 100

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="OTP Studio 홈">
          <span className="brand-mark"><ShieldCheck size={21} strokeWidth={2.2} /></span>
          <span>otp<span className="brand-light">studio</span></span>
        </a>
        <div className="secure-badge"><span className="secure-dot" /> 브라우저에서 안전하게 실행 중</div>
      </header>

      <main id="home">
        <section className="intro">
          <div className="eyebrow"><span /> TWO-FACTOR AUTHENTICATION</div>
          <h1>내 계정을 위한<br /><span>한 겹 더 안전한 잠금</span></h1>
          <p>Authenticator 앱을 연결하고, 시간 기반 일회용 비밀번호를 직접 발급·검증해 보세요.</p>
        </section>

        <div className="workspace">
          <section className="panel setup-panel" aria-labelledby="setup-title">
            <div className="panel-heading">
              <div className="step-number">01</div>
              <div>
                <h2 id="setup-title">Authenticator 연결</h2>
                <p>계정 정보를 입력하고 QR 코드를 스캔하세요.</p>
              </div>
              <Smartphone className="heading-icon" size={21} />
            </div>

            <div className="fields">
              <label>
                <span>서비스 이름</span>
                <input value={issuer} onChange={(event) => setIssuer(event.target.value)} maxLength={48} />
              </label>
              <label>
                <span>계정 이름</span>
                <input value={account} onChange={(event) => setAccount(event.target.value)} maxLength={96} />
              </label>
            </div>

            {provisioningUri ? (
              <div className="qr-card">
                <div className="qr-frame">
                  <QRCodeSVG value={provisioningUri} size={188} level="M" marginSize={1} />
                </div>
                <div className="qr-caption">
                  <span className="qr-check"><Check size={14} /></span>
                  QR 코드는 이 기기에서 생성됩니다
                </div>
              </div>
            ) : (
              <div className="qr-placeholder">
                <Smartphone size={25} />
                <span>서비스 이름과 계정 이름을 입력하면<br />연결용 QR 코드가 표시됩니다.</span>
              </div>
            )}

            <div className="scan-tip">
              <span className="tip-icon"><ArrowUpRight size={16} /></span>
              <p>앱에서 <strong>계정 추가</strong>를 선택한 뒤 QR 코드를 스캔하세요.</p>
            </div>
          </section>

          <div className="right-column">
            <section className="panel code-panel" aria-labelledby="code-title">
              <div className="panel-heading code-heading">
                <div className="step-number">02</div>
                <div>
                  <h2 id="code-title">내 인증 코드</h2>
                  <p>30초마다 새 코드가 만들어집니다.</p>
                </div>
                <div className="live-indicator"><span /> LIVE</div>
              </div>

              <div className="code-display" aria-live="polite" aria-label={`현재 인증 코드 ${otp || '없음'}`}>
                {otp ? otp.match(/.{1,3}/g).join(' ') : <span className="code-empty">------</span>}
              </div>
              <div className="timer-row">
                <span className="timer-label"><RefreshCw size={13} /> 다음 코드까지</span>
                <span className="timer-value">00:{String(secondsRemaining).padStart(2, '0')}</span>
              </div>
              <div className="progress-track" aria-label={`${secondsRemaining}초 남음`}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>

              <div className="secret-row">
                <div className="secret-label"><KeyRound size={14} /> 비밀 키 <span>BASE32</span></div>
                {secret ? (
                  <div className="secret-value">
                    <code>{secret}</code>
                    <button className="icon-button" type="button" aria-label="비밀 키 복사" onClick={() => void copyToClipboard(secret, 'secret')}>
                      {copied === 'secret' ? <Check size={15} /> : <Clipboard size={15} />}
                    </button>
                  </div>
                ) : <span className="secret-empty">새 키를 생성해 주세요</span>}
              </div>

              <button className="primary-button" type="button" onClick={generateNewSecret}>
                <RefreshCw size={16} /> {secret ? '새 비밀 키 발급' : '첫 OTP 만들기'}
              </button>
              {copied === 'secret' && <span className="copy-note">비밀 키를 복사했습니다.</span>}
            </section>

            <section className="panel verify-panel" aria-labelledby="verify-title">
              <div className="panel-heading verify-heading">
                <div className="step-number">03</div>
                <div>
                  <h2 id="verify-title">코드 검증</h2>
                  <p>Authenticator 앱에 표시된 6자리 코드를 입력하세요.</p>
                </div>
                <Fingerprint className="heading-icon" size={21} />
              </div>

              <form className="verify-form" onSubmit={submitCode}>
                <label className="sr-only" htmlFor="otp-input">6자리 인증 코드</label>
                <input
                  id="otp-input"
                  className="otp-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={inputCode}
                  onChange={(event) => {
                    setInputCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    setVerification(null)
                  }}
                  disabled={!secret}
                />
                <button className="verify-button" type="submit" disabled={!secret || inputCode.length !== 6}>
                  확인
                </button>
              </form>

              {verification === true && (
                <div className="verification-result success" role="status"><CheckCircle2 size={17} /> 인증에 성공했습니다.</div>
              )}
              {verification === false && (
                <div className="verification-result failure" role="status"><XCircle size={17} /> 코드가 일치하지 않습니다. 다시 확인해 주세요.</div>
              )}
              {error && <div className="verification-result failure" role="alert">{error}</div>}
            </section>
          </div>
        </div>

        <section className="privacy-note">
          <span className="privacy-icon"><LockKeyhole size={17} /></span>
          <p><strong>비밀 키는 외부로 전송되지 않습니다.</strong> 키 생성과 HMAC-SHA1 계산은 브라우저의 Web Crypto API에서 처리됩니다.</p>
          <span className="privacy-tag">ZERO TRANSMISSION</span>
        </section>

        <footer className="page-footer">
          <span>OTP STUDIO <span>·</span> TOTP / RFC 6238</span>
          <span>비밀 키가 포함된 QR 코드와 키를 타인과 공유하지 마세요.</span>
        </footer>
      </main>
    </div>
  )
}

export default App
