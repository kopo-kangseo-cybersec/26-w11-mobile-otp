import { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Plus,
  Trash2,
  Copy,
  Check,
  Shield,
  Key,
  RotateCcw
} from 'lucide-react';
import {
  generateTOTP,
  getRemainingSeconds,
  generateBase32Secret
} from '../utils/totp';

export default function MobileAuthenticator({ accounts, setAccounts, onResetDefaults }) {
  const [otpCodes, setOtpCodes] = useState({});
  const [remainingTime, setRemainingTime] = useState(() => getRemainingSeconds());
  const [copiedId, setCopiedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 새 계정 추가 폼 상태
  const [newIssuer, setNewIssuer] = useState('');
  const [newAccount, setNewAccount] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [formError, setFormError] = useState('');

  // 실시간 30초 주기 TOTP 계산 및 1초 타이머
  useEffect(() => {
    let isMounted = true;

    const refreshCodes = async () => {
      const rem = getRemainingSeconds();
      if (isMounted) setRemainingTime(rem);

      const newCodes = {};
      for (const acc of accounts) {
        try {
          const code = await generateTOTP(acc.secret);
          newCodes[acc.id] = code;
        } catch {
          newCodes[acc.id] = 'ERROR!';
        }
      }
      if (isMounted) setOtpCodes(newCodes);
    };

    refreshCodes();
    const interval = setInterval(refreshCodes, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [accounts]);

  // 클립보드 복사
  const handleCopyCode = async (id, code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // fallback
    }
  };

  // 계정 삭제
  const handleDeleteAccount = (id) => {
    if (window.confirm('이 OTP 계정을 인증기에서 삭제하시겠습니까?')) {
      setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    }
  };

  // 기본 계정 복구
  const handleResetDefaults = () => {
    if (window.confirm('기본 데모 계정 목록으로 초기화하시겠습니까?')) {
      onResetDefaults();
    }
  };

  // 새 계정 등록 제출
  const handleAddSubmit = (e) => {
    e.preventDefault();
    const cleanSecret = newSecret.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanSecret) {
      setFormError('Base32 비밀 키를 입력하세요.');
      return;
    }
    if (!/^[A-Z2-7]+=*$/.test(cleanSecret)) {
      setFormError('Base32 형식이 올바르지 않습니다 (A-Z, 2-7 문자만 가능).');
      return;
    }

    const newAcc = {
      id: `acc-${Date.now()}`,
      issuer: newIssuer.trim() || 'Custom OTP',
      account: newAccount.trim() || 'user',
      secret: cleanSecret,
      color: '#3b82f6'
    };

    setAccounts((prev) => [newAcc, ...prev]);
    setShowAddModal(false);
    setNewIssuer('');
    setNewAccount('');
    setNewSecret('');
    setFormError('');
  };

  // 원형 진행도 계산 (30초 기준)
  const progressPercent = useMemo(() => {
    return ((30 - remainingTime) / 30) * 100;
  }, [remainingTime]);

  const isTimeExpiring = remainingTime <= 5;

  return (
    <div className="mobile-authenticator-container">
      {/* 모바일 폰 셸 UI */}
      <div className="phone-mockup">
        {/* 스마트폰 상단 스피커 & 노치 */}
        <div className="phone-notch">
          <div className="notch-speaker"></div>
          <div className="notch-camera"></div>
        </div>

        {/* 폰 헤더 */}
        <div className="phone-header">
          <div className="phone-title-row">
            <div className="flex-center gap-2">
              <Smartphone size={20} className="text-primary" />
              <h3 className="phone-title">내 모바일 인증기</h3>
            </div>
            <div className="flex-center gap-1">
              <button
                type="button"
                className="btn-icon"
                onClick={handleResetDefaults}
                title="기본 데모 계정 복원"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                className="btn-icon btn-add"
                onClick={() => setShowAddModal(true)}
                title="새 계정 추가"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* 전역 동기화 타이머 바 */}
          <div className="timer-status-bar">
            <div className="flex-between text-xs text-muted mb-1">
              <span className="flex-center gap-1">
                <Shield size={12} className="text-success" />
                Zero-Transmission 암호화
              </span>
              <span className={`font-mono font-bold ${isTimeExpiring ? 'text-danger' : 'text-primary'}`}>
                {remainingTime}초 후 번호 갱신
              </span>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill ${isTimeExpiring ? 'fill-warning' : ''}`}
                style={{ width: `${100 - progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* OTP 계정 카드 목록 */}
        <div className="phone-body">
          {accounts.length === 0 ? (
            <div className="empty-state">
              <Key size={32} className="text-muted mb-2" />
              <p>등록된 OTP 계정이 없습니다.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm mt-2"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={14} /> 첫 계정 등록하기
              </button>
            </div>
          ) : (
            <div className="account-list">
              {accounts.map((acc) => {
                const code = otpCodes[acc.id] || '------';
                const formattedCode =
                  code.length === 6
                    ? `${code.substring(0, 3)} ${code.substring(3, 6)}`
                    : code;
                const isCopied = copiedId === acc.id;

                return (
                  <div key={acc.id} className="otp-card">
                    <div className="otp-card-top">
                      <div className="account-info">
                        <span className="issuer-name">{acc.issuer}</span>
                        <span className="account-email">{acc.account}</span>
                      </div>
                      <div className="otp-card-actions">
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleDeleteAccount(acc.id)}
                          title="계정 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="otp-card-bottom">
                      <div
                        className="otp-digits-wrapper"
                        onClick={() => handleCopyCode(acc.id, code)}
                        title="클릭하여 복사"
                      >
                        <span className={`otp-code-text ${isTimeExpiring ? 'text-pulsing' : ''}`}>
                          {formattedCode}
                        </span>
                        <span className="copy-indicator">
                          {isCopied ? (
                            <span className="copied-badge">
                              <Check size={12} /> 복사됨!
                            </span>
                          ) : (
                            <Copy size={14} className="text-muted" />
                          )}
                        </span>
                      </div>

                      {/* 개별 원형 미니 타이머 */}
                      <div className="circular-timer-wrapper" title={`${remainingTime}초 남음`}>
                        <svg className="circular-timer-svg" viewBox="0 0 36 36">
                          <path
                            className="circle-bg"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className={`circle-progress ${isTimeExpiring ? 'circle-danger' : ''}`}
                            strokeDasharray={`${(remainingTime / 30) * 100}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className={`circle-seconds ${isTimeExpiring ? 'text-danger' : ''}`}>
                          {remainingTime}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 폰 하단 홈 바 */}
        <div className="phone-home-indicator"></div>
      </div>

      {/* 새 계정 추가 모달 다이얼로그 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>새 OTP 계정 직접 추가</h4>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="modal-form">
              <div className="form-group">
                <label>발급자 (서비스명)</label>
                <input
                  type="text"
                  placeholder="예: AWS, GitHub, MyService"
                  value={newIssuer}
                  onChange={(e) => setNewIssuer(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div className="form-group">
                <label>계정명 (이메일/아이디)</label>
                <input
                  type="text"
                  placeholder="예: user@example.com"
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div className="form-group">
                <div className="flex-between">
                  <label>Base32 비밀 키</label>
                  <button
                    type="button"
                    className="link-btn text-xs"
                    onClick={() => setNewSecret(generateBase32Secret(32))}
                  >
                    랜덤 키 생성
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="예: JBSWY3DPEHPK3PXP"
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value.toUpperCase())}
                  className="input-field font-mono"
                  required
                />
              </div>

              {formError && <div className="text-danger text-xs mb-2">{formError}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  계정 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
