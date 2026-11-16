import { useState, useEffect, useCallback } from 'react';
import { 
  Smartphone, 
  Trash2, 
  Plus, 
  Copy, 
  Check, 
  AlertTriangle, 
  Shield, 
  RotateCcw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { generateTOTP, getRemainingSeconds } from '../utils/totp';

export default function MobileAppSimulator({
  accounts,
  activeAccountId,
  setActiveAccountId,
  onAddManualAccount,
  onDeleteAccount,
}) {
  const [remaining, setRemaining] = useState(30);
  const [accountOtps, setAccountOtps] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 수동 계정 추가 폼 상태
  const [newIssuer, setNewIssuer] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [formError, setFormError] = useState('');

  // 활성 계정 찾기
  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;

  // 전체 계정 OTP 갱신 함수
  const refreshAllOtps = useCallback(async () => {
    const otps = {};
    for (const acc of accounts) {
      try {
        const code = await generateTOTP(acc.secret);
        otps[acc.id] = code;
      } catch (err) {
        otps[acc.id] = 'ERROR';
      }
    }
    setAccountOtps(otps);
  }, [accounts]);

  // 초 단위 타이머 인터벌
  useEffect(() => {
    const updateTick = () => {
      const rem = getRemainingSeconds(30);
      setRemaining(rem);
    };

    updateTick();
    refreshAllOtps();

    const interval = setInterval(() => {
      const rem = getRemainingSeconds(30);
      setRemaining(rem);
      // 매 주기 시작(30초) 시점 또는 1초마다 동기화
      if (rem === 30 || rem === 29) {
        refreshAllOtps();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [refreshAllOtps]);

  // 계정 목록이 바뀔 때 OTP 즉시 갱신
  useEffect(() => {
    refreshAllOtps();
  }, [accounts, refreshAllOtps]);

  // 원형 게이지 계산 (반지름 r=34 -> 둘레 ~213.63)
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - remaining / 30);
  const isExpiringSoon = remaining <= 5;

  const handleCopyOtp = async (code, id) => {
    if (!code || code === 'ERROR') return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    const cleanSec = (newSecret || '').trim().replace(/[\s=-]/g, '').toUpperCase();
    if (!newIssuer.trim()) {
      setFormError('발급자명을 입력해 주세요.');
      return;
    }
    if (!newAccountName.trim()) {
      setFormError('계정명을 입력해 주세요.');
      return;
    }
    if (!cleanSec || cleanSec.length < 8) {
      setFormError('유효한 Base32 비밀 키(8자 이상)를 입력해 주세요.');
      return;
    }
    if (!/^[A-Z2-7]+$/.test(cleanSec)) {
      setFormError('Base32는 A-Z, 2-7 문자만 허용됩니다.');
      return;
    }

    onAddManualAccount({
      issuer: newIssuer.trim(),
      account: newAccountName.trim(),
      secret: cleanSec,
    });

    setNewIssuer('');
    setNewAccountName('');
    setNewSecret('');
    setShowAddModal(false);
  };

  // 6자리 코드를 3자리씩 띄우기: "123 456"
  const formatOtp = (code) => {
    if (!code || code.length !== 6) return code || '------';
    return `${code.slice(0, 3)} ${code.slice(3, 6)}`;
  };

  return (
    <section className="panel-card authenticator-panel">
      {/* 폰 프레임 외형 */}
      <div className="phone-mockup">
        {/* 상단 스피커 & 노치 */}
        <div className="phone-notch">
          <div className="phone-speaker"></div>
          <div className="phone-camera"></div>
        </div>

        {/* 폰 상단 상태 바 */}
        <div className="phone-status-bar">
          <span className="status-time">
            {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="status-icons">
            <span className="network-pill">5G</span>
            <span className="battery-pill">100%</span>
          </div>
        </div>

        {/* 앱 헤더 */}
        <div className="phone-app-header">
          <div className="app-brand">
            <Smartphone size={20} className="app-brand-icon" />
            <div>
              <h2 className="app-name">Mobile Authenticator</h2>
              <span className="app-sub">RFC 6238 TOTP Client</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-icon-round"
            onClick={() => setShowAddModal(!showAddModal)}
            title="새 계정 직접 추가"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* 수동 계정 추가 폼 (토글) */}
        {showAddModal && (
          <div className="add-account-drawer">
            <div className="drawer-header">
              <span className="drawer-title">직접 계정 추가 (Base32)</span>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="drawer-form">
              <input
                type="text"
                className="text-input input-xs"
                placeholder="발급자 (예: GitHub, Naver)"
                value={newIssuer}
                onChange={(e) => setNewIssuer(e.target.value)}
              />
              <input
                type="text"
                className="text-input input-xs"
                placeholder="계정명 (예: user@domain.com)"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
              <input
                type="text"
                className="text-input input-xs font-mono"
                placeholder="Base32 비밀 키"
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
              />
              {formError && <p className="error-text">{formError}</p>}
              <div className="drawer-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setShowAddModal(false)}
                >
                  취소
                </button>
                <button type="submit" className="btn btn-primary btn-xs">
                  계정 등록
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 메인 활성 계정 하이라이트 카드 */}
        {activeAccount ? (
          <div className="active-otp-hero">
            <div className="active-account-info">
              <div className="active-issuer-badge">
                <Shield size={14} />
                <span>{activeAccount.issuer}</span>
              </div>
              <span className="active-account-name">{activeAccount.account}</span>
            </div>

            <div className="active-otp-display">
              <div
                className="otp-code-large"
                onClick={() => handleCopyOtp(accountOtps[activeAccount.id], activeAccount.id)}
                title="클릭하여 코드 복사"
              >
                {formatOtp(accountOtps[activeAccount.id])}
              </div>
              <button
                type="button"
                className="btn btn-copy-otp"
                onClick={() => handleCopyOtp(accountOtps[activeAccount.id], activeAccount.id)}
              >
                {copiedId === activeAccount.id ? (
                  <>
                    <Check size={14} className="text-success" /> 복사됨
                  </>
                ) : (
                  <>
                    <Copy size={14} /> 복사
                  </>
                )}
              </button>
            </div>

            {/* 원형 & 막대형 카운트다운 타이머 */}
            <div className="timer-wrapper">
              <div className="circular-timer-container">
                <svg className="timer-svg" width="80" height="80" viewBox="0 0 80 80">
                  <circle
                    className="timer-track"
                    cx="40"
                    cy="40"
                    r={radius}
                    strokeWidth="6"
                  />
                  <circle
                    className={`timer-progress ${isExpiringSoon ? 'expiring' : ''}`}
                    cx="40"
                    cy="40"
                    r={radius}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>
                <div className={`timer-number ${isExpiringSoon ? 'text-warning pulse' : ''}`}>
                  {remaining}s
                </div>
              </div>

              <div className="timer-meta">
                <div className="progress-bar-track">
                  <div
                    className={`progress-bar-fill ${isExpiringSoon ? 'bg-warning' : 'bg-accent'}`}
                    style={{ width: `${(remaining / 30) * 100}%` }}
                  ></div>
                </div>
                <div className="timer-caption">
                  {isExpiringSoon ? (
                    <span className="warning-caption">
                      <AlertTriangle size={12} /> 곧 만료됩니다 (갱신 대기)
                    </span>
                  ) : (
                    <span>30초 주기 동기화 진행 중</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-account-notice">
            <p>등록된 OTP 계정이 없습니다.</p>
            <p className="hint">좌측 서비스 서버에서 발급받거나 직접 추가하세요.</p>
          </div>
        )}

        {/* 계정 목록 (다중 계정 관리) */}
        <div className="accounts-list-container">
          <div className="accounts-list-header">
            <span className="list-title">
              등록된 계정 목록 ({accounts.length})
            </span>
            <span className="list-hint">터치 시 메인 선택</span>
          </div>

          <div className="accounts-scroll-area">
            {accounts.map((acc) => {
              const isSelected = activeAccount && activeAccount.id === acc.id;
              const currentOtp = accountOtps[acc.id] || '------';

              return (
                <div
                  key={acc.id}
                  className={`account-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setActiveAccountId(acc.id)}
                >
                  <div className="account-avatar">
                    {acc.issuer.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="account-details">
                    <div className="account-item-issuer">{acc.issuer}</div>
                    <div className="account-item-name">{acc.account}</div>
                  </div>

                  <div className="account-item-otp-group">
                    <span className="account-mini-otp">
                      {formatOtp(currentOtp)}
                    </span>
                    <button
                      type="button"
                      className="btn-icon-xs delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAccount(acc.id);
                      }}
                      title="계정 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 모바일 하단 홈 인디케이터 바 */}
        <div className="phone-home-indicator"></div>
      </div>
    </section>
  );
}

