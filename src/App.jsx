import { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  Cpu,
  Lock,
  Clock
} from 'lucide-react';
import ServiceSimulator from './components/ServiceSimulator';
import MobileAuthenticator from './components/MobileAuthenticator';
import SecurityInspector from './components/SecurityInspector';
import './App.css';

// 기본 데모 계정들
const DEFAULT_ACCOUNTS = [
  {
    id: 'kopo-default-1',
    issuer: 'GitHub',
    account: 'developer@github.com',
    secret: 'JBSWY3DPEHPK3PXP',
    color: '#2ea44f'
  },
  {
    id: 'kopo-default-2',
    issuer: 'Google',
    account: 'cybersec@gmail.com',
    secret: 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ',
    color: '#4285f4'
  },
  {
    id: 'kopo-default-3',
    issuer: 'Naver',
    account: 'student@naver.com',
    secret: 'NVRSECUREOTP2026BASE32KEYDEMO99',
    color: '#03c75a'
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'authenticator' | 'inspector'
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // 전역 계정 상태 (로컬스토리지 동기화)
  const [accounts, setAccounts] = useState(() => {
    try {
      const saved = localStorage.getItem('kopo_otp_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ACCOUNTS;
  });

  // 로컬스토리지 저장
  useEffect(() => {
    try {
      localStorage.setItem('kopo_otp_accounts', JSON.stringify(accounts));
    } catch (err) {
      console.error('Failed to save accounts to localStorage:', err);
    }
  }, [accounts]);

  // 실시간 시계
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 서비스 등록 -> 인증기 탭으로 전송 및 추가
  const handleRegisterToAuthenticator = (accountData) => {
    const existing = accounts.find((a) => a.secret === accountData.secret);
    if (!existing) {
      const newAcc = {
        id: `acc-${Date.now()}`,
        issuer: accountData.issuer || '서비스',
        account: accountData.account || '계정',
        secret: accountData.secret,
        color: '#6366f1'
      };
      setAccounts((prev) => [newAcc, ...prev]);
    }
    setActiveTab('authenticator');
  };

  return (
    <div className="app-layout">
      {/* 글로벌 탑바 */}
      <header className="topbar">
        <div className="topbar-container">
          <div className="brand-group">
            <div className="brand-logo">
              <ShieldCheck size={22} className="brand-icon" />
            </div>
            <div>
              <h1 className="brand-title">KOPO CyberSec Mobile OTP</h1>
              <p className="brand-subtitle">
                RFC 6238 TOTP 2단계 인증 & 모바일 인증기 스튜디오
              </p>
            </div>
          </div>

          <div className="topbar-info">
            <div className="clock-badge">
              <Clock size={14} className="text-primary" />
              <span className="font-mono text-xs">
                {currentTime.toLocaleTimeString('ko-KR')} (KST)
              </span>
            </div>
            <span className="badge badge-zero-tx">
              <Lock size={12} /> Zero-Transmission
            </span>
          </div>
        </div>
      </header>

      {/* 네비게이션 탭 */}
      <nav className="tab-nav">
        <div className="tab-nav-container">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <ShieldCheck size={18} />
            <span>2FA 서비스 & QR 시뮬레이터</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'authenticator' ? 'active' : ''}`}
            onClick={() => setActiveTab('authenticator')}
          >
            <Smartphone size={18} />
            <span>내 모바일 인증기 (OTP 앱)</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
            onClick={() => setActiveTab('inspector')}
          >
            <Cpu size={18} />
            <span>보안 원리 & RFC 6238 검증기</span>
          </button>
        </div>
      </nav>

      {/* 본문 콘텐츠 */}
      <main className="main-content">
        {activeTab === 'simulator' && (
          <ServiceSimulator
            onRegisterToAuthenticator={handleRegisterToAuthenticator}
          />
        )}

        {activeTab === 'authenticator' && (
          <MobileAuthenticator
            accounts={accounts}
            setAccounts={setAccounts}
            onResetDefaults={() => setAccounts(DEFAULT_ACCOUNTS)}
          />
        )}

        {activeTab === 'inspector' && <SecurityInspector />}
      </main>

      {/* 푸터 */}
      <footer className="footer">
        <div className="footer-container">
          <p className="text-xs text-muted">
            한국폴리텍대학 서울강서캠퍼스 사이버보안과 | 26-w11-mobile-otp
          </p>
          <div className="flex-center gap-3 text-xs text-muted">
            <span>RFC 6238 (TOTP)</span>
            <span>•</span>
            <span>Web Crypto API (HMAC-SHA1)</span>
            <span>•</span>
            <span>Zero-Transmission Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
