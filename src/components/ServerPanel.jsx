import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Server, RefreshCw, Copy, Check, QrCode, Cpu } from 'lucide-react'
import { counterToBuffer, bufferToHex } from '../utils/totp.js'

export function ServerPanel({
  issuer,
  setIssuer,
  account,
  setAccount,
  secret,
  onGenerateNewSecret,
  otpauthUri,
  currentTime,
  counter
}) {
  const [copied, setCopied] = useState(false)

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('클립보드 복사 실패:', err)
    }
  }

  // 4글자 단위로 시각적 분리
  const formattedSecret = secret.match(/.{1,4}/g)?.join(' ') || secret

  // 64-bit Big-Endian Hex 변환
  const counterHex = bufferToHex(counterToBuffer(counter))
  const unixSeconds = Math.floor(currentTime / 1000)

  return (
    <div className="panel server-panel">
      <div className="panel-header">
        <div className="panel-tag server-tag">
          <Server className="icon-xs" />
          <span>서버 (인증 발급 및 QR 제공)</span>
        </div>
        <h2 className="panel-title">서비스 설정 & QR 등록</h2>
        <p className="panel-desc">
          서버는 사용자 계정마다 160-bit 비밀 키를 생성하고 안전하게 공유하기 위해 표준 QR 코드를 발급합니다.
        </p>
      </div>

      <div className="panel-body">
        {/* 서비스 계정 입력 폼 */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="input-issuer" className="input-label">
              발급자 (Issuer)
            </label>
            <input
              id="input-issuer"
              type="text"
              className="text-input"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="KopoCyberSec"
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-account" className="input-label">
              계정명 (Account)
            </label>
            <input
              id="input-account"
              type="text"
              className="text-input"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="student@kopo.ac.kr"
            />
          </div>
        </div>

        {/* 비밀 키 발급 및 표시 */}
        <div className="secret-section">
          <div className="section-label-row">
            <span className="section-label">공유 비밀 키 (Base32 Secret)</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onGenerateNewSecret}
              title="CSPRNG 20바이트 암호학적 난수로 새 키 생성"
            >
              <RefreshCw className="icon-xs" />
              <span>새 비밀 키 발급</span>
            </button>
          </div>

          <div className="secret-display-box">
            <code className="secret-text font-mono" title={secret}>
              {formattedSecret}
            </code>
            <button
              type="button"
              className={`copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopySecret}
              aria-label="비밀 키 복사"
            >
              {copied ? <Check className="icon-sm text-emerald" /> : <Copy className="icon-sm" />}
            </button>
          </div>
          <div className="secret-caption">
            <span>RFC 4648 Base32 표준 (160-bit 엔트로피, 패딩 제외 32자리)</span>
          </div>
        </div>

        {/* QR 코드 영역 */}
        <div className="qr-container-card">
          <div className="qr-header">
            <QrCode className="icon-sm text-cyan" />
            <span className="qr-header-title">스마트폰 Authenticator 등록용 QR</span>
          </div>

          <div className="qr-wrapper">
            <div className="qr-canvas-box">
              <QRCodeSVG
                value={otpauthUri}
                size={180}
                level="M"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
            </div>
            <div className="qr-instructions">
              <ol className="step-list">
                <li>스마트폰에서 <strong>Google OTP</strong> 또는 <strong>MS Authenticator</strong> 앱 실행</li>
                <li>오른쪽 아래 <strong>[+]</strong> 버튼 터치 후 <strong>[QR 코드 스캔]</strong> 선택</li>
                <li>위 사각형 QR 코드를 스마트폰 카메라로 비추면 즉시 등록 완료!</li>
              </ol>
              <div className="uri-preview" title={otpauthUri}>
                <span className="uri-tag">URI</span>
                <code className="uri-text font-mono">{otpauthUri}</code>
              </div>
            </div>
          </div>
        </div>

        {/* 원리 시각화 박스 (서버 내부 상태) */}
        <div className="principles-card">
          <div className="principles-header">
            <Cpu className="icon-sm text-purple" />
            <span className="principles-title">TOTP 동기화 원리 (실시간 내부 계산 상태)</span>
          </div>

          <div className="metrics-grid">
            <div className="metric-box">
              <span className="metric-name">Unix Timestamp (초)</span>
              <span className="metric-val font-mono">{unixSeconds}s</span>
              <span className="metric-sub font-mono">{currentTime} ms</span>
            </div>

            <div className="metric-box">
              <span className="metric-name">30초 스텝 카운터 (T)</span>
              <span className="metric-val font-mono highlight-purple">{counter}</span>
              <span className="metric-sub font-mono">floor({unixSeconds} / 30)</span>
            </div>

            <div className="metric-box full-width">
              <span className="metric-name">64-bit Big-Endian 카운터 바이트 (서명 입력값)</span>
              <code className="metric-val hex-val font-mono">{counterHex}</code>
              <span className="metric-sub">HMAC-SHA1에 주입되는 8바이트 바이너리 버퍼</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
