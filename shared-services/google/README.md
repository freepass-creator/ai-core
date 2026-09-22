# Google Shared-Service Boundary

이 폴더는 AIOps에 묶여 있는 Google Drive/Sheets 연결 코드를 공통 서비스로 분리하기 위한 **SHADOW 추출 영역**이다.

현재 단계에서는 계정·credential·lease·회사별 Sheet/Drive ID를 가져오지 않는다.

## 지금 추출하는 것

`api-url-boundary.mjs`

AIOps `lib/goog.mjs`의 순수 함수 `assertAllowedGoogleApiUrl()`만 분리한다.

허용 범위:

- `https://sheets.googleapis.com/v4/spreadsheets...`
- `https://www.googleapis.com/drive/v3/...`
- `https://www.googleapis.com/upload/drive/v3/...`

그 외 Google/API host/path는 fail-closed다.

## 아직 AIOps에 남는 것

- delegated service-account/token 발급
- credential 파일 위치/환경변수
- AIOps lease / write gate
- 회사별 Sheet / Drive ID
- 업무별 read/write semantics
- retry/approval/runtime policy

즉 이 단계는 **transport URL boundary 재사용 후보**만 AI Core로 분리한 것이고 Google runtime authority를 이전한 것이 아니다.
