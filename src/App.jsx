import { useState, useEffect } from 'react';
import { Shield, Sparkles, Terminal, CheckCircle2 } from 'lucide-react';
import ServerSimulator from './components/ServerSimulator';
import MobileAppSimulator from './components/MobileAppSimulator';
import SecurityBadge from './components/SecurityBadge';
import { generateSecret } from './utils/totp';
import './App.css';

export default function App() {
  const [issuer, setIssuer] = useState('KOPO-Security');
  const [account, setAccount] = useState('student@kopo.ac.kr');
  const [secret, setSecret] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [activeAccountId, setActiveAccountId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notification, setNotification] = useState(null);

  // 초기 비밀 키 및 기본 계정 설정
  useEffect(() => {
    try {
      const initialSecret = generateSecret(20);
      const demoGitHubSecret = generateSecret(20);
      setSecret(initialSecret);

      const defaultAccounts = [
        {
          id: 'kopo-main',
          issuer: 'KOPO-Security',
          account: 'student@kopo.ac.kr',
          secret: initialSecret,
        },
        {
          id: 'demo-github',
          issuer: 'GitHub',
          account: 'octocat@github.com',
          secret: demoGitHubSecret,
        },
      ];

      setAccounts(defaultAccounts);
      setActiveAccountId('kopo-main');
    } catch (err) {
      console.error('초기 키 생성 실패:', err);
    }
  }, []);

  // 1초마다 현재 시각 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (message) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 2800);
  };

  // 좌측에서 새 비밀 키 발급
  const handleGenerateNewSecret = () => {
    const newSec = generateSecret(20);
    setSecret(newSec);
    showToast('새 160-bit Base32 비밀 키가 발급되었습니다.');
  };

  // 좌측 키를 우측 가상 인증기에 등록/동기화
  const handleAddToAuthenticator = () => {
    setAccounts((prev) => {
      const existingIdx = prev.findIndex(
        (a) => a.issuer.toLowerCase() === issuer.trim().toLowerCase() && 
               a.account.toLowerCase() === account.trim().toLowerCase()
      );

      if (existingIdx !== -1) {
        // 기존 계정의 비밀 키 갱신
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          secret: secret,
        };
        setActiveAccountId(updated[existingIdx].id);
        return updated;
      }

      // 새 계정 추가
      const newAcc = {
        id: `acc-${Date.now()}`,
        issuer: issuer.trim() || 'KOPO-Security',
        account: account.trim() || 'student@kopo.ac.kr',
        secret: secret,
      };
      setActiveAccountId(newAcc.id);
      return [newAcc, ...prev];
    });

    showToast(`가상 인증기에 [${issuer}] 계정이 등록되었습니다.`);
  };

  // 우측 인증기에서 수동 계정 추가
  const handleAddManualAccount = (accData) => {
    const newAcc = {
      id: `acc-${Date.now()}`,
      issuer: accData.issuer,
      account: accData.account,
      secret: accData.secret,
    };
    setAccounts((prev) => [newAcc, ...prev]);
    setActiveAccountId(newAcc.id);
    showToast(`새 계정 [${accData.issuer}]이(가) 추가되었습니다.`);
  };

  // 우측 인증기에서 계정 삭제
  const handleDeleteAccount = (idToDelete) => {
    setAccounts((prev) => {
      const filtered = prev.filter((a) => a.id !== idToDelete);
      if (activeAccountId === idToDelete && filtered.length > 0) {
        setActiveAccountId(filtered[0].id);
      }
      return filtered;
    });
    showToast('계정이 가상 인증기에서 삭제되었습니다.');
  };

  const unixEpoch = Math.floor(currentTime.getTime() / 1000);
  const currentStep = Math.floor(unixEpoch / 30);

  return (
    <div className="app-container">
      {/* 토스트 알림 */}
      {notification && (
        <div className="toast-notification">
          <CheckCircle2 size={16} className="text-success" />
          <span>{notification}</span>
        </div>
      )}

      {/* 헤더 섹션 */}
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-badge">
            <Shield size={24} className="logo-icon" />
          </div>
          <div>
            <h1 className="header-title">모바일 OTP (TOTP) 체험 스튜디오</h1>
            <p className="header-subtitle">
              RFC 6238 & RFC 4648 표준 기반 2단계 인증(2FA) 양방향 대시보드
            </p>
          </div>
        </div>

        {/* 시스템 동기화 상태 메타 바 */}
        <div className="header-meta">
          <div className="time-badge">
            <span className="live-dot"></span>
            <span className="time-label">시스템 시각:</span>
            <span className="time-val">
              {currentTime.toLocaleTimeString('ko-KR', { hour12: false })}
            </span>
          </div>
          <div className="counter-badge">
            <span className="counter-label">카운터 (T):</span>
            <span className="counter-val font-mono">{currentStep}</span>
          </div>
          <div className="crypto-badge">
            <Sparkles size={14} className="text-accent" />
            <span>Web Crypto Zero-Transmission</span>
          </div>
        </div>
      </header>

      {/* 2단 분할 대시보드 (반응형: 데스크톱 좌우 분할, 모바일 상하 분할) */}
      <main className="dashboard-grid">
        <ServerSimulator
          issuer={issuer}
          setIssuer={setIssuer}
          account={account}
          setAccount={setAccount}
          secret={secret}
          onGenerateNewSecret={handleGenerateNewSecret}
          onAddToAuthenticator={handleAddToAuthenticator}
        />

        <MobileAppSimulator
          accounts={accounts}
          activeAccountId={activeAccountId}
          setActiveAccountId={setActiveAccountId}
          onAddManualAccount={handleAddManualAccount}
          onDeleteAccount={handleDeleteAccount}
        />
      </main>

      {/* 사이버보안 가이드 & 보안 안내 배지 */}
      <SecurityBadge />
    </div>
  );
}
