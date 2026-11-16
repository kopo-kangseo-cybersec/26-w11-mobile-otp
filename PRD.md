# [PRD] 웹 기반 TOTP(Time-Based One-Time Password) 인증기 앱

## 1. 앱 개요와 목표

- 프로젝트명: Web-based TOTP Authenticator (모바일 OTP 웹앱)
- 목적: 구글 OTP(Google Authenticator)와 유사한 동작 방식을 웹 환경에서 직접 구현하여, TOTP 알고리즘(RFC 6238)의 동작 원리를 이해하고 보안 요구사항을 만족하는 인증기를 제작
- 핵심 목표
  - 웹앱 내에서 안전한 난수 기반의 비밀 키(Secret Key)를 생성하고 Base32 및 QR 코드로 출력
  - 스마트폰 인증기 앱(Google/Microsoft Authenticator)과 연동하여 동일한 6자리 OTP 코드가 생성되는지 교차 검증
  - 브라우저 내장 암호화 API를 활용하여 서버 통신 없이(Zero-Transmission) TOTP 연산 수행

## 2. 사용자 흐름 (User Flow)

1. 처음 접속: 저장된 계정 목록(localStorage 연동) 또는 빈 상태 화면 표시, 하단에 보안 경고 문구 노출
2. 계정 추가: 우측 하단 + 버튼 클릭 → 모달(Modal) 열림
3. 폰 등록: 서비스 이름과 계정 이름 입력 → "비밀 키 발급" 클릭 → Base32 비밀 키 문자열과 qrcode.react로 렌더링된 QR 코드 표시 → 스마트폰 인증기 앱으로 QR 스캔 등록
4. 코드 비교: 등록 완료 후 메인 화면 카드의 6자리 코드와 스마트폰 인증기 앱 코드가 일치하는지 확인
5. 검증: 카드의 "검증" 버튼으로 입력창을 펼친 뒤 현재 코드 입력 → 성공(초록색) / 실패(빨간색) 피드백 확인

## 3. 화면별 기능 명세

### ① 메인 화면 (계정 카드 목록)

- 카드 구성
  - 서비스 이름 및 계정 이름
  - 6자리 TOTP 코드 (123 456 형태로 가운데 공백 포함)
  - 30초 주기의 잔여 시간을 보여주는 원형 타이머
- 버튼 기능
  - 코드 복사: 현재 6자리 코드를 클립보드에 복사
  - 검증: 해당 카드 하단에 코드 입력 필드와 결과 영역 펼침
  - 삭제: 해당 계정 정보를 상태 및 localStorage에서 제거

### ② 계정 추가 모달 (Modal)

- 입력 폼: 서비스 이름(Issuer), 계정 이름(Account Name) 입력 필드 및 "비밀 키 발급" 버튼
- 생성 결과 뷰
  - crypto.getRandomValues()로 생성한 Base32 인코딩 비밀 키 문자열 표시
  - otpauth://totp/... 표준 스키마를 따르는 QR 코드 출력 (qrcode.react 활용)
  - QR 라벨(발급자:계정) 부분은 encodeURIComponent로 인코딩 (계정 이름에 @ 같은 특수문자가 있어도 깨지지 않게)
- 등록 완료: "등록 완료" 클릭 시 메인 카드 목록에 추가하고 모달 닫기

### ③ 코드 검증 기능

- 입력 UI: 카드별로 펼쳐지는 6자리 숫자 입력칸
  - 입력칸에는 숫자만, 최대 6자리까지 입력 가능
- 판정 로직: 입력값과 현재 시스템 시간 기준 TOTP 코드 비교, 시계 오차를 고려해 ±1 스텝(앞뒤 30초)까지 허용
- UI 피드백: 성공 시 초록색, 실패 시 빨간색 상태 메시지

## 4. 컴포넌트·파일 구조

TOTP 연산 로직과 UI 컴포넌트를 분리

```
src/
 ├── utils/
 │    └── totp.js          # 비밀 키 생성(crypto.getRandomValues), Base32 인코딩/디코딩, HMAC-SHA1 및 TOTP 계산
 ├── components/
 │    ├── AccountCard.jsx  # 개별 계정 카드 (타이머, 코드, 복사, 검증 UI)
 │    ├── AddModal.jsx     # 계정 추가 모달 (입력, 비밀 키 발급, QR 렌더링)
 │    └── WarningBanner.jsx # 보안 경고 문구
 ├── App.jsx               # 메인 레이아웃, 상태 관리(localStorage 연동), 모달 제어
 ├── main.jsx              # 진입점
 └── index.css             # 기본 CSS 사용 (Tailwind 사용 안 함)
```

## 5. 보안 요구사항

- Zero-Transmission (무전송 원칙): 비밀 키와 OTP 값은 외부 서버나 API로 전송하지 않으며, 모든 연산은 브라우저 내부에서만 수행. QR도 외부 QR 생성 API 대신 qrcode.react로 브라우저 안에서 생성
- 안전한 난수 생성: Math.random() 사용 금지, crypto.getRandomValues()로 20바이트 시크릿 생성
- 표준 준수: RFC 6238에 따라 crypto.subtle (HMAC-SHA1), Base32 디코딩, 64비트 빅엔디안 카운터, Dynamic Truncation을 정확히 구현
- localStorage 보안 공지: 새로고침 시 데이터 유지를 위해 localStorage를 사용하되, 평문 저장 위험을 알리는 경고 문구를 화면 하단에 표시
  - 예: "비밀 키가 이 브라우저에 저장됩니다. 공용 PC에서는 사용 후 계정을 삭제하세요."

## 6. 스마트폰 앱과 코드가 안 맞을 때 점검 항목

1. 시간 동기화: TOTP는 현재 Unix 타임스탬프(Math.floor(Date.now() / 1000)) 기준이므로 PC와 스마트폰 시계가 맞아야 함
2. Base32 인코딩/디코딩: 비밀 키 문자열이 올바르게 디코딩되어 바이너리(Uint8Array)로 변환되는지 확인
3. QR 코드 스키마 형식: `otpauth://totp/Issuer:AccountName?secret=SECRETKEY&issuer=Issuer` 형식이 맞는지 확인
4. 카운터 바이트 변환: 30초 단위 카운터 값(T = floor(Time / 30))이 8바이트(64비트) 빅엔디안으로 정확히 변환되어 HMAC에 입력되는지 확인
5. Dynamic Truncation: HMAC 결과의 마지막 바이트 하위 4비트를 오프셋으로 4바이트를 추출하고, 최상위 비트를 & 0x7FFFFFFF로 마스킹하는지 확인
