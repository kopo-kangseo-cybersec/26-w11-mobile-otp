import { useState, useEffect } from 'react';
import { 
  Smartphone, 
  WifiOff, 
  Battery, 
  Clock, 
  ArrowLeftRight, 
  CheckCircle2, 
  ShieldAlert 
} from 'lucide-react';
import { generateTOTP, getRemainingSeconds } from '../utils/totp';

export default function MobileAuthenticator({
  secret = '',
  issuer = 'KopoCyberSec',
  account = 'student@kopo.ac.kr',
  onFillVerificationInput
}) {
  const [otpCode, setOtpCode] = useState('------');
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [deviceTime, setDeviceTime] = useState('');
  const [hasCopiedToVerifier, setHasCopiedToVerifier] = useState(false);
  const [calcError, setCalcError] = useState(null);

  // 1초 주기로 시간 및 OTP 코드 갱신
  useEffect(() => {
    let isMounted = true;

    const updateOtpAndTimer = async () => {
      const now = new Date();
      if (!isMounted) return;

      // 1) 기기 현재 시각 포맷 (HH:MM)
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setDeviceTime(`${hours}:${minutes}`);

      // 2) 30초 카운트다운 남은 초
      const remaining = getRemainingSeconds(30);
      setRemainingSeconds(remaining);

      // 3) TOTP 6자리 계산 (RFC 6238)
      if (!secret) {
        if (isMounted) setOtpCode('------');
        return;
      }

      try {
        const code = await generateTOTP(secret, now.getTime(), 30);
        if (isMounted) {
          setOtpCode(code);
          setCalcError(null);
        }
      } catch (err) {
        if (isMounted) {
          setCalcError(err.message || 'OTP 계산 오류');
          setOtpCode('ERROR');
        }
      }
    };

    // 즉시 1회 실행
    updateOtpAndTimer();

    // 1초마다 반복
    const timerId = setInterval(updateOtpAndTimer, 1000);

    return () => {
      isMounted = false;
      clearInterval(timerId);
    };
  }, [secret]);

  // 3자리씩 띄어쓰기 포맷팅 (예: "123 456")
  const formattedOtp = otpCode && otpCode.length === 6 
    ? `${otpCode.substring(0, 3)} ${otpCode.substring(3, 6)}` 
    : (otpCode || '------');

  // 검증기 입력창으로 바로 채워넣는 편의 버튼
  const handleAutoFill = () => {
    if (otpCode && otpCode.length === 6 && otpCode !== 'ERROR' && typeof onFillVerificationInput === 'function') {
      onFillVerificationInput(otpCode);
      setHasCopiedToVerifier(true);
      setTimeout(() => setHasCopiedToVerifier(false), 2000);
    }
  };

  // 진행도 비율 계산 (30초 -> 100%, 0초 -> 0%)
  const progressPercent = (remainingSeconds / 30) * 100;
  const isExpiringSoon = remainingSeconds <= 5;

  return (
    <div className="card mobile-authenticator-card">
      <div className="card-header">
        <div className="badge badge-accent">Virtual Client</div>
        <h2>내장 모바일 웹 인증기</h2>
        <p className="card-desc">
          스마트폰 Authenticator 앱 화면을 브라우저에 가상으로 재현한 실시간 미리보기입니다.
        </p>
      </div>

      {/* 스마트폰 목업 프레임 */}
      <div className="phone-device-mockup">
        {/* 상단 다이나믹 아일랜드 / 스피커 바 */}
        <div className="phone-notch">
          <div className="camera-lens"></div>
        </div>

        {/* 폰 상단 상태바 */}
        <div className="phone-status-bar">
          <span className="phone-clock">{deviceTime || '12:00'}</span>
          <div className="phone-status-icons">
            <span className="offline-pill" title="오프라인 모드: 인터넷 통신 없이 동작합니다">
              <WifiOff size={13} /> NO-NET
            </span>
            <Battery size={16} />
          </div>
        </div>

        {/* 폰 내부 화면 본문 */}
        <div className="phone-screen-content">
          <div className="authenticator-app-bar">
            <Smartphone size={20} className="app-icon" />
            <span className="app-title">Web Authenticator</span>
          </div>

          <div className="otp-account-card">
            <div className="account-meta">
              <span className="issuer-tag">{issuer || '발급자 미지정'}</span>
              <span className="account-name">{account || '계정 미지정'}</span>
            </div>

            {/* 실시간 6자리 OTP 표시 */}
            <div className={`otp-digits-wrapper ${isExpiringSoon ? 'expiring' : ''}`}>
              {calcError ? (
                <div className="otp-error-box">
                  <ShieldAlert size={20} />
                  <span>{calcError}</span>
                </div>
              ) : (
                <span className="otp-digits-text" title="현재 유효한 6자리 코드">
                  {formattedOtp}
                </span>
              )}
            </div>

            {/* 30초 카운트다운 게이지 및 남은 시간 표시 */}
            <div className="timer-section">
              <div className="timer-info-row">
                <span className="timer-label">
                  <Clock size={14} /> 유효 시간
                </span>
                <span className={`timer-seconds ${isExpiringSoon ? 'text-danger' : ''}`}>
                  <strong>{remainingSeconds}</strong> 초 남음
                </span>
              </div>

              {/* 진행도 프로그레스 바 */}
              <div className="progress-track">
                <div 
                  className={`progress-fill ${isExpiringSoon ? 'fill-danger' : ''}`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* 편리한 검증기 붙여넣기 인터랙션 */}
            <button
              type="button"
              className={`btn btn-copy-otp ${hasCopiedToVerifier ? 'copied-done' : ''}`}
              onClick={handleAutoFill}
              disabled={(otpCode || '').length !== 6 || otpCode === 'ERROR'}
            >
              {hasCopiedToVerifier ? (
                <>
                  <CheckCircle2 size={16} /> 검증기에 복사 완료!
                </>
              ) : (
                <>
                  <ArrowLeftRight size={16} /> 이 번호를 검증기 입력칸에 채우기
                </>
              )}
            </button>
          </div>

          {/* 오프라인 무전송 안내 배너 */}
          <div className="phone-security-banner">
            <p>
              🔒 <strong>로컬 연산 중:</strong> 비행기 모드(오프라인)에서도 정확한 현재 시각만 있으면 동일한 번호가 생성됩니다.
            </p>
          </div>
        </div>

        {/* 폰 하단 홈 바 */}
        <div className="phone-home-indicator"></div>
      </div>
    </div>
  );
}
