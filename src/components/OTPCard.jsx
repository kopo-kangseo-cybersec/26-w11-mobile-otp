
import { useEffect, useState } from "react";
import { generateTOTP } from "../utils/totp";

export default function OTPCard({ account, onDelete }) {
  const [otp, setOtp] = useState("------");
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    let active = true;

    const update = async () => {
      const now = Date.now();
      const nextOtp = await generateTOTP(account.secret);

      if (!active) return;

      setOtp(nextOtp);
      setRemaining(30 - Math.floor((now / 1000) % 30));
    };

    update();

    const timer = setInterval(update, 500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [account.secret]);

  const copyOTP = async () => {
    await navigator.clipboard.writeText(otp);
  };

  return (
    <div className="otp-card">
      <div className="card-header">
        <div>
          <h3>{account.issuer}</h3>
          <p>{account.name}</p>
        </div>

        <button
          className="delete-button"
          onClick={() => onDelete(account.id)}
        >
          삭제
        </button>
      </div>

      <div className="otp-number">
        {otp.slice(0, 3)} {otp.slice(3)}
      </div>

      <div className="timer">
        <div
          className="timer-fill"
          style={{ width: `${remaining / 30 * 100}%` }}
        />
      </div>

      <div className="card-footer">
        <span>남은 시간 {remaining}초</span>

        <button onClick={copyOTP}>
          OTP 복사
        </button>
      </div>
    </div>
  );
}
