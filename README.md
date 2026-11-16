# 🛡️ TOTP 2FA Verification Studio (RFC 6238)

> **RFC 6238 표준 준수 2단계 인증(TOTP) 체험 및 연산 검증 플랫폼**  
> 외부 네트워크 통신이 발생하지 않는 **100% 클라이언트 사이드(Zero-Transmission)** 아키텍처로 구현되었습니다.

---

## 📱 프로젝트 소개 및 화면 구성

본 프로젝트는 서비스 서버(인증 발급 및 검증)와 클라이언트(모바일 Authenticator 앱)의 내부 동작 메커니즘을 한 화면에서 대조하고 실시간으로 검증할 수 있는 **Split-View(2단 분할) 대시보드** 형태의 체험 스튜디오입니다.

```
┌─────────────────────────────────────────┬─────────────────────────────────────────┐
│     [좌측] 서비스 서버 시뮬레이터       │     [우측] 가상 Authenticator & 인스펙터│
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│ • 발급자(Issuer) & 계정(Account) 설정   │ • 스마트폰 목업 UI (Kopo 5G / 배터리)   │
│ • 160-bit CSPRNG Secret Key 발급        │ • 30초 원형 SVG 카운트다운 타이머       │
│ • 클라이언트 사이드 실시간 QR 렌더링    │ • 6자리 OTP 대형 디스플레이 (복사 지원) │
│ • 6자리 OTP 검증 시뮬레이터             │ • [RFC 6238 내부 연산 인스펙터]         │
│   (±1 스텝 윈도우 오차 허용 옵션 포함)  │   (Time, Big-Endian, HMAC, Truncation)  │
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

1. **좌측 패널 (서비스 서버 시뮬레이터)**:
   - 발급자(Issuer) 및 계정명(Account) 입력
   - 160비트 암호학적 난수(`crypto.getRandomValues`) 기반 Base32 비밀 키 발급 및 원클릭 복사
   - `otpauth://totp/...` 규격의 실시간 로컬 QR 코드 렌더링 (`qrcode.react` 활용)
   - 사용자 입력 6자리 OTP 번호 검증 입력창 및 성공/실패 판정 UI (±1 스텝 앞뒤 30초 오차 허용 토글 포함)
2. **우측 패널 (가상 Authenticator & 연산 인스펙터)**:
   - 좌측에서 생성된 비밀 키를 기반으로 30초마다 갱신되는 6자리 OTP 코드 실시간 계산
   - 30초 원형 SVG 프로그레스 타이머 및 5초 미만 긴급 경고 애니메이션
   - **RFC 6238 내부 연산 인스펙터**: 카운터 $T$, 8바이트 Big-Endian Hex 버퍼, HMAC-SHA1 40자리 다이제스트, 동적 절단(Dynamic Truncation) 오프셋 및 31비트 마스킹 과정을 시각적으로 투명하게 공개
3. **상단 보안 상태 배지**:
   - 브라우저 외부 통신 0건을 인증하는 `Zero-Transmission` 녹색 펄스 배지
   - `Web Crypto API (SubtleCrypto)` 하드웨어 가속 연산 상태 표시

---

## 🤖 나의 AI 기획·구현 과정

1. **AI 협업 방식**:
   - **Antigravity IDE Implementation Plan 기반 대화형 설계 및 단계별 구현** 방식을 선택했습니다.
   - 먼저 `/plan`을 통해 시스템 아키텍처, 디렉토리 구조, RFC 6238 비트 연산 명세서, 트러블슈팅 체크리스트를 포함한 계획서를 작성하고 승인받은 뒤 단계별로 구현을 진행했습니다.
2. **설계 및 화면 구상**:
   - 단순히 번호만 띄우는 기존 앱을 넘어, **"왜 스마트폰 앱과 브라우저가 인터넷 없이도 똑같은 번호를 만들어내는가?"**를 교육적으로 입증할 수 있도록 4단계 연산 인스펙터를 기획했습니다.
