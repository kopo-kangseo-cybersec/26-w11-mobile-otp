import { useState, useCallback } from 'react';
import ServiceVerifier from './components/ServiceVerifier';
import MobileAuthenticator from './components/MobileAuthenticator';
import SecurityNotice from './components/SecurityNotice';
import { generateBase32Secret } from './utils/totp';
import { ShieldCheck, Lock, Sparkles } from 'lucide-react';
import './App.css';

function App() {
  const [issuer, setIssuer] = useState('KopoCyberSec');
  const [account, setAccount] = useState('student@kopo.ac.kr');
  // 최초 로드 시 안전한 Base32 비밀키 1회 지연 초기화
  const [secret, setSecret] = useState(() => {
    try {
      return generateBase32Secret();
    } catch (err) {
      console.error('초기 비밀키 생성 실패:', err);
      return '';
    }
  });
  const [verificationInput, setVerificationInput] = useState('');

  // 새 비밀키 발급 핸들러
  const handleGenerateNewSecret = useCallback(() => {
    try {
      const newSecret = generateBase32Secret();
      setSecret(newSecret);
      setVerificationInput(''); // 이전 입력값 초기화
    } catch (err) {
      alert('비밀키 생성 중 오류가 발생했습니다: ' + err.message);
    }
  }, []);

  // 오른쪽 모바일 인증기의 OTP 번호를 왼쪽 검증기 입력창에 자동 입력
  const handleFillVerificationInput = useCallback((otp) => {
    setVerificationInput(otp);
  }, []);

  return (
    <div className="studio-container">
      {/* 글로벌 상단 헤더 */}
      <header className="studio-header">
        <div className="header-brand">
          <div className="brand-logo">
            <Lock size={22} className="logo-icon" />
          </div>
          <div>
            <h1 className="brand-title">모바일 OTP 체험 스튜디오</h1>
            <p className="brand-subtitle">RFC 6238 TOTP (Time-Based One-Time Password) Simulation Studio</p>
          </div>
        </div>

        <div className="header-badges">
          <div className="security-status-badge">
            <ShieldCheck size={16} className="badge-icon" />
            <span>Zero-Transmission (Local Only)</span>
          </div>
          <div className="tech-badge">
            <Sparkles size={14} />
            <span>Web Crypto API &bull; SHA-1</span>
          </div>
        </div>
      </header>

      {/* 메인 2분할 스튜디오 대시보드 (좌: 서비스 검증기 / 우: 모바일 인증기) */}
      <main className="studio-main-grid">
        <section className="studio-column left-column">
          <ServiceVerifier
            issuer={issuer}
            setIssuer={setIssuer}
            account={account}
            setAccount={setAccount}
            secret={secret}
            onGenerateNewSecret={handleGenerateNewSecret}
            verificationInput={verificationInput}
            setVerificationInput={setVerificationInput}
          />
        </section>

        <section className="studio-column right-column">
          <MobileAuthenticator
            secret={secret}
            issuer={issuer}
            account={account}
            onFillVerificationInput={handleFillVerificationInput}
          />
        </section>
      </main>

      {/* 하단 사이버보안 원리 & Zero-Transmission 가이드 */}
      <footer className="studio-footer">
        <SecurityNotice />
        <div className="footer-credits">
          한국폴리텍대학 강서캠퍼스 사이버보안과 &bull; 모바일 OTP 체험 스튜디오 (RFC 6238)
        </div>
      </footer>
    </div>
  );
}

export default App;
