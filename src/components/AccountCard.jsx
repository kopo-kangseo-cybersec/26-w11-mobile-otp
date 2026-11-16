import { useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { generateTOTP } from '../utils/totp.js'

const PERIOD_SECONDS = 30
const TIMER_RADIUS = 19
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS

function AccountCard({ account, onDelete }) {
  const [now, setNow] = useState(Date.now())
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isVerificationOpen, setIsVerificationOpen] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationStatus, setVerificationStatus] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const copyTimeoutRef = useRef(null)
  const currentStep = Math.floor(now / 1000 / PERIOD_SECONDS)
  const remaining = PERIOD_SECONDS - ((now / 1000) % PERIOD_SECONDS)
  const secondsRemaining = Math.ceil(remaining)
  const dashOffset =
    TIMER_CIRCUMFERENCE * (1 - remaining / PERIOD_SECONDS)

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(copyTimeoutRef.current)
    },
    [],
  )

  useEffect(() => {
    let isCurrent = true
    setCode('')
    setError('')

    generateTOTP(account.secret, currentStep * PERIOD_SECONDS)
      .then((nextCode) => {
        if (isCurrent) setCode(nextCode)
      })
      .catch((generationError) => {
        if (isCurrent) {
          setError(
            generationError instanceof Error
              ? generationError.message
              : '인증 코드를 계산하지 못했습니다.',
          )
        }
      })

    return () => {
      isCurrent = false
    }
  }, [account.secret, currentStep])

  function toggleVerification() {
    setIsVerificationOpen((isOpen) => !isOpen)
    setVerificationCode('')
    setVerificationStatus(null)
  }

  async function handleVerification(event) {
    event.preventDefault()
    if (!/^\d{6}$/.test(verificationCode) || isVerifying) return

    setIsVerifying(true)
    setVerificationStatus(null)

    try {
      const step = Math.floor(Date.now() / 1000 / PERIOD_SECONDS)
      const candidateSteps = [step - 1, step, step + 1].filter(
        (candidateStep) => candidateStep >= 0,
      )
      const candidateCodes = await Promise.all(
        candidateSteps.map((candidateStep) =>
          generateTOTP(
            account.secret,
            candidateStep * PERIOD_SECONDS,
          ),
        ),
      )

      setVerificationStatus(
        candidateCodes.includes(verificationCode)
          ? {
              type: 'success',
              message: '인증에 성공했습니다.',
            }
          : {
              type: 'failure',
              message: '인증 코드가 일치하지 않습니다.',
            },
      )
    } catch (verificationError) {
      setVerificationStatus({
        type: 'error',
        message:
          verificationError instanceof Error
            ? `인증 코드를 확인하지 못했습니다: ${verificationError.message}`
            : '인증 코드를 확인하지 못했습니다.',
      })
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleCopy() {
    if (!code) return

    try {
      await navigator.clipboard.writeText(code)
      setCopyStatus('복사됨')
      window.clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopyStatus('')
      }, 1800)
    } catch (copyError) {
      setCopyStatus(
        copyError instanceof Error
          ? '복사할 수 없습니다. 브라우저 권한을 확인해 주세요.'
          : '복사할 수 없습니다.',
      )
    }
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `${account.serviceName} (${account.accountName}) 계정을 삭제할까요?\n\n스마트폰 인증기 앱의 항목은 따로 지워야 합니다`,
    )

    if (confirmed) onDelete(account.secret)
  }

  return (
    <article className="account-card">
      <div className="account-card-heading">
        <span className="account-service-icon" aria-hidden="true">
          <KeyRound size={19} />
        </span>
        <div className="account-identity">
          <h2 title={account.serviceName}>{account.serviceName}</h2>
          <p title={account.accountName}>{account.accountName}</p>
        </div>
      </div>

      <div className="account-code-row">
        <output
          className="account-code"
          aria-label="현재 일회용 인증 코드"
          aria-live="polite"
        >
          {code ? `${code.slice(0, 3)} ${code.slice(3)}` : '••• •••'}
        </output>
        <div
          className="countdown"
          role="img"
          aria-label={`${secondsRemaining}초 후 인증 코드 갱신`}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <circle
              className="countdown-track"
              cx="24"
              cy="24"
              r={TIMER_RADIUS}
            />
            <circle
              className="countdown-progress"
              cx="24"
              cy="24"
              r={TIMER_RADIUS}
              strokeDasharray={TIMER_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span>{secondsRemaining}</span>
        </div>
      </div>

      <div className="account-card-footer">
        <span className="card-live-indicator" />
        <span>30초마다 자동 갱신</span>
      </div>

      <div className="account-actions">
        <button
          className="account-action-button copy-action"
          type="button"
          onClick={handleCopy}
          disabled={!code}
        >
          {copyStatus === '복사됨' ? <Check size={15} /> : <Copy size={15} />}
          {copyStatus || '코드 복사'}
        </button>
        <button
          className="account-action-button delete-action"
          type="button"
          onClick={handleDelete}
        >
          <Trash2 size={15} />
          삭제
        </button>
      </div>

      <button
        className="verification-toggle"
        type="button"
        aria-expanded={isVerificationOpen}
        aria-controls={`verify-${account.secret}`}
        onClick={toggleVerification}
      >
        <ShieldCheck size={15} />
        {isVerificationOpen ? '검증 닫기' : '코드 검증'}
      </button>

      {copyStatus && copyStatus !== '복사됨' && (
        <p className="account-action-error" role="alert">
          {copyStatus}
        </p>
      )}

      {isVerificationOpen && (
        <form
          className="verification-form"
          id={`verify-${account.secret}`}
          onSubmit={handleVerification}
        >
          <label className="verification-label" htmlFor={`code-${account.secret}`}>
            스마트폰에 표시된 6자리 코드를 입력하세요
          </label>
          <div className="verification-controls">
            <input
              id={`code-${account.secret}`}
              className="verification-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              required
              value={verificationCode}
              aria-describedby={
                verificationStatus
                  ? `result-${account.secret}`
                  : undefined
              }
              onChange={(event) => {
                setVerificationCode(
                  event.target.value.replace(/\D/g, '').slice(0, 6),
                )
                setVerificationStatus(null)
              }}
            />
            <button
              className="verification-submit"
              type="submit"
              disabled={isVerifying || verificationCode.length !== 6}
            >
              {isVerifying ? '확인 중…' : '확인'}
            </button>
          </div>
          {verificationStatus && (
            <p
              className={`verification-result verification-result-${verificationStatus.type}`}
              id={`result-${account.secret}`}
              role={verificationStatus.type === 'success' ? 'status' : 'alert'}
              aria-live="polite"
            >
              {verificationStatus.message}
            </p>
          )}
        </form>
      )}

      {error && (
        <p className="account-card-error" role="alert">
          코드를 생성하지 못했습니다: {error}
        </p>
      )}
    </article>
  )
}

export default AccountCard
