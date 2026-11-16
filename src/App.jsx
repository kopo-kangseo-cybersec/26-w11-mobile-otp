import { useState } from 'react'
import { KeyRound, Plus, ShieldCheck } from 'lucide-react'
import AddModal from './components/AddModal.jsx'
import AccountCard from './components/AccountCard.jsx'
import './App.css'

function App() {
  const [accounts, setAccounts] = useState([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  function handleAccountComplete(account) {
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
    </div>
  )
}

export default App
