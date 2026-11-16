# 📋 Zero-Transmission TOTP Authenticator: Technical Specification & Implementation Plan

> **Document Purpose**: Defines the architecture, core cybersecurity checkpoints, and implementation blueprint for a fully client-side Time-based One-Time Password (TOTP) 2-factor authentication service operating strictly under the Zero-Transmission Principle via the browser's Web Crypto API.

---

## 📌 1. Overview

This project adheres strictly to the **Zero-Transmission Principle**, performing all cryptographic key generation, HMAC-SHA1 operations, and clock-drift verification locally inside the client's web browser using `window.crypto`.

```
[160-bit Base32 Secret Key]  +  [Current Time Epoch (T = ⌊UnixTime / 30⌋)]
                  │
                  ▼   Web Crypto API (crypto.subtle) Local HMAC-SHA1
       [6-Digit Dynamic TOTP]  <─── 100% In-Sync with Smartphone Authenticator
```

- **Architecture**: 3-File Separation (`index.html`, `src/App.jsx`, `src/App.css`)
- **Application Concept**: Enterprise Login Simulator (Step 1: ID/PW Authentication $\rightarrow$ Step 2: 6-Digit TOTP Modal Verification $\rightarrow$ Step 3: Security Admin Dashboard Authorization)
- **Standards**: RFC 6238 (TOTP), RFC 4226 (HOTP), RFC 4648 (Base32)

---

## ✅ 2. Four Completion Criteria

### 1. Secure Secret Key Generation
- **Mechanism**: A single click generates a fresh cryptographic entropy pool and issues a new Base32 secret key.
- **Specification**: Utilizes **160 bits (20 bytes)** of random data via `window.crypto.getRandomValues()` to balance compatibility and cryptographic strength.
- **Alphabet**: RFC 4648 Base32 (`ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`)

