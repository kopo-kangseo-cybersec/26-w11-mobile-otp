import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'
import {
  generateRecoveryCodes,
  generateSecret,
  generateTotp,
  normalizeRecoveryCode,
  PERIOD_SECONDS,
  verifyTotp,
} from './utils/totp.js'
import './App.css'

function App() {
  const [issuer, setIssuer] = useState('KopoSec')
  const [accountName, setAccountName] = useState('student@kopo.ac.kr')
  const [accounts, setAccounts] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [otpInput, setOtpInput] = useState('')
  const [recoveryInput, setRecoveryInput] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState({})
  const [allowDrift, setAllowDrift] = useState(false)
  const [otpCodes, setOtpCodes] = useState({})
  const [now, setNow] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? null,
    [accounts, selectedId],
  )

  useEffect(() => {
    let active = true

    const updateCodes = async () => {
      const timestamp = Date.now()
      setNow(timestamp)

      try {
        const entries = await Promise.all(
          accounts.map(async (account) => [
            account.id,
            await generateTotp(account.secret, timestamp),
          ]),
        )

        if (active) {
          setOtpCodes(Object.fromEntries(entries))
          setError('')
        }
      } catch (generationError) {
        if (active) {
          setError(`인증 코드를 계산하지 못했습니다: ${generationError.message}`)
        }
      }
    }

    updateCodes()
    const intervalId = window.setInterval(updateCodes, 1000)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [accounts])

  const remainingSeconds =
    PERIOD_SECONDS - (Math.floor(now / 1000) % PERIOD_SECONDS)
  const progress = (remainingSeconds / PERIOD_SECONDS) * 100

  const createAccount = (event) => {
    event.preventDefault()
    const cleanIssuer = issuer.trim()
    const cleanAccountName = accountName.trim()

    if (!cleanIssuer || !cleanAccountName) {
      setError('발급자와 계정명을 모두 입력해 주세요.')
      return
    }

    try {
      const account = {
        id: `${Date.now()}-${accounts.length}`,
        issuer: cleanIssuer,
        accountName: cleanAccountName,
        secret: generateSecret(),
      }
      setAccounts((currentAccounts) => [account, ...currentAccounts])
      setSelectedId(account.id)
      setOtpInput('')
      setFeedback(null)
      setCopied(false)
      setError('')
    } catch (generationError) {
      setError(`비밀 키를 생성하지 못했습니다: ${generationError.message}`)
    }
  }

  const handleOtpVerification = async (event) => {
    event.preventDefault()
    if (!selectedAccount) {
      setFeedback({ type: 'error', text: '먼저 비밀 키를 생성해 주세요.' })
      return
    }

    try {
      const valid = await verifyTotp(
        selectedAccount.secret,
        otpInput.trim(),
        Date.now(),
        allowDrift ? 1 : 0,
      )
      setFeedback(
        valid
          ? { type: 'success', text: '인증되었습니다. 계정 보안이 확인됐어요.' }
          : { type: 'error', text: '코드가 일치하지 않습니다. 다시 확인해 주세요.' },
      )
    } catch (verificationError) {
      setFeedback({
        type: 'error',
        text: `OTP 검증에 실패했습니다: ${verificationError.message}`,
      })
    }
  }

  const createBackupCodes = () => {
    if (!selectedAccount) {
      setError('먼저 비밀 키를 생성해 주세요.')
      return
    }

    try {
      const codes = generateRecoveryCodes()
      setRecoveryCodes((currentCodes) => ({
        ...currentCodes,
        [selectedAccount.id]: codes,
      }))
      setRecoveryInput('')
      setFeedback({
        type: 'success',
        text: '새 복구 코드가 발급됐습니다. 기존에 발급된 코드는 사용할 수 없습니다.',
      })
      setError('')
    } catch (generationError) {
      setError(`복구 코드를 생성하지 못했습니다: ${generationError.message}`)
    }
  }

  const verifyRecoveryCode = (event) => {
    event.preventDefault()
    if (!selectedAccount) {
      setFeedback({ type: 'error', text: '먼저 비밀 키를 생성해 주세요.' })
      return
    }

    const codes = recoveryCodes[selectedAccount.id] ?? []
    const submittedCode = normalizeRecoveryCode(recoveryInput)
    const matchedIndex = codes.findIndex(
      (code) => normalizeRecoveryCode(code) === submittedCode,
    )

    if (submittedCode && matchedIndex !== -1) {
      setRecoveryCodes((currentCodes) => ({
        ...currentCodes,
        [selectedAccount.id]: codes.filter((_, index) => index !== matchedIndex),
      }))
      setRecoveryInput('')
      setFeedback({
        type: 'success',
        text: `복구 코드가 확인됐습니다. 남은 코드 ${codes.length - 1}개`,
      })
    } else {
      setFeedback({
        type: 'error',
        text: '사용할 수 없는 복구 코드입니다. 이미 사용했거나 올바르지 않습니다.',
      })
    }
  }

  const copySecret = async () => {
    if (!selectedAccount) return

    try {
      await navigator.clipboard.writeText(selectedAccount.secret)
      setCopied(true)
      setError('')
    } catch (copyError) {
      setError(`클립보드에 복사하지 못했습니다: ${copyError.message}`)
    }
  }

  const otpauthUrl = selectedAccount
    ? `otpauth://totp/${encodeURIComponent(selectedAccount.issuer)}:${encodeURIComponent(selectedAccount.accountName)}?secret=${selectedAccount.secret}&issuer=${encodeURIComponent(selectedAccount.issuer)}&algorithm=SHA1&digits=6&period=${PERIOD_SECONDS}`
    : ''

  return (
    <main className="studio">
      <header className="topbar">
        <a className="brand" href="#" aria-label="KopoSec OTP Studio 홈">
          <span className="brand-mark"><ShieldCheck size={19} /></span>
          <span>kopo<span className="brand-light">sec</span></span>
          <span className="brand-divider" />
          <span className="brand-product">OTP Studio</span>
        </a>
        <div className="secure-label"><LockKeyhole size={14} /> 브라우저에서 안전하게 처리</div>
      </header>

      <section className="intro">
        <div className="eyebrow"><span className="eyebrow-dot" /> RFC 6238 · TOTP AUTHENTICATOR</div>
        <h1>더 단단한 계정 보안,<br /><span>한 번의 코드로.</span></h1>
        <p>비밀 키 발급부터 OTP 검증까지, 브라우저 안에서 안전하게 경험해 보세요.</p>
      </section>

      {error && <div className="global-error" role="alert">{error}</div>}

      <div className="workspace">
        <section className="panel manager-panel" aria-labelledby="manager-title">
          <div className="panel-heading">
            <div className="panel-icon manager-icon"><Shield size={20} /></div>
            <div>
              <span className="panel-kicker">SERVICE CONSOLE</span>
              <h2 id="manager-title">서비스 관리자</h2>
            </div>
            <span className="role-tag">관리자</span>
          </div>

          <form onSubmit={createAccount} className="enroll-form">
            <div className="form-grid">
              <label className="field">
                <span>발급자 <span className="required">*</span></span>
                <input value={issuer} onChange={(event) => setIssuer(event.target.value)} />
              </label>
              <label className="field">
                <span>계정명 <span className="required">*</span></span>
                <input
                  type="text"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="button button-primary">
              {accounts.length ? <RefreshCw size={17} /> : <Plus size={18} />}
              새 비밀 키 생성
            </button>
          </form>

          <div className="section-rule"><span>인증기 등록</span></div>
          {selectedAccount ? (
            <div className="registration-card">
              <div className="qr-frame">
                <QRCodeSVG value={otpauthUrl} size={152} level="M" includeMargin />
              </div>
              <div className="registration-info">
                <div className="registration-badge"><Check size={13} /> 등록 준비 완료</div>
                <h3>{selectedAccount.issuer}</h3>
                <p>{selectedAccount.accountName}</p>
                <div className="secret-label">수동 입력 키</div>
                <div className="secret-row">
                  <code>{selectedAccount.secret.match(/.{1,4}/g)?.join(' ')}</code>
                  <button
                    type="button"
                    className={`icon-button ${copied ? 'is-copied' : ''}`}
                    onClick={copySecret}
                    aria-label="비밀 키 복사"
                    title="비밀 키 복사"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="scan-hint">인증기 앱으로 QR 코드를 스캔하거나<br />키를 직접 입력하세요.</p>
              </div>
            </div>
          ) : (
            <div className="empty-registration">
              <div className="empty-qr"><Smartphone size={30} /></div>
              <strong>인증기를 등록해 보세요</strong>
              <span>비밀 키를 생성하면 QR 코드가 여기에 표시됩니다.</span>
            </div>
          )}

          {accounts.length > 1 && (
            <div className="account-tabs" aria-label="등록 계정">
              {accounts.map((account) => (
                <button
                  type="button"
                  className={account.id === selectedId ? 'account-chip active' : 'account-chip'}
                  key={account.id}
                  onClick={() => {
                    setSelectedId(account.id)
                    setFeedback(null)
                    setCopied(false)
                  }}
                >
                  <span className="chip-dot" />{account.accountName}
                </button>
              ))}
            </div>
          )}

          <div className="section-rule verify-rule"><span>2단계 인증 테스트</span></div>
          <form className="verify-form" onSubmit={handleOtpVerification}>
            <label className="field">
              <span>인증 코드 <span className="field-note">인증기 앱의 6자리 번호</span></span>
              <input
                className="otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="000 000"
                value={otpInput}
                onChange={(event) => setOtpInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button type="submit" className="button button-dark">
              코드 검증 <CheckCircle2 size={17} />
            </button>
          </form>
          {feedback && (
            <div className={`feedback ${feedback.type}`} role="status">
              {feedback.type === 'success' ? <CheckCircle2 size={17} /> : <X size={17} />}
              {feedback.text}
            </div>
          )}

          <div className="recovery-box">
            <div className="recovery-heading">
              <div>
                <strong>백업 복구 코드</strong>
                <span>인증기를 사용할 수 없을 때 계정에 접근하세요.</span>
              </div>
              <button type="button" className="button button-secondary" onClick={createBackupCodes}>
                <KeyRound size={15} /> 코드 발급
              </button>
            </div>
            {(recoveryCodes[selectedId]?.length > 0) && (
              <>
                <div className="recovery-codes">
                  {recoveryCodes[selectedId].map((code) => <code key={code}>{code}</code>)}
                </div>
                <p className="recovery-warning">각 코드는 한 번만 사용할 수 있습니다. 안전한 곳에 보관하세요.</p>
              </>
            )}
            <form className="recovery-form" onSubmit={verifyRecoveryCode}>
              <input
                aria-label="복구 코드 입력"
                placeholder="복구 코드로 테스트"
                value={recoveryInput}
                onChange={(event) => setRecoveryInput(event.target.value)}
              />
              <button type="submit" className="text-button">복구 코드 확인 <span>→</span></button>
            </form>
          </div>
        </section>

        <section className="panel authenticator-panel" aria-labelledby="authenticator-title">
          <div className="panel-heading auth-heading">
            <div className="panel-icon auth-icon"><Smartphone size={20} /></div>
            <div>
              <span className="panel-kicker">LIVE AUTHENTICATOR</span>
              <h2 id="authenticator-title">가상 인증기</h2>
            </div>
            <span className="live-tag"><span /> LIVE</span>
          </div>
          <div className="auth-description">등록된 계정의 일회용 인증 코드를 실시간으로 확인하세요.</div>

          {accounts.length ? (
            <div className="token-list">
              {accounts.map((account) => (
                <article className={`token-card ${account.id === selectedId ? 'selected' : ''}`} key={account.id}>
                  <div className="token-card-top">
                    <div className="avatar">{account.issuer.slice(0, 1).toUpperCase()}</div>
                    <div className="token-identity">
                      <strong>{account.issuer}</strong>
                      <span>{account.accountName}</span>
                    </div>
                    <button
                      type="button"
                      className="select-account"
                      onClick={() => {
                        setSelectedId(account.id)
                        setFeedback(null)
                        setCopied(false)
                      }}
                      aria-label={`${account.accountName} 선택`}
                    >
                      {account.id === selectedId ? <Check size={17} /> : <Plus size={17} />}
                    </button>
                  </div>
                  <div className="token-code-row">
                    <div className="token-code">
                      {(otpCodes[account.id] ?? '------').slice(0, 3)}
                      <span>{(otpCodes[account.id] ?? '------').slice(3)}</span>
                    </div>
                    <div className="timer-wrap" aria-label={`${remainingSeconds}초 후 코드 갱신`}>
                      <svg className={remainingSeconds <= 5 ? 'timer-ring urgent' : 'timer-ring'} viewBox="0 0 42 42">
                        <circle className="timer-track" cx="21" cy="21" r="18" />
                        <circle
                          className="timer-progress"
                          cx="21"
                          cy="21"
                          r="18"
                          style={{ strokeDashoffset: `${113.1 * (1 - progress / 100)}` }}
                        />
                      </svg>
                      <span className={remainingSeconds <= 5 ? 'timer-number urgent' : 'timer-number'}>
                        {remainingSeconds}
                      </span>
                    </div>
                  </div>
                  <div className="token-footer">
                    <span><Clock3 size={13} /> 다음 코드까지 {remainingSeconds}초</span>
                    <span>SHA-1 · {PERIOD_SECONDS}초</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-authenticator">
              <div className="empty-phone">
                <Smartphone size={31} />
                <span className="phone-lock"><LockKeyhole size={12} /></span>
              </div>
              <strong>아직 등록된 계정이 없어요</strong>
              <span>왼쪽에서 새 비밀 키를 만들면<br />실시간 인증 코드가 나타납니다.</span>
            </div>
          )}

          <div className="drift-control">
            <div className="drift-icon"><Clock3 size={17} /></div>
            <div className="drift-copy">
              <strong>시간 오차 허용</strong>
              <span>기기 간 시간 차이를 보정합니다.</span>
            </div>
            <button
              type="button"
              className={`toggle ${allowDrift ? 'on' : ''}`}
              role="switch"
              aria-checked={allowDrift}
              aria-label="시간 오차 ±1 스텝 허용"
              onClick={() => setAllowDrift((enabled) => !enabled)}
            >
              <span />
            </button>
            <span className={allowDrift ? 'drift-state enabled' : 'drift-state'}>
              {allowDrift ? '±1 스텝' : '꺼짐'}
            </span>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={15} />
            <span>비밀 키와 인증 코드는 이 브라우저에서만 처리되며 서버로 전송되지 않습니다.</span>
          </div>
        </section>
      </div>

      <footer className="footer">
        <span>© 2026 KopoSec · Mobile OTP Studio</span>
        <span><span className="footer-dot" /> RFC 6238 compliant</span>
      </footer>
    </main>
  )
}

export default App
