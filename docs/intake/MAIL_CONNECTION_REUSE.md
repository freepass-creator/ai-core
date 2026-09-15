# 기존 메일 연결 재사용 — 로컬 확인 및 통합 제안

상태: **읽기 전용 검사기 구현, 공통 SSOT 반영/전체 계정 등록은 총괄 통합 대기**. 기존 자연어 모듈과 메일 인계 계약은 동결 유지. 설치·로그인·기본 계정·발송·전역 설정 변경 없음.

## 2026-09-15 10:56–11:00 KST 확인 범위

기존 문서 → 지정 도구의 경로/소스 → gws `auth status` 메타데이터 순으로 조회했다. 메일/Drive/연락처 원문, 암호·토큰·키 파일 내용, 홈 전체는 조회하지 않았다. 다음은 시점 관찰이며 영구 연결 보장이 아니다.

| 대상 | 근거 및 현재 관찰 | 한계 |
|---|---|---|
| `pyh@teamjpk.com` | gws 0.22.5 `auth status`의 user 일치, encrypted_credentials_exists/encryption_valid/token_valid=true | 실제 Gmail 읽기·발송 미시험 |
| `gws` | 기존 `%USERPROFILE%/.config/gws`; gmail.readonly/compose/send scope 관찰 | 전역 사용 정책은 읽기 전용. scope 보유가 발송 승인 아님 |
| `gws-collab`, `gws-admin` | 각 기존 `.config` 프로필도 같은 pyh 주소; Gmail scope는 관찰되지 않음 | 세 프로필을 세 메일 계정으로 세지 않는다 |
| SMTP 발신 등록 | `C:/dev/mailtool/send_mail.py` 35줄은 `GMAIL_ADDRESS` 선택; 현재 Process 환경 주소만 확인해 pyh 일치 | `GMAIL_APP_PASSWORD`는 존재 여부만 확인. 값/유효성은 미확인, 도구 실행 안 함 |
| AI 로그인 단서 | 지침의 `dudguq@gmail.com`(Cursor), `jpkpyh@gmail.com`(Claude) | 이 조사에서 메일 연결/발신 등록 근거 없음. 메일 계정으로 승격 금지 |
| 수신 예시 | send_mail.py의 `--to ksm@teamjpk.com`, `--cc a@b.com`, `--cc c@d.com` | 예시 수신 주소이며 사용자 발신 계정 목록 아님 |
| `01046403871w@gmail.com` — 사용자 별칭 웰릭스 세일즈폰 | 총괄이 전달한 sales 담당 조사: 로컬 명칭은 업무폰 계정, 마이데이터 수신 Gmail + Google Contacts 저장용 | 이 세션의 실조회 아님. 로컬 문서/코드 근거만 확인됐으며 Google 로그인·프로필 표시명·발송 연결 미검증. 숫자 뒤 소문자 `w`를 보존한다 |

**현재 1개는 프로필 메타데이터/발신 등록 확인, 추가 1개는 sales 담당이 로컬 문서·코드로 확인한 계정 후보다.** 두 주소 모두 실제 발송 성공을 검증한 것은 아니다. 사용자 설명의 3~4개를 전체 확정하지 않으며 나머지 주소·전체 수는 미확인이다. AI 로그인 단서 두 개를 더해 네 개로 맞추지 않는다. 이 세션은 사용자에게 추가 설정/주소 질문을 하지 않는다.

업무폰 후보의 전달받은 근거: `C:/dev/sales/docs/GITHUB-MAIL-AUTOMATION.md:6,9`, `C:/dev/sales/docs/서버-마이데이터-등록-매뉴얼.md:3,10,12`, `자동메일등록.py:26,131`, `서버수신등록.py:54` allowlist. 이 작업은 sales 소스·인증 파일을 추가 열람하지 않았다. 기존 credential/profile의 정확한 참조는 미확인으로 남기며 새 인증 저장소를 만들지 않는다. 앞선 비메일 가능성 해석은 사용자의 “전화번호 이메일” 정정으로 철회됐다.

실행파일 관찰: gws `0.22.5`, Python `3.13.14`, Node `v24.19.0`. 기존 npm 경로의 gws.ps1은 `%LOCALAPPDATA%/Programs/gws/0.22.5/gws.exe`를 가리키며 collab/admin 래퍼는 각 CONFIG_DIR을 지정한다. SMTP 소스 현재 SHA-256은 `5B5C3DF02A9CC5FE722773D80A49EB653E4C360FEF00A0C27824FDE75B303659`다. SMTP 도구는 자체 버전 표기를 확인하지 않았으므로 해시로 구분한다.

