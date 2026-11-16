# SALTIN(人) OTP — 모바일 2단계 인증 대시보드 (`26-w11-mobile-otp`)

> **"Make It Salted"** — 외부 서버 전송 없이 브라우저 내부(IN)에서 암호학적 난수(Salt)로 6자리 OTP를 생성하는 보안 전문가(人)의 2FA 관제 대시보드입니다.

---

## 🌟 프로젝트 소개

**SALTIN(人) OTP**는 스마트폰의 Google Authenticator, Microsoft Authenticator처럼 인터넷 연결 없이도 30초마다 동일한 6자리 인증 번호를 생성하고 검증하는 **RFC 6238 표준 기반 모바일 TOTP 2단계 인증 웹앱**입니다.

- **UI 컨셉**: 사이버 보안 관제 센터(SOC) 대시보드형 2단 분할(Split Grid) 다크 테마
- **좌측 패널**: 16:9 SALTIN(人) 브랜드 카드, 발급자(Issuer)/계정명 설정, 160-bit Base32 비밀 키 발급 및 복사, 클라이언트 로컬 QR 코드 렌더링, 6자리 OTP 검증 폼
- **우측 패널**: 대형 6자리 실시간 TOTP 숫자, 30초 카운트다운 프로그레스 바(5초 이하 붉은색 경고 전환), Unix Timestamp, Time Counter($T$), **HMAC-SHA1 20바이트 Hex 다이제스트 및 Dynamic Truncation 실시간 연산 모니터**

---

## 🤖 나의 AI 기획·구현 과정

1. **AI 협업 방식**:
   - **Antigravity IDE의 대화형 기획(Implementation Plan)** 워크플로우를 채택하여, 구현 전 암호학적 데이터 흐름(`crypto.getRandomValues` $\rightarrow$ RFC 4648 Base32 $\rightarrow$ Big-Endian 버퍼 $\rightarrow$ `crypto.subtle.sign` $\rightarrow$ RFC 4226 Dynamic Truncation)을 철저히 검증하고 단계별로 구현했습니다.
2. **화면 및 기능 구상**:
   - 단순한 번호 생성기를 넘어, 암호학 실습 과제로서 **내부 연산 과정(HMAC 20바이트 Hex 다이제스트 및 동적 절단 오프셋 바이트)**을 실시간으로 관찰할 수 있는 **사이버보안 대시보드(옵션 A)** 형태로 설계했습니다.
   - 한국폴리텍대학 서울강서캠퍼스 사이버보안과 공식 엠블럼과 16:9 비율의 고화질 `SALTIN(人)` 브랜드 카드를 결합하여 완성도 높은 프로덕션 수준의 UI를 구축했습니다.
3. **시행착오 및 해결 과정**:
   - **RFC 6238 표준 벡터 검증**: 카운터 $T$를 8바이트 Big-Endian 버퍼(`DataView.setBigUint64`)로 변환하고 RFC 4226 동적 절단 공식을 네이티브로 구현한 뒤, RFC 6238 부록 B의 표준 테스트 벡터($T=1 \rightarrow 287082$, $T=37037036 \rightarrow 081804$, $T=66666666 \rightarrow 279037$)에 대해 100% 일치함을 자동화 단위 테스트로 검증했습니다.
   - **Zero-Transmission QR 연동**: 외부 QR API(api.qrserver.com 등) 호출 시 비밀 키가 외부 서버로 유출되는 치명적인 취약점을 방지하기 위해, `qrcode.react`의 `QRCodeSVG`를 사용해 브라우저 내부에서 순수 벡터 SVG로 렌더링되도록 구현했습니다.

---

## 🛡️ TOTP 원리 및 보안 점검 (사이버보안과 체크포인트)

### 1. `Math.random()` 대신 `crypto.getRandomValues()`를 사용해야 하는 이유
- 일반 자바스크립트의 `Math.random()`은 의사 난수 생성기(PRNG)로 시드(Seed) 값과 내부 상태가 예측 가능하므로 공격자가 비밀 키를 역추적(Reconstruction)할 수 있습니다.
- 반면 `window.crypto.getRandomValues()`는 운영체제의 암호학적 난수 생성기(CSPRNG, Linux의 `/dev/urandom`, Windows의 `BCryptGenRandom`)를 호출하여 충분한 엔트로피(160비트/20바이트)를 보장하므로 예측이 원천적으로 불가능합니다.

### 2. 브라우저 내장 Web Crypto API(`crypto.subtle`)의 Zero-Transmission 보안 이점
- 비밀 키 발급, HMAC-SHA1 해싱, 6자리 코드 계산이 100% 브라우저 메모리 안에서만 수행됩니다.
- 브라우저 개발자 도구(`F12`) $\rightarrow$ **Network** 탭을 확인한 결과, 키 생성·QR 생성·OTP 연산 중 **외부 도메인으로 전송되는 HTTP 네트워크 패킷이 0건(완전 무전송)**임을 검증했습니다.

### 3. 스마트폰 Authenticator 앱 실시간 일치 결과
- 화면의 QR 코드를 스마트폰의 **Google Authenticator** 및 **Microsoft Authenticator** 앱으로 스캔 등록한 결과, **PC 대시보드 우측 모니터의 6자리 번호와 스마트폰 앱의 번호가 매 30초마다 100% 완벽히 일치**함을 확인했습니다.
- 스마트폰에 표시된 번호를 좌측 검증 폼에 입력 시 `[인증 성공] RFC 6238 검증 통과!` 배지가 정상 활성화되었습니다.

---

## 🔗 실행 및 배포 링크

- **GitHub Pages 배포 URL**: [https://saltedsec.github.io/26-w11-mobile-otp/](https://saltedsec.github.io/26-w11-mobile-otp/)
- **Netlify 배포 URL**: `https://saltedsec-mobile-otp.netlify.app/` *(또는 본인 Netlify 사이트 URL)*

---

## 🚀 나만의 확장 기능

1. **`SALTIN(人)` 3단 네이밍 철학 배너**:
   - `SALTIN(人) = Cryptographic Salt + IN (Zero-Transmission Local Vault) + 人 (Crafted by Geonil Kim)`
   - 프로젝트의 보안 철학과 제작자 아이덴티티를 상단 배너로 직관적으로 표현.
2. **HMAC-SHA1 20바이트 Hex 다이제스트 실시간 가시화**:
   - 매 30초마다 실시간으로 계산되는 20바이트 Hex 서명 값 중에서 RFC 4226 동적 절단으로 추출되는 4바이트(Offset ~ Offset+3)를 네온 시안으로 실시간 하이라이트 표시.
3. **30초 카운트다운 게이지 경고 전환**:
   - 30초 주기의 남은 시간이 5초 이하로 떨어지면 프로그레스 바와 숫자가 붉은색 경고로 전환되며 펄스 애니메이션이 활성화되어 사용자에게 갱신 임박을 시각적으로 알림.
4. **시간 오차($\pm 1$ step) 허용 검증 지원**:
   - 단말기와 PC 간의 시계 오차(최대 $\pm 30$초)를 고려하여 현재 $T$뿐만 아니라 $T-1$, $T+1$ 카운터에 대한 오차 보정 검증(Time Window) 로직 탑재.
5. **한국폴리텍대학 서울강서캠퍼스 사이버보안과 공식 엠블럼 연동**:
   - 52px 고해상도 학과 엠블럼과 16:9 비율의 전용 브랜드 카드를 결합하여 완성도 높은 UI 구축.
