# 모바일 OTP 로그인 시뮬레이터

브라우저에서 비밀 키를 발급하고 QR 코드를 Authenticator 앱에 등록한 뒤, TOTP(Time-Based One-Time Password)로 2단계 인증 로그인을 체험하는 React + Vite 웹앱입니다. 실제 사용자 계정이나 서버 로그인을 제공하지 않는 학습용 시뮬레이터입니다.

## 주요 기능

- 암호학적으로 안전한 Base32 비밀 키 발급 및 복사
- `otpauth://` URI를 담은 QR 코드의 브라우저 내 렌더링
- 30초 주기의 6자리 TOTP와 남은 시간 표시
- 6칸 숫자 입력, 자동 포커스 및 붙여넣기를 지원하는 로그인 검증
- Unix Timestamp, 30초 카운터, 이전·현재·다음 OTP를 확인하는 시계 진단 패널

## 화면 구성

대시보드는 반응형 좌우 2분할 레이아웃입니다. 좌측 패널에서 발급자와 계정명을 설정하고 비밀 키를 발급하거나 복사할 수 있으며, 생성된 QR 코드와 현재 예상 OTP·30초 카운터를 확인할 수 있습니다. 우측 패널에는 로그인 시뮬레이터가 배치되어 있습니다. 좁은 화면에서는 두 패널이 세로로 쌓입니다.

페이지에 처음 접속하면 사용할 수 있도록 비밀 키와 QR 코드가 자동으로 표시됩니다. 새 등록을 시작하려면 **새 비밀 키 발급**을 누르세요. 화면 하단의 시계 진단 패널에서는 브라우저 Unix Timestamp, 30초 카운터와 이전·현재·다음 시간 구간의 OTP를 확인할 수 있습니다.

## TOTP 작동 원리

RFC 6238은 시간 기반 OTP를 정의하며, 이 프로젝트는 표준 기본값인 30초 시간 간격, HMAC-SHA1, 6자리 코드를 사용합니다. 비밀 키와 현재 Unix 시간으로부터 계산한 카운터를 사용해 매 시간 구간마다 같은 코드를 생성합니다.

```text
Base32 Secret + floor(Unix Timestamp / 30) 카운터 (64-bit Big-Endian)
    -> HMAC-SHA1
    -> RFC 4226 Dynamic Truncation
    -> 6-digit OTP (앞자리 0 포함)
```

QR 코드에는 Authenticator 앱이 키와 계정 정보를 등록할 수 있도록 `otpauth://totp/...` URI를 담습니다. 브라우저 화면의 OTP와 등록된 앱의 OTP가 일치하면 로그인 시뮬레이션이 성공합니다. 두 기기의 시계가 크게 어긋나면 코드가 다를 수 있으므로 기기의 날짜 및 시간 자동 설정을 켜 두세요.

화면 하단의 시간 동기화 진단 패널에서 브라우저의 Unix Timestamp와 30초 카운터를 확인하고, 이전·현재·다음 구간의 코드를 비교할 수 있습니다. 표준시와 브라우저 시간을 비교해 clock drift를 점검할 때 사용하세요.

## 프로젝트 구조

```text
src/
├── App.jsx              # 발급, QR 등록, OTP 모니터, 코드 검증 UI
├── App.css              # 대시보드 및 반응형 스타일
├── index.css            # 전역 스타일과 디자인 변수
├── main.jsx             # React 앱 진입점
├── utils/
│   └── totp.js          # UI와 분리된 비밀 키, Base32, TOTP, URI 유틸리티
└── assets/              # 정적 이미지 및 아이콘
```

`src/utils/totp.js`는 UI와 암호화 로직을 분리합니다. `generateSecret()`은 `window.crypto.getRandomValues()`로 키를 만들고, `base32ToBytes()`는 Base32 문자열을 디코딩합니다. `generateTOTP()`는 현재 시각의 코드를, `generateTOTPAtTime()`은 진단용 지정 시각의 코드를 Web Crypto API로 계산합니다. 두 함수는 HMAC-SHA1과 동적 절단을 사용하며, 64-bit 카운터를 `DataView.setBigUint64()`의 Big-Endian 형식으로 기록합니다. `generateOtpAuthUri()`는 Base32 Secret을 검증·정규화한 뒤 QR 등록용 URI를 구성합니다. 화면은 이 모듈을 호출해 등록과 검증을 처리합니다.

## 보안 설계 및 검증

### 암호학적 난수

비밀 키는 브라우저의 `window.crypto.getRandomValues()`로 생성합니다. 예측 가능한 의사 난수 생성기인 `Math.random()`은 비밀 키 생성에 사용하지 않습니다.

### Zero-Transmission (무전송 원칙)

