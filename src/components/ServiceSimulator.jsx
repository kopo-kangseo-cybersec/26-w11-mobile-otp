import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  KeyRound,
  QrCode,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
  ArrowRight,
  LogOut,
  FileKey
} from 'lucide-react';
import {
  generateBase32Secret,
  generateOtpAuthUri,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  getRemainingSeconds
} from '../utils/totp';

export default function ServiceSimulator({ onRegisterToAuthenticator }) {
  // 계정 및 발급자 설정
  const [issuer, setIssuer] = useState('KOPO-CyberSec');
  const [account, setAccount] = useState('student@kopo.ac.kr');
  const [secret, setSecret] = useState(() => generateBase32Secret(32));
  const [backupCodes, setBackupCodes] = useState(() => generateBackupCodes(5));
  const [usedBackupCodes, setUsedBackupCodes] = useState([]);

  // 사용자 입력 OTP 및 상태
  const [inputCode, setInputCode] = useState('');
  const [useBackupMode, setUseBackupMode] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null); // null | { valid: boolean, message: string }
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionToken, setSessionToken] = useState('');

  // 옵션 및 모니터링
  const [allowTimeWindow, setAllowTimeWindow] = useState(true); // ±30초 허용
  const [showExpectedOTP, setShowExpectedOTP] = useState(true);
  const [expectedOTP, setExpectedOTP] = useState('000000');
  const [remainingTime, setRemainingTime] = useState(() => getRemainingSeconds());
  const [copiedKey, setCopiedKey] = useState(false);

  // 실시간 예상 OTP 및 타이머 갱신
  useEffect(() => {
    let isMounted = true;
    const updateOTP = async () => {
      if (!secret) return;
      try {
        const otp = await generateTOTP(secret);
        if (isMounted) {
          setExpectedOTP(otp);
          setRemainingTime(getRemainingSeconds());
        }
      } catch (err) {
        console.error('Error generating expected OTP:', err);
      }
    };

    updateOTP();
    const interval = setInterval(updateOTP, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [secret]);

  // 새 비밀 키 생성
  const handleRegenerateSecret = () => {
    const newSecret = generateBase32Secret(32);
    setSecret(newSecret);
    setBackupCodes(generateBackupCodes(5));
    setUsedBackupCodes([]);
    setVerificationResult(null);
    setInputCode('');
  };

  // 키 클립보드 복사
  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // fallback
    }
  };

  // OTP 인증 수행
  const handleVerify = async (e) => {
    e?.preventDefault();
    if (useBackupMode) {
      // 백업 코드 검증
      const cleanInput = inputCode.trim().toUpperCase();
      if (usedBackupCodes.includes(cleanInput)) {
        setVerificationResult({ valid: false, message: '이미 사용된 1회용 백업 복구 코드입니다.' });
        return;
      }
      if (backupCodes.includes(cleanInput)) {
        setUsedBackupCodes((prev) => [...prev, cleanInput]);
        setVerificationResult({ valid: true, message: '1회용 백업 복구 코드로 긴급 인증되었습니다!' });
        setSessionToken(`SEC-2FA-${Date.now().toString(36).toUpperCase()}-OK`);
        setIsLoggedIn(true);
      } else {
        setVerificationResult({ valid: false, message: '유효하지 않은 백업 복구 코드입니다. 형식을 확인하세요.' });
      }
      return;
    }

    // TOTP 코드 검증
    const windowStep = allowTimeWindow ? 1 : 0;
    const result = await verifyTOTP(inputCode, secret, windowStep);

    if (result.valid) {
      const deltaMsg =
        result.delta === 0
          ? '현재 시간대와 완벽하게 일치합니다.'
          : result.delta > 0
          ? '이전 30초 시간대(지연)로 정상 인증되었습니다.'
          : '다음 30초 시간대(선행)로 정상 인증되었습니다.';
      setVerificationResult({
        valid: true,
        message: `인증 성공! (RFC 6238 검증 완료 - ${deltaMsg})`
      });
      setSessionToken(`SEC-2FA-${Date.now().toString(36).toUpperCase()}-OK`);
      setIsLoggedIn(true);
    } else {
      setVerificationResult({
        valid: false,
        message: '인증 실패! 6자리 OTP 번호가 일치하지 않습니다. 시계 또는 키를 확인하세요.'
      });
    }
  };

  const otpAuthUri = generateOtpAuthUri(issuer, account, secret);

  return (
    <div className="simulator-grid">
      {/* 좌측: 서비스 2FA 등록 패널 */}
      <div className="card panel">
        <div className="card-header">
          <div className="card-title-group">
            <span className="badge badge-primary">Step 1</span>
            <h3>2단계 인증(2FA) 등록 & QR 발급</h3>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRegenerateSecret}
            title="새 암호학적 난수 키 생성"
          >
            <RefreshCw size={14} /> 키 재발급
          </button>
        </div>

        <p className="card-desc">
          스마트폰의 <strong>Google Authenticator</strong> 또는 <strong>2FAS</strong> 앱을 열고 아래 QR 코드를 스캔하세요.
        </p>

        {/* 계정 정보 폼 */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="service-issuer">발급자 (서비스명)</label>
            <input
              id="service-issuer"
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className="input-field"
              placeholder="예: KOPO-CyberSec"
            />
          </div>
          <div className="form-group">
            <label htmlFor="service-account">사용자 계정명</label>
            <input
              id="service-account"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="input-field"
              placeholder="예: student@kopo.ac.kr"
            />
          </div>
        </div>

        {/* QR 코드 및 비밀키 표시 영역 */}
        <div className="qr-section">
          <div className="qr-wrapper">
            <QRCodeSVG
              value={otpAuthUri}
              size={176}
              level="M"
              includeMargin={true}
              className="qr-code"
            />
            <div className="qr-scan-badge">
              <QrCode size={14} /> 스마트폰 스캔
            </div>
          </div>

          <div className="key-details">
            <label className="field-label">Base32 비밀 키 (수동 입력용)</label>
            <div className="secret-box">
              <code>{secret}</code>
              <button
                type="button"
                className="btn-icon"
                onClick={handleCopySecret}
                title="비밀키 복사"
              >
                {copiedKey ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="helper-text">
              <Sparkles size={13} className="text-warning" /> <code>crypto.getRandomValues()</code>로 안전하게 생성된 160비트 암호화 난수입니다.
            </p>

            {onRegisterToAuthenticator && (
              <button
                type="button"
                className="btn btn-outline btn-sm full-width mt-2"
                onClick={() => onRegisterToAuthenticator({ issuer, account, secret })}
              >
                <ArrowRight size={14} /> 내 모바일 인증기 탭에 자동 추가하기
              </button>
            )}
          </div>
        </div>

        {/* 1회용 백업 복구 코드 안내 */}
        <div className="backup-section">
          <div className="backup-header">
            <span className="flex-center gap-1 font-semibold text-sm">
              <FileKey size={15} /> 1회용 비상 복구 코드 (Backup Codes)
            </span>
            <span className="text-xs text-muted">기기 분실 시 사용</span>
          </div>
          <div className="backup-codes-grid">
            {backupCodes.map((code) => {
              const isUsed = usedBackupCodes.includes(code);
              return (
                <span
                  key={code}
                  className={`backup-code-pill ${isUsed ? 'used' : ''}`}
                >
                  {code} {isUsed && '(사용됨)'}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* 우측: 2FA 인증 로그인 시뮬레이터 */}
      <div className="card panel">
        <div className="card-header">
          <div className="card-title-group">
            <span className="badge badge-success">Step 2</span>
            <h3>2단계 인증 로그인 시뮬레이터</h3>
          </div>
          <span className="security-tag">
            <ShieldCheck size={14} /> Web Crypto API
          </span>
        </div>

        {isLoggedIn ? (
          <div className="login-success-box">
            <div className="success-icon-wrapper">
              <ShieldCheck size={48} className="text-success" />
            </div>
            <h4>보안 2단계 인증 성공!</h4>
            <p className="text-sm text-muted">
              <strong>{account}</strong> 계정으로 안전하게 로그인 세션이 생성되었습니다.
            </p>
            <div className="session-token-box">
              <span className="text-xs font-mono text-muted">Zero-Trust Session Token:</span>
              <code className="session-token">
                {sessionToken}
              </code>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm mt-3"
              onClick={() => {
                setIsLoggedIn(false);
                setInputCode('');
                setVerificationResult(null);
                setSessionToken('');
              }}
            >
              <LogOut size={14} /> 다시 로그인 테스트
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="verify-form">
            <p className="card-desc">
              스마트폰 Authenticator 앱에 나타난 <strong>6자리 일회용 비밀번호(TOTP)</strong>를 입력하여 신원을 증명하세요.
            </p>

            {/* 입력 폼 */}
            <div className="form-group">
              <div className="flex-between mb-1">
                <label htmlFor="otp-input" className="font-semibold text-sm">
                  {useBackupMode ? '8자리 백업 복구 코드 입력' : '6자리 TOTP 인증 코드'}
                </label>
                <button
                  type="button"
                  className="link-btn text-xs"
                  onClick={() => {
                    setUseBackupMode(!useBackupMode);
                    setInputCode('');
                    setVerificationResult(null);
                  }}
                >
                  {useBackupMode ? 'OTP 번호로 인증하기' : '스마트폰을 분실했나요? (백업 코드 사용)'}
                </button>
              </div>

              <div className="otp-input-wrapper">
                <KeyRound size={20} className="input-icon" />
                <input
                  id="otp-input"
                  type="text"
                  maxLength={useBackupMode ? 9 : 6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder={useBackupMode ? '예: A1B2-C3D4' : '6자리 숫자 (예: 123456)'}
                  className="input-field otp-input"
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            {/* 인증 버튼 */}
            <button
              type="submit"
              className="btn btn-primary full-width mt-1"
              disabled={!inputCode.trim()}
            >
              <ShieldCheck size={16} /> 2단계 인증 승인
            </button>

            {/* 인증 결과 알림 */}
            {verificationResult && (
              <div
                className={`alert-banner ${
                  verificationResult.valid ? 'alert-success' : 'alert-danger'
                }`}
              >
                {verificationResult.valid ? (
                  <ShieldCheck size={18} />
                ) : (
                  <ShieldAlert size={18} />
                )}
                <span>{verificationResult.message}</span>
              </div>
            )}

            {/* 실시간 힌트 & 시간 오차 허용 옵션 */}
            <div className="options-card">
              <div className="option-row">
                <span className="text-xs font-semibold">±30초 시간 오차(Drift) 허용</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={allowTimeWindow}
                    onChange={(e) => setAllowTimeWindow(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="expected-otp-row">
                <div className="flex-center gap-1 text-xs text-muted">
                  <Clock size={13} />
                  <span>실시간 예상 번호 (테스트용):</span>
                </div>
                <div className="flex-center gap-2">
                  <span className="expected-otp-code">
                    {showExpectedOTP ? expectedOTP : '••••••'}
                  </span>
                  <span className="badge badge-timer">
                    {remainingTime}초 남음
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowExpectedOTP(!showExpectedOTP)}
                    title={showExpectedOTP ? '예상 번호 가리기' : '예상 번호 보기'}
                  >
                    {showExpectedOTP ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