## 기존 SSOT와 반복 탐색 원인

- 연결 진입점: `C:/dev/ai-core/memory/TOOL_CONNECTIONS.md`. 현재 읽은 2026-09-13판은 Gemini 개발 연결 힌트만 기록한다. 메일 계정별 기존 경로 안내는 없다.
- 메일 운영 절차 정본: `C:/dev/aiops/docs/aiknowhow/README.md`가 안내하는 `메일읽기.md`, `메일보내기.md`. 후자는 이미 기존 SMTP 도구와 기본값이 실제 발송이라는 주의, 다른 세션이 도구를 못 찾았던 재발 사례를 기록한다.
- 확인된 단절: AI Core 연결 진입점에 이 메일 절차/기존 도구 포인터가 없고, 계정별 공통 비밀 없는 목록도 이번 지정 범위에서 발견하지 못했다. gws와 SMTP는 현재 존재한다. 따라서 “커넥터에 없으니 새 설치가 필요하다”는 판단은 현재 근거와 맞지 않는다.
- 추정: 세션이 커넥터 목록만 보거나 진입 문서만 읽고 멈춰 기존 도구를 놓치는 것이 반복 재탐색의 원인일 수 있다. 실제 각 세션의 설치 로그를 조사하지 않았으므로 모든 반복 설치의 원인/횟수를 확정하지 않는다.

## 이번 검사기의 재사용 경로

`node scripts/mail-connection-status.mjs`는 좁은 기존 gws 설치 폴더와 세 프로필 디렉터리/암호화 파일 **존재만** 확인하고, gws `--version`만 실행한다. SMTP 파일은 존재 확인만 하며 실행하지 않는다. 현재 프로세스의 SMTP 주소는 식별용으로 읽고 비밀번호 변수는 값 접근 없이 존재 여부만 표시한다.

호스트가 최소 인증 메타데이터 확인을 허용한 경우 `--check-auth`는 기존 gws 바이너리의 `auth status`만 세 지정 프로필에 실행한다. 자식 환경은 OS/경로 변수의 허용 목록과 명시 CONFIG_DIR만 전달하며 token/password 환경변수를 복사하지 않는다. gws 보호 저장소는 기존 위치를 사용한다. `auth export/login/setup/logout`, API 조회/발송, SMTP 실행은 호출 경로에 없다. 도구 자체의 내부 캐시 동작은 이 검사기가 통제하거나 검증하지 않는다.

- 결과는 일회성 관찰 JSON이며 새 계정/인증 저장소를 만들지 않는다. stdout은 user 주소·상태·고정 경로 참조·scope 판정 등의 허용 필드만 포함한다. auth 원문/오류/표준오류는 출력하지 않는다.
- `MISSING`: 지정 경로에 없음. 다른 설치 위치까지 없다는 뜻이 아니다. `UNVERIFIED`: 아직 확인하지 않음. `FAILED`: 조회/파싱/실행 또는 token_valid=false. 이 셋을 설치 필요로 합치지 않는다.
- scope `PRESENT`는 해당 작업 권한의 메타데이터 관찰일 뿐 실행 성공이 아니다. 실제 작업 상태는 항상 `NOT_TESTED`, 발송 승인은 항상 false다. 기본 발신자는 설정하지 않는다.
- `metadata_observed_unique`/`emails`는 응답에 나타난 주소의 집계다. `token_valid:false`로 auth가 FAILED여도 주소는 남을 수 있으므로 **유효 인증 계정 수로 표시하지 않는다**. 소비자는 각 프로필의 auth.status/token_valid와 작업별 NOT_TESTED를 별도로 표시한다. `registered_unique`도 환경에 등록된 주소를 포함하며 인증 성공 집계가 아니다.
- 바이너리가 여러 버전이면 `AMBIGUOUS`로 남기고 최신 버전을 임의 실행하지 않는다. 호스트는 기존 래퍼 경로를 확인해 모듈 함수의 `gwsExecutable`에 정확한 실행파일을 제공할 수 있다. 전역 PATH/래퍼를 바꾸지 않는다.
- 실행파일 basename 검사는 허용 명령을 제한하는 보조 조건이며 바이너리 신원/무결성 검증이 아니다. 명시 경로와 기본 설치 폴더 모두 호스트가 신뢰하는 기존 설치여야 한다. 사용자 입력이나 모델 후보에서 임의 실행파일 경로를 받아 이 함수에 넘기지 않는다.
- 프로필을 찾지 못하거나 인증 실패하면 기존 참조와 오류 단계부터 확인한다. Windows가 아닌 환경/다른 서버에서도 설치부터 수행하지 말고 해당 호스트의 기존 경로 참조를 확인한다. 이 CLI 기본 탐색은 현재 PC의 지정 경로만 지원한다.