비밀 키 생성과 TOTP 계산은 브라우저에서 처리하고, QR 코드는 `qrcode.react`가 페이지 안에서 SVG로 렌더링합니다. QR 생성 API나 OTP 계산용 외부 API에 비밀 키를 보내지 않습니다. TOTP의 HMAC 연산은 브라우저 내장 `window.crypto.subtle`을 사용합니다.

직접 확인하려면 개발자 도구를 연 상태에서 다음과 같이 점검하세요.

1. **Network** 탭에서 `Preserve log`를 선택하고 기존 요청을 지웁니다.
2. 앱에서 **새 비밀 키 발급**을 누르고 QR 코드와 OTP가 표시될 때까지 기다립니다.
3. 요청 목록에서 `api.qrserver.com` 같은 외부 QR 생성 서비스나 OTP 처리 API로 향하는 요청이 없는지 확인합니다. QR 코드는 클라이언트에서 생성되며, 비밀 키를 포함한 요청이 전송되지 않아야 합니다.
4. 개발 모드에서는 Vite의 페이지·모듈 로드 요청이 보일 수 있습니다. 이는 앱 리소스 요청이며 비밀 키나 OTP를 전송하는 요청과 구분하세요.

### 구현 검증

RFC 6238 SHA-1 테스트 벡터에서 테스트용 비밀 키 `12345678901234567890`의 Unix 시간 `59`초 결과 `94287082`, `1111111109`초 결과 `07081804`를 확인했습니다. 32-bit 경계를 넘는 카운터의 Big-Endian 처리와 `otpauth` Secret 정규화도 확인했습니다. 실제 앱에서는 과제 요구사항에 맞게 6자리 코드를 사용합니다.

## 로컬 실행

Node.js가 설치된 환경에서 저장소 루트 디렉터리에서 실행합니다.

```bash
npm install
npm run dev
```

터미널에 표시되는 로컬 주소(일반적으로 `http://localhost:5173`)를 브라우저에서 엽니다. VS Code의 **Go Live** 버튼(Live Server, 기본 포트 `5500`)은 정적 파일 서버이므로 Vite의 React 플러그인이 필요한 JSX 앱을 실행할 수 없습니다. 앱은 반드시 `npm run dev`로 실행하세요.

Vite를 `5500` 포트에서 열고 싶다면 다음처럼 실행할 수 있습니다. 이 경우에도 포트를 여는 서버는 Go Live가 아니라 Vite입니다.

```bash
npm run dev -- --port 5500 --strictPort
```

`--strictPort`는 `5500` 포트를 사용할 수 없을 때 다른 포트로 자동 변경하지 않고 오류를 표시합니다. 배포용 빌드는 다음 명령으로 확인할 수 있습니다.

```bash
npm run build
```

## GitHub Pages 배포

저장소의 `.github/workflows/deploy-pages.yml`은 `dev` 브랜치에 변경 사항을 푸시하면 Vite 앱을 빌드하고 `dist` 결과물을 GitHub Pages에 배포합니다.

최초 설정 시 저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택해야 합니다. **Deploy from a branch**로 설정하면 JSX 원본 파일이 게시되어 사이트가 빈 화면으로 보일 수 있습니다. 설정을 바꾼 뒤에는 **Actions → Deploy to GitHub Pages → Run workflow**에서 `dev` 브랜치로 배포를 실행하거나 `dev`에 새 변경 사항을 푸시하세요. 배포 작업이 성공한 뒤 사이트를 새로고침하면 됩니다.

## Authenticator 앱 연동 테스트

1. 페이지를 열면 기본 발급자와 계정명의 비밀 키 및 QR 코드가 자동으로 표시됩니다. 원하는 계정 정보로 등록하려면 발급자·계정명을 먼저 입력하고 **새 비밀 키 발급**을 누릅니다.
2. 스마트폰에서 Google Authenticator, Microsoft Authenticator 등 TOTP를 지원하는 앱을 열고 새 계정 추가의 QR 스캔 기능으로 좌측 패널의 QR 코드를 스캔합니다.
3. 스마트폰에 등록된 계정과 웹앱의 발급자·계정명이 맞는지 확인합니다. QR 코드를 스캔할 수 없다면 화면의 Base32 비밀 키를 복사해 수동으로 등록합니다.
4. 웹앱의 **현재 예상 6자리 OTP**와 스마트폰 앱의 코드를 비교합니다. 코드는 30초마다 바뀌므로 남은 시간이 충분할 때 확인하고, 기기의 시간 설정도 동기화되어 있는지 확인합니다.
5. 우측 패널의 인증 입력 6칸에 스마트폰의 코드를 입력합니다. 첫 칸에 6자리 코드를 붙여넣어도 자동으로 각 칸에 채워집니다.
6. **인증하기**를 눌러 성공·실패 결과를 확인합니다.

> 이 프로젝트는 학습 및 시연용입니다. 화면에 표시되거나 복사한 비밀 키를 실제 서비스 계정에 재사용하지 마세요.
