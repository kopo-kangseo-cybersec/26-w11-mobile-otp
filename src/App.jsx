import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header.jsx';
import ServerPanel from './components/ServerPanel.jsx';
import AuthenticatorPanel from './components/AuthenticatorPanel.jsx';
import {
  generateSecretKey,
  generateTOTP,
  getDetailedTOTPStep,
  verifyTOTP,
} from './utils/totp.js';
import './App.css';

export default function App() {
  // 1. 발급자 및 계정 상태
  const [issuer, setIssuer] = useState('KopoCyberSec');
  const [account, setAccount] = useState('student@kopo.ac.kr');

  // 2. 비밀 키 상태 (초기 1회 암호학적 난수 160비트 생성)
  const [secretKey, setSecretKey] = useState(() => {
    try {
      return generateSecretKey(20);
    } catch (e) {
      console.error(e);
      // Fallback if window.crypto is not ready
      return 'JBSWY3DPEHPK3PXP';
    }
  });

  // 3. 시간 및 OTP 상태
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [otpCode, setOtpCode] = useState('------');
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [progressRatio, setProgressRatio] = useState(1);
  const [inspectorData, setInspectorData] = useState(null);

  // 4. 검증 입력 및 결과 상태
  const [inputOtp, setInputOtp] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  // 실시간 1초 주기 타이머 동기화
  useEffect(() => {
    const updateTick = () => {
      const now = Date.now();
      setCurrentTime(now);

      const seconds = Math.floor(now / 1000);
      const rem = 30 - (seconds % 30);
      setRemainingSeconds(rem);
      setProgressRatio(rem / 30);
    };

    updateTick();
    const timerId = setInterval(updateTick, 500);
    return () => clearInterval(timerId);
  }, []);

  // 시간 또는 비밀키 변경 시 OTP 및 인스펙터 상세 정보 갱신
  useEffect(() => {
    let isCancelled = false;

    async function refreshOtp() {
      if (!secretKey) return;
      try {
        const details = await getDetailedTOTPStep(secretKey, currentTime, 30, 6);
        if (!isCancelled) {
          setOtpCode(details.otpCode);
          setInspectorData(details);
        }
      } catch (err) {
        console.error('Error generating OTP step:', err);
      }
    }

    refreshOtp();

    return () => {
      isCancelled = true;
    };
  }, [secretKey, Math.floor(currentTime / 1000 / 30)]);

  // 새 비밀 키 발급 핸들러
  const handleGenerateNewSecret = useCallback(() => {
    try {
      const newSecret = generateSecretKey(20);
      setSecretKey(newSecret);
      setVerificationResult(null);
      setInputOtp('');
    } catch (err) {
      console.error('Failed to generate CSPRNG secret key:', err);
    }
  }, []);

  // OTP 검증 핸들러
  const handleVerifyOtp = useCallback(
    async (codeToVerify, windowOption = 1) => {
      try {
        const result = await verifyTOTP(
          codeToVerify,
          secretKey,
          currentTime,
          30,
          6,
          windowOption
        );
        setVerificationResult(result);
        return result;
      } catch (err) {
        console.error('Verification error:', err);
        setVerificationResult({ valid: false, reason: err.message });
      }
    },
    [secretKey, currentTime]
  );

  // 가상 인증기에서 좌측 검증창으로 번호 전달
  const handleFillOtpToVerification = useCallback((code) => {
    if (code && code !== '------') {
      setInputOtp(code);
      setVerificationResult(null);
    }
  }, []);

  const handleClearVerification = useCallback(() => {
    setVerificationResult(null);
  }, []);

  return (
    <div className="app-container">
      <Header currentTime={currentTime} />

      <main className="studio-main-grid">
        <ServerPanel
          issuer={issuer}
          setIssuer={setIssuer}
          account={account}
          setAccount={setAccount}
          secretKey={secretKey}
          onGenerateNewSecret={handleGenerateNewSecret}
          onVerifyOtp={handleVerifyOtp}
          verificationResult={verificationResult}
          onClearVerification={handleClearVerification}
          inputOtp={inputOtp}
          setInputOtp={setInputOtp}
        />

        <AuthenticatorPanel
          issuer={issuer}
          account={account}
          otpCode={otpCode}
          remainingSeconds={remainingSeconds}
          progressRatio={progressRatio}
          inspectorData={inspectorData}
          onFillOtpToVerification={handleFillOtpToVerification}
        />
      </main>

      <footer className="app-footer">
        <p>
          RFC 6238 TOTP 2FA Verification Studio • Powered by Web Crypto API (SubtleCrypto & CSPRNG) • Zero-Transmission Architecture
        </p>
      </footer>
    </div>
  );
}