3. **구현 중 직면했던 문제와 해결 과정 (Troubleshooting)**:
   - **문제 1: 64-bit 카운터의 Big-Endian 정렬 오류 위험**  
     일반적인 JavaScript Number는 IEEE-754 부동소수점이며, 시스템 아키텍처(x86_64)는 Little-Endian을 기본 사용합니다. 이를 그대로 처리하면 스마트폰 앱과 해시값이 불일치하게 됩니다.  
     👉 **해결**: `DataView.prototype.setBigUint64(0, BigInt(counter), false)`의 세 번째 인자에 `false`를 명시하여 RFC 4226 규격의 8바이트 Big-Endian 버퍼로 정확히 패킹했습니다.
   - **문제 2: Base32 패딩 및 공백 문자열 정제**  
     비밀 키 복사/입력 시 공백이나 하이픈, `=` 패딩이 포함되면 디코딩 길이가 달라져 잘못된 키가 생성될 수 있습니다.  
     👉 **해결**: `cleanInput = base32Str.replace(/[\s\-=]+/g, '').toUpperCase()`로 전처리 후 5비트 $\to$ 8비트 정규화 디코딩을 수행했습니다.
   - **문제 3: 부호 비트 오버플로우**  
     Dynamic Truncation 추출 4바이트의 최상위 비트(MSB)가 1일 경우 음수로 인식될 수 있습니다.  
     👉 **해결**: `& 0x7FFFFFFF` 비트 마스크를 적용해 31비트 양의 정수로 고정했습니다.

---

## 🛡️ TOTP 원리 및 보안 점검 (사이버보안과 체크포인트)

### 1. `Math.random()` 대신 `crypto.getRandomValues()`를 사용해야 하는 이유
- `Math.random()`은 유사난수 생성기(PRNG)로, 내부 시드(seed) 상태를 추적할 수 있어 공격자가 생성될 난수를 예측할 수 있습니다.
- 반면 `window.crypto.getRandomValues()`는 운영체제의 엔트로피 풀(마우스 움직임, 하드웨어 인터럽트 등)을 활용하는 **암호학적으로 안전한 난수 생성기(CSPRNG)**이므로, 무작위 대칭키를 안전하게 생성합니다.

### 2. Zero-Transmission (무전송 원칙) 검증
- 모든 비밀 키 생성(`crypto.getRandomValues`), HMAC-SHA1 해싱(`crypto.subtle.sign`), 동적 절단, QR 렌더링(`qrcode.react`)이 100% 브라우저 메모리 안에서만 비동기로 실행됩니다.
- **개발자 도구 (F12) Network 탭 검증 결과**:
  - 비밀 키 재생성, QR 스캔, OTP 입력 검증 시 외부 API(`api.qrserver.com` 등)나 서버로 전달되는 HTTP/WebSocket 요청이 **0건(Zero Request)**임을 확인했습니다.

### 3. 스마트폰 Authenticator 앱 실기기 연동 검증
- 스마트폰의 **Google Authenticator** 및 **2FAS** 앱으로 화면의 QR 코드를 스캔하여 등록했습니다.
- **결과**: PC 화면의 30초 카운트다운 주기와 스마트폰 앱의 6자리 숫자가 **100% 실시간으로 동일하게 일치**함을 확인했습니다.

---

## 🚀 실행 및 배포 링크

- **로컬 실행**:
  ```bash
  npm install
  npm run dev
  ```
- **RFC 6238 단위 테스트 (Node.js)**:
  ```bash
  npm test
  ```
- **Netlify 배포 URL**: `https://otp-11.netlify.app/` 
- **GitHub Pages 배포 URL**: `https://taeyoon-hack.github.io/26-w11-mobile-otp/` 

---

## ✨ 나만의 확장 기능

1. **RFC 6238 실시간 비트 연산 인스펙터 (Deep Educational Inspector)**:
   - 카운터 $T$ 계산식, 8바이트 Big-Endian Hex, 20바이트 Raw Key Hex, HMAC-SHA1 40자리 다이제스트, 동적 절단(Dynamic Truncation) 오프셋 바이트 및 추출 4바이트를 실시간 컬러 하이라이트로 시각화.
2. **±1 스텝 (앞뒤 30초) 시간 오차 허용 토글 (Tolerance Window)**:
   - 네트워크 전송 지연 또는 단말기와 서버 간의 시계 불일치(Time Drift)를 보정하기 위해 $T-1, T, T+1$ 윈도우를 허용하여 실제 프로덕션 서버와 동일한 내결함성(Fault Tolerance)을 구현.
3. **가상 번호 원클릭 자동 입력 (One-Click Auto Fill)**:
   - 우측 가상 인증기에서 생성된 6자리 번호를 좌측 검증창으로 즉시 전달하여 빠른 테스트 지원.
4. **RFC 6238 Appendix B 표준 테스트 벡터 5종 단위 테스트 스크립트 (`npm test`) 탑재**.
