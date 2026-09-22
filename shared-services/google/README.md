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


## Google READ Port / Adapter / Binding

현재 SHADOW 구조:

```text
AIOps caller
  -> aiops.google-read.shadow binding (PARTIAL, not runtime)
  -> google.api.read port
  -> shared.google.read-shadow adapter
  -> read-transport.mjs
  -> Sheets v4 / Drive v3 read endpoint
```

- Port: `ports/google-api-read.v1.json`
- Adapter: `adapters/shared-google-read-shadow.v1.json`
- AIOps binding: `bindings/aiops-google-read-shadow.v1.json`
- Implementation: `read-transport.mjs`

이 구조는 기존 `core-port/v1`, `core-adapter/v1`, `core-binding-profile/v1`을 그대로 사용한다. 새 공통 계약 가족은 만들지 않았다.

### 아직 cutover하지 않는 이유

AIOps 원본 `makeCall()`의 read retry는 20초에서 시작해 재시도마다 15초씩 늘어난다. 현재 canonical adapter contract는 linear backoff를 표현하지 못하므로 SHADOW 구현은 fixed 20초 retry로 명시했다. 따라서 이 adapter는 exact parity가 아니라 **PARTIAL shadow**다.

또한 다음 권한은 계속 AIOps에 남는다.

- credential 로딩
- delegated identity / token minting
- lease / write authorization
- 회사별 Google resource ID
- 실제 운영 호출자

이 차이가 해소되고 live provider verification이 끝나기 전에는 consumer cutover를 허용하지 않는다.
