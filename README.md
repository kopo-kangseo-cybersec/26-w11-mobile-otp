# 모바일 OTP — TOTP 2단계 인증 (`26-w11-mobile-otp`)

## 소개

Authenticator 앱처럼 동작하는 모바일 친화형 TOTP 체험 앱입니다. 서비스·계정 이름을 입력하고 새 비밀 키를 발급하면 `otpauth://` QR 코드와 6자리 인증 코드가 만들어집니다. 스마트폰 Authenticator 앱으로 QR 코드를 스캔하고, 앱의 코드를 입력해 검증할 수 있습니다.

## 기능

- `crypto.getRandomValues()`로 160-bit Base32 비밀 키 생성
- `crypto.subtle`의 HMAC-SHA1과 RFC 6238 30초 주기로 6자리 코드 계산
- Authenticator 앱에서 읽을 수 있는 `otpauth://totp/` QR 코드 생성
- 30초 카운트다운 및 현재 코드 검증
- 화면 크기에 맞춘 모바일 레이아웃

비밀 키와 OTP 계산은 브라우저 안에서 처리합니다. 비밀 키는 저장소에 저장되지 않으며, QR 코드에는 비밀 키가 포함되므로 다른 사람과 공유하지 마세요. 개발 서버와 빌드에는 패키지 설치·배포를 위한 네트워크 연결이 필요할 수 있지만, 앱의 OTP 연산을 위해 외부 API 서버로 비밀 키를 보내지 않습니다. 배포 후 브라우저 개발자 도구의 Network 탭에서도 확인해 주세요.

## 실행

```bash
npm install
npm run dev
```

Web Crypto API를 사용하므로 `localhost` 또는 HTTPS 환경에서 실행해야 합니다.

## 검증

```bash
npm run build
npm run lint
```

Google Authenticator로 QR을 스캔하고 웹앱과 같은 시간 구간의 OTP가 일치하며 코드 검증에 성공하는 것을 확인했습니다. 비밀 키는 화면에서 가리고 공유하세요. Network 탭의 외부 전송 여부는 브라우저 개발자 도구에서 직접 확인할 수 있습니다.

## 나의 AI 기획·구현 과정

VS Code의 Copilot을 활용해 Vite 기본 화면을 TOTP 체험 스튜디오로 구현했습니다. 화면은 QR 연결, 실시간 코드 확인, 사용자 입력 코드 검증의 세 단계로 구성했습니다. TOTP 알고리즘은 UI에서 분리한 `src/utils/totp.js`에 두고, Base32 변환·64-bit Big-Endian 카운터·HMAC-SHA1 동적 절단을 구현했습니다.

구현 과정에서는 30초 구간의 남은 시간을 Unix 시각에 맞춰 계산하고, 코드가 구간 경계에서만 갱신되도록 했습니다. 서비스·계정 이름을 수정하면 QR의 `otpauth://` 정보도 함께 바뀝니다. Google Authenticator에서 QR을 등록해 웹앱과 같은 시간 구간의 코드가 일치하는 것을 확인했습니다.

## 실행 및 배포 링크

- Netlify 배포 URL: https://reliable-malabi-f559ae.netlify.app
- GitHub Pages 배포 URL: https://yoooooeun.github.io/26-w11-mobile-otp/

GitHub Pages 배포 명령:

```bash
npm run deploy
```

## 나만의 확장 기능

- 서비스·계정 이름을 편집해 QR 라벨과 발급자 정보를 구성
- 비밀 키 복사 기능과 QR 코드 공유 주의 안내
- 화면 내 검증 결과 및 6자리 입력 전용 UI
