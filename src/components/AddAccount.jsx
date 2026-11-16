
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateSecret } from "../utils/totp";

export default function AddAccount({ onAdd }) {
  const [issuer, setIssuer] = useState("");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [showQR, setShowQR] = useState(false);

  const createAccount = () => {
    if (!issuer.trim() || !name.trim()) {
      alert("서비스명과 계정명을 입력하세요.");
      return;
    }

    const newSecret = generateSecret();

    setSecret(newSecret);
    setShowQR(true);
  };

  const addAccount = () => {
    const account = {
      id: crypto.randomUUID(),
      issuer,
      name,
      secret
    };

    onAdd(account);

    setIssuer("");
    setName("");
    setSecret("");
    setShowQR(false);
  };

  const uri = secret
    ? `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(name)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
    : "";

  return (
    <div className="add-section">
      <h2>새 계정 추가</h2>

      <input
        placeholder="서비스명 (예: GitHub)"
        value={issuer}
        onChange={e => setIssuer(e.target.value)}
      />

      <input
        placeholder="계정명 (예: user@email.com)"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      {!showQR ? (
        <button onClick={createAccount}>
          비밀키 생성 및 QR 발급
        </button>
      ) : (
        <div className="qr-section">
          <QRCodeSVG value={uri} size={190} />

          <p>스마트폰 Authenticator로 스캔하세요.</p>

          <p className="secret-text">{secret}</p>

          <button onClick={addAccount}>
            계정 등록 완료
          </button>
        </div>
      )}
    </div>
  );
}
