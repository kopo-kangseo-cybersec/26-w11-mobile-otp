import React, { useState } from 'react';
import {
  Binary,
  Code2,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Hash,
} from 'lucide-react';

export default function InspectorModal({ inspectorData }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!inspectorData) return null;

  const {
    timestamp,
    timeSeconds,
    timeStep,
    counter,
    keyHex,
    counterHex,
    hmacHex,
    offset,
    truncatedHex,
    binary,
    otpCode,
  } = inspectorData;

  // HMAC-SHA1 40자리 hex에서 offset 위치(2자리 hex * 4 = 8글자) 및 offset index byte(마지막 2글자) 하이라이트
  const offsetStartHexIndex = offset * 2;
  const offsetEndHexIndex = offsetStartHexIndex + 8;

  const hmacPrefix = hmacHex ? hmacHex.slice(0, offsetStartHexIndex) : '';
  const hmacSelected = hmacHex ? hmacHex.slice(offsetStartHexIndex, offsetEndHexIndex) : '';
  const hmacMiddle = hmacHex ? hmacHex.slice(offsetEndHexIndex, 38) : '';
  const hmacLastByte = hmacHex ? hmacHex.slice(38, 40) : '';

  return (
    <div className="inspector-container">
      <div
        className="inspector-header"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
      >
        <div className="inspector-title-group">
          <Binary size={18} className="text-accent" />
          <h3 className="inspector-title">RFC 6238 내부 연산 인스펙터</h3>
          <span className="inspector-badge">실시간 연산 시각화</span>
        </div>
        <button
          type="button"
          className="btn-icon"
          aria-label={isOpen ? '인스펙터 접기' : '인스펙터 펼치기'}
        >
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {isOpen && (
        <div className="inspector-content">
          <div className="inspector-intro">
            <HelpCircle size={15} />
            <span>
              RFC 6238은 30초 단위 카운터와 공유 비밀 키를 HMAC-SHA1으로 서명한 후 동적 절단(Dynamic Truncation)을 통해 6자리 숫자를 도출합니다.
            </span>
          </div>

          <div className="inspector-steps-grid">
            {/* Step 1: Time & Counter */}
            <div className="step-card">
              <div className="step-header">
                <span className="step-num">Step 1</span>
                <span className="step-name">시간 & 64-bit Big-Endian 카운터</span>
              </div>
              <div className="step-body">
                <div className="math-row">
                  <span className="math-label">현재 시각:</span>
                  <code className="math-val">{timeSeconds}초 ({timestamp} ms)</code>
                </div>
                <div className="math-row">
                  <span className="math-label">카운터 T = ⌊Time / 30⌋:</span>
                  <code className="math-val text-accent">{counter}</code>
                </div>
                <div className="math-row">
                  <span className="math-label">8바이트 빅엔디안 버퍼:</span>
                  <code className="code-box hex-highlight">{counterHex || '0000000000000000'}</code>
                </div>
              </div>
            </div>

            {/* Step 2: Secret Key Raw Bytes */}
            <div className="step-card">
              <div className="step-header">
                <span className="step-num">Step 2</span>
                <span className="step-name">공유 비밀 키 (Raw 20-Bytes)</span>
              </div>
              <div className="step-body">
                <div className="math-row">
                  <span className="math-label">디코딩 규격:</span>
                  <span className="math-val">RFC 4648 Base32 → Uint8Array</span>
                </div>
                <div className="math-row">
                  <span className="math-label">160-bit Key Hex (40 chars):</span>
                  <code className="code-box hex-highlight" title="HMAC의 대칭 암호화 키로 사용">{keyHex}</code>
                </div>
              </div>
            </div>

            {/* Step 3: HMAC-SHA1 Hash */}
            <div className="step-card full-span">
              <div className="step-header">
                <span className="step-num">Step 3</span>
                <span className="step-name">HMAC-SHA1 다이제스트 (Web Crypto API)</span>
              </div>
              <div className="step-body">
                <p className="step-desc">
                  <code>crypto.subtle.sign('HMAC', key, counterBuffer)</code> 연산 결과 (20바이트 / 40자리 Hex):
                </p>
                <div className="hmac-digest-display">
                  <span>{hmacPrefix}</span>
                  <mark className="highlight-extracted" title={`선택된 4바이트 (Offset ${offset})`}>
                    {hmacSelected}
                  </mark>
                  <span>{hmacMiddle}</span>
                  <mark className="highlight-offset" title={`마지막 바이트 0x${hmacLastByte}의 하위 4비트 = Offset ${offset}`}>
                    {hmacLastByte}
                  </mark>
                </div>
                <div className="digest-legend">
                  <span className="legend-item">
                    <span className="legend-dot offset-dot"></span>
                    마지막 바이트 <code>0x{hmacLastByte} & 0x0F = {offset}</code> (동적 절단 시작 오프셋)
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot extracted-dot"></span>
                    추출된 4바이트: <code>0x{truncatedHex}</code>
                  </span>
                </div>
              </div>
            </div>

            {/* Step 4: Dynamic Truncation */}
            <div className="step-card full-span">
              <div className="step-header">
                <span className="step-num">Step 4</span>
                <span className="step-name">동적 절단 (Dynamic Truncation) & 6자리 산출</span>
              </div>
              <div className="step-body truncation-flow">
                <div className="trunc-step">
                  <span className="trunc-label">1. 4바이트 추출</span>
                  <code className="trunc-code">0x{truncatedHex}</code>
                </div>
                <span className="trunc-arrow">→</span>
                <div className="trunc-step">
                  <span className="trunc-label">2. 최상위 비트 마스크 (& 0x7FFFFFFF)</span>
                  <code className="trunc-code">{binary}</code>
                </div>
                <span className="trunc-arrow">→</span>
                <div className="trunc-step">
                  <span className="trunc-label">3. 10⁶ 모듈로 (% 1,000,000)</span>
                  <code className="trunc-code highlight-otp">{otpCode}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

