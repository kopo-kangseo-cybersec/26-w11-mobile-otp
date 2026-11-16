import { Shield, Lock, AlertTriangle, Cpu, Network, FileCode } from 'lucide-react';

export default function SecurityBadge() {
  return (
    <footer className="security-footer-container">
      <div className="security-cards-grid">
        {/* Zero-Transmission 보안 카드 */}
        <div className="security-card">
          <div className="security-card-header">
            <div className="security-badge-icon badge-blue">
              <Network size={18} />
            </div>
            <div>
              <h3 className="security-title">Zero-Transmission (무전송 원칙)</h3>
              <span className="security-subtitle">브라우저 내장 Web Crypto API 사용</span>
            </div>
          </div>
          <p className="security-body">
            본 웹앱은 외부 서드파티 API나 서버로 비밀 키 및 OTP를 전송하지 않습니다.
            브라우저 내장 <code>window.crypto.subtle</code>(HMAC-SHA1)과 <code>crypto.getRandomValues</code>(CSPRNG)를 사용하여
            사용자 기기 메모리에서만 완전하게 독립 연산됩니다.
            (브라우저 개발자 도구 <strong>F12 → Network</strong> 탭에서 0건의 네트워크 요청을 직접 확인하세요!)
          </p>
        </div>

        {/* XSS 및 키 관리 보안 카드 */}
        <div className="security-card">
          <div className="security-card-header">
            <div className="security-badge-icon badge-amber">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="security-title">클라이언트 키 저장 및 XSS 위협</h3>
              <span className="security-subtitle">실제 엔터프라이즈 환경과의 차이점</span>
            </div>
          </div>
          <p className="security-body">
            본 체험 스튜디오는 교육 및 시뮬레이션을 위해 메모리 상태(State)에서 키를 관리합니다.
            실제 운영 웹 서비스에서 2FA 마스터 비밀 키를 브라우저 <code>localStorage</code>나 쿠키에 노출할 경우,
            XSS(Cross-Site Scripting) 취약점에 의해 OTP 생성 키가 완전히 탈취될 위험이 있습니다.
            실제 백엔드는 비밀 키를 하드웨어 보안 모듈(HSM/KMS) 또는 안전하게 암호화된 서버 DB에만 격리 보관해야 합니다.
          </p>
        </div>

        {/* RFC 6238 표준 연산 원리 */}
        <div className="security-card">
          <div className="security-card-header">
            <div className="security-badge-icon badge-green">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="security-title">RFC 6238 TOTP 수학적 표준</h3>
              <span className="security-subtitle">인터넷 연결 없이 작동하는 동기화 메커니즘</span>
            </div>
          </div>
          <p className="security-body">
            공유 비밀 키(160비트 Base32)와 현재 시각 카운터 <code>⌊UnixTime / 30⌋</code>를 8바이트 Big-Endian 버퍼로 구성한 뒤,
            HMAC-SHA1 20바이트 해시에서 동적 절단(Dynamic Truncation, 마지막 바이트 하위 4비트 오프셋)을 수행해 6자리 숫자를 추출합니다.
            양측의 시계만 맞다면 네트워크 없이도 정확히 일치합니다.
          </p>
        </div>
      </div>

      <div className="security-footer-copyright">
        <span>한국폴리텍대학 강서캠퍼스 사이버보안과 | 26-w11 Mobile OTP Experience Studio</span>
      </div>
    </footer>
  );
}

