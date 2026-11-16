import { Shield, Lock, Radio, Cpu, Network } from 'lucide-react';

export default function SecurityNotice() {
  return (
    <div className="security-notice-card">
      <div className="notice-header">
        <div className="notice-badge">
          <Shield size={16} /> 사이버보안 체크포인트 (Cybersecurity Analysis)
        </div>
        <h3>인터넷 없이도 30초마다 동일한 코드가 생성되는 RFC 6238의 원리</h3>
      </div>

      <div className="security-grid">
        <div className="security-item">
          <div className="item-icon-wrap">
            <Lock size={20} className="icon-blue" />
          </div>
          <div className="item-content">
            <h4>1. 사전 공유된 대칭 비밀키 (Base32)</h4>
            <p>
              서비스와 단말기(스마트폰)가 QR 코드를 통해 최초 1회만 비밀키($K$)를 안전하게 공유합니다.
              이후 통신은 전혀 필요 없습니다.
            </p>
          </div>
        </div>

        <div className="security-item">
          <div className="item-icon-wrap">
            <Radio size={20} className="icon-purple" />
          </div>
          <div className="item-content">
            <h4>2. 동기화된 타임스탬프 카운터 ($T$)</h4>
            <p>
              Unix 시간($\text{Time}$)을 30초 주기로 나눈 정수 카운터($T = \lfloor \text{Time} / 30 \rfloor$)를 사용합니다.
              64-bit Big-Endian 버퍼로 변환되어 메시지로 사용됩니다.
            </p>
          </div>
        </div>

        <div className="security-item">
          <div className="item-icon-wrap">
            <Cpu size={20} className="icon-green" />
          </div>
          <div className="item-content">
            <h4>3. HMAC-SHA1 & 동적 절단 (Dynamic Truncation)</h4>
            <p>
              비밀키와 시간 카운터로 20바이트 HMAC-SHA1 다이제스트를 생성하고,
              마지막 바이트의 4비트 오프셋을 추출하여 최종 6자리 정수 OTP를 도출합니다.
            </p>
          </div>
        </div>

        <div className="security-item">
          <div className="item-icon-wrap">
            <Network size={20} className="icon-emerald" />
          </div>
          <div className="item-content">
            <h4>4. Zero-Transmission (무전송 원칙)</h4>
            <p>
              외부 API 서버로 비밀키가 절대 나가지 않습니다.
              개발자 도구(<code>F12</code>) &gt; <strong>Network</strong> 탭에서 어떤 외부 네트워크 패킷도 발생하지 않음을 직접 검증할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

