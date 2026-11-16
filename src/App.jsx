import { useEffect, useRef, useState } from 'react'
import { KeyRound, Plus, ShieldCheck } from 'lucide-react'
import AddModal from './components/AddModal.jsx'
import AccountCard from './components/AccountCard.jsx'
import { decodeBase32 } from './utils/totp.js'
import './App.css'

const STORAGE_KEY = 'mobile-otp-accounts-v1'

function isValidSecret(secret) {
  try {
    return decodeBase32(secret).length > 0
  } catch {
    return false
  }
}

function isAccountList(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (account) =>
        account !== null &&
        typeof account === 'object' &&
        typeof account.serviceName === 'string' &&
        account.serviceName.trim().length > 0 &&
        typeof account.accountName === 'string' &&
        account.accountName.trim().length > 0 &&
        typeof account.secret === 'string' &&
        isValidSecret(account.secret),
    )
  )
}

function loadSavedAccounts() {
  try {
    const storedAccounts = window.localStorage.getItem(STORAGE_KEY)
    if (storedAccounts === null) {
      return { accounts: [], error: '' }
    }

    const parsedAccounts = JSON.parse(storedAccounts)
    if (!isAccountList(parsedAccounts)) {
      return {
        accounts: [],
        error:
          '저장된 계정 데이터가 손상되어 불러오지 못했습니다. 기존 데이터는 유지됩니다. 새 계정을 등록하면 새 목록으로 저장됩니다.',
      }
    }

    return { accounts: parsedAccounts, error: '' }
  } catch {
    return {
      accounts: [],
      error:
        '저장된 계정을 읽지 못했습니다. 브라우저 저장소를 확인한 뒤 다시 시도해 주세요.',
    }
  }
}

function App() {
  const [initialState] = useState(loadSavedAccounts)
  const [accounts, setAccounts] = useState(initialState.accounts)
  const [storageError, setStorageError] = useState(initialState.error)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const canPersist = useRef(!initialState.error)

  useEffect(() => {
    if (!canPersist.current) return

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
      setStorageError('')
    } catch {
      setStorageError(
        '계정 목록을 브라우저에 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.',
      )
    }
  }, [accounts])

  function handleAccountComplete(account) {
    canPersist.current = true
    setAccounts((currentAccounts) => [...currentAccounts, account])
    setIsAddModalOpen(false)
  }

  const accountCount = accounts.length

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="모바일 OTP 홈">
          <span className="brand-mark">
            <ShieldCheck size={20} strokeWidth={2.2} />
          </span>
          <span>KEYSPACE</span>
        </a>
        <div className="privacy-badge">
          <span className="privacy-dot" />
          브라우저에서 안전하게 처리
        </div>
      </header>

      <main className="dashboard">
        <section className="dashboard-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">PERSONAL AUTHENTICATOR</p>
            <h1 id="page-title">모바일 OTP</h1>
            <p className="page-description">
              인증 코드를 한곳에서 안전하게 관리하세요.
            </p>
          </div>
          <div className="account-summary" aria-live="polite">
            <span className="summary-icon">
              <KeyRound size={17} />
            </span>
            <span>
              <strong>{accountCount}</strong>
              <span className="summary-label">등록된 계정</span>
            </span>
          </div>
        </section>

        {storageError && (
          <p className="storage-message" role="alert">
            {storageError}
          </p>
        )}

        {accountCount === 0 ? (
          <section className="empty-state" aria-labelledby="empty-title">
            <div className="empty-visual" aria-hidden="true">
              <div className="empty-orbit empty-orbit-outer" />
              <div className="empty-orbit empty-orbit-inner" />
              <div className="empty-key">
                <KeyRound size={32} strokeWidth={1.7} />
              </div>
              <span className="orbit-dot orbit-dot-top" />
              <span className="orbit-dot orbit-dot-side" />
            </div>
            <p className="eyebrow">START YOUR VAULT</p>
            <h2 id="empty-title">첫 OTP 계정을 추가해 보세요</h2>
            <p className="empty-description">
              아래 + 버튼으로 계정을 추가하고 QR 코드를 인증기 앱으로 스캔하세요.
            </p>
            <div className="empty-note">
              <span className="note-indicator" />
              비밀 키는 이 브라우저 안에서 생성됩니다.
            </div>
          </section>
        ) : (
          <section className="account-grid" aria-label="등록된 OTP 계정">
            {accounts.map((account) => (
              <AccountCard key={account.secret} account={account} />
            ))}
          </section>
        )}
      </main>

      <button
        className="add-account-button"
        type="button"
        aria-label="계정 추가"
        onClick={() => setIsAddModalOpen(true)}
      >
        <Plus size={25} strokeWidth={2.2} />
      </button>

      {isAddModalOpen && (
        <AddModal
          onClose={() => setIsAddModalOpen(false)}
          onComplete={handleAccountComplete}
        />
      )}

      <footer className="security-warning">
        비밀 키가 이 브라우저에 저장됩니다. 공용 PC에서는 사용 후 계정을 삭제하세요.
      </footer>
    </div>
  )
}

export default App