## 기존 SSOT 변경 제안 — 적용하지 않음

소유 범위 밖이므로 `C:/dev/ai-core/memory/TOOL_CONNECTIONS.md` 수정은 총괄/개발통합 담당에게 제안만 전달한다. 다음 섹션을 **기존 파일에** 추가하는 방향이며 별도 인증 파일이나 복제 registry는 만들지 않는다.

```diff
+## Mail connection reuse
+- Before installation/account rediscovery, read docs/intake/MAIL_CONNECTION_REUSE.md and the existing aiops docs/aiknowhow/메일읽기.md / 메일보내기.md.
+- Keep credential values in their existing protected stores; this section contains references only.
+- Confirmed profile identity (2026-09-15): alias=teamjpk-workspace; address=pyh@teamjpk.com; provider=Google; profile_ref=%USERPROFILE%/.config/gws; tool=gws; read_scope=observed; send_scope=observed; read/send operation=not tested; send_authorized=false.
+- Existing SMTP route for that same address: tool=C:/dev/mailtool/send_mail.py; credential_ref=existing GMAIL_ADDRESS/GMAIL_APP_PASSWORD environment; sender registration observed; send operation not tested. Do not create a second account record for this route.
+- Local-document candidate: alias=웰릭스 세일즈폰; local_label=업무폰 계정; address=01046403871w@gmail.com; provider=Google; purpose=mydata receiving/Contacts; credential/profile_ref=unverified; login/read/send=not tested; evidence=sales docs/GITHUB-MAIL-AUTOMATION.md:6,9 and docs/서버-마이데이터-등록-매뉴얼.md:3,10,12 (reported by sales reviewer). Do not infer sending capability.
+- No default sender. Other accounts require confirmed identity/profile references; AI login addresses are not evidence of mail registration.
```

`teamjpk-workspace`는 제안 별칭이며 아직 등록된 정본 키가 아니다. 통합 시 계정 별칭→주소→provider→기존 credential/profile 참조→읽기/발송 지원→확인 시각/근거를 한 곳에서 관리하고, 다른 세션은 그 포인터와 최신 관찰을 사용한다. 자격증명 자체를 worktree/서버/Git으로 옮기지 않는다. 서로 다른 PC/서버의 동일 별칭은 해당 호스트 연결이 확인돼야 재사용할 수 있다.

## 검증과 남은 범위

`node --test test/mail-connection-status.test.mjs`: 임시 fixture에서 기본 무인증 모드, scope/발송 구분, 비밀 필드/오류 제거, 암호 getter 미접근, 프로필별 환경 격리, 동일 계정 중복 집계 방지, 잘못된 metadata/실패/경로 없음/버전 모호성 검증. 실제 `--check-auth`도 지정 세 프로필에서 메타데이터만 확인했다. 실제 읽기/발송·SMTP 유효성·전체 계정 목록·공통 SSOT 소비 경로는 검증하지 않았다. 이 가역 구현은 반복 설치 전 점검 수단이며 모든 세션에 등록이 완료됐다는 선언이 아니다.

개발통합 담당의 읽기 전용 코드 검토: 비밀/오류 원문 출력 및 설치/login/send 호출 경로를 발견하지 못했고, scope와 실제 작업/승인 분리에 동의했다. 주소 집계의 의미와 실행파일 신뢰 경계에 대한 지적을 위에 반영했다. 검토자는 초기 9개 테스트 소스를 확인했으며 직접 실행/실계정 조회는 하지 않았다. 마지막 경로 권한 오류 회귀를 포함한 10개 테스트 실행은 이 담당의 검증 결과다.
