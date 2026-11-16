import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { generateTOTP } from '../utils/totp.js'

const PERIOD_SECONDS = 30
const TIMER_RADIUS = 19
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS

function AccountCard({ account }) {
  const [now, setNow] = useState(Date.now())
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const currentStep = Math.floor(now / 1000 / PERIOD_SECONDS)
  const remaining = PERIOD_SECONDS - ((now / 1000) % PERIOD_SECONDS)
  const secondsRemaining = Math.ceil(remaining)
  const dashOffset =
    TIMER_CIRCUMFERENCE * (1 - remaining / PERIOD_SECONDS)

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timerId)
  }, [])

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

      {error && (
        <p className="account-card-error" role="alert">
          코드를 생성하지 못했습니다: {error}
        </p>
      )}
    </article>
  )
}

export default AccountCard
