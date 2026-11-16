
import { useEffect, useState } from "react";
import OTPCard from "./components/OTPCard";
import AddAccount from "./components/AddAccount";
import { verifyTOTP } from "./utils/totp";
import "./App.css";

export default function App() {
  const [accounts, setAccounts] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("otp_accounts") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    localStorage.setItem(
      "otp_accounts",
      JSON.stringify(accounts)
    );
  }, [accounts]);

  const addAccount = account => {
    setAccounts(prev => [...prev, account]);
  };

  const deleteAccount = id => {
    setAccounts(prev => prev.filter(item => item.id !== id));
  };

  const checkOTP = async () => {
    const account = accounts.find(item => item.id === selected);

    if (!account) {
      setResult("계정을 선택하세요.");
      return;
    }

    const success = await verifyTOTP(
      account.secret,
      input
    );

    setResult(success ? "인증 성공!" : "인증 실패!");
  };

  return (
    <main className="app">
      <header>
        <div className="logo">🔐</div>
        <h1>Mobile OTP</h1>
        <p>안전한 2단계 인증 관리</p>
      </header>

      <section>
        <h2>내 인증 계정</h2>

        {accounts.length === 0 && (
          <p className="empty">
            등록된 계정이 없습니다.
          </p>
        )}

        {accounts.map(account => (
          <OTPCard
            key={account.id}
            account={account}
            onDelete={deleteAccount}
          />
        ))}
      </section>

      <AddAccount onAdd={addAccount} />

      <section className="verify-section">
        <h2>OTP 인증 테스트</h2>

        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">계정 선택</option>

          {accounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.issuer} - {account.name}
            </option>
          ))}
        </select>

        <input
          maxLength={6}
          placeholder="6자리 OTP 입력"
          value={input}
          onChange={e =>
            setInput(e.target.value.replace(/\D/g, ""))
          }
        />

        <button onClick={checkOTP}>
          인증 확인
        </button>

        <p>{result}</p>
      </section>

      <footer>
        <p>Mobile OTP Authenticator</p>
        <small>RFC 6238 · TOTP · Web Crypto API</small>
      </footer>
    </main>
  );
}
