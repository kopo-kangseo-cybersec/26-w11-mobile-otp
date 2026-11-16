import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from './components/Header'
import { ServerPanel } from './components/ServerPanel'
import { AuthenticatorPanel } from './components/AuthenticatorPanel'
import {
  generateBase32Secret,
  generateTOTP,
  verifyTOTP,
  buildOtpAuthUri,
  getStepCounter
} from './utils/totp'
import { Shield, CheckCircle } from 'lucide-react'
import './App.css'

export function App() {
  // 1. 서비스 발급자 및 계정 설정
  const [issuer, setIssuer] = useState('KopoCyberSec')
  const [account, setAccount] = useState('student@kopo.ac.kr')

  // 2. CSPRNG 20바이트 암호학적 난수로 초기 비밀 키 생성
  const [secret, setSecret] = useState(() => {
    try {
      return generateBase32Secret(20)
    } catch {
      // SSR 또는 비정상 환경 fallback (기본 32자)
      return 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
    }
  })

  // 3. 실시간 시각 상태 (매 200ms 단위 동기화로 부드러운 게이지 제공)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // 4. 현재 계산된 6자리 OTP 및 카운터
  const [currentOtp, setCurrentOtp] = useState('')
  const [currentCounter, setCurrentCounter] = useState(0)

  // 5. 검증 결과 및 검증 이력 상태
  const [verificationResult, setVerificationResult] = useState(null)
  const [verifyHistory, setVerifyHistory] = useState([])
  const [allowTimeWindow, setAllowTimeWindow] = useState(true)

  // 1초 미만 주기(200ms)로 브라우저 시각을 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 200)
    return () => clearInterval(timer)
  }, [])

  // 비밀키 또는 30초 스텝 카운터가 변할 때 실시간 TOTP 재계산
  const stepCounter = useMemo(() => {
    return getStepCounter(currentTime, 30)
  }, [currentTime])

  useEffect(() => {
    let isMounted = true

    async function updateOtp() {
      try {
        const result = await generateTOTP(secret, {
          timestamp: stepCounter * 30 * 1000,
          timeStep: 30,
          digits: 6
        })
        if (isMounted) {
          setCurrentOtp(result.otp)
          setCurrentCounter(result.counter)
        }
      } catch (err) {
        console.error('TOTP 계산 오류:', err)
      }
    }

    updateOtp()

    return () => {
      isMounted = false
    }
  }, [secret, stepCounter])

  // 새 비밀 키 생성 핸들러 (CSPRNG 20바이트)
  const handleGenerateNewSecret = useCallback(() => {
    const newSecret = generateBase32Secret(20)
    setSecret(newSecret)
    setVerificationResult(null)
  }, [])

  // otpauth:// URI 생성
  const otpauthUri = useMemo(() => {
    return buildOtpAuthUri(issuer, account, secret)
  }, [issuer, account, secret])

  // 2단계 인증 코드 검증 핸들러
  const handleVerify = useCallback(
    async (codeToTest) => {
      try {
        const res = await verifyTOTP(codeToTest, secret, {
          window: allowTimeWindow ? 1 : 0,
          timeStep: 30,
          digits: 6,
          timestamp: currentTime
        })

        const nowStr = new Date().toLocaleTimeString('ko-KR', { hour12: false })
        const resultObj = {
          valid: res.valid,
          delta: res.delta,
          testedCode: codeToTest,
          message: res.valid
            ? res.delta === 0
              ? '인증 성공! 현재 시각(30초 타임스텝)과 정확히 일치합니다.'
              : `인증 성공! 시계 오차 허용(±30초, delta: ${res.delta > 0 ? '+' : ''}${res.delta * 30}s) 범위 내에서 일치합니다.`
            : res.reason || '인증 실패: 잘못된 OTP 번호이거나 만료되었습니다.'
        }

        setVerificationResult(resultObj)

        // 이력 추가 (최대 5건 유지)
        setVerifyHistory((prev) => [
          {
            id: Date.now(),
            code: codeToTest,
            valid: res.valid,
            timestamp: nowStr,
            reason: resultObj.message
          },
          ...prev.slice(0, 4)
        ])
      } catch (err) {
        setVerificationResult({
          valid: false,
          delta: null,
          testedCode: codeToTest,
          message: `검증 중 오류 발생: ${err.message}`
        })
      }
    },
    [secret, allowTimeWindow, currentTime]
  )

  const handleClearHistory = useCallback(() => {
    setVerifyHistory([])
  }, [])

  return (
    <div className="studio-app">
      {/* 헤더 */}
      <Header currentTime={currentTime} />

      {/* 좌우 2단 분할 스튜디오 메인 그리드 */}
      <main className="studio-main-grid">
        {/* [좌측 패널] 서비스 서버 역할 */}
        <ServerPanel
          issuer={issuer}
          setIssuer={setIssuer}
          account={account}
          setAccount={setAccount}
          secret={secret}
          onGenerateNewSecret={handleGenerateNewSecret}
          otpauthUri={otpauthUri}
          currentTime={currentTime}
          counter={currentCounter}
        />

        {/* [우측 패널] 인증기 & 로그인 검증기 역할 */}
        <AuthenticatorPanel
          currentOtp={currentOtp}
          currentTime={currentTime}
          onVerify={handleVerify}
          verificationResult={verificationResult}
          verifyHistory={verifyHistory}
          onClearHistory={handleClearHistory}
          allowTimeWindow={allowTimeWindow}
          setAllowTimeWindow={setAllowTimeWindow}
        />
      </main>

      {/* 하단 사이버보안 체크포인트 카드 */}
      <footer className="studio-footer">
        <div className="security-summary-card">
          <div className="summary-header">
            <Shield className="icon-sm text-emerald" />
            <span>사이버보안과 필수 체크포인트 준수 현황</span>
          </div>
          <div className="summary-grid">
            <div className="summary-item">
              <CheckCircle className="icon-xs text-emerald" />
              <div>
                <strong>CSPRNG 난수 보장</strong>
                <p>Math.random() 배제, window.crypto.getRandomValues()로 20바이트(160-bit) 생성</p>
              </div>
            </div>

            <div className="summary-item">
              <CheckCircle className="icon-xs text-emerald" />
              <div>
                <strong>Zero-Transmission 원칙</strong>
                <p>모든 HMAC-SHA1 연산은 브라우저 내장 Web Crypto(crypto.subtle)에서 메모리 내 처리</p>
              </div>
            </div>

            <div className="summary-item">
              <CheckCircle className="icon-xs text-emerald" />
              <div>
                <strong>RFC 6238 / RFC 4648 준수</strong>
                <p>Base32 인코딩, 64-bit Big-Endian 카운터, Dynamic Truncation 표준 완벽 일치</p>
              </div>
            </div>
          </div>
        </div>

        <p className="copyright-text">
          26-w11-mobile-otp · 한국폴리텍대학 강서캠퍼스 사이버보안과 웹콘텐츠 제작
        </p>
      </footer>
    </div>
  )
}

export default App
