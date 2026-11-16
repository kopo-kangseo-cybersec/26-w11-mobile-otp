import { useEffect, useState } from 'react'
import { KeyRound, QrCode, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { generateSecret } from '../utils/totp.js'

function AddModal({ onClose, onComplete }) {
  const [serviceName, setServiceName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleGenerate(event) {
    event.preventDefault()

    try {
      setSecret(generateSecret())
      setError('')
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : '비밀 키를 생성하지 못했습니다.',
      )
    }
  }

  function handleInputChange(setValue) {
    return (event) => {
      setValue(event.target.value)
      setSecret('')
      setError('')
    }
  }

  function handleComplete() {
    onComplete({ serviceName, accountName, secret })
  }

  const label = encodeURIComponent(`${serviceName}:${accountName}`)
  const parameters = new URLSearchParams({ secret, issuer: serviceName })
  const provisioningUri = `otpauth://totp/${label}?${parameters.toString()}`

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon">
              <KeyRound size={19} />
            </span>
            <div>
              <p className="eyebrow">NEW AUTHENTICATOR</p>
              <h2 id="modal-title">계정 추가</h2>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="모달 닫기"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <p className="modal-description" id="modal-description">
          서비스와 계정 정보를 입력하고 인증 앱에 등록할 QR 코드를 발급하세요.
        </p>

        <form className="account-form" onSubmit={handleGenerate}>
          <label className="form-field">
            <span>서비스 이름</span>
            <input
              autoFocus
              autoComplete="organization"
              maxLength={64}
              placeholder="예: GitHub"
              required
              value={serviceName}
              onChange={handleInputChange(setServiceName)}
            />
          </label>
          <label className="form-field">
            <span>계정 이름</span>
            <input
              autoComplete="username"
              maxLength={128}
              placeholder="예: name@example.com"
              required
              value={accountName}
              onChange={handleInputChange(setAccountName)}
            />
          </label>

          <button className="primary-button generate-button" type="submit">
            <KeyRound size={17} />
            {secret ? '새 비밀 키 발급' : '비밀 키 발급'}
          </button>
        </form>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {secret && (
          <div className="provisioning-result" aria-live="polite">
            <div className="result-heading">
              <span className="result-icon">
                <QrCode size={18} />
              </span>
              <div>
                <h3>인증 앱에 등록</h3>
                <p>인증 앱에서 QR 코드를 스캔하세요.</p>
              </div>
            </div>
            <div className="qr-code-frame">
              <QRCodeSVG
                value={provisioningUri}
                size={196}
                level="M"
                title={`${serviceName} ${accountName} OTP 등록 QR 코드`}
              />
            </div>
            <div className="secret-value">
              <span>수동 입력용 비밀 키</span>
              <code>{secret}</code>
            </div>
            <button
              className="primary-button complete-button"
              type="button"
              onClick={handleComplete}
            >
              등록 완료
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export default AddModal
