# 모바일 OTP — TOTP 2단계 인증 (`26-w11-mobile-otp`)

실습 안내와 완성 기준은 [`guide.md`](./guide.md)를 참고하세요.

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

VS Code Copilot 채팅에서 RFC 6238 기준과 화면 요구사항을 정리해 요청하고, 구현 후 lint와 production build, RFC 기준 벡터 테스트로 확인하는 방식으로 진행했습니다. 로그인 시나리오를 보여 주는 서비스 관리자 화면과 코드를 바로 확인할 수 있는 가상 인증기를 한 화면에 나란히 배치하고, QR 등록·수동 입력 키·OTP 검증·복구 코드까지 이어지는 흐름을 기획했습니다.

구현에서 중요한 부분은 인증기와 같은 6자리 코드가 나오도록 Base32 비밀 키, 30초 카운터, HMAC-SHA1의 Dynamic Truncation을 정확히 적용하는 것이었습니다. 이를 `src/utils/totp.js`에 분리하고 RFC 기준 시각의 예상 코드와 비교해 계산 결과를 검증했습니다. 또한 매초 카운트다운을 갱신하면서도 코드 계산은 현재 30초 구간을 기준으로 하도록 했습니다.

## TOTP 원리 및 보안 점검 (사이버보안과 체크포인트)

비밀 키는 계정 보안의 기반이므로 예측 가능한 `Math.random()` 대신 암호학적으로 안전한 난수를 제공하는 `crypto.getRandomValues()`로 160-bit 값을 생성합니다. OTP는 비밀 키를 서버로 보내지 않고 브라우저의 `crypto.subtle` HMAC-SHA1 연산으로 계산하고 검증합니다. 따라서 비밀 키와 OTP를 처리하기 위한 인증 서버 요청을 만들지 않으며, QR 코드도 브라우저에서 생성합니다.

Network 탭에서 키 생성과 OTP 검증을 수행할 때 외부 API 요청이 추가되지 않는지 확인하는 것을 보안 점검 기준으로 삼았습니다. 구현 코드에는 `fetch`나 외부 인증 API 호출이 없으며, 키 생성부터 OTP 계산·검증까지 로컬에서 처리합니다. 다만 배포 환경에서 발생할 수 있는 페이지·정적 리소스 로딩 요청은 인증 API 전송과 구분해 확인해야 합니다.

QR 코드는 `otpauth://totp/` URI에 RFC 6238 설정(SHA1, 6자리, 30초)을 담아 생성합니다. 실제 스마트폰 인증기 앱에서 QR 스캔 후 코드가 일치하는지도 배포 환경에서 확인할 수 있도록 테스트 항목으로 남겼습니다.

## 실행 및 배포 링크

- Netlify 배포 URL: [https://ornate-brioche-742c76.netlify.app/](https://ornate-brioche-742c76.netlify.app/)
- GitHub Pages 배포 URL: [https://kyudyssey.github.io/26-w11-mobile-otp/](https://kyudyssey.github.io/26-w11-mobile-otp/)

## 나만의 확장 기능

다중 계정별 실시간 OTP 표시, 30초 카운트다운 게이지, 기기 시간 차이를 보정하는 ±1 스텝 허용 옵션, 일회용 백업 복구 코드를 추가했습니다. 복구 코드는 한 번 사용하면 목록에서 제거되며, 새 코드를 발급하면 이전 코드는 사용할 수 없습니다.
