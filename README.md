# 모바일 OTP — TOTP 2단계 인증 (`26-w11-mobile-otp`)

> 한국폴리텍대학 서울강서캠퍼스 사이버보안과 11주차 실습 프로젝트입니다.  
> 브라우저 내장 암호화 API(Web Crypto API)와 암호학적 난수를 활용하여, **외부 서버 전송 없이(Zero-Transmission)** 스마트폰 Authenticator 앱과 실시간 동기화되는 모바일 OTP 웹앱 및 2단계 인증 시뮬레이터를 구현했습니다.

---

## 🌟 프로젝트 소개 (KOPO CyberSec Mobile OTP Studio)

본 프로젝트는 **RFC 6238 (TOTP) / RFC 4226 (HOTP)** 표준 규격을 기반으로 제작된 **"투-인-원 (Two-in-One) 모바일 OTP 및 2FA 보안 스튜디오"**입니다.

1. **2FA 서비스 & QR 시뮬레이터 (Service & 2FA Login)**:
   - 신규 사용자를 위한 암호학적 Base32 비밀 키 자동 발급 및 발급자/계정 커스텀
   - 표준 `otpauth://totp/...` 규격의 QR 코드 생성 & 스마트폰 Authenticator 앱(Google Authenticator, Microsoft Authenticator, 2FAS 등) 실시간 연동
   - 6자리 TOTP 코드 실시간 검증 (앞뒤 ±30초 시간 오차 Drift 허용 옵션 탑재)
   - 기기 분실을 대비한 1회용 비상 백업 복구 코드(Backup Codes) 발급 및 긴급 로그인 지원
2. **내 모바일 인증기 (Mobile Authenticator)**:
   - 스마트폰 화면(목업) 스타일의 멀티 계정 OTP 관리 앱
   - 30초 카운트다운 원형 프로그레스 타이머 & 5초 이하 경고 애니메이션
   - 여러 계정(GitHub, Google, Naver 및 사용자 추가 계정) 관리 및 LocalStorage 저장
   - 원클릭 6자리 코드 클립보드 복사
3. **보안 원리 & RFC 6238 공식 검증기 (Security Inspector)**:
   - Base32 디코딩 & 64-bit Big-Endian 카운터 & HMAC-SHA1 & Dynamic Truncation 연산 단계별 시각화
   - IETF RFC 6238 공식 부록 B(Appendix B) 테스트 벡터 5개에 대한 실시간 자체 검증기 (100% PASS)

---

## 🧭 나의 AI 기획·구현 과정

1. **AI 협업 방식**:
   - **Antigravity IDE Implementation Plan 기반 대화형 설계**: RFC 6238 공식 표준 규격과 사이버보안과 필수 2대 체크포인트를 바탕으로 아키텍처를 수립한 뒤, 모듈화(`src/utils/totp.js`)와 컴포넌트(`ServiceSimulator`, `MobileAuthenticator`, `SecurityInspector`) 단위로 단계별 검증을 진행했습니다.
2. **화면과 기능 구상**:
   - 단순한 코드 생성기에 그치지 않고, 사이버보안 관점에서 **"서비스 관리자가 2FA를 등록하고 사용자가 스마트폰으로 인증하는 전체 라이프사이클"**을 체험할 수 있도록 서비스 등록 탭과 모바일 인증기 탭을 상호 연동(서비스 탭에서 '인증기 탭에 자동 추가')하도록 설계했습니다.
3. **시행착오 및 디버깅**:
   - **64-bit Big-Endian 카운터 버퍼 구성**: JavaScript의 Number는 53비트 정밀도이므로, `DataView.setBigUint64(0, BigInt(counter), false)`를 사용하여 정확한 8바이트 빅엔디안 버퍼를 생성해야 스마트폰 앱과 코드가 일치했습니다.
   - **RFC 4226 Dynamic Truncation (동적 절단)**: HMAC-SHA1의 20바이트 해시 중 마지막 바이트의 하위 4비트(`hashBytes[19] & 0x0f`)를 오프셋으로 추출하여 31비트 부호 없는 정수를 구하는 비트 연산을 정확히 검증했습니다.
   - **RFC 6238 공식 테스트 벡터 5종(Time: 59, 1111111109, 1111111111, 1234567890, 2000000000)**을 단위 테스트로 검증하여 100% 일치를 입증했습니다.

---

## 🛡️ TOTP 원리 및 보안 점검 (사이버보안과 체크포인트)

### 1. `Math.random()` 대신 `crypto.getRandomValues()`를 사용해야 하는 이유
- `Math.random()`은 유사 난수 생성기(PRNG)로, 내부 시드 상태가 노출되거나 소수의 연속된 난수 출력만으로도 다음 난수 값을 수학적으로 역추적할 수 있어 비밀 키(Secret) 발급에 사용할 경우 심각한 보안 취약점이 발생합니다.
- 본 프로젝트는 브라우저와 OS 커널의 물리적 엔트로피 풀(하드웨어 인터럽트 등)을 사용하는 암호학적 난수 생성기(CSPRNG)인 `window.crypto.getRandomValues()`를 사용하여 160비트(20바이트, Base32 32글자)의 예측 불가능한 비밀 키를 생성합니다.

### 2. Zero-Transmission (무전송 원칙) 검증
- 모든 비밀 키 생성, Base32 인코딩/디코딩, HMAC-SHA1 해시 연산, TOTP 동적 절단 과정이 브라우저 내장 하드웨어 가속 API인 **Web Crypto API (`window.crypto.subtle`)** 안에서만 실행됩니다.
- 브라우저 개발자 도구(`F12`) &rarr; **Network** 탭을 열고 OTP 생성 및 인증을 진행해도 외부 서버로 어떠한 HTTP/WebSocket 요청도 전송되지 않음을 확인할 수 있습니다.

### 3. 스마트폰 Authenticator 앱과의 일치 확인
- 스마트폰의 **Google Authenticator** 및 **2FAS** 앱으로 QR 코드를 스캔했을 때, 웹앱에 표시되는 실시간 예상 6자리 번호와 스마트폰 화면의 6자리 숫자가 정확하게 동일하게 동기화됨을 확인했습니다.

---

## 🚀 실행 및 배포 링크

- **Netlify 배포 URL**: https://26-w11-mobile-otp.netlify.app (배포 후 업데이트 예정)
- **GitHub Pages 배포 URL**: https://kopo-kangseo-cybersec.github.io/26-w11-mobile-otp/ (배포 후 업데이트 예정)

---

## 💡 나만의 확장 기능

1. **다중 계정 로컬스토리지 보관 및 스마트폰 뷰 목업**:
   - Google Authenticator UI를 모방한 반응형 모바일 폰 목업 인터페이스
   - GitHub, Google, Naver 등 다중 계정 등록 및 삭제, `localStorage` 자동 영구 저장
2. **1회용 비상 백업 복구 코드 (Backup Codes)**:
   - 스마트폰 분실 및 방전 상황을 대비한 8자리 비상 백업 코드 5개 암호학적 생성 및 1회 사용 시 자동 폐기 처리
3. **시간 오차(Drift) ±30초 허용 옵션 토글**:
   - 클라이언트와 서버 간 미세한 시계 오차(네트워크 지연 등)를 허용하는 RFC 6238 윈도우 검증 기능 탑재
4. **RFC 6238 공식 테스트 벡터 실시간 자체 진단기**:
   - IETF 표준 문서 Appendix B의 5개 테스트 케이스를 브라우저 내에서 원클릭으로 검증하는 보안 인스펙터 기능 탑재
