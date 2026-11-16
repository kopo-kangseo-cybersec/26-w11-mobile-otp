# 모바일 OTP — TOTP 2단계 인증 (`26-w11-mobile-otp`)

> 이 README는 실습을 완성한 뒤, 배포 직전 단계에서 직접 채워 넣습니다.
> 실습 안내와 완성 기준은 [`guide.md`](./guide.md)를 참고하세요.

## 소개

브라우저에서 비밀 키를 생성하고 RFC 6238 기반 TOTP를 발급·검증하는 모바일 OTP 실습 스튜디오입니다. 서비스 관리자 화면에서 QR 코드와 수동 입력 키를 만들고, 가상 인증기에서 계정별 6자리 코드를 실시간으로 확인할 수 있습니다.

- `src/utils/totp.js`에서 Web Crypto API를 이용해 160-bit 비밀 키와 HMAC-SHA1 TOTP를 생성합니다.
- 시간 오차 ±1 스텝 검증과 일회용 백업 복구 코드를 지원합니다.
- 비밀 키와 OTP 계산은 브라우저 안에서 처리하며 외부 인증 API를 호출하지 않습니다.

### 로컬 실행

```sh
npm install
npm run dev
```

`npm run build`로 GitHub Pages 등 서브 경로 배포용 production 빌드를 생성할 수 있습니다.

## 나의 AI 기획·구현 과정

<!--
1. 이번 주에 어떤 AI 협업 방식을 선택했나요? (Gemini 웹에서 먼저 기획 후 Antigravity IDE 구현 / Antigravity IDE에서 Implementation Plan 기반 대화형 설계 / VS Code Copilot 병행 등)
2. 처음부터 스스로 기획하고 설계하면서 어떤 화면과 기능을 구상했나요?
3. 구현 중 가장 막혔던 문제(예: 스마트폰 앱과 6자리 코드 불일치, Base32 변환, 타이머 동기화 등)는 무엇이었고, 어떻게 해결했나요?
-->

## TOTP 원리 및 보안 점검 (사이버보안과 체크포인트)

<!--
1. 비밀 키(Secret Key)를 만들 때 Math.random() 대신 crypto.getRandomValues()를 사용해야 하는 이유는 무엇인가요?
2. 비밀번호/OTP 생성 및 검증 연산을 외부 서버가 아닌 브라우저(Web Crypto API / crypto.subtle)에서 직접 처리하면 어떤 보안상 이점이 있나요? (개발자 도구 Network 탭 확인 결과 포함)
3. 스마트폰 Authenticator 앱(Google/Microsoft Authenticator 등)으로 QR 코드를 스캔했을 때 PC 화면과 6자리 번호가 일치했나요?
-->

## 실행 및 배포 링크

- Netlify 배포 URL: 
- GitHub Pages 배포 URL: 

## 나만의 확장 기능

<!-- 기본 4가지 기준 외에 스스로 기획해 추가한 기능(예: 다중 계정 저장, 백업 복구 코드, 시간 오차 허용 등)을 적어주세요 -->
