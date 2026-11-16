import React from 'react';
import { ShieldCheck, Lock, Cpu, Globe } from 'lucide-react';

export default function Header({ currentTime }) {
  const timeFormatted = new Date(currentTime).toLocaleTimeString('ko-KR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-icon-wrapper">
          <ShieldCheck className="brand-icon" size={28} />
        </div>
        <div>
          <h1 className="header-title">TOTP 2FA Verification Studio</h1>
          <p className="header-subtitle">
            RFC 6238 표준 기반 2단계 인증 체험 및 연산 검증 플랫폼
          </p>
        </div>
      </div>

      <div className="header-status-group">
        <div className="status-badge secure-badge" title="외부 통신 0건: 모든 암호 연산이 브라우저 내부에서만 수행됩니다.">
          <span className="pulse-indicator"></span>
          <Lock size={15} />
          <span>Zero-Transmission (100% Client-Side)</span>
        </div>

        <div className="status-badge info-badge" title="브라우저 내장 하드웨어 가속 Web Crypto API 사용">
          <Cpu size={15} />
          <span>Web Crypto API (SubtleCrypto)</span>
        </div>

        <div className="status-badge time-badge" title="로컬 시스템 시계 동기화 상태">
          <Globe size={15} />
          <span>시스템 시계: <strong>{timeFormatted}</strong></span>
        </div>
      </div>
    </header>
  );
}