### 2. QR Code Integration (`otpauth://`)
- **Standard URI Format**:
  $$\text{otpauth://totp/Issuer:Account?secret=SECRET\&issuer=Issuer}$$
- **Functionality**: Generates a scannable QR code directly in the DOM using client-side SVG rendering, enabling users to instantly register the key with standard smartphone authenticator apps (Google Authenticator, Microsoft Authenticator, 2FAS, Authy).

### 3. Real-Time Synchronization & Possession-Factor Isolation
- **Timing Epoch**: Synchronized to standard 30-second UNIX timestamp windows ($T = \lfloor \text{Current Time (Seconds)} / 30 \rfloor$).
- **Possession-Factor Security Principle**: The dynamic OTP code and countdown timer are **never printed on the web browser screen**. Displaying OTPs on the PC screen defeats the fundamental purpose of two-factor authentication (Something You Know + Something You Have). Codes are computed and viewed **exclusively on the user's physical smartphone**, with the browser performing verification only upon submission.

### 4. Code Verification & Diagnostic Classification
- **Validation**: Compares user-inputted 6-digit codes against the locally computed HMAC-SHA1 TOTP value.
- **Clock-Drift Tolerance**: Automatically checks a $\pm 1$ time-step window covering past, current, and future 30-second intervals:
  - $T - 1$ (Previous 30s window - clock delay allowed)
  - $T$ (Current window - 0s offset)
  - $T + 1$ (Next 30s window - clock advance allowed)
- **Granular Failure Diagnostics**:
  - `EXPIRED`: Matches an expired historical step ($T-2 \sim T-10$, 60s+ past expiration)
  - `CLOCK_AHEAD`: Matches a future step ($T+2 \sim T+10$, device clock ahead)
  - `MISMATCH`: Not found in the expanded window (invalid code/typo)
- **Special Audit Logs**:
  - `[SPECIAL]: Detected N-step time discontinuity` whenever $|\Delta| \ge 2$ (60s+ timestamp gap)
  - `[SPECIAL]: Detected N Consecutive Failures` whenever $\ge 2$ consecutive failures occur (brute-force alert)

---

## 🛡️ 3. Two Essential Cybersecurity Checkpoints

### 1. Absolute Prohibition of `Math.random()`
- **Rule**: Regular pseudo-random number generators (`Math.random()`) are predictable and forbidden for cryptographic operations.
- **Enforcement**: All entropy is sourced exclusively from `window.crypto.getRandomValues()`.

### 2. Zero-Transmission Principle
- **Rule**: Secret keys and HMAC-SHA1 signature calculations must never leave the client device or touch an external API server (e.g. no external QR chart generators).
- **Enforcement**: Handled natively via `window.crypto.subtle`. Developers can open DevTools (`F12`) $\rightarrow$ **Network** tab (Filter: `Fetch/XHR`) to confirm zero outbound payload leakage.

---

## 🏗️ 4. Three-File Architecture

```
26-w11-mobile-otp/
├── index.html         # [1] HTML: Entrypoint & security metadata
├── src/
│   ├── App.jsx        # [2] JS/JSX: TOTP Web Crypto engine + Login simulator
│   └── App.css        # [3] CSS: Cybersecurity dark theme & glassmorphic UI
```

### Enhanced Security UX Features
1. **'Cannot scan QR code?' Toggle**: Shields the Base32 secret key from shoulder-surfing, revealing the manual setup key only when the user explicitly expands the drawer.
2. **Collapsible Security Event Audit Trail**: Keeps the administrator dashboard clean by default while allowing security operators to inspect real-time audit logs on demand.
3. **30-Second Cooldown Rate Limiting**: Enforces standard 30-second epoch protection by disabling key regeneration until 30 seconds have elapsed.
4. **Diagnostic Logging**: Automatically records `[SPECIAL]: Detected N Consecutive Failures` and `[SPECIAL]: Detected N-step time discontinuity`.


---

## 📈 5. 단계별 실행 계획 (Implementation Roadmap)

| 단계 | 목표 | 주요 작업 내용 | 상태 |
|---|---|---|:---:|
| **Phase 1** | 코어 암호화 엔진 구축 | - RFC 4648 Base32 인코딩/디코딩 구현<br>- `window.crypto.getRandomValues()` 기반 160비트 난수 생성<br>- `crypto.subtle` 기반 HMAC-SHA1 및 RFC 4226 Dynamic Truncation 검증 | ✅ 완료 |
| **Phase 2** | UI 3개 파일 분리 & QR 연동 | - `index.html`, `src/App.jsx`, `src/App.css` 구조화<br>- `otpauth://` 표준 URI 및 DOM 인라인 SVG QR 렌더링<br>- 30초 주기 동기화 루프 및 보안 분리 UI | ✅ 완료 |
| **Phase 3** | 실전 로그인 시뮬레이터 & 검증 | - 1단계 자격증명 폼 $\rightarrow$ 2단계 6자리 분할 OTP 입력 모달 구현<br>- $\pm 1$ 타임스텝($T-1, T, T+1$) 시계 오차 허용 판정<br>- 인증 인가 대시보드 및 실시간 보안 감사 로그 연동 | ✅ 완료 |
| **Phase 4** | 보안 검증 및 빌드/배포 | - `oxlint` 린트 및 `vite build` 무결성 검증<br>- F12 Network 탭 무전송 검증 확인<br>- Git 커밋(`GEMINI.md` 규칙) 및 배포 준비 | ✅ 완료 |

---

## 🧪 6. 보안 점검 및 테스트 체크리스트 (Verification Checklist)

- [x] **CSPRNG 검증**: 키 생성 시 `Math.random()` 호출이 없으며 `crypto.getRandomValues()`만 사용하는가?
- [x] **RFC 6238 정밀도**: 테스트 벡터 및 실제 스마트폰 Authenticator 앱과 6자리 숫자가 오차 없이 일치하는가?
- [x] **Zero-Transmission**: 개발자 도구(F12) Network 탭에서 키 생성 및 검증 시 외부 API 호출이 0건인가?
- [x] **시계 오차 허용**: 직전($T-1$) 및 다음($T+1$) 타임스텝 코드 입력 시 정상적으로 인가 판정되는가?
- [x] **3개 파일 분리**: HTML, JS/JSX, CSS의 관심사 분리가 명확하고 유지보수 가능한가?
